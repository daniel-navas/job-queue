import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Queue, normalizeCaptures, mergeJobs } from '../src/queue.mjs';

test('rediscovery preserves legacy history and captures multiple immutable search revisions', () => {
  const base = { id: '123', title: 'Backend', description: 'Full text', status: 'dismissed', reason: 'No', history: [], searchUrl: 'https://www.linkedin.com/jobs/search/?keywords=backend&location=Colombia' };
  const a = { id: 'a', provider: 'linkedin', revision: 'v1', name: 'A', url: 'https://www.linkedin.com/jobs/search/?keywords=node' };
  const b = { ...a, id: 'b', name: 'B' };
  const once = mergeJobs([base], [{ id: '123', title: 'Backend' }], '2026-09-14', a.url, a);
  const twice = mergeJobs(once, [{ id: '123' }], '2026-09-15', b.url, b);
  const third = mergeJobs(twice, [{ id: '123' }], '2026-09-16', a.url, a);
  assert.equal(third[0].discoveries.length, 3);
  assert.equal(third[0].discoveries[0].search.legacy, true);
  assert.equal(third[0].discoveries[1].firstSeen, '2026-09-14');
  assert.equal(third[0].discoveries[1].lastSeen, '2026-09-16');
  assert.equal(third[0].reason, 'No');
  assert.equal(third[0].description, 'Full text');
  assert.equal(third[0].searchUrl, base.searchUrl);
  a.name = 'Changed later';
  assert.equal(third[0].discoveries[1].search.name, 'A');
});

test('normalization joins card metadata with descriptions without importing unrelated entities', () => {
  const jobs = normalizeCaptures([{ included: [
    { $type: 'x.JobPostingCard', entityUrn: 'urn:li:fsd_jobPostingCard:(123,JOBS_SEARCH)', jobPostingTitle: 'Engineer', primaryDescription: { text: 'Example' }, secondaryDescription: { text: 'Colombia (Remote)' } },
    { $type: 'x.JobPosting', entityUrn: 'urn:li:fsd_jobPosting:123', title: 'Engineer', description: { text: 'Build tools.' } },
    { $type: 'x.Profile', entityUrn: 'urn:li:fsd_profile:123', title: 'Private profile' },
  ] }]);
  assert.equal(jobs.length, 1); assert.equal(jobs[0].company, 'Example'); assert.equal(jobs[0].description, 'Build tools.');
  assert.equal(normalizeCaptures([{ included: [{ $type: 'x.JobPostingCard', entityUrn: 'urn:li:fsd_jobPostingCard:(456,JOBS_SEARCH)', jobPostingTitle: 'Partial' }] }]).length, 0);
});

test('repeat imports preserve review decisions and discovery time', () => {
  const old = [{ id: '123', status: 'dismissed', reason: 'Too senior', history: [{ status: 'dismissed' }], firstSeen: '2026-01-01' }];
  const result = mergeJobs(old, [{ id: '123', title: 'Updated title' }], '2026-02-01', 'search');
  assert.equal(result.length, 1); assert.equal(result[0].reason, 'Too senior'); assert.equal(result[0].status, 'dismissed'); assert.equal(result[0].firstSeen, '2026-01-01');
});

test('review persists across restart and requires dismissal reason', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jobqueue-test-'));
  try {
    const queue = new Queue(root); queue.state.jobs = [{ id: '123', status: 'new', history: [] }];
    assert.throws(() => queue.review('123', 'dismissed', ' '));
    await queue.review('123', 'dismissed', 'Too senior');
    const restored = new Queue(root); await restored.load();
    assert.equal(restored.state.jobs[0].reason, 'Too senior');
    await restored.review('123', 'new', '');
    assert.equal(restored.state.jobs[0].history.length, 2);
  } finally { await rm(root, { recursive: true }); }
});

test('run imports attribute only observed results, preserve rediscoveries, and are idempotent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-import-run-'));
  try {
    await mkdir(path.join(root, '.local/linkedin-captures'), { recursive: true });
    await mkdir(path.join(root, 'data'));
    const search = { id: 'a', provider: 'linkedin', revision: 'v1', name: 'Search A', url: 'https://www.linkedin.com/jobs/search/?keywords=backend' };
    const queue = new Queue(root);
    queue.state.jobs = [{ id: 'old', title: 'Old', description: 'Complete old description', status: 'interesting', reason: 'Good', history: [] }];
    const payload = { included: ['123', '999'].map(id => ({ $type: 'x.JobPosting', entityUrn: `urn:li:fsd_jobPosting:${id}`, title: 'Backend', description: { text: 'Complete description' } })) };
    await writeFile(path.join(root, '.local/linkedin-captures/run.json'), JSON.stringify(payload));
    const manifest = path.join(root, 'data/run.json');
    await writeFile(manifest, JSON.stringify({ runId: 'run1', search, searchUrl: search.url, status: 'interrupted', capturedAt: '2026-09-14', searchJobIds: ['old', '123'], network: { candidateResponses: [{ localCapture: '.local/linkedin-captures/run.json' }] } }));
    assert.deepEqual(await queue.importCapture(manifest, 'run1'), { captured: 2, added: 1 });
    assert.deepEqual(queue.state.jobs.map(job => job.id), ['old', '123']);
    assert.equal(queue.state.jobs[0].status, 'interesting');
    assert.equal(queue.state.jobs[0].discoveries[0].search.id, 'a');
    assert.equal(queue.state.searchRuns[0].status, 'interrupted');
    assert.deepEqual(await queue.importCapture(manifest, 'run1'), { captured: 0, added: 0 });
    assert.equal(queue.state.searchRuns.length, 1);
    await assert.rejects(queue.importCapture(manifest, 'different'), /does not match/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
