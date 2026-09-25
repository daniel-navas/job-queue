import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCard, requirement } from '../test-support/fixtures.mjs';
import { decodeExtraction, wireSchema } from '../src/extraction-wire.mjs';
import { validateShape } from '../src/facts.mjs';
import * as summarizer from '../src/summarize.mjs';
const { runCodex } = summarizer;
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const wire = overrides => ({ cards: [emptyCard({
  workplace: { value: 'Remote', e: 'Remote' },
  requirements: [{ l: 'Java experience', k: 'tag', a: ['java'], e: 'Java', t: [], ...overrides }],
  projectTags: [{ key: 'b2b', e: 'Business customers' }],
})] });

test('compact extraction restores nulls, typed thresholds and exact evidence without changing facts', () => {
  const input = wire({ t: [{ p: 'minMonths', v: 36 }, { p: 'maxMonths', v: 84 }, { p: 'level', v: 'advanced' }] });
  const expandRefs = rule => {
    if (Array.isArray(rule)) return rule.map(expandRefs);
    if (!rule || typeof rule !== 'object') return rule;
    if (rule.$ref) return expandRefs(wireSchema.$defs[rule.$ref.split('/').at(-1)]);
    return Object.fromEntries(Object.entries(rule).map(([key, value]) => [key, expandRefs(value)]));
  };
  validateShape(input, expandRefs(wireSchema));
  assert.deepEqual(decodeExtraction(input), { cards: [emptyCard({
    workplace: { value: 'Remote', evidence: 'Remote' },
    requirements: [requirement('java', { label: 'Java experience', evidence: 'Java', minMonths: 36, maxMonths: 84, level: 'advanced' })],
    projectTags: [{ key: 'b2b', evidence: 'Business customers' }],
  })] });
  assert.equal(input.cards[0].requirements[0].t.length, 3, 'Decoding does not mutate provider input');
  const conceptual = wire({ k: 'tag', a: ['system-design'], t: [{ p: 'level', v: 'basic' }] });
  const decoded = decodeExtraction(conceptual).cards[0].requirements[0];
  assert.equal(decoded.level, 'basic');
  assert.equal(decoded.minMonths, null);
});

test('compact decoding rejects duplicate, unknown and malformed data instead of silently dropping it', () => {
  for (const patch of [
    { t: [{ p: 'minMonths', v: 12 }, { p: 'minMonths', v: 24 }] },
    { t: [{ p: 'minMonths', v: '12' }] },
    { t: [{ p: 'minMonths', v: -1 }] },
    { t: [{ p: 'level', v: 'expert' }] },
    { t: [{ p: 'invented', v: 5 }] },
    { t: [{ p: 'minMonths', v: null }] },
    { t: undefined }, { invented: true }, { a: ['made-up-tag'] },
  ]) assert.throws(() => decodeExtraction(wire(patch)));
});

test('runner sends full sources with compact schema and returns ordinary validated facts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'jq-wire-test-'));
  const previous = process.env.CODEX_BIN;
  try {
    const executable = path.join(directory, 'fake-codex.mjs');
    await writeFile(executable, `#!${process.execPath}
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
assert(args.includes('forced_login_method="chatgpt"'));
assert(args.includes('--ignore-user-config'));
assert.equal(args[args.indexOf('-m') + 1], 'gpt-5.6-terra');
assert(args.includes('model_reasoning_effort="medium"'));
assert.equal(process.env.OPENAI_API_KEY, undefined);
assert.equal(process.env.CODEX_API_KEY, undefined);
const schema = JSON.parse(await readFile(args[args.indexOf('--output-schema') + 1], 'utf8'));
assert(schema.$defs.criterion.anyOf.every(rule => rule.required.includes('t') && !rule.required.includes('minMonths')));
let input = ''; for await (const chunk of process.stdin) input += chunk;
assert(input.includes('Keep every requirement.'));
assert(input.includes('WIRE FORMAT ONLY'));
assert(input.includes('Java. Remote. Business customers. Complete source tail.'));
await writeFile(args[args.indexOf('--output-last-message') + 1], ${JSON.stringify(JSON.stringify(wire({})))});
console.log(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5 } }));
`);
    await chmod(executable, 0o700);
    process.env.CODEX_BIN = executable;
    const result = await runCodex([{ id: '1', title: 'Engineer', description: 'Java. Remote. Business customers. Complete source tail.' }], 'Keep every requirement.', directory);
    assert.equal(result.cards[0].requirements[0].evidence, 'Java');
    assert.equal(result.cards[0].requirements[0].minMonths, null);
    assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 5 });
  } finally {
    if (previous === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test('runner locates bundled Codex when the server PATH has no Codex command', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'jq-codex-path-test-'));
  try {
    const bundled = path.join(directory, 'codex');
    await writeFile(bundled, '#!/bin/sh\nexit 0\n');
    await chmod(bundled, 0o700);
    assert.equal(typeof summarizer.resolveCodexExecutable, 'function');
    assert.equal(await summarizer.resolveCodexExecutable({ PATH: directory + '/empty' }, [bundled]), bundled);
    assert.equal(await summarizer.resolveCodexExecutable({ CODEX_BIN: bundled, PATH: '' }, []), bundled);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
