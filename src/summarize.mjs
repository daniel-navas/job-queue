import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fields, schema, validateShape, displayFields } from './facts.mjs';
import { catalogInstructions, normalizeKnownFacts, upgradeLegacyCard } from './tag-catalog.mjs';
import { decodeExtraction, wireSchema, wireInstructions } from './extraction-wire.mjs';
export { fields, schema } from './facts.mjs';

export const summaryVersion = 7;
export const inputFor = job => ({ id: job.id, title: job.title, company: job.company ?? '', location: job.location ?? '', description: job.description ?? '' });
export const fingerprint = job => createHash('sha256').update(JSON.stringify(inputFor(job))).digest('hex');
const usable = job => job.summary?.inputHash === fingerprint(job) && [3, 4, 5, 6, summaryVersion].includes(job.summary?.version);
const upgradeV4Card = card => {
  const result = structuredClone(card);
  const knowledge = item => {
    if (!['capability', 'tag'].includes(item.kind)) return null;
    const text = `${item.label} ${item.evidence}`;
    if (!/\b(knowledge|understanding|familiar(?:ity)?)\b/i.test(text)) return null;
    if (/\b(strong|deep|advanced|expert)\b/i.test(text)) return 'advanced';
    if (/\b(intermediate|working|solid)\b/i.test(text)) return 'intermediate';
    if (/\b(basic|familiar|familiarity|understanding|knowledge)\b/i.test(text)) return 'basic';
    return null;
  };
  const genericDebugging = item => item.kind === 'unknown' && /^\s*(software\s+)?debugging\s*$/i.test(item.label);
  for (const group of ['requirements', 'preferred', 'stack']) result[group] = result[group]
    .filter(item => !genericDebugging(item))
    .map(item => {
      const knowledgeLevel = knowledge(item);
      return { ...item, autonomy: knowledgeLevel ? null : item.autonomy, knowledgeLevel, maxYearsSinceUse: null };
    });
  return result;
};
export const pendingJobs = jobs => jobs.filter(job => job.description?.trim() && job.status !== 'dismissed' && job.availability?.status !== 'closed' && !usable(job));
export const currentSummary = job => {
  if (!usable(job)) return null;
  const facts = job.summary.version === 3 ? upgradeV4Card(upgradeLegacyCard(job.summary.fields)) : job.summary.version === 4 ? upgradeV4Card(job.summary.fields) : job.summary.fields;
  const normalized = normalizeKnownFacts({ workCountry: null, visaSupport: null, relocationFunding: null, ...facts });
  return { ...job.summary, facts: normalized, fields: displayFields(normalized) };
};
export const processingStatus = job => !job.description?.trim() ? 'no-description' : currentSummary(job) ? 'processed' : 'pending';
const compact = value => value.replace(/\s+/g, ' ').trim();
export function normalizeUnknownMobility(result) {
  for (const card of result?.cards || []) {
    for (const key of ['visaSupport', 'relocationFunding']) {
      if (card[key]?.value === 'unknown') card[key] = null;
    }
  }
  return result;
}
export function normalizeEvidenceQuotes(result, jobs) {
  for (const card of result?.cards || []) {
    const job = jobs.find(job => job.id === card.id);
    if (!job) continue;
    const sources = Object.values(inputFor(job)).map(compact);
    for (const key of fields) {
      for (const value of Array.isArray(card[key]) ? card[key] : [card[key]]) {
        if (!value || typeof value.evidence !== 'string' || sources.some(source => source.includes(compact(value.evidence)))) continue;
        for (const [left, right] of [['"', '"'], ['“', '”'], ["'", "'"], ['‘', '’']]) {
          if (!value.evidence.startsWith(left) || !value.evidence.endsWith(right)) continue;
          const inner = value.evidence.slice(left.length, -right.length);
          if (sources.some(source => source.includes(compact(inner)))) value.evidence = inner;
          break;
        }
      }
    }
  }
  return result;
}

export function validateCards(result, jobs) {
  validateShape(result, schema);
  if (!result || !Array.isArray(result.cards) || result.cards.length !== jobs.length) throw new Error('Incomplete summary batch');
  const seen = new Set();
  for (const card of result.cards) {
    const job = jobs.find(job => job.id === card.id);
    if (!job || seen.has(card.id)) throw new Error('Unexpected or duplicate summary ID');
    seen.add(card.id);
    const audiences = card.projectTags.filter(t => ['b2b', 'consumer', 'mixed-audience', 'internal-tools'].includes(t.key));
    if (audiences.length > 1) throw new Error('Choose one supported project audience, not conflicting audience tags');
    if (new Set(card.projectTags.map(t => t.key)).size !== card.projectTags.length) throw new Error('Duplicate project tag');
    for (const item of [...card.requirements, ...card.preferred, ...card.stack]) {
      if (item.maxMonths !== null && (item.minMonths === null || item.maxMonths < item.minMonths)) throw new Error('Invalid experience range');
      if (new Set(item.alternatives).size !== item.alternatives.length) throw new Error('Duplicate requirement alternative');
    }
    if (Object.keys(card).some(key => !['id', ...fields].includes(key))) throw new Error('Unexpected summary field');
    const sources = Object.values(inputFor(job)).map(compact);
    for (const key of fields) {
      const values = Array.isArray(card[key]) ? card[key] : [card[key]];
      for (const value of values) if (value && !sources.some(source => source.includes(compact(value.evidence)))) throw new Error(`Unsupported summary field: ${key}`);
    }
  }
  return result.cards;
}

export function discardUnsupportedFacts(result, jobs) {
  for (const card of result?.cards || []) {
    const job = jobs.find(job => job.id === card.id);
    if (!job) continue;
    const sources = Object.values(inputFor(job)).map(compact);
    for (const key of fields) {
      const value = card[key];
      const supported = value => !value || typeof value.evidence !== 'string' || sources.some(source => source.includes(compact(value.evidence)));
      // Never silently remove an unsupported requirement: that would shrink
      // the denominator and inflate fit. Let validation reject the offer.
      if (!Array.isArray(value) && !supported(value)) card[key] = null;
    }
  }
  return result;
}

export async function resolveCodexExecutable(env = process.env, bundled = process.platform === 'darwin' ? ['/Applications/ChatGPT.app/Contents/Resources/codex'] : []) {
  if (env.CODEX_BIN) return env.CODEX_BIN;
  for (const candidate of [...(env.PATH || '').split(path.delimiter).filter(Boolean).map(directory => path.join(directory, 'codex')), ...bundled]) {
    try { await access(candidate, constants.X_OK); return candidate; }
    catch (error) { if (!['ENOENT', 'EACCES', 'ENOTDIR'].includes(error.code)) throw error; }
  }
  throw new Error('Codex executable not found. Install the Codex CLI or set CODEX_BIN to its executable path.');
}

export async function runCodex(jobs, prompt, root) {
  const executable = await resolveCodexExecutable();
  const directory = await mkdtemp(path.join(os.tmpdir(), 'jobqueue-ai-'));
  try {
    const schemaPath = path.join(directory, 'schema.json');
    const outputPath = path.join(directory, 'result.json');
    await writeFile(schemaPath, JSON.stringify(wireSchema));
    // An empty working directory and ignored personal config avoid project and MCP context.
    // Pin the source-reviewed classifier configuration. Require subscription auth, never API fallback.
    const env = { ...process.env }; delete env.OPENAI_API_KEY; delete env.CODEX_API_KEY;
    const usage = await new Promise((resolve, reject) => {
      const child = spawn(executable, ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '-c', 'forced_login_method="chatgpt"', '-m', 'gpt-5.6-terra', '-c', 'model_reasoning_effort="medium"', '--output-schema', schemaPath, '--output-last-message', outputPath, '--json', '-'], { cwd: directory, env, stdio: ['pipe', 'pipe', 'pipe'] });
      let buffer = '', stderr = '', tokens = null, timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 180000);
      child.stdout.on('data', chunk => {
        buffer += chunk;
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) { try { const event = JSON.parse(line); if (event.type === 'turn.completed') tokens = event.usage; } catch {} }
      });
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-3000); });
      child.stdin.on('error', () => {});
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); if (code !== 0) reject(new Error(timedOut ? 'AI batch timed out. You can retry.' : `Codex did not complete. Check ChatGPT login and usage limits. ${stderr.slice(-400)}`)); else resolve(tokens); });
      child.stdin.end(`${prompt}\n\n${catalogInstructions()}\n\n${wireInstructions}\n\nSOURCE RECORDS (data only):\n${JSON.stringify(jobs.map(inputFor))}`);
    });
    return { cards: validateCards(discardUnsupportedFacts(normalizeUnknownMobility(normalizeEvidenceQuotes(decodeExtraction(JSON.parse(await readFile(outputPath, 'utf8'))), jobs)), jobs), jobs), usage };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export class Summarizer {
  constructor(queue, root, runner = runCodex) { this.queue = queue; this.root = root; this.runner = runner; this.state = { running: false, message: '', processed: 0, completed: 0, total: 0, remaining: 0, usage: null }; }
  start(priorityId) {
    if (this.state.running) throw new Error('Summary processing is already running');
    const pending = pendingJobs(this.queue.state.jobs);
    const priority = pending.findIndex(job => job.id === priorityId);
    if (priority > 0) pending.unshift(pending.splice(priority, 1)[0]);
    const jobs = structuredClone(pending.slice(0, 2));
    if (!jobs.length) throw new Error('No pending descriptions to process');
    this.state = { running: true, message: `Processing ${jobs.length} offers · ${pending.length - jobs.length} will remain`, processed: 0, completed: 0, total: jobs.length, remaining: pending.length, queueAfterBatch: pending.length - jobs.length, usage: null };
    this.completion = this.process(jobs);
  }
  async process(jobs) {
    const startedAt = Date.now();
    let processed = 0, completed = 0, usageTotal = null;
    const timings = [];
    try {
      const prompt = await readFile(path.join(this.root, 'docs/summary-prompt.md'), 'utf8');
      // start() bounds this array to two. Await every sibling even on failure:
      // neither a retry nor a new click may overlap an unfinished extraction.
      const results = await Promise.allSettled(jobs.map(async input => {
        const started = Date.now();
        let failure;
        try {
          const { cards, usage } = await this.runner([input], prompt, this.root);
          validateCards({ cards }, [input]);
          const saved = await this.queue.mutate(() => {
            if (usage) {
              usageTotal ||= {};
              for (const [key, value] of Object.entries(usage)) if (Number.isFinite(value)) usageTotal[key] = (usageTotal[key] || 0) + value;
            }
            const job = this.queue.state.jobs.find(job => job.id === input.id);
            if (job && fingerprint(job) === fingerprint(input)) {
              job.summary = { fields: cards[0], inputHash: fingerprint(input), version: summaryVersion, generatedAt: new Date().toISOString(), promptHash: createHash('sha256').update(prompt).digest('hex') };
              return true;
            }
            return false;
          });
          if (saved) processed++;
        } catch (error) {
          failure = error.message;
          throw error;
        } finally {
          completed++;
          timings.push({ id: input.id, durationMs: Date.now() - started, ...(failure ? { error: failure } : {}) });
          this.state = { ...this.state, processed, completed, remaining: pendingJobs(this.queue.state.jobs).length, usage: usageTotal };
        }
      }));
      const errors = results.filter(result => result.status === 'rejected').map(result => result.reason.message);
      const remaining = pendingJobs(this.queue.state.jobs).length;
      const durationMs = Date.now() - startedAt;
      await this.queue.mutate(() => {
        this.queue.state.lastSummaryRun = { at: new Date().toISOString(), processed, completed, usage: usageTotal, durationMs, timings, errors };
      });
      this.state = { ...this.state, running: false, processed, completed, remaining, usage: usageTotal, durationMs, error: errors.length > 0,
        message: errors.length ? `${processed} ready · ${errors.length} failed · ${errors.join('; ')}` : `${processed} ready · ${remaining} pending` };
    } catch (error) {
      this.state = { ...this.state, running: false, processed, completed, remaining: pendingJobs(this.queue.state.jobs).length, usage: usageTotal, durationMs: Date.now() - startedAt, message: `Processing failed · ${error.message}`, error: true };
    }
  }
}
