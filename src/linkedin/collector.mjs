import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { normalizeCaptures } from '../queue.mjs';
import { normalizeSearch } from '../searches.mjs';
import { readJobDescription } from './description.mjs';
import { extractJobIds, isLikelyJobResponse, normalizeJobUrl, pageGateReason, securityResponseReason, verifyCaptureHealth, waitForSearchReadiness } from './extract.mjs';
import { fetchObservedDetail, observedDetailTemplate } from './transport.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const isLoginPage = url => /\/login|\/checkpoint\/lg\/login/i.test(url);

export async function createLinkedInCollector(root, progress = () => {}, options = {}) {
  const profileDirectory = path.join(root, '.local/linkedin-profile');
  await mkdir(profileDirectory, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDirectory, {
    executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    viewport: { width: 1440, height: 1000 },
  });
  const page = context.pages()[0] ?? await context.newPage();
  const pending = new Set();
  const requestPhases = new WeakMap();
  let active = null;
  let phase = 'idle';
  let stopReason = null;
  let detailTemplate = null;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 60_000;
  const searchReadyTimeoutMs = options.searchReadyTimeoutMs ?? 15_000;
  const detailReadyTimeoutMs = options.detailReadyTimeoutMs ?? 8_000;
  const detailLimit = Math.min(options.detailLimit ?? 5, 5);

  const ensureAllowed = async () => {
    if (stopReason) throw new Error(stopReason);
    stopReason = pageGateReason({ url: page.url(), title: await page.title() }) ?? stopReason;
    if (stopReason) throw new Error(stopReason);
  };
  const drain = async () => { while (pending.size) await Promise.all([...pending]); };
  const savePayload = async (run, payload, body, response) => {
    run.sequence += 1;
    const file = path.join(run.captureDirectory, `${String(run.sequence).padStart(3, '0')}.json`);
    await writeFile(file, body, 'utf8');
    run.payloads.push(payload);
    const ids = extractJobIds(body);
    for (const id of ids) run.discoveredJobIds.add(id);
    run.capturedResponses.push({
      capturedAt: new Date().toISOString(), url: response.url, status: response.status,
      contentType: response.contentType, method: response.method,
      byteLength: Buffer.byteLength(body), jobIds: ids,
      localCapture: path.relative(root, file),
    });
  };

  context.on('request', request => requestPhases.set(request, { phase, run: active }));
  context.on('response', response => {
    const operation = (async () => {
      const url = response.url();
      const status = response.status();
      if (active || status === 429) stopReason = securityResponseReason({ url, status }) ?? stopReason;
      const requestState = requestPhases.get(response.request());
      const run = requestState?.run;
      if (!run || !['search', 'detail'].includes(requestState.phase)) return;
      const contentType = response.headers()['content-type'] ?? '';
      if (status !== 200 || !isLikelyJobResponse({ url, contentType })) return;
      let body, payload;
      try { body = await response.text(); payload = JSON.parse(body); }
      catch { return; }
      stopReason = securityResponseReason({ url, status, contentType, body }) ?? stopReason;
      if (stopReason) return;
      if (requestState.phase === 'search') {
        for (const item of payload.included ?? []) {
          if (item.$type?.endsWith('.JobPostingCard') && /JOBS_SEARCH/.test(item.entityUrn ?? '')) {
            const id = item.entityUrn.match(/jobPostingCard:\(?(\d+)/)?.[1];
            if (id) run.searchJobIds.add(id);
          }
        }
      }
      const candidate = observedDetailTemplate(url);
      if (candidate && (payload.included ?? []).some(item =>
        item.entityUrn?.endsWith(`jobPosting:${candidate.originalId}`) && item.description?.text?.length >= 100)) {
        const headers = await response.request().allHeaders();
        detailTemplate = observedDetailTemplate(url, headers);
      }
      const ids = extractJobIds(body);
      if (!ids.length && !body.toLowerCase().includes('jobposting')) return;
      await savePayload(run, payload, body, { url, status, contentType, method: 'browser-network' });
    })().catch(error => { stopReason = `LinkedIn capture failed: ${error.message}`; });
    pending.add(operation);
    operation.then(() => pending.delete(operation));
  });

  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
    if (stopReason) throw new Error(stopReason);
    if (/\/checkpoint\/|\/challenge\/|captcha/i.test(page.url())) throw new Error('LinkedIn security challenge; stopped.');
    if (isLoginPage(page.url())) {
      progress('Sign in to LinkedIn');
      await page.waitForURL(url => !isLoginPage(url.href), { timeout: options.loginWaitMs ?? 5 * 60_000 });
    }
    await ensureAllowed();
  } catch (error) { await context.close(); throw error; }

  return {
    async collect(value, runId) {
      if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error('Invalid run ID');
      const search = normalizeSearch(value);
      const captureDirectory = path.join(root, '.local/linkedin-captures', `${new Date().toISOString().replace(/[:.]/g, '-')}-${runId}`);
      const output = path.join(root, 'data/search-runs', `${runId}.json`);
      await Promise.all([mkdir(captureDirectory, { recursive: true }), mkdir(path.dirname(output), { recursive: true })]);
      const run = {
        captureDirectory, sequence: 0, payloads: [], capturedResponses: [],
        discoveredJobIds: new Set(), searchJobIds: new Set(), visibleJobs: [],
        stored: [], effectiveUrl: null, completed: false,
      };
      active = run;
      try {
        await ensureAllowed();
        phase = 'search';
        await page.goto(search.url, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
        const readiness = await waitForSearchReadiness({
          drain, ensureAllowed, timeoutMs: searchReadyTimeoutMs,
          inspect: async () => {
            run.visibleJobs = await collectVisibleJobs(page);
            return { observed: run.searchJobIds.size, visible: run.visibleJobs.length,
              explicitEmpty: await page.getByText(/^(No matching jobs found|No results found|No jobs found|No se encontraron (empleos|resultados))/i).first().isVisible().catch(() => false) };
          },
        });
        const explicitEmpty = readiness.explicitEmpty;
        await drain();
        await ensureAllowed();
        run.effectiveUrl = page.url();
        for (const job of run.visibleJobs) { run.discoveredJobIds.add(job.id); run.searchJobIds.add(job.id); }
        verifyCaptureHealth({ observed: run.searchJobIds.size, explicitEmpty, attempted: 0, completed: 0 });
        phase = 'detail';
        try { run.stored = JSON.parse(await readFile(path.join(root, 'data/queue.json'), 'utf8')).jobs; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const complete = new Set([...run.stored.filter(job => job.description?.trim()), ...normalizeCaptures(run.payloads)].map(job => job.id));
        const targets = [...run.searchJobIds].filter(id => !complete.has(id)).slice(0, detailLimit);
        for (const id of targets) {
          await ensureAllowed();
          if (detailTemplate) {
            const detail = await fetchObservedDetail(context.request, detailTemplate, id);
            if (detail) await savePayload(run, detail.payload, detail.body, { ...detail, method: 'observed-http-detail' });
          }
          if (!normalizeCaptures(run.payloads, run.stored).some(job => job.id === id)) {
            // A browser response can report a block while the HTTP request is
            // in flight. Never start fallback navigation after that signal.
            await ensureAllowed();
            await page.goto(`https://www.linkedin.com/jobs/view/${id}/`, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
            const detailDeadline = Date.now() + detailReadyTimeoutMs;
            do {
              await drain();
              await ensureAllowed();
              if (normalizeCaptures(run.payloads, run.stored).some(job => job.id === id)) break;
              const description = await readJobDescription(page, id);
              if (description) {
                const payload = { included: [{ $type: 'com.linkedin.voyager.dash.jobs.JobPosting', entityUrn: `urn:li:fsd_jobPosting:${id}`, description: { text: description } }] };
                await savePayload(run, payload, JSON.stringify(payload), { url: page.url(), status: 200, contentType: 'application/json', method: 'description-dom' });
                break;
              }
              await pause(200);
            } while (Date.now() < detailDeadline);
          }
        }
        await drain();
        await ensureAllowed();
        verifyCaptureHealth({ observed: run.searchJobIds.size, explicitEmpty, attempted: targets.length,
          completed: normalizeCaptures(run.payloads, run.stored).filter(job => targets.includes(job.id)).length });
        run.completed = true;
      } finally {
        phase = 'idle';
        await drain();
        await writeFile(`${output}.tmp`, JSON.stringify({
          runId, search, status: run.completed ? 'complete' : 'interrupted', effectiveUrl: run.effectiveUrl,
          searchJobIds: [...run.searchJobIds], capturedAt: new Date().toISOString(), source: 'linkedin', searchUrl: search.url,
          network: { candidateResponses: run.capturedResponses, jobIds: [...run.discoveredJobIds] },
          visibleJobs: run.visibleJobs, completeCount: normalizeCaptures(run.payloads, run.stored).length,
        }, null, 2) + '\n');
        await rename(`${output}.tmp`, output);
        active = null;
      }
    },
    async close() { await context.close(); },
  };
}

async function collectVisibleJobs(page) {
  const candidates = await page.locator('.jobs-search-results-list a[href*="/jobs/view/"], .scaffold-layout__list a[href*="/jobs/view/"], [data-view-name="job-card"] a[href*="/jobs/view/"]').evaluateAll(anchors =>
    anchors.map(anchor => ({ href: anchor.href, text: anchor.textContent?.replace(/\s+/g, ' ').trim() ?? '' })));
  const jobs = new Map();
  for (const candidate of candidates) {
    const url = normalizeJobUrl(candidate.href);
    if (!url) continue;
    const id = url.match(/\/jobs\/view\/(\d+)\//)?.[1];
    if (id && !jobs.has(id)) jobs.set(id, { id, url, title: candidate.text || null });
  }
  return [...jobs.values()];
}
