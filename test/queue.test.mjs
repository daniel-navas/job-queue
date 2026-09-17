import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, readdir, copyFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Queue, normalizeCaptures, mergeJobs, readStoredJobs, backupQueue } from '../src/queue.mjs';

test('queue commits survive a concurrent reader and database permissions are private', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-reader-lock-'));
  let reader;
  try {
    const queue = new Queue(root); queue.state.jobs = [{ id: 'one', status: 'new', history: [] }];
    await queue.save();
    assert.equal((await stat(path.join(root, 'data/jobqueue.sqlite'))).mode & 0o777, 0o600);
    reader = new DatabaseSync(path.join(root, 'data/jobqueue.sqlite'), { readOnly: true });
    reader.exec('BEGIN'); reader.prepare('SELECT * FROM jobs').all();
    const release = setTimeout(() => reader.exec('COMMIT'), 75);
    try { await queue.review('one', 'interesting', 'Good'); } finally { clearTimeout(release); }
    const restored = new Queue(root); await restored.load();
    assert.equal(restored.state.jobs[0].status, 'interesting');
  } finally { reader?.close(); await rm(root, { recursive: true, force: true }); }
});

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

test('legacy migration preserves ordered records and metadata exactly, backed up and imported once', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-migrate-'));
  try {
    await mkdir(path.join(root, 'data'));
    const original = { jobs: [
      { id: 'z', title: 'First', history: [{ status: 'interesting', at: '2026-01-01' }], unusual: { keep: [1, null, 'x'] } },
      { id: 'a', description: 'Second', status: 'dismissed', reason: 'No' },
    ], importedAt: '2026-01-02', searchRuns: [{ id: 'run', jobIds: ['z', 'a'] }], extra: { nested: true } };
    const legacy = JSON.stringify(original, null, 2) + '\n';
    await writeFile(path.join(root, 'data/queue.json'), legacy);
    const queue = new Queue(root); await queue.load();
    assert.deepEqual(queue.state, original);
    assert.deepEqual(await readStoredJobs(root), original.jobs);
    const backups = await readdir(path.join(root, 'data/backups'));
    assert.equal(backups.length, 1);
    assert.equal(await readFile(path.join(root, 'data/backups', backups[0]), 'utf8'), legacy);
    await writeFile(path.join(root, 'data/queue.json'), JSON.stringify({ jobs: [{ id: 'stale' }] }));
    const restored = new Queue(root); await restored.load();
    assert.deepEqual(restored.state, original);
    assert.deepEqual(restored.state, queue.state);
    assert.equal((await readdir(path.join(root, 'data/backups'))).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed mutation rolls back both in-memory and persisted state', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-rollback-'));
  try {
    const queue = new Queue(root); queue.state.jobs = [{ id: 'one', status: 'new', history: [] }];
    await queue.mutate(() => { queue.state.note = 'initial'; });
    const before = structuredClone(queue.state);
    await assert.rejects(queue.mutate(() => { queue.state.jobs[0].status = 'interesting'; queue.state.note = 1n; }), /BigInt/);
    assert.deepEqual(queue.state, before);
    const restored = new Queue(root); await restored.load();
    assert.deepEqual(restored.state, before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('independent queue instances refresh before review updates', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-concurrent-'));
  try {
    const first = new Queue(root); first.state.jobs = [
      { id: 'one', status: 'new', history: [] }, { id: 'two', status: 'new', history: [] },
    ];
    await first.mutate(() => {});
    const second = new Queue(root); await second.load();
    await first.review('one', 'interesting', 'Good');
    await second.review('two', 'dismissed', 'Not now');
    const restored = new Queue(root); await restored.load();
    assert.deepEqual(restored.state.jobs.map(job => [job.id, job.status]), [['one', 'interesting'], ['two', 'dismissed']]);
    assert.equal(restored.state.jobs[0].history.length, 1);
    assert.equal(restored.state.jobs[1].history.length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('private migration backup restores full state in a fresh root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-backup-'));
  const recovery = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-recovery-'));
  try {
    await mkdir(path.join(root, 'data'));
    const original = { jobs: [{ id: 'saved', summary: { inputHash: 'hash' }, history: [] }], importedAt: 'date', searchRuns: [{ id: 'run' }] };
    await writeFile(path.join(root, 'data/queue.json'), JSON.stringify(original));
    const queue = new Queue(root); await queue.load();
    await mkdir(path.join(recovery, 'data'));
    const [backup] = await readdir(path.join(root, 'data/backups'));
    await copyFile(path.join(root, 'data/backups', backup), path.join(recovery, 'data/queue.json'));
    const restored = new Queue(recovery); await restored.load();
    assert.deepEqual(restored.state, original);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(recovery, { recursive: true, force: true });
  }
});

test('overlapping writers serialize without losing independent edits', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-overlap-'));
  try {
    const first = new Queue(root); first.state.jobs = [{ id: 'one', status: 'new', history: [] }, { id: 'two', status: 'new', history: [] }];
    await first.mutate(() => {});
    const second = new Queue(root); await second.load();
    await Promise.all([
      first.mutate(async () => { await new Promise(resolve => setTimeout(resolve, 30)); first.state.jobs[0].status = 'interesting'; }),
      second.review('two', 'dismissed', 'Not suitable'),
    ]);
    const restored = new Queue(root); await restored.load();
    assert.deepEqual(restored.state.jobs.map(job => job.status), ['interesting', 'dismissed']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('parallel first loads create one backup and import the legacy snapshot once', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-parallel-load-'));
  try {
    await mkdir(path.join(root, 'data'));
    const state = { jobs: [{ id: 'one', history: [] }], searchRuns: [{ id: 'run' }] };
    await writeFile(path.join(root, 'data/queue.json'), JSON.stringify(state));
    const first = new Queue(root), second = new Queue(root);
    await Promise.all([first.load(), second.load()]);
    assert.deepEqual(first.state, state);
    assert.deepEqual(second.state, state);
    assert.equal((await readdir(path.join(root, 'data/backups'))).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('malformed legacy data fails closed without replacing the source', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-malformed-'));
  try {
    await mkdir(path.join(root, 'data'));
    await writeFile(path.join(root, 'data/queue.json'), '{broken');
    await assert.rejects(new Queue(root).load(), SyntaxError);
    assert.equal(await readFile(path.join(root, 'data/queue.json'), 'utf8'), '{broken');
    await assert.rejects(stat(path.join(root, 'data/jobqueue.sqlite')), { code: 'ENOENT' });
    await assert.rejects(readStoredJobs(root));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an existing corrupt database never falls back to a stale JSON queue', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-corrupt-'));
  try {
    await mkdir(path.join(root, 'data'));
    await writeFile(path.join(root, 'data/jobqueue.sqlite'), 'not a database');
    await writeFile(path.join(root, 'data/queue.json'), JSON.stringify({ jobs: [{ id: 'stale' }] }));
    await assert.rejects(new Queue(root).load());
    await assert.rejects(readStoredJobs(root));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('SQLite backup restores the latest review and metadata without JSON', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-native-backup-'));
  const recovery = await mkdtemp(path.join(os.tmpdir(), 'jq-sqlite-native-restore-'));
  try {
    const queue = new Queue(root);
    queue.state = { jobs: [{ id: 'one', status: 'new', history: [] }], searchRuns: [{ id: 'run' }] };
    await queue.mutate(() => {});
    await queue.review('one', 'interesting', 'Looks good');
    const destination = path.join(root, 'data/backups/snapshot.sqlite');
    await backupQueue(root, destination);
    await assert.rejects(backupQueue(root, destination), /exist/i);
    await mkdir(path.join(recovery, 'data'));
    await copyFile(destination, path.join(recovery, 'data/jobqueue.sqlite'));
    const restored = new Queue(recovery); await restored.load();
    assert.deepEqual(restored.state, queue.state);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(recovery, { recursive: true, force: true });
  }
});
