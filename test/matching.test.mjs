import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingProfile, evaluationConfig, requirement } from '../test-support/fixtures.mjs';
import { experienceMonths, matchTags, matchRequirement } from '../src/matching.mjs';
import { evaluateJob, evaluationProgress } from '../src/evaluate.mjs';
import { displayFields } from '../src/facts.mjs';
const profile = matchingProfile();
const { preferences, scoring } = evaluationConfig();
test('candidate assessments distinguish confirmed negatives, missing facts, and unmapped criteria', () => {
  const explicitNoProfile = {
    ...profile,
    technologies: {
      ...profile.technologies,
      kubernetes: {
        label: 'Kubernetes', practicalMonths: 0, autonomy: 'unknown',
        lastUsedYear: null, professionalUse: false,
      },
    },
  };
  const missingProfile = {
    ...profile,
    technologies: { ...profile.technologies, kubernetes: undefined },
  };

  assert.equal(matchRequirement(requirement('kubernetes'), explicitNoProfile).assessment, 'no-match');
  assert.equal(matchRequirement(requirement('kubernetes'), missingProfile).assessment, 'unknown');
  assert.equal(matchRequirement(requirement('kubernetes'), profile).assessment, 'no-match');
  assert.equal(matchRequirement(requirement('unmapped', { kind: 'unknown' }), profile).assessment, 'unmapped');
});

test('OR assessments preserve unknown alternatives until one matches or all are known negatives', () => {
  const missingGo = { ...profile, technologies: { ...profile.technologies, go: undefined } };

  assert.equal(matchRequirement(requirement('any', { alternatives: ['kubernetes', 'go'] }), missingGo).assessment, 'unknown');
  assert.equal(matchRequirement(requirement('any', { alternatives: ['kubernetes'] }), profile).assessment, 'no-match');
  assert.equal(matchRequirement(requirement('any', { alternatives: ['kubernetes', 'node.js'] }), profile).assessment, 'match');
});

test('technology families evaluate their real members without inventing a missing umbrella profile entry', () => {
  const noExperience = label => ({
    label, practicalMonths: 0, autonomy: 'unknown', lastUsedYear: null, professionalUse: false,
  });
  const completeFamily = {
    ...profile,
    technologies: {
      postgresql: noExperience('PostgreSQL'),
      mysql: noExperience('MySQL'),
      mariadb: noExperience('MariaDB'),
      'sql-server': noExperience('SQL Server'),
    },
  };
  const incompleteFamily = structuredClone(completeFamily);
  delete incompleteFamily.technologies['sql-server'];

  assert.equal(matchRequirement(requirement('relational-db'), completeFamily).assessment, 'no-match');
  assert.equal(matchRequirement(requirement('relational-db'), incompleteFamily).assessment, 'unknown');
});

test('capability assessments require only the profile dimensions named by the criterion', () => {
  const capabilities = {
    ...profile,
    capabilities: {
      ...profile.capabilities,
      denied: { confirmed: false, evidence: 'Owner denied it.' },
      conceptual: { confirmed: true, evidence: 'Owner confirmed familiarity.' },
    },
  };

  assert.equal(matchRequirement(requirement('denied', { kind: 'capability' }), capabilities).assessment, 'no-match');
  assert.equal(matchRequirement(requirement('conceptual', { kind: 'capability', knowledgeLevel: 'basic' }), capabilities).assessment, 'match');
  assert.equal(matchRequirement(requirement('conceptual', { kind: 'capability', knowledgeLevel: 'advanced' }), capabilities).assessment, 'unknown');
  assert.equal(matchRequirement(requirement('conceptual', { kind: 'capability', minMonths: 12 }), capabilities).assessment, 'unknown');
});

test('evaluation progress counts only definitive candidate outcomes as resolved', () => {
  const processed = { processingStatus: 'processed' };
  const resolvedTags = {
    requiredTechnologies: [{ assessment: 'match' }],
    preferredTechnologies: [{ assessment: 'no-match' }],
    experience: [], stack: [],
  };
  const mixedTags = {
    ...resolvedTags,
    preferredTechnologies: [{ assessment: 'unknown' }],
    stack: [{ assessment: 'unmapped' }],
  };

  assert.deepEqual(evaluationProgress(processed, resolvedTags), {
    status: 'complete', resolved: 2, total: 2, profileGaps: 0, unmapped: 0,
  });
  assert.deepEqual(evaluationProgress(processed, mixedTags), {
    status: 'needs-info', resolved: 1, total: 3, profileGaps: 1, unmapped: 1,
  });
  assert.equal(evaluationProgress({ processingStatus: 'pending' }, null).status, 'pending-analysis');
  assert.deepEqual(evaluationProgress(processed, {
    requiredTechnologies: [], preferredTechnologies: [], experience: [], stack: [],
  }), { status: 'complete', resolved: 0, total: 0, profileGaps: 0, unmapped: 0 });
});
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
test('stack familiarity adds a capped optional advantage and keeps unresolved facts visible', () => {
  const evaluate = facts => evaluateJob({ ...job(facts), processingStatus: 'processed' }, profile, preferences, scoring, null);
  const empty = evaluate({ stack: [] });
  const allMatched = evaluate({ stack: [requirement('node.js'), requirement('react')] });
  const halfMatched = evaluate({ stack: [requirement('node.js'), requirement('kubernetes')] });
  const noMatch = evaluate({ stack: [requirement('kubernetes')] });
  const unknown = evaluate({ stack: [requirement('go')] });
  const deduplicated = evaluate({ requirements: [requirement('nestjs')], stack: [requirement('nestjs'), requirement('node.js')] });

  assert.deepEqual(empty.rating.fields.stack, { score: 0, reason: '0/0 confirmed stack advantages; optional non-matches and unresolved facts receive no advantage credit.', weight: 0.5, contribution: 0 });
  assert.equal(allMatched.rating.fields.stack.contribution, 0.5);
  assert.equal(halfMatched.rating.fields.stack.score, 0.5);
  assert.equal(halfMatched.rating.fields.stack.contribution, 0.25);
  assert.equal(noMatch.rating.fields.stack.contribution, 0);
  assert.equal(noMatch.evaluation.status, 'complete');
  assert.equal(unknown.evaluation.status, 'needs-info');
  assert.deepEqual(deduplicated.tags.stack.map(tag => tag.label), ['Node.js']);
});
