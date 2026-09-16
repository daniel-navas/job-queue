import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingProfile, evaluationConfig, requirement } from '../test-support/fixtures.mjs';
import { experienceMonths, matchTags, matchRequirement } from '../src/matching.mjs';
import { evaluateJob } from '../src/evaluate.mjs';
import { displayFields } from '../src/facts.mjs';
const profile = matchingProfile();
const { preferences, scoring } = evaluationConfig();
test('technology thresholds enforce duration, autonomy and last use at their boundaries', () => {
  for (const [key, months, autonomy, year] of [
    ['react', 36, 'independent', 2022], ['docker', 12, 'basic', 2023],
    ['gcp', 12, 'independent', 2026], ['sql', 36, 'basic', 2026],
  ]) {
    const base = { minMonths: months, autonomy, lastUsedYear: year };
    for (const [label, overrides, expected] of [
      ['exact thresholds', base, 1],
      ['insufficient months', { ...base, minMonths: months + 12 }, 0],
      ['insufficient autonomy', { ...base, autonomy: autonomy === 'basic' ? 'independent' : 'advanced' }, 0],
      ['outdated use', { ...base, lastUsedYear: year + 1 }, 0],
    ]) assert.equal(matchRequirement(requirement(key, overrides), profile, 2026).score, expected, `${key}: ${label}`);
  }
  assert.equal(matchRequirement(requirement('docker'), profile).score, 0, 'Default technology autonomy is independent');
  assert.equal(matchRequirement(requirement('kubernetes'), profile).score, 0, 'Docker does not establish Kubernetes experience');
});
const facts = { requirements: [], preferred: [], stack: [], projectTags: [], software: null, work: null };
const job = (data = {}) => { const value = { ...facts, ...data }; return { id: 'any-new-id', summary: { facts: value, fields: displayFields(value) } }; };
test('experience deduplicates boundary overlaps and excludes gaps', () => {
  assert.equal(experienceMonths([['2020-01','2020-02'],['2020-02','2020-03'],['2021-01','2021-01']]),4);
});
test('every ID uses the same typed technology matcher, never evidence string presence', () => {
  for (const id of ['new-offer', '4446543828', '4179554853']) {
    const tags = matchTags({ ...job({ requirements: [requirement('nestjs'), requirement('go'), requirement('java')] }), id }, profile);
    assert.deepEqual(tags.requiredTechnologies.map(t => t.score), [1,0,0]);
  }
  const uncalibrated = { ...profile, technologies: { ...profile.technologies, react: undefined } };
  assert.equal(matchRequirement(requirement('react'), uncalibrated).score, 0);
});
test('explicit thresholds, aliases, families and OR groups are respected', () => {
  const match = r => matchRequirement(r, profile).score;
  assert.equal(match(requirement('NestJS', { minMonths: 36 })), 1);
  assert.equal(match(requirement('modern-frontend')), 1);
  assert.equal(match(requirement('nestjs', { minMonths: 48 })), 0);
  assert.equal(match(requirement('nestjs', { lastUsedYear: 2024 })), 0);
  assert.equal(match(requirement('nestjs', { autonomy: 'advanced' })), 0);
  assert.equal(match(requirement('java', { autonomy: 'basic' })), 1);
  assert.equal(match(requirement('compiled-language')), 0);
  assert.equal(match(requirement('orm')), 1);
  assert.equal(match(requirement('relational-db')), 0);
  assert.equal(match(requirement('relational-db', { autonomy: 'basic' })), 1);
  assert.equal(match(requirement('any', { alternatives: ['go','node.js'] })), 1);
});
test('general years and capabilities do not invent technology or domain duration', () => {
  assert.equal(matchRequirement(requirement('professional', { kind:'experience', minMonths:72 }),profile).score,1);
  assert.equal(matchRequirement(requirement('financial', { kind:'experience', minMonths:72 }),profile).score,0);
  assert.equal(matchRequirement(requirement('financial', { kind:'capability' }),profile).score,1);
  assert.equal(matchRequirement(requirement('financial', { kind:'capability', minMonths:12 }),profile).score,0);
  assert.equal(matchRequirement(requirement('leadership', { kind:'unknown' }),profile).score,0);
});
test('typed capabilities respect duration, autonomy and last-use thresholds', () => {
  const fullstack=requirement('full-stack',{kind:'capability',minMonths:36,autonomy:'independent',lastUsedYear:2026});
  assert.equal(matchRequirement(fullstack,profile).score,1);
  assert.equal(matchRequirement({...fullstack,minMonths:60},profile).score,0);
  assert.equal(matchRequirement({...fullstack,autonomy:'advanced'},profile).score,0);
});
test('relative recency and conceptual knowledge are matched independently', () => {
  assert.equal(matchRequirement(requirement('react',{maxYearsSinceUse:5}),profile,2026).score,1);
  assert.equal(matchRequirement(requirement('react',{maxYearsSinceUse:3}),profile,2026).score,0);
  const conceptual={...profile,capabilities:{...profile.capabilities,'data-structures':{confirmed:true,knowledgeLevel:'intermediate',evidence:'Owner confirmed.'}}};
  assert.equal(matchRequirement(requirement('data-structures',{kind:'capability',knowledgeLevel:'basic'}),conceptual,2026).score,1);
  assert.equal(matchRequirement(requirement('data-structures',{kind:'capability',knowledgeLevel:'advanced'}),conceptual,2026).score,0);
  assert.equal(matchRequirement(requirement('secure-coding',{kind:'capability',knowledgeLevel:'basic'}),profile,2026).score,1);
  assert.equal(matchRequirement(requirement('secure-coding',{kind:'capability',knowledgeLevel:'intermediate'}),profile,2026).score,0);
});
test('preferences, weights and profile recalculate without changing extracted facts', () => {
  const offer = job({ software:{value:'HR platform.',evidence:'HR platform.'}, requirements: [requirement('nestjs'),requirement('go')], projectTags:[{ key:'hr-platform',evidence:'HR platform' },{key:'fintech',evidence:'fintech'}] });
  const before = JSON.stringify(offer);
  const first = evaluateJob(offer, profile, preferences, scoring, null);
  assert.equal(first.rating.fields.requiredTechnologies.score,.5);
  const next = evaluateJob(offer, profile, {...preferences,projectTags:{'hr-platform':-3}}, {...scoring,weights:{...scoring.weights,requiredTechnologies:4}}, null);
  assert.equal(next.rating.fields.project.score,-3);
  assert.equal(next.rating.fields.requiredTechnologies.contribution,2);
  const updated = structuredClone(profile); updated.technologies.go = { label:'Go', autonomy:'independent',practicalMonths:12,lastUsedYear:2026 };
  assert.equal(evaluateJob(offer,updated,preferences,scoring,null).rating.fields.requiredTechnologies.score,1);
  assert.equal(JSON.stringify(offer),before);
});
test('independent project preferences add instead of collapsing to one signal', () => {
  const offer = job({ software:{value:'Consumer crypto product.',evidence:'Product description.'}, projectTags:[
    {key:'mixed-audience',evidence:'Individuals and institutions.'},
    {key:'crypto-trading',evidence:'Digital asset trading.'},
    {key:'growth-work',evidence:'Growth Engineering team.'}
  ] });
  const result = evaluateJob(offer,profile,preferences,scoring,null);
  assert.equal(result.rating.fields.project.score,3);
  assert.equal(result.rating.fields.project.contribution,3);
  assert.match(result.rating.fields.project.reason,/additive/i);
});
test('stack is unscored and duplicate technologies are omitted', () => {
  const offer = job({ requirements:[requirement('nestjs')],stack:[requirement('nestjs'),requirement('aws')] });
  assert.deepEqual(matchTags(offer,profile).stack.map(t=>t.label),['AWS']);
  assert.equal(evaluateJob(offer,profile,preferences,scoring,null).rating.fields.stack,undefined);
});
