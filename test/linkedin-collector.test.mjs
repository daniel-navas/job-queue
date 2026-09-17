import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeSearch } from '../src/searches.mjs';
import { createLinkedInCollector } from '../src/linkedin/collector.mjs';
import { saveConnection } from '../src/linkedin/connection.mjs';
import { observedDetailTemplate, observedSearchTemplate } from '../src/linkedin/transport.mjs';

test('HTTP detail block stops sequential retrieval and retains completed partial captures', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-collector-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const search = normalizeSearch({ id: 'test', provider: 'linkedin', name: 'Test', query: 'backend', location: 'Colombia', enabled: true });
  const searchUrl = 'https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards?count=25&q=jobSearch&query=(origin:JOB_SEARCH_PAGE_OTHER_ENTRY,keywords:backend,locationUnion:(seoLocation:(location:Colombia)),selectedFilters:(timePostedRange:List(r2592000)),spellCorrectionEnabled:true)&start=0';
  const detailUrl = 'https://www.linkedin.com/voyager/api/graphql?queryId=voyagerJobsDashJobPostings.observed&variables=(jobPostingUrn:urn:li:fsd_jobPosting:123)';
  await saveConnection(root, { version: 1, connectedAt: new Date().toISOString(), storageState: { cookies: [{ name: 'li_at', value: 'fake', domain: '.linkedin.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600 }], origins: [] }, searchTemplate: observedSearchTemplate(searchUrl), detailTemplate: observedDetailTemplate(detailUrl) });
  const payload = { data: { $type: 'com.linkedin.restli.common.CollectionResponse', metadata: { keywords: 'backend' }, paging: { start: 0, count: 25, total: 2 }, elements: [{}, {}] }, included: ['123', '456'].map(id => ({ $type: 'x.JobPostingCard', entityUrn: `urn:li:fsd_jobPostingCard:(${id},JOBS_SEARCH)`, jobPostingTitle: 'Engineer' })) };
  const complete = { included: [{ $type: 'x.JobPosting', entityUrn: 'urn:li:fsd_jobPosting:123', title: 'Engineer', description: { text: 'Complete source description. '.repeat(8) } }] };
  const urls = [];
  const request = { async get(url) {
    urls.push(url);
    const status = urls.length === 3 ? 429 : 200;
    return { status: () => status, headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(url.includes('JobCards') ? payload : complete) };
  }, async storageState() { return { cookies: [] }; }, async dispose() {} };
  const collector = await createLinkedInCollector(root, () => {}, { requestFactory: async () => request });
  try { await assert.rejects(collector.collect(search, 'blocked'), /429/); }
  finally { await collector.close(); }
  assert.equal(urls.length, 3);
  const manifest = JSON.parse(await readFile(path.join(root, 'data/search-runs/blocked.json'), 'utf8'));
  assert.equal(manifest.status, 'interrupted');
  assert.equal(manifest.completeCount, 1);
  assert.deepEqual(manifest.searchJobIds, ['123', '456']);
  assert.equal(manifest.network.candidateResponses.length, 2);
});
