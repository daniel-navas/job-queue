import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { catalog } from '../src/tag-catalog.mjs';
import { matchRequirement } from '../src/matching.mjs';
import { requirement } from '../test-support/fixtures.mjs';

const profile = JSON.parse(await readFile(new URL('../profile/matching.json', import.meta.url)));

test('editable profile contains only qualitative canonical tag values', () => {
  assert.equal(profile.schemaVersion, 2);
  assert.ok(Object.keys(profile).every(key => ['employmentPeriods', 'interests', 'schemaVersion', 'tags', 'tagUpdatedAtDefault', 'tagUpdatedAt'].includes(key)), Object.keys(profile));
  assert.ok(!('technologies' in profile));
  assert.ok(!('capabilities' in profile));
  assert.match(profile.tagUpdatedAtDefault, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  for (const [key, value] of Object.entries(profile.tags)) {
    assert.ok(catalog.tags[key], key);
    const allowed = catalog.tags[key].profileMode === 'presence' ? ['none', 'present'] : ['none', 'basic', 'independent', 'advanced'];
    assert.ok(allowed.includes(value), `${key}: ${value}`);
  }
  for (const [key, value] of Object.entries(profile.tagUpdatedAt || {})) {
    assert.ok(Object.hasOwn(profile.tags, key), key);
    assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  }
});

test('profile migration preserves confirmed levels, presence and negatives', () => {
  assert.equal(profile.tags.nodejs, 'advanced');
  assert.equal(profile.tags['data-integrity'], 'independent');
  assert.equal(profile.tags.financial, 'present');
  assert.equal(profile.tags.kubernetes, 'none');
  assert.equal(matchRequirement(requirement('kubernetes'), profile).assessment, 'no-match');
});
