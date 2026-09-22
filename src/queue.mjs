import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { discoveriesFor } from './searches.mjs';
import { beginWrite, commitWrite, openStorage, storageState, storeState } from './queue-storage.mjs';
import { changeApplication } from './application-tracker.mjs';
export { backupQueue, readStoredJobs } from './queue-storage.mjs';

const text = value => (typeof value === 'string' ? value : value?.text)?.trim() || null;
const reviewStatuses = ['new', 'interesting', 'dismissed'];

function reviewBeforeDismissal(job) {
  const history = job.history ?? [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const status = history[index]?.status;
    if (status === 'new' || status === 'interesting') return status;
  }
  return 'new';
}

function normalizeTrackerState(job) {
  let changed = false;
  if (job.status === 'dismissed' && !['new', 'interesting'].includes(job.reviewStatusBeforeDismissal)) {
    job.reviewStatusBeforeDismissal = reviewBeforeDismissal(job);
    changed = true;
  }
  if (job.application && !job.application.previousReview) {
    job.application.previousReview = { status: reviewStatuses.includes(job.status) ? job.status : 'new', reason: job.reason ?? '' };
    if (job.status !== 'interesting' || job.reason) {
      job.status = 'interesting';
      job.reason = '';
      (job.history ??= []).push({ status: 'interesting', reason: '', at: new Date().toISOString() });
    }
    changed = true;
  }
  return changed;
}

export function normalizeCaptures(payloads, metadata = []) {
  // Legacy search-card metadata can hydrate a detail-only response. Never seed
  // descriptions here: only descriptions received in this capture are imported.
  const jobs = new Map(metadata.map(({ id, title, company, location, publishedAt, source, url }) => [id, { id, title, company, location, publishedAt, source, url }]));
  for (const payload of payloads) {
    for (const item of payload.included ?? []) {
      const card = item.$type?.endsWith('.JobPostingCard');
      if (!card && !item.$type?.endsWith('.JobPosting')) continue;
      const id = item.entityUrn?.match(/jobPosting(?:Card)?:\(?(\d+)/)?.[1];
      if (!id) continue;
      const previous = jobs.get(id) ?? { id, source: 'linkedin', url: `https://www.linkedin.com/jobs/view/${id}/` };
      const fields = {
        title: text(item.jobPostingTitle) || text(item.title),
        company: card ? text(item.primaryDescription) : null,
        location: card ? text(item.secondaryDescription) : null,
        description: text(item.description),
        publishedAt: item.footerItems?.find(i => i.type === 'LISTED_DATE')?.timeAt,
      };
      for (const [key, value] of Object.entries(fields)) if (value) previous[key] = value;
      jobs.set(id, previous);
    }
  }
  return [...jobs.values()].filter(job => job.title && job.description);
}

export function mergeJobs(existing, incoming, capturedAt, searchUrl, search = null) {
  const jobs = new Map(existing.map(job => [job.id, job]));
  for (const job of incoming) {
    const old = jobs.get(job.id);
    const discoveries = structuredClone(discoveriesFor(old ?? {}));
    if (search) {
      const origin = discoveries.find(d => d.search.id === search.id && d.search.provider === search.provider && d.search.revision === search.revision);
      if (origin) origin.lastSeen = capturedAt;
      else discoveries.push({ search: structuredClone(search), firstSeen: capturedAt, lastSeen: capturedAt });
    }
    jobs.set(job.id, { ...old, ...job, firstSeen: old?.firstSeen ?? capturedAt,
      lastSeen: capturedAt, searchUrl: old?.searchUrl ?? searchUrl, discoveries, status: old?.status ?? 'new',
      reason: old?.reason ?? '', history: old?.history ?? [] });
  }
  return [...jobs.values()];
}

export class Queue {
  constructor(root) { this.root = root; this.file = path.join(root, 'data/queue.json'); this.state = { jobs: [], importedAt: null }; this.pending = Promise.resolve(); }
  async load() {
    const db = await openStorage(this.root, this.state);
    try { this.state = storageState(db); } finally { db.close(); }
    if (this.state.jobs.some(job => normalizeTrackerState(structuredClone(job)))) {
      await this.mutate(() => { for (const job of this.state.jobs) normalizeTrackerState(job); });
    }
  }
  async save() {
    const db = await openStorage(this.root, this.state);
    try {
      await beginWrite(db);
      try { storeState(db, this.state); await commitWrite(db); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    } finally { db.close(); }
  }
  mutate(fn) {
    const operation = this.pending.then(async () => {
      const db = await openStorage(this.root, this.state);
      try {
        await beginWrite(db);
        const before = storageState(db);
        this.state = structuredClone(before);
        try {
          const result = fn();
          const resolved = result && typeof result.then === 'function' ? await result : result;
          storeState(db, this.state);
          await commitWrite(db);
          return resolved;
        } catch (error) {
          db.exec('ROLLBACK');
          this.state = before;
          throw error;
        }
      } finally { db.close(); }
    });
    this.pending = operation.catch(() => {});
    return operation;
  }
  async importCapture(manifest = path.join(this.root, 'data/linkedin-poc.json'), expectedRunId = null) {
    const capture = JSON.parse(await readFile(manifest, 'utf8'));
    if (expectedRunId && capture.runId !== expectedRunId) throw new Error('Capture run does not match the current search');
    const payloads = await Promise.all(capture.network.candidateResponses.map(async response => {
      const file = path.resolve(this.root, response.localCapture);
      if (!file.startsWith(path.join(this.root, '.local/linkedin-captures/'))) throw new Error('Invalid capture path');
      return JSON.parse(await readFile(file, 'utf8'));
    }));
    return this.mutate(() => {
      if (capture.runId && this.state.searchRuns?.some(run => run.id === capture.runId)) return { captured: 0, added: 0 };
      let incoming = normalizeCaptures(payloads, this.state.jobs);
      if (capture.search) {
        // Discovery is established on the search page, never from detail-page
        // recommendations or a feed response containing an incidental job ID.
        const discovered = new Set(capture.searchJobIds ?? []);
        const fresh = new Map(incoming.filter(job => discovered.has(job.id)).map(job => [job.id, job]));
        for (const old of this.state.jobs) if (discovered.has(old.id) && old.description?.trim() && !fresh.has(old.id)) fresh.set(old.id, { id: old.id });
        incoming = [...fresh.values()];
      }
      const added = incoming.filter(job => !this.state.jobs.some(old => old.id === job.id && old.description?.trim())).length;
      this.state.jobs = mergeJobs(this.state.jobs, incoming, capture.capturedAt, capture.searchUrl, capture.search);
      if (capture.runId && capture.search) {
        (this.state.searchRuns ??= []).push({ id: capture.runId, search: capture.search, capturedAt: capture.capturedAt,
          status: capture.status ?? 'complete', observed: new Set(capture.searchJobIds ?? []).size,
          captured: incoming.length, added, jobIds: incoming.map(job => job.id), effectiveUrl: capture.effectiveUrl ?? null });
      }
      this.state.importedAt = capture.capturedAt;
      this.state.searchUrl = capture.searchUrl;
      return { captured: incoming.length, added };
    });
  }
  recordFailedSearch(id, search, message) {
    return this.mutate(() => {
      if (!this.state.searchRuns?.some(run => run.id === id)) (this.state.searchRuns ??= []).push({ id, search, status: 'failed', capturedAt: new Date().toISOString(), observed: 0, captured: 0, added: 0, jobIds: [], message });
    });
  }
  review(id, status, reason) {
    if (!['new', 'interesting', 'dismissed'].includes(status) || typeof reason !== 'string' || reason.length > 2000) throw new Error('Invalid review');
    if (status === 'dismissed' && !reason.trim()) throw new Error('Please add a reason for dismissing this job.');
    return this.mutate(() => {
      const job = this.state.jobs.find(job => job.id === id);
      if (!job) throw new Error('Job not found');
      if (job.application && status !== 'interesting') throw new Error('Applied jobs must remain interested');
      if (status === 'dismissed' && job.status !== 'dismissed') job.reviewStatusBeforeDismissal = ['new', 'interesting'].includes(job.status) ? job.status : 'new';
      if (job.status === 'dismissed' && status !== 'dismissed') delete job.reviewStatusBeforeDismissal;
      job.status = status; job.reason = reason.trim();
      job.history.push({ status, reason: job.reason, at: new Date().toISOString() });
    });
  }
  setAvailability(id, status) {
    if (!['open', 'closed'].includes(status)) throw new Error('Invalid availability');
    return this.mutate(() => {
      const job = this.state.jobs.find(job => job.id === id);
      if (!job) throw new Error('Job not found');
      const availability = { status, checkedAt: new Date().toISOString(), source: 'manual' };
      job.availability = availability;
      (job.availabilityHistory ??= []).push(availability);
    });
  }
  updateApplication(id, change) {
    return this.mutate(() => {
      const job = this.state.jobs.find(job => job.id === id);
      if (!job) throw new Error('Job not found');
      const previousApplication = job.application;
      const previousReview = previousApplication?.previousReview;
      const application = changeApplication(job.application, change);
      if (application) {
        if (!previousApplication) {
          application.previousReview = { status: job.status, reason: job.reason ?? '' };
          job.status = 'interesting'; job.reason = '';
          job.history.push({ status: 'interesting', reason: '', at: new Date().toISOString() });
        }
        job.application = application;
      } else {
        delete job.application;
        if (previousReview && ['new', 'interesting', 'dismissed'].includes(previousReview.status)) {
          job.status = previousReview.status; job.reason = previousReview.reason ?? '';
          job.history.push({ status: job.status, reason: job.reason, at: new Date().toISOString() });
        }
      }
      return job.application ?? null;
    });
  }
}
