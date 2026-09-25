import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fingerprint, summaryVersion } from '../src/summarize.mjs';
import { emptyCard, requirement } from '../test-support/fixtures.mjs';
import { openStorage, storeState } from '../src/queue-storage.mjs';
import {
  candidateFingerprint,
  inventoryUnmapped,
  validateUnmappedReview,
} from '../src/unmapped-review.mjs';

const summarized = (id, fields, overrides = {}) => {
  const job = { id, title: `Offer ${id}`, company: 'Example', description: Object.values(fields)
    .flatMap(value => Array.isArray(value) ? value.map(item => item.evidence) : value?.evidence ?? [])
    .filter(Boolean).join(' '), ...overrides };
  return { ...job, summary: { fields: { ...fields, id }, version: summaryVersion, inputHash: fingerprint(job) } };
};

const unknown = (label, evidence, overrides = {}) => requirement('unmapped', {
  kind: 'unknown', label, evidence, ...overrides,
});

test('inventory aggregates identical source-backed criteria without using offer identity', () => {
  const criterion = unknown('Platform certification', 'Required platform certification.');
  const jobs = [
    summarized('1', emptyCard({ requirements: [criterion] })),
    summarized('2', emptyCard({ requirements: [{ ...criterion, label: '  PLATFORM certification  ' }] })),
  ];

  const result = inventoryUnmapped(jobs, { schemaVersion: 1, reviewThreshold: 20, decisions: [] });

  assert.equal(result.pending, 1);
  assert.equal(result.candidates[0].occurrences, 2);
  assert.deepEqual(result.candidates[0].offers.map(offer => offer.reference), ['JQ-001', 'JQ-002']);
  assert.equal(result.candidates[0].label, 'Platform certification');
  assert.equal(result.recommended, false);
});

test('fingerprints preserve criterion group, evidence and typed thresholds', () => {
  const base = unknown('Certification', 'Certification required.');
  const values = [
    ['requirements', base],
    ['preferred', base],
    ['requirements', { ...base, evidence: 'Another certification required.' }],
    ['requirements', { ...base, minMonths: 12 }],
  ].map(([group, criterion]) => candidateFingerprint(group, criterion));

  assert.equal(new Set(values).size, 4);
  assert.match(values[0], /^[a-f0-9]{64}$/);
});

test('only applied decisions leave the review queue; deferred decisions remain pending', () => {
  const criteria = ['Applied', 'Deferred', 'Proposed', 'Reopened'].map(label => unknown(label, `${label} evidence.`));
  const job = summarized('1', emptyCard({ requirements: criteria }));
  const decisions = criteria.map((criterion, index) => ({
    id: `decision-${index + 1}`,
    status: ['applied', 'deferred', 'proposed', 'reopened'][index],
    action: index === 0 ? 'map-existing' : 'keep-unmapped',
    target: index === 0 ? { kind: 'capability', key: 'backend' } : null,
    fingerprints: [candidateFingerprint('requirements', criterion)],
    rationale: 'Reviewed.',
    reviewedAt: '2026-09-21',
  }));

  const result = inventoryUnmapped([job], { schemaVersion: 1, reviewThreshold: 2, decisions });

  assert.deepEqual(result.candidates.map(candidate => candidate.label), ['Deferred', 'Proposed', 'Reopened']);
  assert.equal(result.pending, 3);
  assert.equal(result.recommended, true);
});

test('review threshold is inclusive and independent from occurrence count', () => {
  const jobs = Array.from({ length: 20 }, (_, index) => summarized(String(index), emptyCard({
    requirements: [unknown(`Criterion ${index}`, `Evidence ${index}.`)],
  })));
  const below = inventoryUnmapped(jobs.slice(0, 19), { schemaVersion: 1, reviewThreshold: 20, decisions: [] });
  const at = inventoryUnmapped(jobs, { schemaVersion: 1, reviewThreshold: 20, decisions: [] });

  assert.deepEqual([below.pending, below.recommended], [19, false]);
  assert.deepEqual([at.pending, at.recommended], [20, true]);
});

test('review state rejects malformed decisions instead of hiding candidates', () => {
  assert.throws(() => validateUnmappedReview({ schemaVersion: 1, reviewThreshold: 0, decisions: [] }), /threshold/i);
  assert.throws(() => validateUnmappedReview({ schemaVersion: 1, reviewThreshold: 20, decisions: [{
    id: 'bad', status: 'applied', action: 'map-existing', target: null,
    fingerprints: ['not-a-hash'], rationale: 'Bad.', reviewedAt: '2026-09-21',
  }] }), /fingerprint|target/i);
});

test('local command reports status and compact candidates without mutating the queue', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-unmapped-review-'));
  try {
    await mkdir(path.join(root, 'config'));
    await writeFile(path.join(root, 'config/unmapped-review.json'), JSON.stringify({ schemaVersion: 1, reviewThreshold: 1, decisions: [] }));
    const job = summarized('1', emptyCard({ requirements: [unknown('Platform certification', 'Required platform certification.')] }));
    const db = await openStorage(root);
    storeState(db, { jobs: [job], importedAt: null });
    db.close();
    const script = new URL('../scripts/unmapped-review.mjs', import.meta.url);
    const run = option => spawnSync(process.execPath, [script.pathname, option], { env: { ...process.env, JOBQUEUE_ROOT: root }, encoding: 'utf8' });

    const status = run('--status');
    assert.equal(status.status, 0, status.stderr);
    assert.deepEqual(JSON.parse(status.stdout), { pending: 1, threshold: 1, recommended: true });
    const report = run('--report');
    assert.equal(report.status, 0, report.stderr);
    const payload = JSON.parse(report.stdout);
    assert.equal(payload.candidates[0].label, 'Platform certification');
    assert.equal(payload.candidates[0].offers[0].reference, 'JQ-001');
    assert.equal(run('--unknown').status, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
