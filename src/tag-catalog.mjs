import sourceCatalog from '../config/tag-catalog.json' with { type: 'json' };
export const catalog = sourceCatalog;
const aliases = new Map(Object.entries(catalog.tags).flatMap(([key, value]) => [key, ...(value.aliases || [])].map(alias => [alias.toLowerCase(), { kind: 'tag', key }]))
  .concat(Object.entries(catalog.experience).flatMap(([key, value]) => [key, ...(value.aliases || [])].map(alias => [alias.toLowerCase(), { kind: 'experience', key }]))));
export const resolveTag = value => aliases.get(value.toLowerCase().trim());
export const canonical = value => resolveTag(value)?.key || value.toLowerCase().trim();
export const members = key => catalog.tags[canonical(key)]?.members || [canonical(key)];
export const isDifferentiating = ({ kind, key }) => (kind === 'tag' ? catalog.tags : catalog[kind])?.[key]?.differentiating !== false;
export const selectableKeys = kind => Object.entries(kind === 'tag' ? catalog.tags : catalog[kind]).filter(([, item]) => item.differentiating !== false).map(([key]) => key);

export function effectiveLevel(requirement) {
  if (requirement.level) return requirement.level;
  if (!Number.isFinite(requirement.minMonths)) return 'basic';
  return Object.entries(catalog.qualitativeMatching.ranges)
    .find(([, range]) => requirement.minMonths >= range.minMonths && (range.maxMonths === null || requirement.minMonths <= range.maxMonths))?.[0] || 'advanced';
}

// These are approved mappings for the already-processed 2026-09 review batch.
// They repair historic records only. New extraction uses the catalog and prompt.
const reviewedLegacyMappings = new Map([
  ['advanced automation', [['capability', ['workflow-automation']]]],
  ['ai or automation integration', [['capability', ['ai-integration', 'workflow-automation']]]],
  ['ai technology applications', [['capability', ['ai-integration']]]],
  ['ai-first solutions', [['capability', ['ai-integration']]]],
  ['ai, ml, or agent systems', [['capability', ['ai-integration', 'machine-learning', 'ai-agents']]]],
  ['airline industry experience', [['capability', ['airline-domain-experience']]]],
  ['api design and management', [['capability', ['api-development']]]],
  ['api design knowledge', [['capability', ['api-development']]]],
  ['api design principles', [['capability', ['api-development']]]],
  ['api development', [['capability', ['api-development']]]],
  ['api knowledge', [['capability', ['distributed']], ['capability', ['api-development']], ['capability', ['cloud-native']]]],
  ['api orchestration', [['capability', ['api-integration']]]],
  ['asynchronous workflows', [['capability', ['asynchronous-workflows']], ['capability', ['distributed']], ['capability', ['cloud-infrastructure']]]],
  ['azure networking', [['technology', ['azure']], ['capability', ['cloud-networking']]]],
  ['bff or middleware integration', [['capability', ['api-integration']]]],
  ['clickhouse or aurora', [['technology', ['clickhouse', 'amazon-aurora']]]],
  ['cloud infrastructure', [['capability', ['cloud-infrastructure']]]],
  ['cloud service operations and optimization', [['capability', ['cloud-operations']]]],
  ['consumer product shipping', [['capability', ['consumer-product-development']]]],
  ['customer growth and provisioning', [['capability', ['growth-engineering']]]],
  ['data infrastructure knowledge', [['capability', ['data-engineering']], ['capability', ['distributed']]]],
  ['data sourcing and integration', [['capability', ['data-integration']]]],
  ['data-driven applications or dashboards', [['capability', ['data-applications', 'data-visualization']]]],
  ['database engineering', [['capability', ['database-engineering']]]],
  ['database performance tradeoffs', [['capability', ['data-integrity']], ['capability', ['query-optimization']]]],
  ['design systems experience', [['capability', ['design-systems']]]],
  ['developer platforms and tooling', [['capability', ['developer-platforms']]]],
  ['devops, ci/cd, or cloud infrastructure', [['capability', ['devops', 'ci-cd', 'cloud-infrastructure']]]],
  ['energy sector experience', [['capability', ['energy-domain-experience']]]],
  ['finops and cloud cost optimization', [['capability', ['finops']]]],
  ['high-traffic reliable systems', [['capability', ['large-scale-systems']], ['capability', ['high-availability']]]],
  ['highly available production systems', [['capability', ['high-availability']]]],
  ['large-scale consumer products', [['capability', ['large-scale-systems']], ['capability', ['consumer-product-development']]]],
  ['lending or related domain', [['capability', ['financial']]]],
  ['micro-frontends', [['capability', ['micro-frontends']]]],
  ['mcp or agentic workflows', [['tag', ['mcp', 'ai-agents', 'developer-platforms']]]],
  ['modern web technologies', [['technology', ['javascript', 'typescript', 'react']]]],
  ['oop and design patterns', [['capability', ['object-oriented-design']]]],
  ['other server-side language', [['technology', ['nodejs', 'server-side-language']]]],
  ['platform reliability improvements', [['capability', ['high-availability']]]],
  ['production systems exposure', [['capability', ['production-operations']]]],
  ['python or data engineering exposure', [['tag', ['python', 'data-engineering']]]],
  ['recommendation personalization or search', [['capability', ['recommendation-systems', 'search-engineering']]]],
  ['sabre knowledge', [['technology', ['sabre']]]],
  ['security standards', [['capability', ['secure-coding']]]],
  ['self-healing systems', [['capability', ['self-healing-systems']]]],
  ['self-service onboarding platforms', [['capability', ['self-service-platforms', 'growth-engineering', 'workflow-automation']]]],
  ['software supply chain security', [['capability', ['secure-coding']], ['capability', ['software-supply-chain-security']]]],
  ['vba or powershell automation', [['technology', ['vba', 'powershell']]]],
  ['workflow automation solutions', [['capability', ['workflow-automation']]]],
]);
const reviewedCommodityLabels = new Set([
  'json and http fundamentals', 'large or distributed codebases', 'software testing',
  'testing knowledge', 'technical debt management',
]);

export function normalizeKnownFacts(card) {
  const result = structuredClone(card);
  const timezoneRequirement = result.requirements?.find(item => item.kind === 'unknown' && (
    /time\s*zone overlap/i.test(item.label || '') || /\bhours?\s+overlap\s+with\b/i.test(item.evidence || '')
  ));
  if (!result.timezoneOverlap && timezoneRequirement) result.timezoneOverlap = {
    value: timezoneRequirement.evidence,
    evidence: timezoneRequirement.evidence,
  };
  if (timezoneRequirement) result.requirements = result.requirements.filter(item => item !== timezoneRequirement);
  const normalizedCriterion = (item, kind = item.kind, alternatives = item.alternatives) => {
    const legacyLevel = item.autonomy || ({ basic: 'basic', intermediate: 'independent', advanced: 'advanced' })[item.knowledgeLevel] || null;
    return {
      label: item.label,
      kind: ['technology', 'capability', 'tag'].includes(kind) ? 'tag' : kind,
      alternatives: ['technology', 'capability', 'tag'].includes(kind) ? alternatives.map(canonical) : alternatives,
      level: item.level ?? legacyLevel,
      minMonths: item.minMonths ?? null,
      maxMonths: item.maxMonths ?? null,
      evidence: item.evidence,
    };
  };
  const recognized = item => {
    const text = `${item.label || ''} ${item.evidence || ''}`;
    const alternatives = [];
    if (/\bA\/B test(?:ing|s)?\b|\bsplit test(?:ing|s)?\b|\bmultivariate test(?:ing|s)?\b|\bfeature experiments?\b|\bexperimentation (?:platforms?|frameworks?)\b/i.test(text)) alternatives.push('product-experimentation');
    if (/\banalytics instrumentation\b|\bevent instrumentation\b|\bevent tracking\b|\btracking plans?\b/i.test(text)) alternatives.push('analytics-instrumentation');
    if (/\bproduct analytics\b|\bdata analysis tools?\b|\bfunnel analysis\b|\bcohort analysis\b|\bretention analysis\b/i.test(text)) alternatives.push('product-analytics');
    if (/\b(?:own(?:ing)?|operat(?:e|ing))\b.*\b(?:business[ -]critical|production)\b.*\b(?:system|service)s?\b|\bproduction operations?\b/i.test(text)) alternatives.push('production-operations');
    return { kind: 'tag', alternatives: [...new Set(alternatives)] };
  };
  for (const group of ['requirements','preferred','stack']) result[group] = result[group].filter(item => !(item.kind === 'unknown' && reviewedCommodityLabels.has((item.label || '').toLowerCase()))).flatMap(item => {
    const mapped = item.kind === 'unknown' ? reviewedLegacyMappings.get((item.label || '').toLowerCase()) : null;
    if (mapped) return mapped.map(([kind, alternatives]) => normalizedCriterion(item, kind, alternatives));
    const recognition = item.kind === 'unknown' ? recognized(item) : { kind: item.kind, alternatives: item.alternatives.map(canonical) };
    const canonicalAlternatives = recognition.alternatives;
    if (!canonicalAlternatives.length) return normalizedCriterion(item, 'unknown', ['unmapped']);
    return normalizedCriterion(item, recognition.kind, canonicalAlternatives);
  });
  const work = `${result.work?.value || ''} ${result.work?.evidence || ''}`;
  if (/\bgrowth (?:engineering|team|product)\b|\bactivation\b|\bmarketing funnels?\b|\bonboarding\b|\bconversion optimization\b/i.test(work) && !result.projectTags.some(tag => tag.key === 'growth-work')) {
    result.projectTags.push({ key:'growth-work', evidence:result.work.evidence });
  }
  return result;
}

export function catalogInstructions() {
  const allowed = ['tags', 'experience', 'project'].map(kind => `${kind}:\n` + Object.entries(catalog[kind]).filter(([, item]) => item.differentiating !== false).map(([key, item]) => `${key}: ${item.label}${item.definition ? '. ' + item.definition : ''}${item.members ? ' Allowed equivalents: ' + item.members.join(', ') : ''}`).join('\n')).join('\n\n');
  const ignored = Object.entries(catalog.tags).filter(([, item]) => item.differentiating === false).map(([key, item]) => `tag/${key}: ${item.label}`);
  return `TAG CATALOG (choose keys, not new tags):\n${allowed}\n\nNON-DIFFERENTIATING; NEVER EXTRACT AS REQUIREMENT, PREFERENCE OR STACK:\n${ignored.join('\n')}`;
}

export function requirementLabel(requirement) {
  const source = requirement.kind === 'tag' ? catalog.tags : catalog[requirement.kind];
  const name = requirement.kind === 'unknown' ? requirement.label : requirement.alternatives.map(key => source?.[canonical(key)]?.label || key).join(' | ');
  const min = requirement.minMonths, max = requirement.maxMonths;
  const parts = [name];
  if (requirement.kind === 'tag' && requirement.alternatives.some(key => catalog.tags[canonical(key)]?.profileMode === 'level')) {
    parts.push(({ basic: 'Basic', independent: 'Independent', advanced: 'Advanced' })[effectiveLevel(requirement)]);
  }
  if (Number.isFinite(min)) {
    const years = min % 12 === 0 && (!Number.isFinite(max) || max % 12 === 0);
    const factor = years ? 12 : 1, unit = years ? 'years' : 'months';
    const duration = Number.isFinite(max) ? `${min / factor}–${max / factor}` : `${min / factor}+`;
    parts.push(`${duration} ${unit}`);
  }
  return parts.join(' · ');
}

// Lossless-source compatibility for the two existing v3 cards. Do not spend AI
// tokens to rename known keys. Unmapped criteria remain visible and neutral.
export function upgradeLegacyCard(card) {
  const result = structuredClone(card);
  for (const group of ['requirements', 'preferred', 'stack']) result[group] = result[group].map(item => {
    const resolved = item.alternatives.map(resolveTag);
    const compatible = resolved.every(Boolean);
    const range = item.evidence.match(/\b(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(years?|años?|months?|meses)\b/i);
    const factor = range && /year|año/i.test(range[3]) ? 12 : 1;
    const maxMonths = range && Number(range[1]) * factor === item.minMonths ? Number(range[2]) * factor : null;
    return { ...item, kind: compatible ? resolved[0].kind : 'unknown', alternatives: compatible ? [...new Set(resolved.map(tag => tag.key))] : ['unmapped'], maxMonths };
  }).filter(item => item.kind === 'unknown' || item.alternatives.some(key => isDifferentiating({ kind: item.kind, key })));
  // The old definition marked merchant-enabled consumer products B2B. A pair
  // of opposing audience tags establishes mixed audience, not a B2B penalty.
  if (result.projectTags.some(t => t.key === 'b2b') && result.projectTags.some(t => t.key === 'consumer')) {
    const source = result.projectTags.find(t => t.key === 'consumer');
    result.projectTags = result.projectTags.filter(t => !['b2b','consumer'].includes(t.key));
    result.projectTags.push({ key: 'mixed-audience', evidence: source.evidence });
  }
  return result;
}
