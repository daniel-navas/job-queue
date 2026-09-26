import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { profileReview, ProfileStore } from '../src/profile-review.mjs';
import { emptyCard, requirement } from '../test-support/fixtures.mjs';

const activeJob = (id, requirements, score, overrides = {}) => ({
  id,
  reference: `JQ-${id}`,
  title: `Role ${id}`,
  company: `Company ${id}`,
  status: 'new',
  availability: { status: 'open' },
  application: null,
  processingStatus: 'processed',
  rating: { total: score },
  summary: { facts: emptyCard({ requirements }).requirements ? emptyCard({ requirements }) : null },
  ...overrides,
});

test('profile review counts each missing fact once per active job and orders by reach', () => {
  const profile = { schemaVersion: 2, interests: [], employmentPeriods: [['2020-01', '2021-01']], tags: { nodejs: 'advanced' } };
  const jobs = [
    activeJob('001', [requirement('data-modeling')], 4, { summary: { facts: emptyCard({ requirements: [requirement('data-modeling')], preferred: [requirement('data-modeling')] }) } }),
    activeJob('002', [requirement('data-modeling'), requirement('financial')], 2),
    activeJob('003', [requirement('graphql')], 10),
    activeJob('004', [requirement('graphql')], 20, { status: 'dismissed' }),
    activeJob('005', [requirement('graphql')], 20, { availability: { status: 'closed' } }),
    activeJob('006', [requirement('graphql')], 20, { application: { submission: {} } }),
  ];

  const result = profileReview(jobs, profile);

  assert.equal(result.pendingCount, 3);
  assert.deepEqual(result.items.map(item => item.label), ['Data modeling', 'GraphQL', 'Financial domain']);
  assert.equal(result.items[0].activeJobCount, 2);
  assert.deepEqual(result.items[0].jobs.map(job => job.id), ['001', '002']);
  assert.deepEqual(result.items[0].jobs[0].groups, ['requirements', 'preferred']);
  assert.equal(result.items[2].facts[0].mode, 'presence');
  assert.deepEqual(result.allFacts.map(fact => fact.key), ['nodejs']);
});

test('saved profile facts are ordered by most recently updated', () => {
  const profile = {
    schemaVersion: 2,
    interests: [],
    employmentPeriods: [],
    tags: { angular: 'basic', nodejs: 'advanced', react: 'independent' },
    tagUpdatedAtDefault: '2026-09-23T12:00:00.000Z',
    tagUpdatedAt: {
      nodejs: '2026-09-26T12:00:00.000Z',
      react: '2026-09-25T12:00:00.000Z',
    },
  };

  const result = profileReview([], profile);

  assert.deepEqual(result.allFacts.map(fact => fact.key), ['nodejs', 'react', 'angular']);
  assert.equal(result.allFacts[2].updatedAt, '2026-09-23T12:00:00.000Z');
});

test('overlapping requested families form one task without duplicate facts', () => {
  const profile = { schemaVersion: 2, interests: [], employmentPeriods: [], tags: { java: 'basic' } };
  const jobs = [
    activeJob('001', [requirement('compiled-language', { level: 'independent' })], 3),
    activeJob('002', [requirement('server-side-language', { level: 'independent' })], 2),
  ];

  const result = profileReview(jobs, profile);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].label, 'Server-side and compiled languages');
  assert.equal(new Set(result.items[0].facts.map(fact => fact.key)).size, result.items[0].facts.length);
  assert.deepEqual(result.items[0].facts.find(fact => fact.key === 'java'), {
    key: 'java', label: 'Java', mode: 'level', value: 'basic', pending: false,
  });
  assert.equal(result.pendingCount, result.items[0].facts.filter(fact => fact.pending).length);
});

test('unmapped criteria count affected active jobs but never become profile facts', () => {
  const profile = { schemaVersion: 2, interests: [], employmentPeriods: [], tags: {} };
  const unmapped = requirement('unmapped', { kind: 'unknown', alternatives: ['unmapped'], label: 'Unmapped', evidence: 'Unmapped source' });
  const result = profileReview([
    activeJob('001', [unmapped, unmapped], 2),
    activeJob('002', [unmapped], 1, { status: 'dismissed' }),
  ], profile);

  assert.equal(result.activeUnmappedJobs, 1);
  assert.equal(result.pendingCount, 0);
  assert.deepEqual(result.items, []);
});

test('profile store applies a validated batch atomically and preserves unrelated data', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jq-profile-'));
  try {
    await mkdir(path.join(root, 'profile'));
    const original = {
      schemaVersion: 2,
      interests: ['go'],
      employmentPeriods: [['2020-01', '2021-01']],
      tags: { nodejs: 'advanced' },
      tagUpdatedAt: { nodejs: '2026-09-01T12:00:00.000Z' },
    };
    await writeFile(path.join(root, 'profile/matching.json'), JSON.stringify(original, null, 2) + '\n');
    const store = new ProfileStore(root);

    await store.update([{ key: 'data-modeling', value: 'independent' }, { key: 'financial', value: 'present' }]);
    const updated = await store.read();
    assert.deepEqual(updated.tags, { nodejs: 'advanced', 'data-modeling': 'independent', financial: 'present' });
    assert.equal(updated.tagUpdatedAt.nodejs, '2026-09-01T12:00:00.000Z');
    assert.match(updated.tagUpdatedAt['data-modeling'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(updated.tagUpdatedAt.financial, updated.tagUpdatedAt['data-modeling']);

    const beforeInvalid = await readFile(path.join(root, 'profile/matching.json'), 'utf8');
    await assert.rejects(store.update([{ key: 'graphql', value: 'basic' }, { key: 'financial', value: 'advanced' }]), /Invalid profile value/);
    assert.equal(await readFile(path.join(root, 'profile/matching.json'), 'utf8'), beforeInvalid);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
