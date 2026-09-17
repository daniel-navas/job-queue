import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runCodex, fingerprint } from '../src/summarize.mjs';
import { wireSchema, wireInstructions } from '../src/extraction-wire.mjs';
import { catalogInstructions } from '../src/tag-catalog.mjs';
import { cases, evaluateCase } from '../test-support/classifier-cases.mjs';

// Explicit invocation only. Never imports results into the queue.
// --audit REPORT checks saved outputs without contacting AI.
// --sources FILE supplies the two owner-authorized, frozen real descriptions.
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1]; };
const root = path.resolve(import.meta.dirname, '..');
const audit = option('--audit');
let report;
if (audit) {
  report = JSON.parse(await readFile(audit, 'utf8'));
  for (const item of report.reports) item.checks = evaluateCase(item.id, item.cards?.[0]);
} else {
  const sourcePath = option('--sources');
  const sources = sourcePath ? JSON.parse(await readFile(sourcePath, 'utf8')) : [];
  const selected = cases.filter(item => item.source || sourcePath);
  const jobs = selected.map(item => item.source || sources.find(job => job.id === item.id));
  if (jobs.some(job => !job)) throw new Error('Missing frozen source; nothing sent');
  const prompt = await readFile(path.join(root, 'docs/summary-prompt.md'), 'utf8');
  const hash = value => createHash('sha256').update(value).digest('hex');
  const reports = [];
  const started = Date.now();
  // Same production boundary: one complete description/call, at most two concurrent.
  for (let index = 0; index < jobs.length; index += 2) {
    reports.push(...await Promise.all(jobs.slice(index, index + 2).map(async job => {
      const start = Date.now();
      try {
        const result = await runCodex([job], prompt, root);
        return { id: job.id, sourceHash: fingerprint(job), durationMs: Date.now() - start, ...result, checks: evaluateCase(job.id, result.cards[0]) };
      } catch (error) { return { id: job.id, sourceHash: fingerprint(job), durationMs: Date.now() - start, error: error.message, checks: evaluateCase(job.id, null) }; }
    })));
  }
  report = { at: new Date().toISOString(), durationMs: Date.now() - started, promptHash: hash(prompt), schemaHash: hash(JSON.stringify(wireSchema)), catalogHash: hash(catalogInstructions()), wireInstructionsHash: hash(wireInstructions), settings: 'Codex CLI default model/effort; ChatGPT subscription; full source; compact wire; concurrency 2; no retries', reports };
  const output = option('--output') || path.join(root, '.local/classifier-eval.json');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(`Saved local report: ${output}`);
}
for (const item of report.reports) console.log(JSON.stringify({ id: item.id, durationMs: item.durationMs, usage: item.usage, error: item.error, passed: item.checks.filter(check => check.passed).length, checks: item.checks.length, failures: item.checks.filter(check => !check.passed).map(check => check.name) }));
if (report.reports.some(item => item.error || item.checks.some(check => !check.passed))) process.exitCode = 1;
