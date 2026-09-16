import test from 'node:test';
import assert from 'node:assert/strict';

test('scan snapshots enabled searches and stops after the first failure', async () => {
  const { runSearchBatch } = await import('../src/scan.mjs');
  const searches = [{ id: 'a', enabled: true }, { id: 'off', enabled: false }, { id: 'b', enabled: true }, { id: 'c', enabled: true }];
  const visited = [], messages = [];
  const result = await runSearchBatch(searches, async search => {
    visited.push(search.id);
    if (search.id === 'a') { searches[2].id = 'edited'; return { added: 2 }; }
    throw new Error('Security challenge');
  }, message => messages.push(message));
  assert.deepEqual(visited, ['a', 'b']);
  assert.equal(result.added, 2);
  assert.equal(result.error, true);
  assert.match(result.message, /Security challenge/);
  assert.equal(messages.length, 2);
});

test('a batch with no enabled searches cannot report success', async () => {
  const { runSearchBatch } = await import('../src/scan.mjs');
  await assert.rejects(runSearchBatch([{ enabled: false }], async () => {}), /enable/i);
});
