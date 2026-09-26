import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, pendingJobs, currentSummary, processingStatus, summaryVersion, validateCards, discardUnsupportedFacts, normalizeEvidenceQuotes, normalizeUnknownMobility, Summarizer } from '../src/summarize.mjs';
import { emptyCard, requirement } from '../test-support/fixtures.mjs';
import { Queue } from '../src/queue.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const job = { id: '1', title: 'Engineer', description: 'Requires Java. Remote in Colombia.', status: 'new' };
const card = () => emptyCard({ workplace: { value: 'Remote', evidence: 'Remote in Colombia.' } });
test('only new or changed descriptions need processing', () => {
  const done = { ...job, summary: { inputHash: fingerprint(job), version: summaryVersion, fields: card() } };
  assert.equal(pendingJobs([done, { ...job, status: 'dismissed' }, { ...job, description: '' }]).length, 0);
  assert.equal(pendingJobs([{ ...job, availability: { status: 'closed' } }]).length, 0);
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
test('paired presentation quotes are removed only for exact source excerpts', () => {
  const quoted = { cards: [emptyCard({ requirements: [requirement('java', { evidence: '"Requires Java."' })] })] };
  assert.equal(normalizeEvidenceQuotes(quoted, [job]).cards[0].requirements[0].evidence, 'Requires Java.');
  assert.equal(validateCards(quoted, [job]).length, 1);
  const invented = { cards: [emptyCard({ requirements: [requirement('java', { evidence: '"Invented Java."' })] })] };
  assert.equal(normalizeEvidenceQuotes(invented, [job]).cards[0].requirements[0].evidence, '"Invented Java."');
  assert.throws(() => validateCards(invented, [job]), /Unsupported/);
});
test('provider unknown mobility values become missing facts', () => {
  const result = { cards: [emptyCard({
    visaSupport: { value: 'supported', evidence: 'visa support' },
    relocationFunding: { value: 'unknown', evidence: 'relocation package' },
  })] };
  normalizeUnknownMobility(result);
  assert.deepEqual(result.cards[0].visaSupport, { value: 'supported', evidence: 'visa support' });
  assert.equal(result.cards[0].relocationFunding, null);
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
test('one start prioritizes the two newest interested offers and ignores the selected job', async () => {
  const jobs = [
    { ...job, id: '1', status: 'new', publishedAt: Date.parse('2026-09-26T12:00:00Z') },
    { ...job, id: '2', status: 'interesting', publishedAt: Date.parse('2026-09-24T12:00:00Z') },
    { ...job, id: '3', status: 'interesting', publishedAt: Date.parse('2026-09-25T12:00:00Z') },
    { ...job, id: '4', status: 'new', publishedAt: Date.parse('2026-09-23T12:00:00Z') },
    { ...job, id: '5', status: 'new' },
    { ...job, id: '6', status: 'new', publishedAt: Date.parse('2026-09-22T12:00:00Z') },
  ];
  const queue = { state: { jobs: structuredClone(jobs) }, mutate: async fn => fn() };
  const sizes = [], ids = [];
  const worker = new Summarizer(queue, process.cwd(), async batch => {
    sizes.push(batch.length); ids.push(...batch.map(item=>item.id));
    return { cards: batch.map(item => ({ ...card(), id: item.id })), usage: { input_tokens: batch.length } };
  });
  worker.start('1'); await worker.completion;
  assert.deepEqual(sizes,[1,1]);
  assert.deepEqual(ids,['3','2']);
  assert.equal(worker.state.completed,2);
  assert.equal(worker.state.remaining,4);
  assert.equal(worker.state.usage.input_tokens,2);
  assert.equal(queue.state.jobs.filter(item=>item.summary?.version===summaryVersion).length,2);
});

test('both offers start together and a failed offer does not release the batch before its sibling saves', { timeout: 2000 }, async () => {
  const queue = { state: { jobs: [{ ...job }, { ...job, id: '2' }] }, mutate: async fn => fn() };
  const gates = new Map();
  let bothStarted;
  const started = new Promise(resolve => { bothStarted = resolve; });
  const worker = new Summarizer(queue, process.cwd(), batch => new Promise((resolve, reject) => {
    gates.set(batch[0].id, { resolve, reject });
    if (gates.size === 2) bothStarted();
  }));
  worker.start();
  await started;
  gates.get('1').reject(new Error('Extraction failed'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(worker.state.running, true);
  assert.throws(() => worker.start(), /already running/);
  queue.state.jobs[1].status = 'interesting';
  gates.get('2').resolve({ cards: [{ ...card(), id: '2' }], usage: { input_tokens: 7 } });
  await worker.completion;
  assert.equal(worker.state.error, true);
  assert.equal(worker.state.processed, 1);
  assert.equal(worker.state.completed, 2);
  assert.equal(worker.state.remaining, 1);
  assert.equal(queue.state.jobs[1].status, 'interesting');
  assert.ok(queue.state.jobs[1].summary);
  assert.equal(queue.state.jobs[0].summary, undefined);
  assert.equal(queue.state.lastSummaryRun.timings.length, 2);
  assert.ok(queue.state.lastSummaryRun.durationMs >= 0);
});

test('ready count includes only durably saved offers after a write failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-summary-save-'));
  try {
  const queue = new Queue(root);
  queue.state.jobs = [{ ...job }, { ...job, id: '2' }];
  await queue.save();
  const db = new DatabaseSync(path.join(root, 'data/jobqueue.sqlite'));
  db.exec("CREATE TRIGGER fail_first_summary BEFORE UPDATE ON jobs WHEN NEW.id = '1' AND json_extract(NEW.record, '$.summary') IS NOT NULL BEGIN SELECT RAISE(ABORT, 'Disk full'); END");
  db.close();
  const worker = new Summarizer(queue, process.cwd(), async ([input]) => ({ cards: [{ ...card(), id: input.id }], usage: null }));
  worker.start(); await worker.completion;
  const restored = new Queue(root); await restored.load(); const persisted = restored.state;
  assert.equal(persisted.jobs.filter(item => item.summary).length, 1);
  assert.equal(worker.state.processed, 1);
  assert.equal(persisted.lastSummaryRun.processed, 1);
  assert.equal(worker.state.error, true);
  assert.match(worker.state.message, /^1 ready/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('long qualification lists are not truncated to thirty criteria', () => {
  const requirements = Array.from({ length: 40 }, (_, index) => requirement('unmapped', { kind: 'unknown', label: `Qualification ${index}`, evidence: `Qualification ${index}.` }));
  const source = { ...job, description: requirements.map(item => item.evidence).join(' ') };
  assert.equal(validateCards({ cards: [emptyCard({ requirements })] }, [source])[0].requirements.length, 40);
});

test('removed threshold fields are rejected by the qualitative schema', () => {
  const source = { ...job, description: 'Knowledge of Java.' };
  const bad = emptyCard({ requirements: [requirement('java', { evidence: source.description, knowledgeLevel: 'basic' })] });
  assert.throws(() => validateCards({ cards: [bad] }, [source]), /extraction/i);
});
