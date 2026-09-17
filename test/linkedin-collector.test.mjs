import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createLinkedInCollector } from '../src/linkedin/collector.mjs';

test('a browser block received during HTTP hydration prevents fallback navigation and retains partial captures', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-collector-test-'));
  const context = new EventEmitter();
  const navigations = [];
  const endpoint = 'https://www.linkedin.com/voyager/api/graphql?queryId=voyagerJobsDashJobPostings.observed&variables=(jobPostingUrn:urn:li:fsd_jobPosting:123)';
  const payload = { included: [
    ...['123', '456'].map(id => ({ $type: 'x.JobPostingCard', entityUrn: `urn:li:fsd_jobPostingCard:(${id},JOBS_SEARCH)`, jobPostingTitle: 'Engineer' })),
    { $type: 'x.JobPosting', entityUrn: 'urn:li:fsd_jobPosting:123', title: 'Engineer', description: { text: 'Complete source description. '.repeat(8) } },
  ] };
  const page = {
    url: () => navigations.at(-1), title: async () => 'Jobs | LinkedIn',
    async goto(url) {
      navigations.push(url);
      if (!url.includes('/jobs/search/')) return;
      const request = { allHeaders: async () => ({ accept: 'application/json' }) };
      context.emit('request', request);
      context.emit('response', { url: () => endpoint, status: () => 200, request: () => request,
        headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(payload) });
    },
    locator: () => ({ evaluateAll: async () => [] }),
    getByText: () => ({ first: () => ({ isVisible: async () => false }) }),
  };
  context.pages = () => [page];
  context.close = async () => {};
  let httpCalls = 0;
  context.request = { async get() {
    httpCalls++;
    context.emit('response', { url: () => endpoint, status: () => 429, request: () => ({}) });
    return { status: () => 404, headers: () => ({}), text: async () => '{}' };
  } };
  t.mock.method(chromium, 'launchPersistentContext', async () => context);
  let collector;
  try {
    collector = await createLinkedInCollector(root);
    await assert.rejects(collector.collect({ id: 'test', provider: 'linkedin', name: 'Test', query: 'backend', location: 'Colombia', enabled: true }, 'blocked'), /429/);
    assert.equal(httpCalls, 1);
    assert.equal(navigations.filter(url => url.includes('/jobs/view/')).length, 0);
    const manifest = JSON.parse(await readFile(path.join(root, 'data/search-runs/blocked.json'), 'utf8'));
    assert.equal(manifest.status, 'interrupted');
    assert.equal(manifest.completeCount, 1);
  } finally {
    if (collector) await collector.close();
    await rm(root, { recursive: true, force: true });
  }
});
