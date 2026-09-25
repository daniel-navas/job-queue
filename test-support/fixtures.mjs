// Synthetic inputs: never load the owner's editable profile or preferences.
import { fields } from '../src/facts.mjs';

export const requirement = (key = 'docker', overrides = {}) => ({
  label: key, kind: 'tag', alternatives: [key], level: null,
  minMonths: null, maxMonths: null, evidence: key, ...overrides,
});

export const emptyCard = (overrides = {}) => ({
  id: '1',
  ...Object.fromEntries(fields.map(key => [key,
    ['requirements', 'preferred', 'stack', 'projectTags'].includes(key) ? [] : null])),
  ...overrides,
});

export function matchingProfile() {
  return {
    schemaVersion: 2,
    employmentPeriods: [['2010-01', '2015-12']],
    tags: {
      react: 'independent', nestjs: 'independent', nodejs: 'independent', java: 'basic',
      typeorm: 'independent', sql: 'basic', postgresql: 'basic', mysql: 'basic',
      mariadb: 'none', 'sql-server': 'none', docker: 'basic', gcp: 'independent',
      nosql: 'basic', kubernetes: 'none', financial: 'present',
      'full-stack': 'independent', 'secure-coding': 'basic',
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
      weights: { roleFocus: 1, workplace: 1, project: 1, experience: 1, requirements: 2, preferred: 0.5, stack: 0.5 },
      recencyBands: [],
    },
  };
}
