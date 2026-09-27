import sourceCatalog from '../config/company-types.json' with { type: 'json' };

export const companyTypes = sourceCatalog.types;
export const companyTypeKeys = Object.keys(companyTypes);

const aliases = new Map(Object.entries(companyTypes).flatMap(([key, type]) =>
  [key, type.label, ...(type.aliases || [])].map(value => [value.toLowerCase().trim().replace(/\s+/g, '-'), key])));

export function normalizeCompanyType(value) {
  if (typeof value !== 'string') return 'unknown';
  return aliases.get(value.toLowerCase().trim().replace(/\s+/g, '-')) || 'unknown';
}

export function companyTypeLabel(value) {
  return companyTypes[normalizeCompanyType(value)].label;
}

export function companyTypeInstructions() {
  const definitions = Object.entries(companyTypes)
    .map(([key, type]) => `- ${key}: ${type.definition}`)
    .join('\n');
  return `COMPANY TYPE CATALOG (choose exactly one key):\n${definitions}`;
}
