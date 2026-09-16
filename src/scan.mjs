import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export async function runSearchBatch(searches, execute, progress = () => {}) {
  const selected = structuredClone(searches.filter(search => search.enabled));
  if (!selected.length) throw new Error('Enable a search first');
  let added = 0;
  for (const [index, search] of selected.entries()) {
    progress(`${index + 1}/${selected.length} · ${search.name ?? search.id}`);
    try { added += (await execute(search)).added; }
    catch (error) { added += error.added ?? 0; return { added, error: true, message: `${added} new offers retained. ${error.message}` }; }
  }
  return { added, error: false, message: `${added} complete opportunities added · ${selected.length} searches` };
}

export async function collectSearch(root, queue, search, progress = () => {}) {
  const runId = randomUUID();
  const manifest = path.join(root, 'data/search-runs', `${runId}.json`);
  let failure = '';
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, ['src/linkedin/poc.mjs', '--search-json', JSON.stringify(search), '--run-id', runId, '--capture-window-ms', '15000', '--detail-limit', '5'], { cwd: root });
    child.stdout.on('data', chunk => {
      const line = chunk.toString().trim().split('\n').find(value => /^(Detail |Waiting for)/.test(value));
      if (line) progress(`${search.name} · ${line}`);
    });
    child.stderr.on('data', chunk => { failure = (failure + chunk).slice(-4000); });
    child.on('error', error => { failure = error.message; resolve(-1); });
    child.on('close', resolve);
  });
  let result;
  try { result = await queue.importCapture(manifest, runId); }
  catch {
    await queue.recordFailedSearch(runId, search, 'Capture unavailable; search stopped.');
    throw new Error(`${search.name}: capture unavailable; search stopped.`);
  }
  if (code !== 0) {
    const error = new Error(/429|challenge|checkpoint|captcha/i.test(failure)
      ? `${search.name}: LinkedIn security/rate-limit stop. Captures retained; check Chrome before retrying.`
      : `${search.name}: search interrupted. Captures retained; sign-in or collector update may be needed.`);
    error.added = result.added;
    throw error;
  }
  return result;
}
