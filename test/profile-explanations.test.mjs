import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const load = () => import('../src/profile-explanations.mjs');
const facts = [{ key: 'angular', label: 'Angular', mode: 'level' }, { key: 'financial', label: 'Financial software experience', mode: 'presence' }];
const card = key => ({ key, whatIs: 'Explicación breve.', basic: 'Sigues un ejemplo.', independent: 'Resuelves una tarea.', advanced: 'Diseñas y corriges problemas.', yes: null, no: null });
const presence = { key: facts[1].key, whatIs: 'Experiencia en software financiero.', basic: null, independent: null, advanced: null, yes: 'Has trabajado en ese sector.', no: 'No has trabajado en ese sector.' };
async function setup(t, runner) {
  const { ProfileExplanations } = await load();
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-explanations-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return new ProfileExplanations(root, runner);
}
test('cached explanations survive restart, deduplicate facts and invalidate changed definitions', async t => {
  const store = await setup(t, async input => ({ cards: input.map(f => f.mode === 'presence' ? presence : card(f.key)), usage: { input_tokens: 20 } }));
  await store.load();
  store.start([...facts, facts[0]]); await store.completion;
  assert.equal(store.state.generated, 2);
  assert.equal(store.get(facts[0]).independent, 'Resuelves una tarea.');
  const restarted = await setup(t, () => { throw new Error('Unexpected provider call'); });
  restarted.file = store.file;
  await restarted.load();
  assert.deepEqual(restarted.missing(facts), []);
  assert.equal(restarted.get(facts[1]).yes, 'Has trabajado en ese sector.');
  assert.equal(restarted.get({ ...facts[0], definition: 'A changed meaning' }), null);
  assert.throws(() => restarted.start(facts), /No explanations/);
});
test('invalid or duplicate output is rejected without saving misleading cards', async t => {
  const { validateExplanations } = await load();
  for (const cards of [[card('wrong')], [card('angular'), card('angular')], [{ ...card('angular'), basic: '' }], [{ ...card('angular'), yes: 'Wrong level mode' }]]) {
    assert.throws(() => validateExplanations(cards, [facts[0]]));
  }
  assert.throws(() => validateExplanations([card(facts[1].key)], [facts[1]]));
  const store = await setup(t, async () => ({ cards: [card('wrong')] }));
  await store.load(); store.start([facts[0]]); await store.completion;
  assert.equal(store.get(facts[0]), null);
  assert.equal(store.state.error, true);
});
test('only one run is accepted and failed chunks stop without retries while preserving earlier chunks', async t => {
  let release;
  const store = await setup(t, input => new Promise(resolve => { release = () => resolve({ cards: input.map(f => card(f.key)) }); }));
  await store.load(); store.start([facts[0]]);
  assert.throws(() => store.start([facts[0]]), /already running/);
  await new Promise(resolve => setImmediate(resolve)); release(); await store.completion;
  const { catalog } = await import('../src/tag-catalog.mjs');
  const input = Object.entries(catalog.tags).filter(([, d]) => d.profileMode === 'level' && !d.members).slice(0, 11).map(([key, d]) => ({ key, label: d.label, mode: 'level', definition: d.definition }));
  let calls = 0;
  const failing = await setup(t, async batch => { if (++calls === 2) throw new Error('Quota limit'); return { cards: batch.map(f => card(f.key)) }; });
  await failing.load(); failing.start(input); await failing.completion;
  assert.equal(failing.state.generated, 10);
  assert.equal(failing.state.error, true);
  assert.equal(failing.missing(input).length, 1);
  const saved = JSON.parse(await readFile(failing.file, 'utf8'));
  assert.equal(Object.keys(saved.cards).length, 10);
});
test('an unreadable optional cache blocks generation without overwriting it or breaking profile display', async t => {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const store = await setup(t, () => { throw new Error('Unexpected provider call'); });
  await mkdir(path.dirname(store.file), { recursive: true });
  await writeFile(store.file, '{broken');
  await store.load();
  const view = store.view({ items: [], allFacts: [], families: [] });
  assert.equal(view.unavailable, true);
  assert.equal(view.running, false);
  assert.throws(() => store.start([facts[0]]), /cache unavailable/i);
  assert.equal(await readFile(store.file, 'utf8'), '{broken');
});
