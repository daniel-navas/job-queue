import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { displayFields } from '../src/facts.mjs';
import { rateJob } from '../src/rating.mjs';
import { companyTypeInstructions, companyTypeKeys, companyTypes } from '../src/company-types.mjs';
import { emptyCard } from '../test-support/fixtures.mjs';

test('company type classifier instructions contain every normalized catalog definition', () => {
  assert.deepEqual(companyTypeKeys, ['product', 'outsourcing', 'recruiting-intermediary', 'unknown']);
  const instructions = companyTypeInstructions();
  for (const [key, type] of Object.entries(companyTypes)) {
    assert.match(instructions, new RegExp(`^- ${key}: ${type.definition.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'm'));
  }
  assert.equal(instructions.split('\n').filter(line => line.startsWith('- ')).length, companyTypeKeys.length);
});

test('legacy recruiting intermediary values use the normalized negative preference', async () => {
  const preferences = JSON.parse(await readFile(new URL('../config/preferences.json', import.meta.url), 'utf8'));
  const job = { summary: { fields: {
    companyType: { value: 'recruiting intermediary', evidence: 'Recruiting intermediary' },
    project: { value: 'Client platform', evidence: 'Client platform' },
  } } };

  const rating = rateJob(job, preferences);

  assert.equal(rating.fields.companyType.score, -1);
  assert.equal(rating.total, -1);
});

test('outsourcing company is a normalized negative preference', async () => {
  const preferences = JSON.parse(await readFile(new URL('../config/preferences.json', import.meta.url), 'utf8'));
  const rating = rateJob({ summary: { fields: {
    companyType: { value: 'outsourcing', evidence: 'Engineering services for client teams.' },
    project: { value: 'Client platform', evidence: 'Client platform' },
  } } }, preferences);

  assert.equal(rating.fields.companyType.score, -1);
  assert.equal(rating.total, -1);
});

test('company types expose display labels without losing their configured score', async () => {
  const preferences = JSON.parse(await readFile(new URL('../config/preferences.json', import.meta.url), 'utf8'));
  const fields = displayFields(emptyCard({
    companyType: { value: 'product', evidence: 'We build our own product.' },
    software: { value: 'Owned platform', evidence: 'Owned platform' },
  }));

  assert.equal(fields.companyType.value, 'Product company');
  assert.equal(fields.companyType.evidence, 'We build our own product.');
  assert.equal(rateJob({ summary: { fields } }, preferences).fields.companyType.score, 1);
});
