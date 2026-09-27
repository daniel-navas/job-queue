import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingProfile, evaluationConfig, requirement, emptyCard } from '../test-support/fixtures.mjs';
import { experienceMonths, matchTags, matchRequirement } from '../src/matching.mjs';
import { evaluateJob, evaluationProgress } from '../src/evaluate.mjs';
import { displayFields } from '../src/facts.mjs';

const profile = matchingProfile();
const { preferences, scoring } = evaluationConfig();
const facts = { requirements: [], preferred: [], stack: [], projectTags: [], software: null, work: null };
const job = (data = {}) => { const value = { ...facts, ...data }; return { id: 'job', summary: { facts: value, fields: displayFields(value) } }; };

test('candidate assessments distinguish negatives, missing facts and unmapped criteria', () => {
  assert.equal(matchRequirement(requirement('kubernetes'), profile).assessment, 'no-match');
  assert.equal(matchRequirement(requirement('terraform'), profile).assessment, 'unknown');
  assert.equal(matchRequirement(requirement('unmapped', { kind: 'unknown', alternatives: ['unmapped'] }), profile).assessment, 'unmapped');
});

test('OR keeps an unknown until one alternative matches or all are negatives', () => {
  assert.equal(matchRequirement(requirement('any', { alternatives: ['kubernetes', 'terraform'] }), profile).assessment, 'unknown');
  assert.equal(matchRequirement(requirement('any', { alternatives: ['kubernetes', 'mariadb'] }), profile).assessment, 'no-match');
  assert.equal(matchRequirement(requirement('any', { alternatives: ['kubernetes', 'nodejs'] }), profile).assessment, 'match');
});

test('families inspect members and summarize confirmed negatives', () => {
  const compiled = { ...profile, tags: { ...profile.tags, go: 'none', rust: 'none', 'c++': 'none', csharp: 'none', kotlin: 'none', scala: 'none' } };
  const result = matchRequirement(requirement('compiled-language', { level: 'independent' }), compiled);
  assert.equal(result.assessment, 'no-match');
  assert.deepEqual(result.profileSummary, ['Java · Basic', 'None: Go, Rust, C++, C#, Kotlin, Scala']);
});

test('general employment duration remains exact and deduplicates overlaps', () => {
  assert.equal(experienceMonths([['2020-01','2020-02'],['2020-02','2020-03'],['2021-01','2021-01']]), 4);
  assert.equal(matchRequirement(requirement('professional', { kind: 'experience', minMonths: 60 }), profile).assessment, 'match');
});

test('evaluation progress and score use renamed requirement groups', () => {
  const tags = { requirements: [{ assessment: 'match' }], preferred: [{ assessment: 'no-match' }], experience: [], stack: [] };
  assert.deepEqual(evaluationProgress({ processingStatus: 'processed' }, tags), { status: 'complete', resolved: 2, total: 2, profileGaps: 0, unmapped: 0 });
  const offer = job({ requirements: [requirement('nestjs'), requirement('go')], projectTags: [] });
  const evaluated = evaluateJob(offer, profile, preferences, scoring, null);
  assert.equal(evaluated.rating.fields.requirements.score, 0.5);
  assert.equal(evaluated.rating.fields.requirements.contribution, 1);
});

test('evaluation exposes fit and applies recency symmetrically to final priority', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  const multiplierScoring = { ...scoring, recencyBands: [{ maxAgeDays: 1, multiplier: 1.5 }, { multiplier: 0.5 }] };
  const positive = evaluateJob({ ...job({ requirements: [requirement('nestjs')], software: true }), publishedAt: now }, profile, preferences, multiplierScoring, null, now);
  const negative = evaluateJob({ ...job(), publishedAt: now }, profile, preferences, multiplierScoring, null, now);

  assert.deepEqual(
    { fit: positive.rating.fields.publishedRecency.fitScore, multiplier: positive.rating.fields.publishedRecency.multiplier, priority: positive.rating.total },
    { fit: 2, multiplier: 1.5, priority: 3 },
  );
  assert.deepEqual(
    { fit: negative.rating.fields.publishedRecency.fitScore, multiplier: negative.rating.fields.publishedRecency.multiplier, priority: negative.rating.total },
    { fit: -1, multiplier: 1.5, priority: -0.67 },
  );
});

test('confirmed Easy Apply adds a small configurable fit bonus', () => {
  const offer = job({ requirements: [requirement('nestjs')], software: true });
  const bonusScoring = { ...scoring, weights: { ...scoring.weights, easyApply: 0.5 } };
  const ordinary = evaluateJob(offer, profile, preferences, bonusScoring, null);
  const easy = evaluateJob({ ...offer, easyApply: true }, profile, preferences, bonusScoring, null);

  assert.equal(ordinary.rating.fields.easyApply.contribution, 0);
  assert.equal(easy.rating.fields.easyApply.contribution, 0.5);
  assert.equal(easy.rating.total - ordinary.rating.total, 0.5);
});

test('confirmed visa sponsorship adds three fit points only for work outside Colombia', () => {
  const sponsorshipScoring = { ...scoring, weights: { ...scoring.weights, visaSupport: 3 } };
  const supported = { value: 'supported', evidence: 'We sponsor work visas.' };
  const spain = job({
    software: { value: 'Payments platform', evidence: 'Payments platform' },
    workCountry: { value: 'ES', evidence: 'Madrid, Spain' },
    visaSupport: supported,
  });
  const colombia = job({
    software: { value: 'Payments platform', evidence: 'Payments platform' },
    workCountry: { value: 'CO', evidence: 'Bogota, Colombia' },
    visaSupport: supported,
  });
  const unsupported = job({
    software: { value: 'Payments platform', evidence: 'Payments platform' },
    workCountry: { value: 'DE', evidence: 'Berlin, Germany' },
    visaSupport: { value: 'not-supported', evidence: 'No visa sponsorship.' },
  });
  const malformedCountry = job({
    software: { value: 'Payments platform', evidence: 'Payments platform' },
    workCountry: { value: 'unknown', evidence: 'Location not specified' },
    visaSupport: supported,
  });
  const paddedColombia = job({
    software: { value: 'Payments platform', evidence: 'Payments platform' },
    workCountry: { value: 'CO ', evidence: 'Bogota, Colombia' },
    visaSupport: supported,
  });

  const ordinary = evaluateJob(job({ software: { value: 'Payments platform', evidence: 'Payments platform' } }), profile, preferences, sponsorshipScoring, null);
  const abroad = evaluateJob(spain, profile, preferences, sponsorshipScoring, null);
  const local = evaluateJob(colombia, profile, preferences, sponsorshipScoring, null);
  const refused = evaluateJob(unsupported, profile, preferences, sponsorshipScoring, null);
  const malformed = evaluateJob(malformedCountry, profile, preferences, sponsorshipScoring, null);
  const paddedLocal = evaluateJob(paddedColombia, profile, preferences, sponsorshipScoring, null);

  assert.equal(abroad.rating.fields.visaSupport.contribution, 3);
  assert.equal(abroad.rating.total - ordinary.rating.total, 3);
  assert.equal(local.rating.fields.visaSupport.contribution, 0);
  assert.equal(refused.rating.fields.visaSupport.contribution, 0);
  assert.equal(malformed.rating.fields.visaSupport.contribution, 0);
  assert.equal(paddedLocal.rating.fields.visaSupport.contribution, 0);
});

test('stack familiarity requires only basic level and remains capped', () => {
  const offer = { ...job({ stack: [requirement('docker'), requirement('terraform')] }), processingStatus: 'processed' };
  const evaluated = evaluateJob(offer, profile, preferences, scoring, null);
  assert.equal(evaluated.tags.stack[0].assessment, 'match');
  assert.equal(evaluated.tags.stack[1].assessment, 'unknown');
  assert.equal(evaluated.rating.fields.stack.contribution, 0.25);
});

test('display fields use generic requirements and preferred names', () => {
  const fields = displayFields(emptyCard({ requirements: [requirement('python')], preferred: [requirement('docker')] }));
  assert.equal(fields.requirements.value, 'Python · Basic');
  assert.equal(fields.preferred.value, 'Docker · Basic');
});
