// Extraction contract. No candidate data or preference scores belong here.
import { catalog, requirementLabel, selectableKeys } from './tag-catalog.mjs';
const string = { type: 'string', minLength: 1, maxLength: 400 };
const evidence = { type: 'string', minLength: 1, maxLength: 500 };
const nullable = value => ({ anyOf: [{ type: 'null' }, value] });
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const fact = values => nullable(object({ value: values ? { ...string, enum: values } : string, evidence }));
const array = (items, maxItems = 30) => ({ type: 'array', maxItems, items });
export const tagKeys = Object.keys(catalog.tags);
export const projectKeys = Object.keys(catalog.project);
export const requirementSchema = { anyOf: ['tag', 'experience', 'unknown'].map(kind => object({
  label: string,
  kind: { type: 'string', enum: [kind] },
  alternatives: { ...array({ ...string, enum: kind === 'unknown' ? ['unmapped'] : selectableKeys(kind) }), minItems: 1 },
  level: nullable({ type: 'string', enum: ['basic', 'independent', 'advanced'] }),
  minMonths: nullable({ type: 'number', minimum: 0, maximum: 1200 }),
  maxMonths: nullable({ type: 'number', minimum: 0, maximum: 1200 }),
  evidence,
})) };
export const properties = {
  id: string,
  salary: fact(), companyType: fact(['product', 'outsourcing', 'recruiting-intermediary', 'unknown']),
  client: fact(), language: fact(), workplace: fact(), culture: fact(),
  roleFocus: fact(['backend', 'fullstack', 'frontend', 'unknown']),
  workplaceMode: fact(['remote', 'hybrid', 'onsite', 'unknown']),
  workCountry: fact(),
  visaSupport: fact(['supported', 'not-supported', 'unknown']),
  relocationFunding: fact(['available', 'not-available', 'unknown']),
  software: fact(), work: fact(),
  requirements: array(requirementSchema, 100), preferred: array(requirementSchema, 100), stack: array(requirementSchema, 100),
  projectTags: array(object({ key: { type: 'string', enum: projectKeys }, evidence })),
};
export const schema = object({ cards: array(object(properties)) });
export const fields = Object.keys(properties).filter(key => key !== 'id');

// Validate the same bounded schema locally; provider-side JSON mode is not trusted.
export function validateShape(value, rule, location = 'cards') {
  if (rule.anyOf) {
    if (rule.anyOf.some(option => { try { validateShape(value, option, location); return true; } catch { return false; } })) return;
    throw new Error(`Invalid extraction at ${location}`);
  }
  const valid = rule.type === 'null' ? value === null : rule.type === 'array' ? Array.isArray(value) : rule.type === 'object' ? value && typeof value === 'object' && !Array.isArray(value) : rule.type === 'integer' ? Number.isInteger(value) : typeof value === rule.type;
  if (!valid || rule.enum && !rule.enum.includes(value)) throw new Error(`Invalid extraction at ${location}`);
  if (typeof value === 'number' && (!Number.isFinite(value) || value < rule.minimum || value > rule.maximum)) throw new Error(`Invalid threshold at ${location}`);
  if (typeof value === 'string' && (!value.trim() || value.length > (rule.maxLength ?? Infinity))) throw new Error(`Invalid text at ${location}`);
  if (rule.type === 'object') {
    if (Object.keys(value).some(key => !(key in rule.properties)) || rule.required.some(key => !(key in value))) throw new Error(`Unexpected or missing field at ${location}`);
    for (const [key, child] of Object.entries(rule.properties)) validateShape(value[key], child, `${location}.${key}`);
  }
  if (rule.type === 'array') {
    if (value.length < (rule.minItems ?? 0) || value.length > rule.maxItems) throw new Error(`Invalid list at ${location}`);
    value.forEach((item, index) => validateShape(item, rule.items, `${location}[${index}]`));
  }
}

export function displayFields(card) {
  const list = values => values.length ? { value: values.map(requirementLabel).join(', '), evidence: [...new Set(values.map(v => v.evidence))].join('\n') } : null;
  return { ...card,
    requirements: list(card.requirements.filter(v => v.kind !== 'experience')),
    preferred: list(card.preferred),
    experience: list(card.requirements.filter(v => v.kind === 'experience')),
    project: card.software || card.work ? { value: `Software: ${card.software?.value || 'Not stated'} Work: ${card.work?.value || 'Not stated'}`, evidence: [card.software?.evidence, card.work?.evidence].filter(Boolean).join('\n') } : null,
  };
}
