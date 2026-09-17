import test from 'node:test';
import assert from 'node:assert/strict';

test('scan snapshots enabled searches and stops after the first failure', async () => {
  const { runSearchBatch } = await import('../src/scan.mjs');
  const searches = [{ id: 'a', name: 'Old name', query: 'backend engineer', enabled: true }, { id: 'off', enabled: false }, { id: 'b', query: 'python', enabled: true }, { id: 'c', enabled: true }];
  const visited = [], messages = [];
  const result = await runSearchBatch(searches, async search => {
    visited.push(search.id);
    if (search.id === 'a') { searches[2].id = 'edited'; return { added: 2 }; }
    throw new Error('Security challenge');
  }, (message, query) => messages.push({ message, query }));
  assert.deepEqual(visited, ['a', 'b']);
  assert.equal(result.added, 2);
  assert.equal(result.error, true);
  assert.match(result.message, /Security challenge/);
  assert.deepEqual(messages, [
    { message: 'Searching 1/3', query: 'backend engineer' },
    { message: 'Searching 2/3', query: 'python' },
  ]);
});

test('a batch with no enabled searches cannot report success', async () => {
  const { runSearchBatch } = await import('../src/scan.mjs');
  await assert.rejects(runSearchBatch([{ enabled: false }], async () => {}), /enable/i);
});

test('one collector serves sequential searches, imports partial progress, and closes on stop', async () => {
  const { runManagedSearchBatch } = await import('../src/scan.mjs');
  const events = [];
  const queue = {
    async importCapture(_manifest, runId) { events.push(`import:${runId}`); return { added: events.filter(event => event.startsWith('import:')).length }; },
    async recordFailedSearch() { throw new Error('unexpected missing manifest'); },
  };
  const collector = {
    async collect(search, runId) { events.push(`collect:${search.id}:${runId}`); if (search.id === 'second') throw new Error('LinkedIn HTTP 429; stopped'); },
    async close() { events.push('close'); },
  };
  const result = await runManagedSearchBatch('/unused', queue, [
    { id: 'first', query: 'one', enabled: true },
    { id: 'second', query: 'two', enabled: true },
    { id: 'third', query: 'three', enabled: true },
  ], () => {}, async () => { events.push('open'); return collector; });
  assert.equal(result.error, true);
  assert.equal(result.added, 3);
  assert.match(result.message, /HTTP 429/);
  assert.equal(events[0], 'open');
  assert.equal(events.at(-1), 'close');
  assert.deepEqual(events.filter(event => event.startsWith('collect:')).map(event => event.split(':')[1]), ['first', 'second']);
  assert.equal(events.filter(event => event.startsWith('import:')).length, 2);
});

test('browser startup failure records the first attempted search as failed', async () => {
  const { runManagedSearchBatch } = await import('../src/scan.mjs');
  const failures = [];
  const queue = { async recordFailedSearch(id, search, message) { failures.push({ id, search, message }); } };
  await assert.rejects(runManagedSearchBatch('/unused', queue, [
    { id: 'first', enabled: true }, { id: 'second', enabled: true },
  ], () => {}, async () => { throw new Error('Chrome unavailable'); }), /Chrome unavailable/);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].search.id, 'first');
  assert.match(failures[0].message, /Chrome unavailable/);
});
