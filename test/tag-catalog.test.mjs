import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingProfile, emptyCard, requirement as makeRequirement } from '../test-support/fixtures.mjs';
import { catalog, normalizeKnownFacts, upgradeLegacyCard, requirementLabel, resolveTag, selectableKeys, catalogInstructions } from '../src/tag-catalog.mjs';
import { validateCards, currentSummary, fingerprint, pendingJobs } from '../src/summarize.mjs';
import { matchRequirement, matchTags, projectTags } from '../src/matching.mjs';
const profile = matchingProfile();
const requirement = (overrides = {}) => makeRequirement('docker', { label: 'Ignored AI spelling', evidence: 'Docker', ...overrides });
const card = emptyCard;
test('family references belong to the shared catalog', () => {
  for (const entry of Object.values(catalog.technology)) {
    for (const key of entry.members || []) assert.ok(catalog.technology[key],key);
    if (entry.capability) assert.ok(catalog.capability[entry.capability]);
  }
});
test('growth capabilities use balanced canonical concepts and preserve old A/B facts', () => {
  assert.deepEqual(resolveTag('ab-testing'),{kind:'capability',key:'product-experimentation'});
  for (const key of ['product-experimentation','analytics-instrumentation','product-analytics','growth-engineering']) assert.ok(catalog.capability[key],key);
  assert.ok(catalog.project['growth-work']);
});
test('production operations is a canonical capability for owning live services', () => {
  assert.equal(catalog.capability['production-operations']?.label, 'Production operations');
  assert.equal(catalog.capability['production-operations']?.definition, 'Operating and owning live production services.');
});
test('production-operations wording normalizes instead of remaining unmapped', () => {
  const normalized = normalizeKnownFacts({ ...card(), requirements: [{
    label: 'Business-critical system operations', kind: 'unknown', alternatives: ['unmapped'],
    minMonths: null, maxMonths: null, autonomy: null, knowledgeLevel: null,
    lastUsedYear: null, maxYearsSinceUse: null,
    evidence: 'Track record of owning and operating business-critical systems.'
  }] });
  assert.deepEqual(normalized.requirements[0].alternatives, ['production-operations']);
  assert.equal(normalized.requirements[0].kind, 'capability');
});
test('recognized growth evidence normalizes OR criteria and assigned work without job exceptions', () => {
  const facts={...card(),work:{value:'Build onboarding funnels and improve activation, retention and monetization.',evidence:'improve activation, retention and monetization'},preferred:[
    {label:'Experimentation or analytics instrumentation',kind:'unknown',alternatives:['unmapped'],minMonths:null,maxMonths:null,autonomy:null,knowledgeLevel:null,lastUsedYear:null,maxYearsSinceUse:null,evidence:'Experience with A/B testing, analytics instrumentation, or experimentation platforms.'},
    {label:'Analysis or experimentation tools',kind:'unknown',alternatives:['unmapped'],minMonths:null,maxMonths:null,autonomy:'basic',knowledgeLevel:null,lastUsedYear:null,maxYearsSinceUse:null,evidence:'Familiarity with data analysis tools or experimentation frameworks.'}
  ]};
  const normalized=normalizeKnownFacts(facts);
  assert.deepEqual(normalized.preferred.map(item=>item.alternatives),[
    ['product-experimentation','analytics-instrumentation'],
    ['product-experimentation','product-analytics']
  ]);
  assert.deepEqual(normalized.preferred.map(item=>item.kind),['capability','capability']);
  assert.equal(normalized.preferred[1].autonomy,null);
  assert.equal(normalized.preferred[1].knowledgeLevel,'basic');
  assert.deepEqual(normalized.projectTags,[{key:'growth-work',evidence:'improve activation, retention and monetization'}]);
});
test('commodity expectations cannot enter a new extraction or legacy denominator', () => {
  for (const key of ['team-problem-solving','engineering-process','agile','pair-programming','code-review','collaboration','generic-problem-solving','generic-debugging','generic-communication','clean-code','fast-paced','adaptability','ownership']) assert.equal(selectableKeys('capability').includes(key),false,key);
  assert.equal(selectableKeys('technology').includes('git'),false);
  assert.match(catalogInstructions(),/NON-DIFFERENTIATING/);
  const legacy={...card(),requirements:[
    {...requirement({kind:'capability',alternatives:['team-technical-problem-solving']}),maxMonths:undefined},
    {...requirement({kind:'capability',alternatives:['degree']}),maxMonths:undefined},
  ],preferred:[{...requirement({kind:'capability',alternatives:['engineering-process']}),maxMonths:undefined}]};
  const upgraded=upgradeLegacyCard(legacy);
  assert.deepEqual(upgraded.requirements.map(item=>item.alternatives),[['degree']]);
  assert.deepEqual(upgraded.preferred,[]);
});
test('schema enforces catalog keys and kinds, with a single explicit unmapped fallback', () => {
  const job={id:'1',title:'Engineer',description:'Docker. An unusual requirement.'};
  const valid={...card(),requirements:[requirement()]};
  assert.equal(validateCards({cards:[valid]},[job]).length,1);
  for (const invalid of [requirement({alternatives:['dockerr']}),requirement({kind:'capability'}),requirement({kind:'unknown',alternatives:['invented']})]) assert.throws(()=>validateCards({cards:[{...card(),requirements:[invalid]}]},[job]));
  const unmapped=requirement({kind:'unknown',alternatives:['unmapped'],label:'Unusual requirement',evidence:'An unusual requirement.'});
  assert.equal(validateCards({cards:[{...card(),requirements:[unmapped]}]},[job]).length,1);
  assert.equal(matchRequirement(unmapped,profile).score,0);
});
test('mutually exclusive audiences cannot create a spurious B2B penalty', () => {
  const source={id:'1',description:'Consumers and merchants. Businesses.'};
  const conflicting={...card(),projectTags:[{key:'consumer',evidence:'Consumers and merchants.'},{key:'b2b',evidence:'Businesses.'}]};
  assert.throws(()=>validateCards({cards:[conflicting]},[source]),/audience/);
  const upgraded=upgradeLegacyCard(conflicting);
  assert.deepEqual(upgraded.projectTags.map(t=>t.key),['mixed-audience']);
  assert.equal(projectTags({summary:{facts:upgraded}},{b2b:-1})[0].score,0);
  assert.equal(projectTags({summary:{facts:{projectTags:[{key:'b2b',evidence:'Corporate treasury'}]}}},{b2b:-1})[0].score,-1);
});
test('duration label preserves published range while matching only its minimum', () => {
  const r=requirement({kind:'experience',alternatives:['professional'],minMonths:36,maxMonths:84,evidence:'3-7 years'});
  assert.equal(requirementLabel(r),'3–7 years · Software engineering');
  assert.equal(matchRequirement(r,profile).score,1);
  assert.equal(requirementLabel({...r,maxMonths:null}),'3+ years · Software engineering');
  assert.throws(()=>validateCards({cards:[{...card(),requirements:[{...r,maxMonths:12}]}]},[{id:'1',description:'3-7 years'}]),/range/);
});
test('requirement labels expose explicit autonomy and last-use thresholds', () => {
  assert.equal(requirementLabel(requirement({alternatives:['typescript'],autonomy:'independent',lastUsedYear:2024})),'TypeScript · Independent · Used 2024+');
  assert.equal(requirementLabel(requirement({alternatives:['typescript'],minMonths:24,autonomy:'advanced'})),'2+ years · TypeScript · Advanced');
  assert.equal(requirementLabel(requirement({kind:'capability',alternatives:['data-structures'],knowledgeLevel:'advanced'})),'Data structures · Advanced knowledge');
  assert.equal(requirementLabel(requirement({alternatives:['typescript'],maxYearsSinceUse:5})),'TypeScript · Recent · ≤5 years');
});
test('a generic NoSQL profile fact matches only the generic family requirement', () => {
  const general=requirement({alternatives:['nosql'],autonomy:'basic',minMonths:12,lastUsedYear:2022});
  assert.equal(matchRequirement(general,profile).score,1);
  assert.equal(matchRequirement({...general,autonomy:'independent'},profile).score,0);
  assert.equal(matchRequirement({...general,alternatives:['mongodb']},profile).score,0);
});
test('legacy conversion preserves sources and avoids an unnecessary AI rerun', () => {
  const old={...card(),requirements:[
    {...requirement({kind:'experience',alternatives:['professional'],minMonths:36,evidence:'3-7 years'}),maxMonths:undefined},
    {...requirement({kind:'unknown',alternatives:['data-structures'],label:'Data structures',evidence:'Strong understanding of data structures.'}),maxMonths:undefined}
  ]};
  const job={id:'1',description:'3-7 years. Strong understanding of data structures.'};
  job.summary={version:3,inputHash:fingerprint(job),fields:old};
  const before=JSON.stringify(job);
  const summary=currentSummary(job);
  assert.equal(matchTags({...job,summary},profile).experience[0].label,'3–7 years · Software engineering');
  assert.equal(summary.facts.requirements.find(r=>r.alternatives.includes('data-structures')).knowledgeLevel,'advanced');
  assert.deepEqual(pendingJobs([job]),[]);
  assert.equal(JSON.stringify(job),before);
});
test('version-4 cards gain knowledge metadata and drop generic debugging without AI', () => {
  const old={...card(),requirements:[
    {label:'Data structures',kind:'capability',alternatives:['data-structures'],minMonths:null,maxMonths:null,autonomy:null,lastUsedYear:null,evidence:'Strong understanding of data structures.'},
    {label:'Software debugging',kind:'unknown',alternatives:['unmapped'],minMonths:null,maxMonths:null,autonomy:null,lastUsedYear:null,evidence:'Understanding of debugging.'}
  ],preferred:[{label:'Secure coding familiarity',kind:'capability',alternatives:['secure-coding'],minMonths:null,maxMonths:null,autonomy:'basic',lastUsedYear:null,evidence:'Familiarity with secure coding.'}]};
  const job={id:'1',description:'Strong understanding of data structures. Understanding of debugging. Familiarity with secure coding.'};
  job.summary={version:4,inputHash:fingerprint(job),fields:old};
  const summary=currentSummary(job);
  assert.equal(summary.facts.requirements.length,1);
  assert.equal(summary.facts.requirements[0].knowledgeLevel,'advanced');
  assert.equal(summary.facts.requirements[0].autonomy,null);
  assert.equal(summary.facts.requirements[0].maxYearsSinceUse,null);
  assert.equal(summary.facts.preferred[0].autonomy,null);
  assert.equal(summary.facts.preferred[0].knowledgeLevel,'basic');
  assert.deepEqual(pendingJobs([job]),[]);
});
test('distinct unmapped requirements do not disappear from the denominator', () => {
  const a=requirement({kind:'unknown',alternatives:['unmapped'],label:'A'}),b={...a,label:'B'};
  const tags=matchTags({summary:{facts:{...card(),requirements:[a,b]}}},profile);
  assert.equal(tags.requiredTechnologies.length,2);
});
