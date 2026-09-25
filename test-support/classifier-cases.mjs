// Source-reviewed eval expectations, never production overrides or scoring rules.
const has = (card, group, key, predicate = () => true) => card[group].some(item => item.alternatives.includes(key) && predicate(item));
const fact = (card, key, value) => (card[key]?.value ?? null) === value;
export const cases = [
  {
    id: '4456274071',
    checks: {
      'Conflicting Colombia/Chile geography stays unknown': card => fact(card, 'workCountry', null),
      'Four years required': card => has(card, 'requirements', 'professional', item => item.minMonths === 48),
      'Technologies under requirements are not merely company stack': card => ['spring-boot', 'docker', 'terraform'].every(key => has(card, 'requirements', key)),
      'Kubernetes remains required alongside GKE': card => has(card, 'requirements', 'kubernetes'),
      'Kubernetes on GKE is not an OR choice': card => !card.requirements.some(item => item.alternatives.includes('kubernetes') && item.alternatives.includes('gke')),
      'End of long requirements list is not lost': card => ['argocd', 'prometheus', 'grafana', 'sonarqube', 'unit-testing', 'integration-testing', 'e2e-testing', 'ai-assisted'].every(key => has(card, 'requirements', key)),
      'General API design remains a requirement': card => card.requirements.some(item => item.evidence === 'Diseño y gestión de APIs.'),
      'Cloud service operations remain a requirement': card => card.requirements.some(item => item.evidence === 'Operación y optimización de servicios en la nube.'),
      'Technical debt remains a requirement': card => card.requirements.some(item => item.evidence === 'Gestión de deuda técnica.'),
      'Generic API design does not imply REST': card => !card.requirements.some(item => item.evidence === 'Diseño y gestión de APIs.' && item.alternatives.includes('rest-api')),
      'Illustrative AI tools are not three separate requirements': card => !['cursor', 'claude', 'gemini'].some(key => has(card, 'requirements', key)),
      'Contextual SQL and NoSQL are not alternatives': card => !card.stack.some(item => item.alternatives.includes('sql') && item.alternatives.includes('nosql')),
      'Troubleshooting alone is not incident response': card => !card.requirements.some(item => item.alternatives.includes('incident-response') && !/incidente|incident/i.test(item.evidence)),
      'Airline/SABRE remains optional': card => !card.requirements.some(item => /SABRE|airline|aerolínea/i.test(item.evidence)),
    },
  },
  {
    id: '4456384983',
    checks: {
      'Required cloud architecture is retained independently of preferred AWS': card => card.requirements.some(item => /cloud architecture/i.test(item.evidence)) && has(card, 'preferred', 'aws') && !has(card, 'requirements', 'aws'),
      'Experience alone does not invent Spring Boot proficiency': card => has(card, 'requirements', 'spring-boot', item => item.level === null),
      'Requirements use the unified tag contract': card => [...card.requirements, ...card.preferred].every(item => item.kind === 'tag' && !('autonomy' in item) && !('knowledgeLevel' in item)),
      'Attitude toward security is not a measurable requirement': card => !card.requirements.some(item => /appreciation and consideration for security/i.test(item.evidence)),
      'Both database families required separately': card => ['relational-db', 'nosql'].every(key => has(card, 'requirements', key, item => item.alternatives.length === 1)),
      'Kotlin remains optional': card => has(card, 'preferred', 'kotlin') && !has(card, 'requirements', 'kotlin'),
      'Visa support is not proof of funded relocation': card => fact(card, 'visaSupport', 'supported') && fact(card, 'relocationFunding', null),
      'Hybrid multi-country role has no single country': card => fact(card, 'workplaceMode', 'hybrid') && fact(card, 'workCountry', null),
    },
  },
  {
    id: 'eval-alternatives',
    source: { id: 'eval-alternatives', title: 'Backend Engineer', company: 'Example', location: 'Spain', description: 'Requirements: Experience with Python or TypeScript. Docker and PostgreSQL are required. Familiarity with algorithms. Our company also uses React; this role does not require React. Remote within Spain. We sponsor work visas but do not pay moving expenses.' },
    checks: {
      'OR languages stay one criterion without invented proficiency': card => card.requirements.some(item => item.alternatives.length === 2 && ['python', 'typescript'].every(key => item.alternatives.includes(key)) && item.level === null),
      'AND technologies stay separate': card => ['docker', 'postgresql'].every(key => has(card, 'requirements', key, item => item.alternatives.length === 1)),
      'Company stack does not become a requirement': card => !has(card, 'requirements', 'react'),
      'Conceptual familiarity uses the unified basic level': card => has(card, 'requirements', 'algorithms', item => item.level === 'basic'),
      'Visa and moving expenses are independent': card => fact(card, 'visaSupport', 'supported') && fact(card, 'relocationFunding', 'not-available'),
    },
  },
];

export function evaluateCase(id, card) {
  const entry = cases.find(item => item.id === id);
  if (!entry) throw new Error(`No reviewed expectations for ${id}`);
  return Object.entries(entry.checks).map(([name, check]) => ({ name, passed: Boolean(card && check(card)) }));
}
