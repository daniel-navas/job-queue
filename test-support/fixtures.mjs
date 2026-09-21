// Synthetic inputs: never load the owner's editable profile or preferences.
import { fields } from '../src/facts.mjs';

export const requirement = (key = 'docker', overrides = {}) => ({
  label: key, kind: 'technology', alternatives: [key], minMonths: null,
  maxMonths: null, autonomy: null, knowledgeLevel: null, lastUsedYear: null,
  maxYearsSinceUse: null, evidence: key, ...overrides,
});

export const emptyCard = (overrides = {}) => ({
  id: '1',
  ...Object.fromEntries(fields.map(key => [key,
    ['requirements', 'preferred', 'stack', 'projectTags'].includes(key) ? [] : null])),
  ...overrides,
});

export function matchingProfile() {
  const technology = (label, practicalMonths, autonomy, lastUsedYear) =>
    ({ label, practicalMonths, autonomy, lastUsedYear });
  return {
    employmentPeriods: [['2010-01', '2015-12']],
    technologies: {
      react: technology('React', 36, 'independent', 2022),
      nestjs: technology('NestJS', 36, 'independent', 2023),
      nodejs: technology('Node.js', 48, 'independent', 2026),
      java: technology('Java', 6, 'basic', 2019),
      typeorm: technology('TypeORM', 12, 'independent', 2023),
      sql: technology('SQL', 36, 'basic', 2026),
      postgresql: technology('PostgreSQL', 24, 'basic', 2025),
      docker: technology('Docker', 12, 'basic', 2023),
      gcp: technology('GCP', 12, 'independent', 2026),
      nosql: technology('NoSQL', 12, 'basic', 2022),
      kubernetes: { ...technology('Kubernetes', 0, 'unknown', null), professionalUse: false },
    },
    capabilities: {
      financial: { confirmed: true, evidence: 'Synthetic financial systems experience.' },
      'full-stack': { confirmed: true, practicalMonths: 36, autonomy: 'independent', lastUsedYear: 2026, evidence: 'Synthetic full-stack experience.' },
      'secure-coding': { confirmed: true, knowledgeLevel: 'basic', evidence: 'Synthetic security knowledge.' },
    },
  };
}

export function evaluationConfig() {
  return {
    preferences: {
      unknownScore: 0, missingProjectScore: -1,
      roleFocus: { backend: 1, fullstack: 0, frontend: -1 },
      workplace: { remote: 1, hybrid: 0, onsite: -1 },
      companyType: { product: 1 },
      projectTags: { 'hr-platform': -1, 'mixed-audience': 1, 'crypto-trading': 1, 'growth-work': 1 },
    },
    scoring: {
      weights: { roleFocus: 1, workplace: 1, project: 1, experience: 1, requiredTechnologies: 2, preferredTechnologies: 0.5, stack: 0.5 },
      recencyBands: [],
    },
  };
}
