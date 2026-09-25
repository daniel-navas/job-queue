// Numeric scores come from explicit data, never an AI-generated rating.
const defaults = {
  unknownScore: 0,
  missingProjectScore: -1,
  roleFocus: { backend: 1, fullstack: 0, frontend: -1 },
  workplace: { remote: 1, hybrid: 0, onsite: -1 },
  timezoneOverlap: { requiredScore: -1 },
  companyType: { product: 1, outsourcing: 0, 'recruiting-intermediary': 0, unknown: 0 },
  salaryMonthlyUsd: { preferredMin: 3000, preferredMax: 4000, acceptableMin: 2500, acceptableMax: 4500, preferredScore: 1, outsideScore: -1 }
};

export function rateJob(job, preferences = defaults) {
  const fields = {};
  const facts = job.summary?.fields;
  if (!facts) return { total: null, fields };
  for (const key of ['salary', 'companyType', 'requirements', 'preferred', 'experience', 'language', 'workplace', 'workCountry', 'timezoneOverlap', 'visaSupport', 'relocationFunding', 'project', 'culture']) fields[key] = { score: 0, reason: 'No preference defined; neutral.' };
  const type = facts.companyType?.value?.toLowerCase().trim();
  const role = roleFocus(job, preferences);
  fields.roleFocus = { score: role.score, reason: role.reason };
  const mode = workplaceMode(job, preferences);
  fields.workplace = { score: mode.score, reason: mode.reason };
  if (facts.timezoneOverlap) fields.timezoneOverlap = {
    score: preferences.timezoneOverlap?.requiredScore ?? -1,
    reason: `${facts.timezoneOverlap.value}: configured work-condition score ${preferences.timezoneOverlap?.requiredScore ?? -1}.`,
  };
  const typeKey = type?.replace(/\s+/g, '-') || 'unknown';
  const companyScore = preferences.companyType?.[typeKey] ?? preferences.unknownScore ?? 0;
  if (companyScore) fields.companyType = { score: companyScore, reason: `Company type ${typeKey}: configured preference ${companyScore}.` };
  if (job.summary.facts ? !job.summary.facts.software : !facts.project) fields.project = { score: preferences.missingProjectScore ?? -1, reason: 'The source does not establish what the software does.' };
  return { total: Object.values(fields).reduce((sum, field) => sum + field.score, 0), fields };
}

export function roleFocus(job, preferences = defaults) {
  if (job.summary?.facts) return configured(({ backend: 'Backend', frontend: 'Frontend', fullstack: 'Full-stack' })[job.summary.facts.roleFocus?.value] || 'Not determined', job.summary.facts.roleFocus?.value || 'unknown', preferences.roleFocus, preferences.unknownScore);
  const title = job.title || '';
  if (/\bback[- ]?end\b/i.test(title)) return configured('Backend', 'backend', preferences.roleFocus, preferences.unknownScore);
  if (/\bfront[- ]?end\b/i.test(title)) return configured('Frontend', 'frontend', preferences.roleFocus, preferences.unknownScore);
  if (/\bfull[- ]?stack\b/i.test(title)) return configured('Full-stack', 'fullstack', preferences.roleFocus, preferences.unknownScore);
  return { label: 'Not determined', score: preferences.unknownScore ?? 0, reason: 'Role focus not explicit in title; configured unknown score.' };
}

export function workplaceMode(job, preferences = defaults) {
  const country = job.summary?.facts?.workCountry?.value;
  const mode = job.summary?.facts?.workplaceMode?.value;
  if (preferences.relocation?.countries?.includes(country) && ['remote', 'hybrid', 'onsite'].includes(mode)) {
    return { label: ({ remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' })[mode], score: preferences.relocation.workplaceScore ?? 0,
      reason: 'All work modes are equally acceptable for European relocation. Visa support is a separate fact; eligibility is not established by this score.' };
  }
  if (job.summary?.facts) return configured(({ remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' })[job.summary.facts.workplaceMode?.value] || 'Not determined', job.summary.facts.workplaceMode?.value || 'unknown', preferences.workplace, preferences.unknownScore);
  const text = job.summary?.fields.workplace?.value || job.location || '';
  const modes = [ /\bremote\b|\bremoto\b/i.test(text), /\bhybrid\b|\bh[ií]brido\b/i.test(text), /\bon[- ]?site\b|\bpresencial\b/i.test(text) ];
  if (modes.filter(Boolean).length !== 1) return { label: 'Not determined', score: preferences.unknownScore ?? 0, reason: 'Missing or ambiguous workplace mode; configured unknown score.' };
  if (modes[0]) return configured('Remote', 'remote', preferences.workplace, preferences.unknownScore);
  if (modes[1]) return configured('Hybrid', 'hybrid', preferences.workplace, preferences.unknownScore);
  return configured('On-site', 'onsite', preferences.workplace, preferences.unknownScore);
}

function configured(label, key, values = {}, unknownScore = 0) {
  const score = values[key] ?? unknownScore ?? 0;
  return { label, score, reason: `${label}: configured preference ${score}.` };
}

export function salaryPreference(monthly, preference = defaults.salaryMonthlyUsd) {
  if (!monthly) return { score: 0, reason: 'Salary not stated or not normalizable; neutral.' };
  const usd = monthly.currency === 'USD' ? monthly : monthly.usd;
  if (!usd) return { score: 0, reason: 'USD comparison unavailable; neutral.' };
  if (usd.max >= preference.preferredMin && usd.min <= preference.preferredMax) return { score: preference.preferredScore, reason: `Published range intersects the preferred USD ${preference.preferredMin.toLocaleString()}–${preference.preferredMax.toLocaleString()}/month band.` };
  if (usd.max < preference.acceptableMin) return { score: preference.outsideScore, reason: `Entire published range is below USD ${preference.acceptableMin.toLocaleString()}/month.` };
  if (usd.min > preference.acceptableMax) return { score: preference.outsideScore, reason: `Entire published range is above USD ${preference.acceptableMax.toLocaleString()}/month; likely excessive role expectations.` };
  return { score: 0, reason: 'Published range does not intersect the ideal band and is not wholly outside the acceptable band.' };
}

export function coverageScore(tags) {
  if (!tags?.length) return 0;
  return tags.filter(tag => tag.score === 1).length / tags.length;
}

export function publishedRecency(publishedAt, bands, now = Date.now()) {
  const timestamp = Number(publishedAt);
  if (!publishedAt || !Number.isFinite(timestamp) || timestamp > now || !bands?.length) return { score: 0, reason: 'Publication date unavailable or in the future; no recency bonus.' };
  const ageDays = Math.max(0, (now - timestamp) / 86400000);
  const band = bands.find(item => ageDays <= item.maxAgeDays);
  const score = band?.score ?? 0;
  const age = ageDays < 1 ? 'less than one day' : `${Math.floor(ageDays)} day${Math.floor(ageDays) === 1 ? '' : 's'}`;
  return { score, reason: score ? `Published ${age} ago; recency bonus before weighting.` : `Published ${age} ago; outside the 14-day recency window.` };
}

export function weightedTotal(fields, weights) {
  const total = Object.entries(fields).reduce((sum, [key, field]) => sum + field.score * (weights[key] ?? 0), 0);
  return Math.round(total * 100) / 100;
}

export function compareJobs(a, b) {
  // Unprocessed offers remain visible in a separate trailing group, not scored as bad fits.
  if ((a.rating.total === null) !== (b.rating.total === null)) return a.rating.total === null ? 1 : -1;
  return (b.rating.total ?? 0) - (a.rating.total ?? 0) || (b.publishedAt ?? 0) - (a.publishedAt ?? 0) || a.id.localeCompare(b.id);
}
