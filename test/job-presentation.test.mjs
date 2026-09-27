import test from 'node:test';
import assert from 'node:assert/strict';
import { listTags, publicationAgeLabel } from '../public/job-presentation.js';

test('publication age labels use whole elapsed days and hide missing dates', () => {
  const now = Date.parse('2026-09-26T12:00:00Z');
  assert.equal(publicationAgeLabel(Date.parse('2026-09-26T01:00:00Z'), now), 'today');
  assert.equal(publicationAgeLabel(Date.parse('2026-09-25T11:59:59Z'), now), '1 day ago');
  assert.equal(publicationAgeLabel(Date.parse('2026-09-23T12:00:00Z'), now), '3 days ago');
  assert.equal(publicationAgeLabel(null, now), null);
});

test('list card tags expose confirmed signals through one reusable presentation contract', () => {
  const easy = { easyApply: true, rating: { fields: { easyApply: { contribution: 0.5 } } } };
  assert.deepEqual(listTags(easy), [{ label: 'Easy Apply +0.5', tone: 'positive', title: 'Easy Apply fit bonus before publication recency' }]);
  const sponsorship = {
    summary: { facts: { workCountry: { value: 'ES' }, visaSupport: { value: 'supported' } } },
    rating: { fields: { visaSupport: { contribution: 3 } } },
  };
  assert.deepEqual(listTags(sponsorship), [{ label: 'Visa sponsorship +3', tone: 'positive', title: 'Confirmed visa sponsorship bonus before publication recency' }]);
  assert.deepEqual(listTags({ ...sponsorship, rating: { fields: { visaSupport: { contribution: 0 } } } }), []);
  assert.deepEqual(listTags({}), []);
});
