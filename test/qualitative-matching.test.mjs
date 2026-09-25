import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveLevel, matchRequirement } from '../src/matching.mjs';
import { requirementLabel } from '../src/tag-catalog.mjs';

const criterion = (alternatives, overrides = {}) => ({
  label: alternatives.join(' or '), kind: 'tag', alternatives,
  level: null, minMonths: null, maxMonths: null, evidence: alternatives.join(' or '),
  ...overrides,
});

const profile = {
  schemaVersion: 2,
  tags: {
    python: 'independent',
    'data-engineering': 'none',
    nodejs: 'advanced',
    degree: 'present',
    'aws-certification': 'none',
  },
  employmentPeriods: [['2020-01', '2026-01']],
};

test('duration mapping uses the least overlapping qualitative level', () => {
  for (const [months, expected] of [[0, 'basic'], [12, 'basic'], [13, 'independent'], [36, 'independent'], [48, 'independent'], [49, 'advanced']]) {
    assert.equal(effectiveLevel({ level: null, minMonths: months }), expected, `${months} months`);
  }
});

test('explicit level wins over duration and missing thresholds default to basic', () => {
  assert.equal(effectiveLevel({ level: 'independent', minMonths: 60 }), 'independent');
  assert.equal(effectiveLevel({ level: null, minMonths: null }), 'basic');
});

test('mixed alternatives and presence tags use one canonical namespace', () => {
  assert.equal(matchRequirement(criterion(['python', 'data-engineering']), profile).assessment, 'match');
  assert.equal(matchRequirement(criterion(['data-engineering']), profile).assessment, 'no-match');
  assert.equal(matchRequirement(criterion(['degree']), profile).assessment, 'match');
  assert.equal(matchRequirement(criterion(['aws-certification']), profile).assessment, 'no-match');
  assert.equal(matchRequirement(criterion(['terraform']), profile).assessment, 'unknown');
});

test('labels show canonical alternatives, effective level and compact duration', () => {
  assert.equal(requirementLabel(criterion(['python'], { minMonths: 60 })), 'Python · Advanced · 5+ years');
  assert.equal(requirementLabel(criterion(['python'], { level: 'independent', minMonths: 60 })), 'Python · Independent · 5+ years');
  assert.equal(requirementLabel(criterion(['python', 'data-engineering'])), 'Python | Data engineering · Basic');
});
