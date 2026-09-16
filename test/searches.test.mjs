import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const input = { id: 'backend', provider: 'linkedin', name: 'Backend', query: 'backend engineer', location: 'Colombia', workplace: 'any', datePosted: 'month', enabled: true };

test('search criteria are validated and fingerprints survive name or activation edits', async () => {
  const { normalizeSearch } = await import('../src/searches.mjs');
  const a = normalizeSearch(input);
  assert.equal(new URL(a.url).searchParams.get('keywords'), 'backend engineer');
  assert.equal(new URL(a.url).searchParams.get('f_TPR'), 'r2592000');
  assert.equal(normalizeSearch({ ...input, name: 'Renamed', enabled: false }).revision, a.revision);
  assert.notEqual(normalizeSearch({ ...input, query: 'python backend' }).revision, a.revision);
  assert.throws(() => normalizeSearch({ ...input, provider: 'other' }), /provider/i);
  assert.throws(() => normalizeSearch({ ...input, query: ' ' }), /query/i);
  assert.throws(() => normalizeSearch({ ...input, workplace: 'telepathy' }), /workplace/i);
});

test('search edits persist, reload external changes and reject stale writes', async () => {
  const { SearchStore } = await import('../src/searches.mjs');
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-searches-'));
  try {
    await mkdir(path.join(root, 'config'));
    await writeFile(path.join(root, 'config/searches.json'), JSON.stringify({ searches: [input] }));
    const store = new SearchStore(root);
    const original = await store.read();
    const updated = await store.update({ ...input, enabled: false }, original.version);
    assert.equal(updated.searches[0].enabled, false);
    await assert.rejects(store.update({ ...input, name: 'Lost update' }, original.version), /changed/i);
    assert.equal((await new SearchStore(root).read()).searches[0].enabled, false);
    await assert.rejects(store.update({ ...input, id: 'absent' }, updated.version), /found/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('analytics deduplicate jobs, exclude pending ratings and keep edited revisions separate', async () => {
  const { searchAnalytics, normalizeSearch } = await import('../src/searches.mjs');
  const a = normalizeSearch(input), b = normalizeSearch({ ...input, id: 'python', query: 'python' });
  const origin = s => ({ search: s, firstSeen: '2026-09-14', lastSeen: '2026-09-14' });
  const jobs = [
    { id: '1', description: 'Complete', status: 'interesting', rating: { total: 6 }, discoveries: [origin(a), origin(b)] },
    { id: '2', description: 'Complete', rating: { total: 2 }, discoveries: [origin(a), origin(a)] },
    { id: '3', description: 'Complete', rating: { total: null }, discoveries: [origin(a)] },
  ];
  const [stats] = searchAnalytics([a, b], jobs, []);
  assert.deepEqual([stats.captured, stats.exclusive, stats.processed, stats.meanRating, stats.interesting], [3, 2, 2, 4, 1]);
  jobs[0].rating.total = 8;
  assert.equal(searchAnalytics([a], jobs, [])[0].meanRating, 5);
  const edited = normalizeSearch({ ...input, query: 'new criteria' });
  assert.equal(searchAnalytics([edited], jobs, [])[0].captured, 0);
  assert.equal(searchAnalytics([edited], jobs, [])[0].historicalCaptured, 3);
});
