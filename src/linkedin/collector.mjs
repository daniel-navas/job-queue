import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, request } from 'playwright-core';
import { normalizeCaptures, readStoredJobs } from '../queue.mjs';
import { normalizeSearch } from '../searches.mjs';
import { pageGateReason, securityResponseReason, verifyCaptureHealth } from './extract.mjs';
import { loadConnection, saveConnection, invalidateConnection } from './connection.mjs';
import { fetchObservedDetail, fetchObservedSearch, observedDetailTemplate, observedSearchTemplate, searchUrlFromTemplate } from './transport.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const isLoginPage = url => /\/login|\/checkpoint\/lg\/login/i.test(url);
const reconnect = 'Connect LinkedIn again explicitly; ordinary discovery will not open Chrome.';

function renewedConnection(connection, storageState) {
  const session = storageState.cookies?.find(cookie => cookie.name === 'JSESSIONID' && /(^|\.)linkedin\.com$/.test(cookie.domain ?? ''));
  const csrf = session?.value?.replace(/^"|"$/g, '');
  const update = template => ({ ...template, headers: csrf ? { ...template.headers, 'csrf-token': csrf } : template.headers });
  return { ...connection, storageState, searchTemplate: update(connection.searchTemplate), detailTemplate: update(connection.detailTemplate) };
}

export async function connectionStatus(root) {
  try { await loadConnection(root); return { connected: true }; }
  catch (error) { return { connected: false, reason: error.message }; }
}

// This is the only browser entry point used by the managed finder. It is
// invoked explicitly by the owner, never as a search failure fallback.
export async function connectLinkedIn(root, searches, progress = () => {}, options = {}) {
  const selected = searches.filter(search => search.enabled).map(normalizeSearch);
  if (!selected.length) throw new Error('Enable a LinkedIn search before connecting.');
  const profileDirectory = path.join(root, '.local/linkedin-profile');
  await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
  const browser = await (options.browserFactory ?? ((directory, settings) => chromium.launchPersistentContext(directory, settings)))(profileDirectory, {
    executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, viewport: { width: 1440, height: 1000 },
  });
  const page = browser.pages()[0] ?? await browser.newPage();
  const pending = new Set();
  let searchTemplate = null, detailTemplate = null, firstJobId = null, stopReason = null;
  const ensureAllowed = async () => {
    stopReason = pageGateReason({ url: page.url(), title: await page.title() }) ?? stopReason;
    if (stopReason) throw new Error(stopReason);
  };
  browser.on('response', response => {
    const operation = (async () => {
      const url = response.url(), status = response.status();
      stopReason = securityResponseReason({ url, status }) ?? stopReason;
      if (status !== 200 || !url.startsWith('https://www.linkedin.com/')) return;
      if (!observedSearchTemplate(url) && !observedDetailTemplate(url)) return;
      const contentType = response.headers()['content-type'] ?? '';
      if (!contentType.toLowerCase().includes('json')) return;
      let body, payload;
      try { body = await response.text(); payload = JSON.parse(body); } catch { return; }
      stopReason = securityResponseReason({ url, status, contentType, body }) ?? stopReason;
      if (stopReason) return;
      const headers = await response.request().allHeaders();
      const candidateSearch = observedSearchTemplate(url, headers);
      const matchingCriteria = candidateSearch && new URL(searchUrlFromTemplate(candidateSearch, selected[0],
        Number(new URL(url).searchParams.get('start')))).searchParams.get('query') === new URL(url).searchParams.get('query');
      if (candidateSearch && payload?.data?.metadata?.keywords === selected[0].query
        && matchingCriteria && payload?.data?.paging && Array.isArray(payload.included)) {
        searchTemplate = candidateSearch;
        firstJobId ??= payload.included.find(item => item?.$type?.endsWith('.JobPostingCard') && /JOBS_SEARCH/.test(item.entityUrn ?? ''))?.entityUrn.match(/jobPostingCard:\((\d+)/)?.[1];
      }
      const candidateDetail = observedDetailTemplate(url, headers);
      if (candidateDetail && payload?.included?.some(item => item?.entityUrn?.endsWith(`jobPosting:${candidateDetail.originalId}`)
        && item.description?.text?.trim().length >= 100)) detailTemplate = candidateDetail;
    })().catch(error => { stopReason = `LinkedIn connection capture failed: ${error.message}`; });
    pending.add(operation);
    operation.finally(() => pending.delete(operation));
  });
  const waitFor = async (predicate, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    do {
      // A never-ending unrelated network response must not suspend the deadline.
      await ensureAllowed();
      if (predicate()) return;
      if (Date.now() >= deadline) break;
      await pause(200);
    } while (true);
    throw new Error(`LinkedIn did not provide a usable private request template. ${reconnect}`);
  };
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: options.navigationTimeoutMs ?? 60_000 });
    if (isLoginPage(page.url())) {
      progress('Sign in to LinkedIn');
      await page.waitForURL(url => !isLoginPage(url.href), { timeout: options.loginWaitMs ?? 5 * 60_000 });
    }
    await ensureAllowed();
    progress('Learning LinkedIn search connection');
    await page.goto(selected[0].url, { waitUntil: 'domcontentloaded', timeout: options.navigationTimeoutMs ?? 60_000 });
    await waitFor(() => searchTemplate, options.searchReadyTimeoutMs ?? 15_000);
    if (!detailTemplate && firstJobId) {
      await ensureAllowed();
      await page.goto(`https://www.linkedin.com/jobs/view/${firstJobId}/`, { waitUntil: 'domcontentloaded', timeout: options.navigationTimeoutMs ?? 60_000 });
    }
    await waitFor(() => detailTemplate, options.detailReadyTimeoutMs ?? 8_000);
    const storageState = await browser.storageState();
    await saveConnection(root, { version: 1, connectedAt: new Date().toISOString(), storageState, searchTemplate, detailTemplate });
    await loadConnection(root);
    return { connected: true };
  } finally { await browser.close(); }
}

export async function createLinkedInCollector(root, _progress = () => {}, options = {}) {
  let connection = await loadConnection(root);
  const http = await (options.requestFactory ?? (state => request.newContext({ storageState: state.storageState })))(connection);
  const pageLimit = Math.min(options.pageLimit ?? 2, 2);
  const detailLimit = Math.min(options.detailLimit ?? 5, 5);
  return {
    async collect(value, runId) {
      if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error('Invalid run ID');
      const search = normalizeSearch(value);
      const captureDirectory = path.join(root, '.local/linkedin-captures', `${new Date().toISOString().replace(/[:.]/g, '-')}-${runId}`);
      const output = path.join(root, 'data/search-runs', `${runId}.json`);
      await Promise.all([mkdir(captureDirectory, { recursive: true }), mkdir(path.dirname(output), { recursive: true })]);
      const run = { sequence: 0, payloads: [], capturedResponses: [], discoveredJobIds: new Set(), searchJobIds: new Set(),
        visibleJobs: [], stored: [], effectiveUrl: null, completed: false };
      const savePayload = async (capture, method) => {
        const file = path.join(captureDirectory, `${String(++run.sequence).padStart(3, '0')}.json`);
        await writeFile(file, capture.body, 'utf8');
        run.payloads.push(capture.payload);
        for (const id of capture.ids ?? []) run.discoveredJobIds.add(id);
        run.capturedResponses.push({ capturedAt: new Date().toISOString(), url: capture.url, status: capture.status,
          contentType: capture.contentType, method, byteLength: Buffer.byteLength(capture.body),
          jobIds: capture.ids ?? [], localCapture: path.relative(root, file) });
      };
      try {
        run.stored = await readStoredJobs(root);
        let attemptedPages = 0, start = 0;
        for (let pageIndex = 0; pageIndex < pageLimit; pageIndex++) {
          const found = await fetchObservedSearch(http, connection.searchTemplate, search, start);
          attemptedPages++;
          run.effectiveUrl = found.url;
          for (const id of found.ids) run.searchJobIds.add(id);
          await savePayload(found, 'observed-http-search');
          if (found.explicitEmpty || start + found.count >= found.total || !found.ids.length) break;
          if (found.count <= 0) throw new Error('LinkedIn search pagination is invalid. Connect LinkedIn again.');
          start += found.count;
        }
        verifyCaptureHealth({ observed: run.searchJobIds.size, explicitEmpty: attemptedPages > 0 && run.searchJobIds.size === 0,
          attempted: 0, completed: 0 });
        const complete = new Set([...run.stored.filter(job => job.description?.trim()), ...normalizeCaptures(run.payloads)].map(job => job.id));
        const targets = [...run.searchJobIds].filter(id => !complete.has(id)).slice(0, detailLimit);
        for (const id of targets) {
          const detail = await fetchObservedDetail(http, connection.detailTemplate, id);
          if (detail) await savePayload({ ...detail, ids: [id] }, 'observed-http-detail');
        }
        const completed = normalizeCaptures(run.payloads, run.stored).filter(job => targets.includes(job.id)).length;
        if (targets.length && completed === 0) throw new Error('LinkedIn detail template returned no complete descriptions. Connect LinkedIn again.');
        verifyCaptureHealth({ observed: run.searchJobIds.size, explicitEmpty: run.searchJobIds.size === 0,
          attempted: targets.length, completed });
        run.completed = true;
      } catch (error) {
        if (/template is stale|metadata does not match|membership is unrecognized|Connect LinkedIn again/i.test(error.message)) {
          await invalidateConnection(root, connection);
        }
        throw error;
      } finally {
        // APIRequestContext receives Set-Cookie updates independently of Chrome.
        // Never replace a valid saved session with an empty/expired state.
        try {
          const storageState = await http.storageState();
          const live = storageState.cookies?.some(cookie => cookie.name === 'li_at' && (cookie.expires <= 0 || cookie.expires > Date.now() / 1000));
          if (live && run.completed) {
            connection = renewedConnection(connection, storageState);
            await saveConnection(root, connection);
          }
        } catch { /* preserve the prior connection; the run result remains authoritative */ }
        await writeFile(`${output}.tmp`, JSON.stringify({
          runId, search, status: run.completed ? 'complete' : 'interrupted', effectiveUrl: run.effectiveUrl,
          searchJobIds: [...run.searchJobIds], capturedAt: new Date().toISOString(), source: 'linkedin', searchUrl: search.url,
          network: { candidateResponses: run.capturedResponses, jobIds: [...run.discoveredJobIds] },
          visibleJobs: run.visibleJobs, completeCount: normalizeCaptures(run.payloads, run.stored).length,
        }, null, 2) + '\n');
        await rename(`${output}.tmp`, output);
      }
    },
    async close() { await http.dispose(); },
  };
}
