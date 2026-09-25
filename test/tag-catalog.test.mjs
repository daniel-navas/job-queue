import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingProfile, emptyCard, requirement as makeRequirement } from '../test-support/fixtures.mjs';
import { catalog, normalizeKnownFacts, upgradeLegacyCard, requirementLabel, resolveTag, selectableKeys, catalogInstructions } from '../src/tag-catalog.mjs';
import { validateCards, currentSummary, fingerprint, pendingJobs } from '../src/summarize.mjs';
import { matchRequirement, matchTags, projectTags } from '../src/matching.mjs';
const profile = matchingProfile();
const requirement = (overrides = {}) => makeRequirement('docker', { label: 'Ignored AI spelling', evidence: 'Docker', ...overrides });
const card = emptyCard;
test('catalog has one tag namespace with an explicit profile mode per tag', () => {
  assert.ok(!('technology' in catalog));
  assert.ok(!('capability' in catalog));
  for (const entry of Object.values(catalog.tags)) {
    assert.ok(['level', 'presence'].includes(entry.profileMode));
    for (const key of entry.members || []) assert.ok(catalog.tags[key],key);
  }
});
test('growth capabilities use balanced canonical concepts and preserve old A/B facts', () => {
  assert.deepEqual(resolveTag('ab-testing'),{kind:'tag',key:'product-experimentation'});
  for (const key of ['product-experimentation','analytics-instrumentation','product-analytics','growth-engineering']) assert.ok(catalog.tags[key],key);
  assert.ok(catalog.project['growth-work']);
});
test('production operations is a canonical capability for owning live services', () => {
  assert.equal(catalog.tags['production-operations']?.label, 'Production operations');
  assert.equal(catalog.tags['production-operations']?.definition, 'Operating and owning live production services.');
});
test('production-operations wording normalizes instead of remaining unmapped', () => {
  const normalized = normalizeKnownFacts({ ...card(), requirements: [{
    label: 'Business-critical system operations', kind: 'unknown', alternatives: ['unmapped'],
    minMonths: null, maxMonths: null, autonomy: null, knowledgeLevel: null,
    lastUsedYear: null, maxYearsSinceUse: null,
    evidence: 'Track record of owning and operating business-critical systems.'
  }] });
  assert.deepEqual(normalized.requirements[0].alternatives, ['production-operations']);
  assert.equal(normalized.requirements[0].kind, 'tag');
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
  assert.deepEqual(normalized.preferred.map(item=>item.kind),['tag','tag']);
  assert.equal(normalized.preferred[1].level,'basic');
  assert.deepEqual(normalized.projectTags,[{key:'growth-work',evidence:'improve activation, retention and monetization'}]);
});
test('commodity expectations cannot enter a new extraction or legacy denominator', () => {
  const commodityKeys = ['team-problem-solving','engineering-process','agile','pair-programming','code-review','collaboration','generic-problem-solving','generic-debugging','generic-communication','clean-code','fast-paced','adaptability','ownership','http-json-fundamentals','generic-software-testing','technical-debt-management','large-codebase-experience'];
  for (const key of commodityKeys) {
    assert.equal(catalog.tags[key]?.differentiating, false, key);
    assert.equal(selectableKeys('tag').includes(key),false,key);
  }
  assert.equal(selectableKeys('tag').includes('git'),false);
  assert.match(catalogInstructions(),/NON-DIFFERENTIATING/);
  assert.match(catalogInstructions(),/HTTP and JSON fundamentals/);
  const legacy={...card(),requirements:[
    {...requirement({kind:'tag',alternatives:['team-technical-problem-solving']}),maxMonths:undefined},
    {...requirement({kind:'tag',alternatives:['degree']}),maxMonths:undefined},
  ],preferred:[{...requirement({kind:'tag',alternatives:['engineering-process']}),maxMonths:undefined}]};
  const upgraded=upgradeLegacyCard(legacy);
  assert.deepEqual(upgraded.requirements.map(item=>item.alternatives),[['degree']]);
  assert.deepEqual(upgraded.preferred,[]);
});
test('generic API work and consumer-product delivery remain differentiating capabilities', () => {
  assert.equal(catalog.tags['api-development']?.label, 'API development');
  assert.equal(catalog.tags['consumer-product-development']?.label, 'Consumer product development');
  assert.ok(selectableKeys('tag').includes('api-development'));
  assert.ok(selectableKeys('tag').includes('consumer-product-development'));
});
test('approved specialized catalog gaps are available to new extractions', () => {
  for (const key of [
    'workflow-automation', 'machine-learning', 'airline-domain-experience',
    'asynchronous-workflows', 'cloud-networking', 'cloud-infrastructure',
    'cloud-operations', 'data-integration', 'data-applications',
    'database-engineering', 'design-systems', 'developer-platforms',
    'energy-domain-experience', 'finops', 'large-scale-systems',
    'high-availability', 'recommendation-systems', 'search-engineering',
    'self-healing-systems', 'self-service-platforms',
    'software-supply-chain-security', 'micro-frontends', 'object-oriented-design'
  ]) assert.ok(selectableKeys('tag').includes(key), key);
  for (const key of ['clickhouse', 'amazon-aurora', 'sabre', 'vba', 'powershell']) assert.ok(selectableKeys('tag').includes(key), key);
});
test('server-side language family offers concrete language alternatives', () => {
  assert.deepEqual(catalog.tags['server-side-language']?.members, [
    'typescript', 'javascript', 'python', 'go', 'java', 'rust', 'c++',
    'csharp', 'ruby', 'php', 'kotlin', 'scala'
  ]);
  assert.equal(requirementLabel(requirement({alternatives:['nodejs', 'server-side-language']})), 'Node.js | Server-side language · Basic');
});
test('reviewed unmapped criteria normalize without another AI call', () => {
  const unknown = (label, evidence = label) => requirement({kind:'unknown', alternatives:['unmapped'], label, evidence});
  const normalized = normalizeKnownFacts({...card(), requirements:[
    unknown('API design knowledge', 'Solid understanding of API design'),
    unknown('API development', 'Skilled in building APIs'),
    unknown('Consumer product shipping', 'experience shipping consumer-facing products'),
    unknown('Customer growth and provisioning', 'Familiarity with customer growth, onboarding, provisioning, or operational excellence initiatives.'),
    unknown('Other server-side language', 'experience in at least one other server-side language'),
    unknown('JSON and HTTP fundamentals', 'Familiarity with JSON, HTTP protocols, status codes'),
    unknown('Large or distributed codebases', 'Experience working with large-scale or distributed codebases.'),
    unknown('Software testing', 'Background in software testing.'),
    unknown('Technical debt management', 'Gestión de deuda técnica.')
  ]});
  assert.deepEqual(normalized.requirements.map(item => [item.kind, item.alternatives]), [
    ['tag', ['api-development']],
    ['tag', ['api-development']],
    ['tag', ['consumer-product-development']],
    ['tag', ['growth-engineering']],
    ['tag', ['nodejs', 'server-side-language']]
  ]);
});
test('a stored timezone-overlap requirement becomes a work condition without AI', () => {
  const normalized = normalizeKnownFacts({ ...card(), requirements: [{
    label: 'PST timezone overlap', kind: 'unknown', alternatives: ['unmapped'],
    level: null, minMonths: null, maxMonths: null,
    evidence: '6-8 hours overlap with PST',
  }] });
  assert.deepEqual(normalized.timezoneOverlap, {
    value: '6-8 hours overlap with PST', evidence: '6-8 hours overlap with PST',
  });
  assert.deepEqual(normalized.requirements, []);
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
  assert.equal(requirementLabel(r),'Software engineering · 3–7 years');
  assert.equal(matchRequirement(r,profile).score,1);
  assert.equal(requirementLabel({...r,maxMonths:null}),'Software engineering · 3+ years');
  assert.throws(()=>validateCards({cards:[{...card(),requirements:[{...r,maxMonths:12}]}]},[{id:'1',description:'3-7 years'}]),/range/);
});
test('requirement labels expose qualitative levels and compact duration', () => {
  assert.equal(requirementLabel(requirement({alternatives:['typescript'],level:'independent'})),'TypeScript · Independent');
  assert.equal(requirementLabel(requirement({alternatives:['typescript'],minMonths:24,level:'advanced'})),'TypeScript · Advanced · 2+ years');
  assert.equal(requirementLabel(requirement({kind:'tag',alternatives:['data-structures'],level:'advanced'})),'Data structures · Advanced');
});

test('requirement labels show alternatives with a vertical bar', () => {
  assert.equal(requirementLabel(requirement({alternatives:['go', 'nodejs']})), 'Go | Node.js · Basic');
});
test('a generic NoSQL profile fact matches only the generic family requirement', () => {
  const general=requirement({alternatives:['nosql'],level:'basic',minMonths:12});
  assert.equal(matchRequirement(general,profile).score,1);
  assert.equal(matchRequirement({...general,level:'independent'},profile).score,0);
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
  assert.equal(matchTags({...job,summary},profile).experience[0].label,'Software engineering · 3–7 years');
  assert.equal(summary.facts.requirements.find(r=>r.alternatives.includes('data-structures')).level,'advanced');
  assert.deepEqual(pendingJobs([job]),[]);
  assert.equal(JSON.stringify(job),before);
});
test('version-4 cards gain qualitative levels and drop generic debugging without AI', () => {
  const old={...card(),requirements:[
    {label:'Data structures',kind:'tag',alternatives:['data-structures'],minMonths:null,maxMonths:null,autonomy:null,lastUsedYear:null,evidence:'Strong understanding of data structures.'},
    {label:'Software debugging',kind:'unknown',alternatives:['unmapped'],minMonths:null,maxMonths:null,autonomy:null,lastUsedYear:null,evidence:'Understanding of debugging.'}
  ],preferred:[{label:'Secure coding familiarity',kind:'tag',alternatives:['secure-coding'],minMonths:null,maxMonths:null,autonomy:'basic',lastUsedYear:null,evidence:'Familiarity with secure coding.'}]};
  const job={id:'1',description:'Strong understanding of data structures. Understanding of debugging. Familiarity with secure coding.'};
  job.summary={version:4,inputHash:fingerprint(job),fields:old};
  const summary=currentSummary(job);
  assert.equal(summary.facts.requirements.length,1);
  assert.equal(summary.facts.requirements[0].level,'advanced');
  assert.equal(summary.facts.preferred[0].level,'basic');
  assert.deepEqual(pendingJobs([job]),[]);
});
test('distinct unmapped requirements do not disappear from the denominator', () => {
  const a=requirement({kind:'unknown',alternatives:['unmapped'],label:'A'}),b={...a,label:'B'};
  const tags=matchTags({summary:{facts:{...card(),requirements:[a,b]}}},profile);
  assert.equal(tags.requirements.length,2);
});
