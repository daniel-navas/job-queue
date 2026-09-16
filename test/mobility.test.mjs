import test from 'node:test';
import assert from 'node:assert/strict';
import { workplaceMode } from '../src/rating.mjs';
import { validateCards, currentSummary, fingerprint } from '../src/summarize.mjs';

import { emptyCard } from '../test-support/fixtures.mjs';
const preferences = { workplace: { remote: 1, hybrid: 0, onsite: -1 }, relocation: { countries: ['ES', 'DE'], workplaceScore: 0 } };
const job = (country, mode) => ({ summary: { facts: { workCountry: country ? { value: country, evidence: country } : null, workplaceMode: { value: mode, evidence: mode } } } });
test('European relocation treats work modes equally without using search intent', () => {
  for (const country of ['ES', 'DE']) for (const mode of ['remote', 'hybrid', 'onsite']) assert.equal(workplaceMode(job(country, mode), preferences).score, 0);
  assert.equal(workplaceMode(job('CO', 'remote'), preferences).score, 1);
  assert.equal(workplaceMode({ ...job(null, 'onsite'), searchUrl: 'https://www.linkedin.com/jobs/search/?location=Spain' }, preferences).score, -1);
});
test('visa support needs its own source quote and legacy cards retain unknown mobility', () => {
  const source = { id: '1', title: 'Backend', description: 'Remote in Spain. Moving expenses paid.' };
  const card = emptyCard({ visaSupport: { value: 'supported', evidence: 'We sponsor visas.' } });
  assert.throws(() => validateCards({ cards: [card] }, [source]), /Unsupported|Unexpected/);
  const legacy = { ...card }; delete legacy.visaSupport; delete legacy.workCountry; delete legacy.relocationFunding;
  const summary = currentSummary({ ...source, summary: { version: 5, inputHash: fingerprint(source), fields: legacy } });
  assert.equal(summary.facts.visaSupport, null);
  assert.equal(summary.facts.relocationFunding, null);
});
