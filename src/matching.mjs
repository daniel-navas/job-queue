import { catalog, canonical, effectiveLevel, members, requirementLabel } from './tag-catalog.mjs';
export { canonical, effectiveLevel } from './tag-catalog.mjs';

const levels = { none: 0, basic: 1, independent: 2, advanced: 3 };
const titleCase = value => value[0].toUpperCase() + value.slice(1);

export function experienceMonths(periods) {
  const month = value => Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1;
  const covered = new Set();
  for (const [start, end] of periods) for (let i = month(start); i <= month(end); i++) covered.add(i);
  return covered.size;
}

function profileSummary(results) {
  const facts = [...new Map(results.filter(result => result.profileFact).map(result => [result.profileFact.label, result.profileFact])).values()];
  const lines = facts.filter(fact => fact.status === 'known').map(fact => fact.line);
  const none = facts.filter(fact => fact.status === 'none').map(fact => fact.label);
  const missing = facts.filter(fact => fact.status === 'missing').map(fact => fact.label);
  if (none.length) lines.push(`None: ${none.join(', ')}`);
  if (missing.length) lines.push(`Missing: ${missing.join(', ')}`);
  return lines;
}

function aggregateAlternatives(results) {
  let selected;
  if (results.some(result => result.assessment === 'match')) selected = results.find(result => result.assessment === 'match');
  else if (results.length && results.every(result => result.assessment === 'no-match')) selected = results.find(result => result.shortfall) || results[0];
  else selected = results.find(result => result.assessment === 'unknown') || { assessment: 'unknown', evidence: 'Not established in the profile.' };
  return { ...selected, profileSummary: profileSummary(results) };
}

function assessTag(key, value, requirement, stack) {
  const definition = catalog.tags[key], label = definition?.label || key;
  if (value === undefined) return { assessment: 'unknown', evidence: 'Tag is not recorded in the profile.', profileFact: { label, status: 'missing' } };
  if (value === 'none') return { assessment: 'no-match', evidence: 'The owner confirmed this tag is not present.', profileFact: { label, status: 'none' } };
  if (definition?.profileMode === 'presence') {
    const assessment = value === 'present' ? 'match' : 'unknown';
    return { assessment, evidence: assessment === 'match' ? 'Confirmed in the profile.' : 'Presence is not established.', profileFact: { label, status: assessment === 'match' ? 'known' : 'missing', line: label } };
  }
  if (!(value in levels) || value === 'none') return { assessment: 'unknown', evidence: 'Skill level is not established.', profileFact: { label, status: 'missing' } };
  const required = stack ? 'basic' : effectiveLevel(requirement), passes = levels[value] >= levels[required];
  return { assessment: passes ? 'match' : 'no-match', evidence: `${label}: ${value}; required ${required}.`, ...(passes ? {} : { shortfall: { hint: titleCase(required) } }), profileFact: { label, status: 'known', line: `${label} · ${titleCase(value)}` } };
}

export function matchRequirement(requirement, profile, _currentYear = new Date().getUTCFullYear(), options = {}) {
  let result;
  if (requirement.kind === 'unknown') result = { assessment: 'unmapped', evidence: 'No approved catalog mapping exists for this criterion.' };
  else if (requirement.kind === 'tag') {
    const results = [];
    for (const alternative of requirement.alternatives) {
      const key = canonical(alternative);
      const profileKeys = profile.tags?.[key] !== undefined ? [key, ...members(key)] : members(key);
      for (const member of [...new Set(profileKeys)]) results.push(assessTag(member, profile.tags?.[member], requirement, options.stack === true));
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
  } else result = { assessment: 'unmapped', evidence: 'No approved catalog mapping exists for this criterion.' };
  return { label: requirementLabel(requirement), score: result.assessment === 'match' ? 1 : 0, assessment: result.assessment, evidence: result.evidence, source: requirement.evidence, ...(result.shortfall ? { shortfall: result.shortfall } : {}), ...(result.profileSummary?.length ? { profileSummary: result.profileSummary } : {}) };
}

export function matchTags(job, profile, currentYear = new Date().getUTCFullYear()) {
  const facts = job.summary?.facts;
  if (!facts) return null;
  const identity = value => JSON.stringify([value.kind, value.alternatives.map(canonical).sort(), value.kind === 'unknown' ? [value.label, value.evidence] : null, value.level, value.minMonths, value.maxMonths]);
  const map = values => [...new Map(values.map(value => [identity(value), value])).values()].map(value => matchRequirement(value, profile, currentYear));
  const used = new Set([...facts.requirements, ...facts.preferred].flatMap(r => r.alternatives.flatMap(members)));
  return {
    requirements: map(facts.requirements.filter(r => r.kind !== 'experience')),
    preferred: map(facts.preferred),
    experience: map(facts.requirements.filter(r => r.kind === 'experience')),
    stack: [...new Map(facts.stack.filter(r => !r.alternatives.every(key => used.has(canonical(key)))).map(value => [identity(value), value])).values()].map(value => matchRequirement(value, profile, currentYear, { stack: true })),
  };
}

export function projectTags(job, preferences = {}) {
  return (job.summary?.facts?.projectTags || []).map(tag => ({ label: catalog.project[tag.key]?.label || tag.key, score: preferences[tag.key] ?? 0, evidence: `Configured project preference: ${preferences[tag.key] ?? 0}.`, source: tag.evidence }));
}
