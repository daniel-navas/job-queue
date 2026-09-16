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

export function matchRequirement(requirement, profile, currentYear = new Date().getUTCFullYear()) {
  let matched = false, explanation = 'Not established in the profile; no confirmed match.';
  const cutoff = recencyCutoff(requirement, currentYear);
  if (requirement.kind === 'technology') {
    // General LLM-tool usage is an evidenced capability, not proficiency with
    // every named AI product. A specific Claude-only requirement stays unknown.
    for (const key of requirement.alternatives) {
      const capability = catalog.technology[canonical(key)]?.capability;
      if (!capability) continue;
      const general = matchRequirement({ ...requirement, kind: 'capability', alternatives: [capability] }, profile, currentYear);
      if (general.score === 1) return general;
    }
    // A generic family fact can satisfy that same generic family requirement
    // without claiming experience in every named member.
    const keys = [...new Set(requirement.alternatives.flatMap(key => [canonical(key), ...members(key)]))];
    for (const key of keys) {
      const tech = profile.technologies[key];
      if (!tech) continue;
      const enoughLevel = (levels[tech.autonomy] || 0) >= levels[requirement.autonomy || 'independent'];
      const enoughTime = requirement.minMonths === null || Number.isFinite(tech.practicalMonths) && tech.practicalMonths >= requirement.minMonths;
      const recentEnough = cutoff === null || Number.isInteger(tech.lastUsedYear) && tech.lastUsedYear >= cutoff;
      const detail = `${tech.label}: ${tech.autonomy}, ${tech.practicalMonths ?? 'unknown'} practical months, last used ${tech.lastUsedYear ?? 'unknown'}.`;
      explanation = detail + ' Does not establish every threshold; no match credit.';
      if (enoughLevel && enoughTime && recentEnough) { matched = true; explanation = detail; break; }
    }
  } else if (requirement.kind === 'experience') {
    if (requirement.alternatives.includes('professional') && requirement.minMonths !== null) {
      const months = experienceMonths(profile.employmentPeriods);
      matched = months >= requirement.minMonths;
      explanation = `${months} distinct CV calendar months; minimum ${requirement.minMonths}. Approximate, with overlapping boundaries counted once.`;
    }
  } else if (requirement.kind === 'capability') {
    for (const key of requirement.alternatives) {
      const capability = profile.capabilities?.[key];
      if (capability?.confirmed !== true) continue;
      const enoughLevel = requirement.autonomy === null || (levels[capability.autonomy] || 0) >= levels[requirement.autonomy];
      const candidateKnowledge = capability.knowledgeLevel || 'basic';
      const enoughKnowledge = requirement.knowledgeLevel === null || knowledgeLevels[candidateKnowledge] >= knowledgeLevels[requirement.knowledgeLevel];
      const enoughTime = requirement.minMonths === null || Number.isFinite(capability.practicalMonths) && capability.practicalMonths >= requirement.minMonths;
      const recentEnough = cutoff === null || Number.isInteger(capability.lastUsedYear) && capability.lastUsedYear >= cutoff;
      const typed = capability.autonomy || Number.isFinite(capability.practicalMonths) || Number.isInteger(capability.lastUsedYear)
        ? ` ${capability.autonomy ?? 'unknown'} autonomy, ${capability.practicalMonths ?? 'unknown'} practical months, last used ${capability.lastUsedYear ?? 'unknown'}.`
        : '';
      const knowledge = capability.knowledgeLevel ? ` ${capability.knowledgeLevel} conceptual knowledge.` : '';
      explanation = capability.evidence + typed + knowledge + (enoughLevel && enoughKnowledge && enoughTime && recentEnough ? '' : ' Does not establish every threshold; no match credit.');
      if (enoughLevel && enoughKnowledge && enoughTime && recentEnough) { matched = true; break; }
    }
  }
  return { label: requirementLabel(requirement), score: matched ? 1 : 0, evidence: explanation, source: requirement.evidence };
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
    stack: map(facts.stack.filter(r => !r.alternatives.every(key => used.has(canonical(key))))),
  };
}

export function projectTags(job, preferences = {}) {
  return (job.summary?.facts?.projectTags || []).map(tag => ({ label: catalog.project[tag.key]?.label || tag.key, score: preferences[tag.key] ?? 0, evidence: `Configured project preference: ${preferences[tag.key] ?? 0}.`, source: tag.evidence }));
}
