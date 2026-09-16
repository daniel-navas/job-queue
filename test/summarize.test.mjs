import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, pendingJobs, currentSummary, processingStatus, summaryVersion, validateCards, discardUnsupportedFacts, Summarizer } from '../src/summarize.mjs';
import { emptyCard } from '../test-support/fixtures.mjs';
const job = { id: '1', title: 'Engineer', description: 'Requires Java. Remote in Colombia.', status: 'new' };
const card = () => emptyCard({ workplace: { value: 'Remote', evidence: 'Remote in Colombia.' } });
test('only new or changed descriptions need processing', () => {
  const done = { ...job, summary: { inputHash: fingerprint(job), version: summaryVersion, fields: card() } };
  assert.equal(pendingJobs([done, { ...job, status: 'dismissed' }, { ...job, description: '' }]).length, 0);
  assert.equal(pendingJobs([{ ...done, summary: { inputHash: fingerprint(job) } }]).length, 1);
  assert.equal(pendingJobs([{ ...done, description: 'Changed' }]).length, 1);
  assert.deepEqual(currentSummary(done).facts, done.summary.fields);
  assert.equal(currentSummary({ ...done, summary: { inputHash: fingerprint(job), version: 1 } }), null);
  assert.equal(processingStatus(done), 'processed');
  assert.equal(processingStatus(job), 'pending');
  assert.equal(processingStatus({ ...job, description: '' }), 'no-description');
});
test('validation rejects invented evidence, omitted fields and wrong IDs', () => {
  assert.equal(validateCards({ cards: [card()] }, [job]).length, 1);
  for (const bad of [{ ...card(), id: '2' }, { ...card(), salary: undefined }, { ...card(), salary: { value: '$100k', evidence: 'Earn $100k' } }]) assert.throws(() => validateCards({ cards: [bad] }, [job]));
});
test('runtime safety drops an unsupported fact without losing the card', () => {
  const result = { cards: [{ ...card(), workplace: { value: 'Remote', evidence: 'Invented remote quote' } }] };
  assert.equal(discardUnsupportedFacts(result,[job]).cards[0].workplace,null);
  assert.equal(validateCards(result,[job]).length,1);
});
test('worker preserves reviews and does not save results for changed inputs', async () => {
  const queue = { state: { jobs: [structuredClone(job)] }, mutate: async fn => fn() };
  let finish;
  const worker = new Summarizer(queue, process.cwd(), () => new Promise(resolve => { finish = resolve; }));
  worker.start(); assert.throws(() => worker.start());
  while (!finish) await new Promise(resolve => setTimeout(resolve, 1));
  queue.state.jobs[0].status = 'interesting';
  finish({ cards: [card()], usage: null }); await worker.completion;
  assert.equal(queue.state.jobs[0].status, 'interesting'); assert.ok(queue.state.jobs[0].summary);
  queue.state.jobs[0].description = 'New description';
  const other = new Summarizer(queue, process.cwd(), async jobs => { queue.state.jobs[0].description = 'Another change'; return { cards: [{ ...card(), workplace: null }], usage: null }; });
  other.start(); await other.completion;
  assert.equal(other.state.processed, 0);
});
test('one start processes at most two pending offers', async () => {
  const jobs = Array.from({ length: 6 }, (_, index) => ({ ...job, id: String(index + 1) }));
  const queue = { state: { jobs: structuredClone(jobs) }, mutate: async fn => fn() };
  const sizes = [], ids = [];
  const worker = new Summarizer(queue, process.cwd(), async batch => {
    sizes.push(batch.length); ids.push(...batch.map(item=>item.id));
    return { cards: batch.map(item => ({ ...card(), id: item.id })), usage: { input_tokens: batch.length } };
  });
  worker.start('6'); await worker.completion;
  assert.deepEqual(sizes,[1,1]);
  assert.deepEqual(ids,['6','1']);
  assert.equal(worker.state.completed,2);
  assert.equal(worker.state.remaining,4);
  assert.equal(worker.state.usage.input_tokens,2);
  assert.equal(queue.state.jobs.filter(item=>item.summary?.version===summaryVersion).length,2);
});
