import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createLinkedInCollector } from './linkedin/collector.mjs';

export async function runSearchBatch(searches, execute, progress = () => {}) {
  const selected = structuredClone(searches.filter(search => search.enabled));
  if (!selected.length) throw new Error('Enable a search first');
  let added = 0;
  for (const [index, search] of selected.entries()) {
    progress(`Searching ${index + 1}/${selected.length}`, search.query);
    try { added += (await execute(search)).added; }
    catch (error) { added += error.added ?? 0; return { added, error: true, message: `${added} new offers retained. ${error.message}` }; }
  }
  return { added, error: false, message: `${added} complete opportunities added · ${selected.length} searches` };
}

export async function collectSearch(root, queue, search, collector) {
  const runId = randomUUID();
  const manifest = path.join(root, 'data/search-runs', `${runId}.json`);
  let failure;
  try { await collector.collect(search, runId); }
  catch (error) { failure = error; }
  let result;
  try { result = await queue.importCapture(manifest, runId); }
  catch {
    await queue.recordFailedSearch(runId, search, 'Capture unavailable; search stopped.');
    throw new Error(`${search.query}: capture unavailable; search stopped.`);
  }
  if (failure) {
    const error = new Error(`${search.query}: ${failure.message} Captures retained; check the LinkedIn connection before retrying.`);
    error.added = result.added;
    throw error;
  }
  return result;
}

export async function runManagedSearchBatch(root, queue, searches, progress = () => {}, openCollector = createLinkedInCollector) {
  const selected = structuredClone(searches.filter(search => search.enabled));
  if (!selected.length) throw new Error('Enable a search first');
  let collector;
  try { collector = await openCollector(root, progress); }
  catch (error) {
    await queue.recordFailedSearch(randomUUID(), selected[0], `Connection unavailable: ${error.message}`);
    throw error;
  }
  try { return await runSearchBatch(selected, search => collectSearch(root, queue, search, collector), progress); }
  finally { await collector.close(); }
}
