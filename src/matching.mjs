import { catalog, canonical, members, requirementLabel } from './tag-catalog.mjs';
export { canonical } from './tag-catalog.mjs';
export function experienceMonths(periods) {
  const month = value => Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1;
  const covered = new Set();
  for (const [start, end] of periods) for (let i = month(start); i <= month(end); i++) covered.add(i);
  return covered.size;
}
const levels = { basic: 1, independent: 2, advanced: 3 };
const knowledgeLevels = { basic: 1, intermediate: 2, advanced: 3 };

const recencyCutoff = (requirement, currentYear) => Number.isInteger(requirement.lastUsedYear)
  ? requirement.lastUsedYear
  : Number.isInteger(requirement.maxYearsSinceUse) ? currentYear - requirement.maxYearsSinceUse : null;

const explicitNoTechnology = technology => technology?.practicalMonths === 0
  && technology.autonomy === 'unknown'
  && technology.lastUsedYear === null
  && technology.professionalUse === false;

function aggregateAlternatives(results) {
  if (results.some(result => result.assessment === 'match')) return results.find(result => result.assessment === 'match');
  if (results.length && results.every(result => result.assessment === 'no-match')) return results[0];
  return results.find(result => result.assessment === 'unknown') || { assessment: 'unknown', evidence: 'Not established in the profile.' };
}

function assessTechnology(technology, requirement, currentYear, stack) {
  if (!technology) return { assessment: 'unknown', evidence: 'Technology is not recorded in the profile.' };
  const detail = `${technology.label}: ${technology.autonomy ?? 'unknown'}, ${technology.practicalMonths ?? 'unknown'} practical months, last used ${technology.lastUsedYear ?? 'unknown'}.`;
  if (explicitNoTechnology(technology)) return { assessment: 'no-match', evidence: `${detail} The owner confirmed no practical experience.` };
  if (stack) {
    if (Number.isFinite(technology.practicalMonths) && technology.practicalMonths > 0) return { assessment: 'match', evidence: detail };
    return { assessment: 'unknown', evidence: `${detail} Practical exposure is not confirmed.` };
  }
  const cutoff = recencyCutoff(requirement, currentYear);
  const checks = [
    { needed: true, known: levels[technology.autonomy] !== undefined, passes: (levels[technology.autonomy] || 0) >= levels[requirement.autonomy || 'independent'], label: 'autonomy' },
    { needed: requirement.minMonths !== null, known: Number.isFinite(technology.practicalMonths), passes: technology.practicalMonths >= requirement.minMonths, label: 'duration' },
    { needed: cutoff !== null, known: Number.isInteger(technology.lastUsedYear), passes: technology.lastUsedYear >= cutoff, label: 'recency' },
  ].filter(check => check.needed);
  const missing = checks.filter(check => !check.known).map(check => check.label);
  if (missing.length) return { assessment: 'unknown', evidence: `${detail} Missing ${missing.join(', ')} information.` };
  if (checks.some(check => !check.passes)) return { assessment: 'no-match', evidence: `${detail} Known values do not meet every threshold.` };
  return { assessment: 'match', evidence: detail };
}

function assessCapability(capability, requirement, currentYear) {
  if (!capability || capability.confirmed === undefined) return { assessment: 'unknown', evidence: 'Capability is not recorded in the profile.' };
  if (capability.confirmed === false) return { assessment: 'no-match', evidence: capability.evidence || 'The owner confirmed this capability is not present.' };
  const cutoff = recencyCutoff(requirement, currentYear);
  const checks = [
    { needed: requirement.autonomy !== null, known: levels[capability.autonomy] !== undefined, passes: (levels[capability.autonomy] || 0) >= levels[requirement.autonomy], label: 'autonomy' },
    { needed: requirement.knowledgeLevel !== null && requirement.knowledgeLevel !== 'basic', known: knowledgeLevels[capability.knowledgeLevel] !== undefined, passes: (knowledgeLevels[capability.knowledgeLevel] || 0) >= knowledgeLevels[requirement.knowledgeLevel], label: 'knowledge level' },
    { needed: requirement.minMonths !== null, known: Number.isFinite(capability.practicalMonths), passes: capability.practicalMonths >= requirement.minMonths, label: 'duration' },
    { needed: cutoff !== null, known: Number.isInteger(capability.lastUsedYear), passes: capability.lastUsedYear >= cutoff, label: 'recency' },
  ].filter(check => check.needed);
  const typed = capability.autonomy || Number.isFinite(capability.practicalMonths) || Number.isInteger(capability.lastUsedYear)
    ? ` ${capability.autonomy ?? 'unknown'} autonomy, ${capability.practicalMonths ?? 'unknown'} practical months, last used ${capability.lastUsedYear ?? 'unknown'}.`
    : '';
  const knowledge = capability.knowledgeLevel ? ` ${capability.knowledgeLevel} conceptual knowledge.` : '';
  const detail = `${capability.evidence || 'Owner confirmed familiarity.'}${typed}${knowledge}`;
  const missing = checks.filter(check => !check.known).map(check => check.label);
  if (missing.length) return { assessment: 'unknown', evidence: `${detail} Missing ${missing.join(', ')} information.` };
  if (checks.some(check => !check.passes)) return { assessment: 'no-match', evidence: `${detail} Known values do not meet every threshold.` };
  return { assessment: 'match', evidence: detail };
}

export function matchRequirement(requirement, profile, currentYear = new Date().getUTCFullYear(), options = {}) {
  let result;
  if (requirement.kind === 'unknown') {
    result = { assessment: 'unmapped', evidence: 'No approved catalog mapping exists for this criterion.' };
  } else if (requirement.kind === 'technology') {
    const results = [];
    for (const alternative of requirement.alternatives) {
      const key = canonical(alternative);
      const capability = catalog.technology[key]?.capability;
      if (capability) results.push(assessCapability(profile.capabilities?.[capability], requirement, currentYear));
      for (const member of [...new Set([key, ...members(key)])]) results.push(assessTechnology(profile.technologies?.[member], requirement, currentYear, options.stack === true));
    }
    result = aggregateAlternatives(results);
  } else if (requirement.kind === 'experience') {
    const periods = profile.employmentPeriods;
    const valid = Array.isArray(periods) && periods.length > 0 && periods.every(period => Array.isArray(period) && period.length === 2 && /^\d{4}-\d{2}$/.test(period[0]) && /^\d{4}-\d{2}$/.test(period[1]));
    if (!requirement.alternatives.includes('professional')) result = { assessment: 'unmapped', evidence: 'No approved experience mapping exists for this criterion.' };
    else if (!valid || requirement.minMonths === null) result = { assessment: 'unknown', evidence: 'Professional employment history is missing or incomplete.' };
    else {
      const months = experienceMonths(periods);
      result = { assessment: months >= requirement.minMonths ? 'match' : 'no-match', evidence: `${months} distinct CV calendar months; minimum ${requirement.minMonths}. Approximate, with overlapping boundaries counted once.` };
    }
  } else if (requirement.kind === 'capability') {
    result = aggregateAlternatives(requirement.alternatives.map(key => assessCapability(profile.capabilities?.[key], requirement, currentYear)));
  } else {
    result = { assessment: 'unmapped', evidence: 'No approved catalog mapping exists for this criterion.' };
  }
  return { label: requirementLabel(requirement), score: result.assessment === 'match' ? 1 : 0, assessment: result.assessment, evidence: result.evidence, source: requirement.evidence };
}

export function matchTags(job, profile, currentYear = new Date().getUTCFullYear()) {
  const facts = job.summary?.facts;
  if (!facts) return null;
  const map = values => [...new Map(values.map(value => [JSON.stringify([value.kind, value.alternatives.map(canonical).sort(), value.kind === 'unknown' ? [value.label, value.evidence] : null, value.minMonths, value.maxMonths, value.autonomy, value.knowledgeLevel, value.lastUsedYear, value.maxYearsSinceUse]), value])).values()].map(value => matchRequirement(value, profile, currentYear));
  const used = new Set([...facts.requirements, ...facts.preferred].flatMap(r => r.alternatives.flatMap(members)));
  return {
    requiredTechnologies: map(facts.requirements.filter(r => r.kind !== 'experience')),
    preferredTechnologies: map(facts.preferred),
    experience: map(facts.requirements.filter(r => r.kind === 'experience')),
    stack: [...new Map(facts.stack.filter(r => !r.alternatives.every(key => used.has(canonical(key)))).map(value => [JSON.stringify([value.kind, value.alternatives.map(canonical).sort(), value.minMonths, value.maxMonths, value.autonomy, value.knowledgeLevel, value.lastUsedYear, value.maxYearsSinceUse]), value])).values()].map(value => matchRequirement(value, profile, currentYear, { stack: true })),
  };
}

export function projectTags(job, preferences = {}) {
  return (job.summary?.facts?.projectTags || []).map(tag => ({ label: catalog.project[tag.key]?.label || tag.key, score: preferences[tag.key] ?? 0, evidence: `Configured project preference: ${preferences[tag.key] ?? 0}.`, source: tag.evidence }));
}
