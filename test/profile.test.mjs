import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { catalog } from '../src/tag-catalog.mjs';
import { matchRequirement } from '../src/matching.mjs';
import { requirement } from '../test-support/fixtures.mjs';

const profile = JSON.parse(await readFile(new URL('../profile/matching.json', import.meta.url)));
const preferences = JSON.parse(await readFile(new URL('../config/preferences.json', import.meta.url)));
const scoring = JSON.parse(await readFile(new URL('../config/scoring.json', import.meta.url)));

test('editable profile and preferences contain valid deterministic inputs', () => {
  assert.equal(profile.schemaVersion, 1);
  for (const [key, entry] of Object.entries(profile.technologies)) {
    assert.ok(catalog.technology[key], key);
    assert.ok(typeof entry.label === 'string' && entry.label.trim(), key);
    assert.ok(['basic', 'independent', 'advanced', 'unknown'].includes(entry.autonomy), key);
    assert.ok(entry.practicalMonths === null || Number.isFinite(entry.practicalMonths) && entry.practicalMonths >= 0, key);
    assert.ok(entry.lastUsedYear === null || Number.isInteger(entry.lastUsedYear) && entry.lastUsedYear >= 1970, key);
    assert.equal(typeof entry.professionalUse, 'boolean', key);
  }
  for (const [key, entry] of Object.entries(profile.capabilities)) {
    assert.ok(catalog.capability[key], key);
    assert.equal(typeof entry.confirmed, 'boolean', key);
    assert.ok(!Object.hasOwn(entry, 'evidence'), `${key} must not duplicate owner confirmation as evidence`);
    if (entry.autonomy != null) assert.ok(['basic', 'independent', 'advanced', 'unknown'].includes(entry.autonomy), key);
    if (entry.knowledgeLevel != null) assert.ok(['basic', 'intermediate', 'advanced'].includes(entry.knowledgeLevel), key);
    if (entry.practicalMonths != null) assert.ok(Number.isFinite(entry.practicalMonths) && entry.practicalMonths >= 0, key);
    if (entry.lastUsedYear != null) assert.ok(Number.isInteger(entry.lastUsedYear) && entry.lastUsedYear >= 1970, key);
  }
  for (const [start, end] of profile.employmentPeriods) {
    assert.match(start, /^\d{4}-(0[1-9]|1[0-2])$/);
    assert.match(end, /^\d{4}-(0[1-9]|1[0-2])$/);
    assert.ok(start <= end, 'Employment periods cannot end before they start');
  }
  for (const key of Object.keys(preferences.projectTags)) assert.ok(catalog.project[key], key);
  for (const section of ['roleFocus', 'workplace', 'companyType', 'projectTags']) {
    for (const value of Object.values(preferences[section])) assert.ok(Number.isFinite(value), section);
  }
  for (const key of ['backend', 'fullstack', 'frontend']) assert.ok(Number.isFinite(preferences.roleFocus[key]), key);
  for (const key of ['remote', 'hybrid', 'onsite']) assert.ok(Number.isFinite(preferences.workplace[key]), key);
  for (const value of Object.values(scoring.weights)) assert.ok(Number.isFinite(value));
});

test('profile records the owner-confirmed production and transaction capabilities', () => {
  assert.equal(profile.capabilities['data-integrity']?.knowledgeLevel, 'intermediate');
  assert.equal(profile.capabilities['production-operations']?.knowledgeLevel, 'intermediate');
});

test('the editable profile resolves an explicit zero-experience technology as a non-match', () => {
  assert.equal(matchRequirement(requirement('kubernetes'), profile).assessment, 'no-match');
});
