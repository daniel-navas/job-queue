import { rateJob, salaryPreference, coverageScore, publishedRecency, weightedTotal } from './rating.mjs';
import { matchTags, projectTags } from './matching.mjs';

// Pure evaluation: every processed offer uses this path, without AI or writes.
export function evaluateJob(job, profile, preferences, scoring, monthlySalary, now = Date.now()) {
  const tags = matchTags(job, profile, new Date(now).getUTCFullYear()), rating = rateJob(job, preferences);
  const project = projectTags(job, preferences.projectTags);
  if (rating.total !== null) {
    for (const key of ['requiredTechnologies', 'preferredTechnologies', 'experience']) {
      const values = tags?.[key] || [];
      rating.fields[key] = { score: coverageScore(values), reason: `${values.filter(t => t.score === 1).length}/${values.length} confirmed matches; unknown or insufficient evidence receives no match credit.` };
    }
    // Each configured project or work trait is an independent preference.
    // Catalog validation prevents mutually exclusive audience tags.
    const signals = [rating.fields.project.score, ...project.map(tag => tag.score)];
    const score = signals.reduce((sum, value) => sum + value, 0);
    if (score !== rating.fields.project.score || project.some(tag => tag.score !== 0)) rating.fields.project = { score, reason: 'Configured project and work preferences are additive; neutral tags contribute zero.' };
    rating.fields.salary = salaryPreference(monthlySalary, preferences.salaryMonthlyUsd);
    rating.fields.publishedRecency = publishedRecency(job.publishedAt, scoring.recencyBands, now);
    rating.total = weightedTotal(rating.fields, scoring.weights);
    for (const [key, field] of Object.entries(rating.fields)) {
      field.weight = scoring.weights[key] ?? 0;
      field.contribution = Math.round(field.score * field.weight * 100) / 100;
    }
  }
  return { ...job, tags, projectTags: project, rating, monthlySalary };
}
