import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { EventEmitter } from 'node:events';
import { normalizeSearch } from '../src/searches.mjs';
import { observedSearchTemplate, searchUrlFromTemplate } from '../src/linkedin/transport.mjs';
import { saveConnection } from '../src/linkedin/connection.mjs';
import { connectLinkedIn, connectionStatus, createLinkedInCollector } from '../src/linkedin/collector.mjs';

const search = normalizeSearch({ id: 'backend', provider: 'linkedin', name: 'Backend', query: 'Node.js backend', location: 'Colombia', workplace: 'remote', datePosted: 'week', enabled: true });
const observedSearchUrl = 'https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards?decorationId=observed&count=25&q=jobSearch&query=(origin:JOB_SEARCH_PAGE_OTHER_ENTRY,keywords:backend%20engineer,locationUnion:(seoLocation:(location:Colombia)),selectedFilters:(timePostedRange:List(r2592000)),spellCorrectionEnabled:true)&servedEventEnabled=true&start=0';
const observedDetailUrl = 'https://www.linkedin.com/voyager/api/graphql?variables=(jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A123)&queryId=voyagerJobsDashJobPostings.observed';
const description = 'A complete source-backed job description. '.repeat(8);
const searchPayload = { data: { $type: 'com.linkedin.restli.common.CollectionResponse', metadata: { keywords: search.query }, paging: { start: 0, count: 25, total: 1 }, elements: [{}] }, included: [{ $type: 'com.linkedin.voyager.dash.jobs.JobPostingCard', entityUrn: 'urn:li:fsd_jobPostingCard:(123,JOBS_SEARCH)', jobPostingTitle: 'Backend Engineer', primaryDescription: 'Acme', secondaryDescription: 'Colombia' }] };
const detailPayload = { included: [{ $type: 'com.linkedin.voyager.dash.jobs.JobPosting', entityUrn: 'urn:li:fsd_jobPosting:123', title: 'Backend Engineer', description: { text: description } }] };

test('search replay preserves REST.li punctuation and applies all configured filters', () => {
  const template = observedSearchTemplate(observedSearchUrl, { accept: 'application/json', cookie: 'do-not-copy' });
  assert.ok(template);
  const url = searchUrlFromTemplate(template, search, 25);
  assert.match(url, /query=\(origin:/);
  assert.match(url, /keywords:Node\.js%20backend/);
  assert.match(url, /locationUnion:\(seoLocation:\(location:Colombia\)\)/);
  assert.match(url, /selectedFilters:\(timePostedRange:List\(r604800\),workplaceType:List\(2\)\)/);
  assert.equal(new URL(url).searchParams.get('start'), '25');
  assert.equal(new URL(url).searchParams.get('query')?.includes('workplaceType:List(2)'), true);
  assert.equal(template.headers.cookie, undefined);
  const boolean = searchUrlFromTemplate(template, { ...search, query: '(Node OR Python) backend' });
  assert.match(boolean, /keywords:%28Node%20OR%20Python%29%20backend,locationUnion:/);
});

test('saved connection is private and valid HTTP collection launches no Chrome', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-http-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await saveConnection(root, { version: 1, connectedAt: new Date().toISOString(), storageState: { cookies: [{ name: 'li_at', value: 'fake-test-only', domain: '.linkedin.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600 }], origins: [] }, searchTemplate: observedSearchTemplate(observedSearchUrl, { accept: 'application/json', 'csrf-token': 'ajax:old' }), detailTemplate: { url: observedDetailUrl, originalId: '123', headers: { accept: 'application/json', 'csrf-token': 'ajax:old' } } });
  assert.equal((await stat(path.join(root, '.local/linkedin-connection.json'))).mode & 0o777, 0o600);
  t.mock.method(chromium, 'launchPersistentContext', async () => { throw new Error('Chrome must not launch'); });
  const urls = [];
  const request = { async get(url) { urls.push(url); return { status: () => 200, headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(url.includes('JobCards') ? searchPayload : detailPayload) }; }, async storageState() { return { cookies: [{ name: 'li_at', value: 'updated-test-only', domain: '.linkedin.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600 }, { name: 'JSESSIONID', value: '"ajax:new"', domain: '.linkedin.com', path: '/', expires: -1 }], origins: [] }; }, async dispose() {} };
  const collector = await createLinkedInCollector(root, () => {}, { requestFactory: async () => request });
  try { await collector.collect(search, 'testrun'); }
  finally { await collector.close(); }
  assert.equal(urls.length, 2);
  assert.ok(urls[0].includes('voyagerJobsDashJobCards'));
  assert.ok(urls[1].includes('voyagerJobsDashJobPostings'));
  const manifest = JSON.parse(await readFile(path.join(root, 'data/search-runs/testrun.json'), 'utf8'));
  assert.equal(manifest.status, 'complete');
  assert.deepEqual(manifest.searchJobIds, ['123']);
  assert.equal(manifest.completeCount, 1);
  assert.equal(manifest.network.candidateResponses.length, 2);
  assert.equal((await connectionStatus(root)).connected, true);
  assert.equal((await readFile(path.join(root, '.local/linkedin-connection.json'), 'utf8')).includes('updated-test-only'), true);
  const renewedRequest = { async get(url, options) { const authorized = options.headers['csrf-token'] === 'ajax:new'; return { status: () => authorized ? 200 : 403, headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(url.includes('JobCards') ? searchPayload : detailPayload) }; }, async storageState() { return request.storageState(); }, async dispose() {} };
  const renewedCollector = await createLinkedInCollector(root, () => {}, { requestFactory: async () => renewedRequest });
  try { await renewedCollector.collect(search, 'renewed'); }
  finally { await renewedCollector.close(); }
});

test('missing or expired connection requests explicit reconnect, never browser', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-http-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.mock.method(chromium, 'launchPersistentContext', async () => { throw new Error('Chrome must not launch'); });
  assert.equal((await connectionStatus(root)).connected, false);
  await assert.rejects(createLinkedInCollector(root), /Connect LinkedIn/i);
  await saveConnection(root, { version: 1, connectedAt: new Date().toISOString(), storageState: { cookies: [{ name: 'li_at', value: 'expired', domain: '.linkedin.com', path: '/', expires: 1 }], origins: [] }, searchTemplate: observedSearchTemplate(observedSearchUrl), detailTemplate: { url: observedDetailUrl, originalId: '123', headers: {} } });
  assert.equal((await connectionStatus(root)).connected, false);
  await assert.rejects(createLinkedInCollector(root), /Connect LinkedIn/i);
});

test('security stop interrupts capture and does not request a detail', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-http-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await saveConnection(root, { version: 1, connectedAt: new Date().toISOString(), storageState: { cookies: [{ name: 'li_at', value: 'fake', domain: '.linkedin.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600 }], origins: [] }, searchTemplate: observedSearchTemplate(observedSearchUrl), detailTemplate: { url: observedDetailUrl, originalId: '123', headers: {} } });
  let calls = 0;
  const request = { async get() { calls++; return { status: () => 429, headers: () => ({}), text: async () => '' }; }, async storageState() { return { cookies: [] }; }, async dispose() {} };
  const collector = await createLinkedInCollector(root, () => {}, { requestFactory: async () => request });
  try { await assert.rejects(collector.collect(search, 'blocked'), /429/); }
  finally { await collector.close(); }
  assert.equal(calls, 1);
  assert.equal(JSON.parse(await readFile(path.join(root, 'data/search-runs/blocked.json'), 'utf8')).status, 'interrupted');
  assert.equal((await connectionStatus(root)).connected, true);
});

test('malformed search response invalidates saved template and asks to reconnect', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-http-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await saveConnection(root, { version: 1, connectedAt: new Date().toISOString(), storageState: { cookies: [{ name: 'li_at', value: 'fake', domain: '.linkedin.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600 }], origins: [] }, searchTemplate: observedSearchTemplate(observedSearchUrl), detailTemplate: { url: observedDetailUrl, originalId: '123', headers: {} } });
  const request = { async get() { return { status: () => 200, headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify({ included: [], data: { metadata: { keywords: 'wrong' } } }) }; }, async storageState() { return { cookies: [] }; }, async dispose() {} };
  const collector = await createLinkedInCollector(root, () => {}, { requestFactory: async () => request });
  try { await assert.rejects(collector.collect(search, 'stale'), /Connect LinkedIn again/); }
  finally { await collector.close(); }
  assert.equal((await connectionStatus(root)).connected, false);
});

test('detail template that yields no complete descriptions requests explicit reconnect', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-http-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await saveConnection(root, { version: 1, connectedAt: new Date().toISOString(), storageState: { cookies: [{ name: 'li_at', value: 'fake', domain: '.linkedin.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600 }], origins: [] }, searchTemplate: observedSearchTemplate(observedSearchUrl), detailTemplate: { url: observedDetailUrl, originalId: '123', headers: {} } });
  const request = { async get(url) { const found = url.includes('JobCards'); return { status: () => found ? 200 : 404, headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(found ? searchPayload : {}) }; }, async storageState() { return { cookies: [] }; }, async dispose() {} };
  const collector = await createLinkedInCollector(root, () => {}, { requestFactory: async () => request });
  try { await assert.rejects(collector.collect(search, 'staledetail'), /Connect LinkedIn again/); }
  finally { await collector.close(); }
  assert.equal((await connectionStatus(root)).connected, false);
  assert.equal(JSON.parse(await readFile(path.join(root, 'data/search-runs/staledetail.json'), 'utf8')).status, 'interrupted');
});

test('bounded pagination advances by the returned page size', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-http-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tenAtZero = observedSearchUrl.replace('count=25', 'count=10');
  await saveConnection(root, { version: 1, connectedAt: new Date().toISOString(), storageState: { cookies: [{ name: 'li_at', value: 'fake', domain: '.linkedin.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600 }], origins: [] }, searchTemplate: observedSearchTemplate(tenAtZero), detailTemplate: { url: observedDetailUrl, originalId: '123', headers: {} } });
  const starts = [];
  const request = { async get(url) {
    const start = Number(new URL(url).searchParams.get('start'));
    starts.push(start);
    const payload = { data: { $type: 'com.linkedin.restli.common.CollectionResponse', metadata: { keywords: search.query }, paging: { start, count: 10, total: 15 }, elements: [{}] }, included: [{ $type: 'x.JobPostingCard', entityUrn: `urn:li:fsd_jobPostingCard:(${start ? '456' : '123'},JOBS_SEARCH)`, jobPostingTitle: 'Engineer' }] };
    return { status: () => 200, headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(payload) };
  }, async storageState() { return { cookies: [] }; }, async dispose() {} };
  const collector = await createLinkedInCollector(root, () => {}, { requestFactory: async () => request, detailLimit: 0 });
  try { await collector.collect(search, 'pages'); }
  finally { await collector.close(); }
  assert.deepEqual(starts, [0, 10]);
});

test('explicit bootstrap learns matching requests without waiting for unrelated response bodies', { timeout: 1000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-connect-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const observed = searchUrlFromTemplate(observedSearchTemplate(observedSearchUrl), search, 0);
  const browser = new EventEmitter();
  let currentUrl = '', closed = false;
  const emit = (url, payload) => browser.emit('response', { url: () => url, status: () => 200,
    headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(payload),
    request: () => ({ allHeaders: async () => ({ accept: 'application/json', 'csrf-token': 'ajax:test', cookie: 'secret-never-copy' }) }) });
  const page = { url: () => currentUrl, title: async () => 'Jobs | LinkedIn', async goto(url) {
    currentUrl = url;
    browser.emit('response', { url: () => 'https://www.linkedin.com/voyager/api/feed', status: () => 200,
      headers: () => ({ 'content-type': 'application/json' }), text: () => new Promise(() => {}) });
    if (url.includes('/jobs/search/')) emit(observed, searchPayload);
    if (url.includes('/jobs/view/')) emit(observedDetailUrl, detailPayload);
  } };
  browser.pages = () => [page];
  browser.close = async () => { closed = true; };
  browser.storageState = async () => ({ cookies: [{ name: 'li_at', value: 'private-test-token', domain: '.linkedin.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600 }], origins: [] });
  assert.deepEqual(await connectLinkedIn(root, [search], () => {}, { browserFactory: async () => browser, searchReadyTimeoutMs: 20, detailReadyTimeoutMs: 20 }), { connected: true });
  assert.equal(closed, true);
  assert.equal((await connectionStatus(root)).connected, true);
  const saved = JSON.parse(await readFile(path.join(root, '.local/linkedin-connection.json'), 'utf8'));
  assert.equal(saved.searchTemplate.headers.cookie, undefined);
  assert.equal(saved.detailTemplate.headers.cookie, undefined);
  assert.equal(saved.storageState.cookies[0].value, 'private-test-token');
});

test('bootstrap rejects observed search whose remote/date filters do not match selected search', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-connect-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const browser = new EventEmitter();
  let currentUrl = '';
  const page = { url: () => currentUrl, title: async () => 'Jobs | LinkedIn', async goto(url) {
    currentUrl = url;
    if (url.includes('/jobs/search/')) browser.emit('response', { url: () => observedSearchUrl, status: () => 200,
      headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(searchPayload),
      request: () => ({ allHeaders: async () => ({ accept: 'application/json' }) }) });
    if (url.includes('/jobs/view/')) browser.emit('response', { url: () => observedDetailUrl, status: () => 200,
      headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(detailPayload),
      request: () => ({ allHeaders: async () => ({ accept: 'application/json' }) }) });
  } };
  browser.pages = () => [page];
  browser.close = async () => {};
  browser.storageState = async () => ({ cookies: [{ name: 'li_at', value: 'private-test-token', domain: '.linkedin.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600 }], origins: [] });
  await assert.rejects(connectLinkedIn(root, [search], () => {}, { browserFactory: async () => browser, searchReadyTimeoutMs: 10, detailReadyTimeoutMs: 10 }), /usable private request template/);
  assert.equal((await connectionStatus(root)).connected, false);
});
