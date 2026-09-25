import { schema, validateShape } from './facts.mjs';

const aliases = { label: 'l', kind: 'k', alternatives: 'a', evidence: 'e' };
const names = Object.fromEntries(Object.entries(aliases).map(([name, alias]) => [alias, name]));
const thresholds = ['level', 'minMonths', 'maxMonths'];

// Only the transport changes. The stored facts and their authoritative validator
// stay unchanged; absent thresholds mean null, never an inferred value.
function shorten(rule) {
  if (Array.isArray(rule)) return rule.map(shorten);
  if (!rule || typeof rule !== 'object') return rule;
  const result = Object.fromEntries(Object.entries(rule).map(([key, value]) => [key,
    key === 'properties' ? Object.fromEntries(Object.entries(value).map(([name, child]) => [aliases[name] || name, shorten(child)]))
      : key === 'required' ? value.map(name => aliases[name] || name) : shorten(value),
  ]));
  if (rule.properties?.kind && rule.properties?.alternatives) {
    for (const name of thresholds) delete result.properties[name];
    result.properties.t = {
      type: 'array', maxItems: thresholds.length,
      items: { type: 'object', additionalProperties: false, required: ['p', 'v'], properties: {
        p: { type: 'string', enum: thresholds },
        v: { anyOf: [{ type: 'number' }, { type: 'string' }] },
      } },
    };
    result.required = Object.keys(result.properties);
  }
  return result;
}

const localSchema = shorten(schema);
export const wireSchema = structuredClone(localSchema);
wireSchema.$defs = { criterion: wireSchema.properties.cards.items.properties.requirements.items };
for (const group of ['requirements', 'preferred', 'stack']) {
  wireSchema.properties.cards.items.properties[group].items = { $ref: '#/$defs/criterion' };
}

export const wireInstructions = `WIRE FORMAT ONLY: keep all extraction rules above, but use these shorter JSON property names everywhere in output: ${JSON.stringify(aliases)}. Values and tag keys are unchanged. For each criterion, replace the nullable fields (${thresholds.join(', ')}) with t: an array of {p: original property name, v: its non-null value}. Omit null values from t; use [] if none. Never duplicate a property.`;

export function decodeExtraction(input) {
  validateShape(input, localSchema);
  function expand(value) {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== 'object') return value;
    const result = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 't')
      .map(([key, child]) => [names[key] || key, expand(child)]));
    if (Array.isArray(value.t)) {
      if (new Set(value.t.map(item => item.p)).size !== value.t.length) throw new Error('Duplicate extraction threshold');
      for (const name of thresholds) result[name] = null;
      for (const item of value.t) result[item.p] = item.v;
    }
    return result;
  }
  const result = expand(input);
  validateShape(result, schema);
  return result;
}
