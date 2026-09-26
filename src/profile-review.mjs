import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { matchRequirement } from './matching.mjs';
import { canonical, catalog, members } from './tag-catalog.mjs';

const groups = ['requirements', 'preferred', 'stack'];
const groupOrder = new Map(groups.map((group, index) => [group, index]));
const allowedValues = definition => definition.profileMode === 'presence'
  ? ['none', 'present']
  : ['none', 'basic', 'independent', 'advanced'];
const active = job => ['new', 'interesting'].includes(job.status)
  && job.availability?.status !== 'closed'
  && !job.application
  && job.processingStatus === 'processed'
  && job.summary?.facts;
const scoreOf = job => Number.isFinite(job.rating?.total) ? job.rating.total : null;
const validTimestamp = value => typeof value === 'string'
  && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString() === value;

function fact(key, profile, pending) {
  const definition = catalog.tags[key];
  return { key, label: definition.label, mode: definition.profileMode, value: profile.tags?.[key] ?? null, pending };
}

function jobSummary(job, occurrence) {
  return {
    id: job.id,
    reference: job.reference,
    title: job.title,
    company: job.company,
    score: scoreOf(job),
    groups: [...occurrence.groups].sort((a, b) => groupOrder.get(a) - groupOrder.get(b)),
    quotes: [...occurrence.quotes],
  };
}

export function profileReview(jobs, profile) {
  const eligible = jobs.filter(active);
  const pendingKeys = new Set();
  const occurrences = new Map();
  const families = [];
  const unmappedJobs = new Set();

  const record = (key, job, group, quote) => {
    pendingKeys.add(key);
    if (!occurrences.has(key)) occurrences.set(key, new Map());
    const byJob = occurrences.get(key);
    if (!byJob.has(job.id)) byJob.set(job.id, { job, groups: new Set(), quotes: new Set() });
    const occurrence = byJob.get(job.id);
    occurrence.groups.add(group);
    if (quote) occurrence.quotes.add(quote);
  };

  for (const job of eligible) {
    for (const group of groups) {
      for (const criterion of job.summary.facts[group] || []) {
        if (criterion.kind === 'unknown') { unmappedJobs.add(job.id); continue; }
        if (criterion.kind !== 'tag') continue;
        const assessment = matchRequirement(criterion, profile, undefined, { stack: group === 'stack' });
        if (assessment.assessment !== 'unknown') continue;
        for (const alternative of criterion.alternatives.map(canonical)) {
          const definition = catalog.tags[alternative];
          if (!definition) continue;
          if (definition.members?.length) {
            const missing = members(alternative).filter(key => profile.tags?.[key] === undefined);
            if (missing.length) families.push({ key: alternative, missing });
            for (const key of missing) record(key, job, group, criterion.evidence);
          } else if (profile.tags?.[alternative] === undefined) record(alternative, job, group, criterion.evidence);
        }
      }
    }
  }

  const parent = new Map([...pendingKeys].map(key => [key, key]));
  const find = key => {
    let value = key;
    while (parent.get(value) !== value) value = parent.get(value);
    let current = key;
    while (parent.get(current) !== value) { const next = parent.get(current); parent.set(current, value); current = next; }
    return value;
  };
  const union = (a, b) => { const left = find(a), right = find(b); if (left !== right) parent.set(right, left); };
  for (const family of families) for (const key of family.missing.slice(1)) union(family.missing[0], key);

  const components = new Map();
  for (const key of pendingKeys) {
    const root = find(key);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(key);
  }

  const items = [...components.values()].map(keys => {
    keys.sort();
    const familyKeys = [...new Set(families.filter(family => family.missing.some(key => keys.includes(key))).map(family => family.key))];
    const contextKeys = familyKeys.flatMap(members).filter(key => profile.tags?.[key] !== undefined);
    const itemFacts = [...new Set([...keys, ...contextKeys])]
      .map(key => fact(key, profile, pendingKeys.has(key)))
      .sort((a, b) => Number(b.pending) - Number(a.pending) || a.label.localeCompare(b.label));
    const byJob = new Map();
    for (const key of keys) for (const [jobId, occurrence] of occurrences.get(key) || []) {
      if (!byJob.has(jobId)) byJob.set(jobId, { job: occurrence.job, groups: new Set(), quotes: new Set() });
      const aggregate = byJob.get(jobId);
      for (const group of occurrence.groups) aggregate.groups.add(group);
      for (const quote of occurrence.quotes) aggregate.quotes.add(quote);
    }
    const affectedJobs = [...byJob.values()].map(({ job, ...occurrence }) => jobSummary(job, occurrence))
      .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.reference.localeCompare(b.reference));
    const label = familyKeys.includes('compiled-language') && familyKeys.includes('server-side-language')
      ? 'Server-side and compiled languages'
      : familyKeys.length
        ? familyKeys.map(key => catalog.tags[key].label).join(' and ')
        : catalog.tags[keys[0]].label;
    return {
      id: familyKeys.length ? `family:${familyKeys.sort().join('+')}` : `fact:${keys[0]}`,
      label,
      type: familyKeys.length ? 'family' : 'fact',
      activeJobCount: affectedJobs.length,
      bestScore: affectedJobs[0]?.score ?? null,
      facts: itemFacts,
      jobs: affectedJobs,
    };
  }).sort((a, b) => b.activeJobCount - a.activeJobCount
    || (b.bestScore ?? -Infinity) - (a.bestScore ?? -Infinity)
    || a.label.localeCompare(b.label));

  const allKeys = new Set(Object.keys(profile.tags || {}));
  const allFacts = [...allKeys].map(key => {
    const byJob = occurrences.get(key);
    const scores = [...(byJob?.values() || [])].map(item => scoreOf(item.job)).filter(Number.isFinite);
    return {
      ...fact(key, profile, pendingKeys.has(key)),
      updatedAt: profile.tagUpdatedAt?.[key] ?? profile.tagUpdatedAtDefault ?? null,
      activeJobCount: byJob?.size ?? 0,
      bestScore: scores.length ? Math.max(...scores) : null,
    };
  }).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.label.localeCompare(b.label));

  return { pendingCount: pendingKeys.size, activeUnmappedJobs: unmappedJobs.size, items, allFacts };
}

export function validateProfile(profile) {
  if (!profile || profile.schemaVersion !== 2 || !profile.tags || typeof profile.tags !== 'object' || Array.isArray(profile.tags)) throw new Error('Invalid profile');
  for (const [key, value] of Object.entries(profile.tags)) {
    const definition = catalog.tags[key];
    if (!definition || !allowedValues(definition).includes(value)) throw new Error(`Invalid profile value for ${key}`);
  }
  if (profile.tagUpdatedAtDefault !== undefined && !validTimestamp(profile.tagUpdatedAtDefault)) throw new Error('Invalid default profile update time');
  if (profile.tagUpdatedAt !== undefined) {
    if (!profile.tagUpdatedAt || typeof profile.tagUpdatedAt !== 'object' || Array.isArray(profile.tagUpdatedAt)) throw new Error('Invalid profile update history');
    for (const [key, value] of Object.entries(profile.tagUpdatedAt)) {
      if (!Object.hasOwn(profile.tags, key) || !validTimestamp(value)) throw new Error(`Invalid profile update time for ${key}`);
    }
  }
  return profile;
}

export class ProfileStore {
  constructor(root) { this.file = path.join(root, 'profile/matching.json'); this.pending = Promise.resolve(); }
  async read() { return validateProfile(JSON.parse(await readFile(this.file, 'utf8'))); }
  update(changes) {
    const operation = this.pending.then(async () => {
      if (!Array.isArray(changes) || !changes.length || changes.length > 100) throw new Error('Invalid profile changes');
      const keys = new Set();
      for (const change of changes) {
        const definition = change && catalog.tags[change.key];
        if (!definition || keys.has(change.key) || !allowedValues(definition).includes(change.value)) throw new Error(`Invalid profile value for ${change?.key || 'unknown tag'}`);
        keys.add(change.key);
      }
      const profile = structuredClone(await this.read());
      profile.tagUpdatedAt ??= {};
      const updatedAt = new Date().toISOString();
      for (const { key, value } of changes) {
        profile.tags[key] = value;
        profile.tagUpdatedAt[key] = updatedAt;
      }
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await mkdir(path.dirname(this.file), { recursive: true });
      try {
        await writeFile(temporary, JSON.stringify(profile, null, 2) + '\n', { mode: 0o600 });
        await rename(temporary, this.file);
      } catch (error) {
        await rm(temporary, { force: true });
        throw error;
      }
      return profile;
    });
    this.pending = operation.catch(() => {});
    return operation;
  }
}
