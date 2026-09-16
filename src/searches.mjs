import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const digest = value => createHash('sha256').update(value).digest('hex');
const nonempty = (value, key, max) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid search ${key}`);
  return value.trim();
};

export function normalizeSearch(input) {
  if (!input || input.provider !== 'linkedin') throw new Error('Unsupported search provider');
  const id = nonempty(input.id, 'ID', 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid search ID');
  const name = nonempty(input.name, 'name', 100);
  const query = nonempty(input.query, 'query', 500);
  const location = nonempty(input.location, 'location', 150);
  const workplace = input.workplace ?? 'any', datePosted = input.datePosted ?? 'month';
  if (!['any', 'remote'].includes(workplace)) throw new Error('Invalid search workplace');
  if (!['any', 'day', 'week', 'month'].includes(datePosted)) throw new Error('Invalid search date filter');
  if (typeof input.enabled !== 'boolean') throw new Error('Invalid search enabled value');
  const criteria = { provider: 'linkedin', query, location, workplace, datePosted };
  const url = new URL('https://www.linkedin.com/jobs/search/');
  url.searchParams.set('keywords', query); url.searchParams.set('location', location);
  if (workplace === 'remote') url.searchParams.set('f_WT', '2');
  if (datePosted !== 'any') url.searchParams.set('f_TPR', { day: 'r86400', week: 'r604800', month: 'r2592000' }[datePosted]);
  return { id, name, ...criteria, enabled: input.enabled, revision: digest(JSON.stringify(criteria)).slice(0, 16), url: url.href };
}

// Read-only compatibility: old URLs remain distinguishable from verified runs.
export function legacySearch(url, name = 'Legacy LinkedIn search') {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(parsed.hostname) || parsed.pathname !== '/jobs/search/') return null;
    return { id: `legacy-${digest(url).slice(0, 12)}`, provider: 'linkedin', name,
      query: parsed.searchParams.get('keywords') || 'LinkedIn jobs',
      location: parsed.searchParams.get('location') || 'Not recorded',
      workplace: parsed.searchParams.get('f_WT') === '2' ? 'remote' : 'any',
      datePosted: ({ r86400: 'day', r604800: 'week', r2592000: 'month' })[parsed.searchParams.get('f_TPR')] || 'any',
      revision: 'legacy', url: parsed.href, legacy: true };
  } catch { return null; }
}

export function discoveriesFor(job) {
  if (job.discoveries?.length) return job.discoveries;
  const search = legacySearch(job.searchUrl);
  return search ? [{ search, firstSeen: null, lastSeen: job.lastSeen ?? null }] : [];
}

export class SearchStore {
  constructor(root) { this.file = path.join(root, 'config/searches.json'); this.pending = Promise.resolve(); }
  async read() {
    const raw = await readFile(this.file, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.searches)) throw new Error('Invalid search configuration');
    const searches = data.searches.map(input => {
      if (!input.query && input.url) {
        const legacy = legacySearch(input.url, input.name);
        if (!legacy) throw new Error('Invalid legacy search URL');
        return normalizeSearch({ ...legacy, enabled: true });
      }
      return normalizeSearch(input);
    });
    if (new Set(searches.map(s => `${s.provider}:${s.id}`)).size !== searches.length) throw new Error('Duplicate search IDs');
    return { version: digest(raw), searches };
  }
  update(input, version) {
    const operation = this.pending.then(async () => {
      const state = await this.read();
      if (version !== state.version) { const error = new Error('Searches changed. Reopen the editor before saving.'); error.status = 409; throw error; }
      const isNew = !input.id;
      const search = normalizeSearch({ ...input, id: input.id || randomUUID() });
      const index = state.searches.findIndex(s => s.id === search.id && s.provider === search.provider);
      if (!isNew && index < 0) throw new Error('Search not found');
      if (isNew) state.searches.push(search); else state.searches[index] = search;
      await mkdir(path.dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify({ schemaVersion: 2, searches: state.searches }, null, 2) + '\n');
      await rename(temporary, this.file);
      return this.read();
    });
    this.pending = operation.catch(() => {});
    return operation;
  }
}

export function searchAnalytics(searches, jobs, runs = []) {
  const complete = [...new Map(jobs.filter(j => j.description?.trim()).map(j => [j.id, j])).values()];
  return searches.map(search => {
    const belongs = origin => origin.search.provider === search.provider && origin.search.id === search.id;
    const historical = complete.filter(job => discoveriesFor(job).some(belongs));
    const current = historical.filter(job => discoveriesFor(job).some(origin => belongs(origin) && origin.search.revision === search.revision));
    const scored = current.filter(job => Number.isFinite(job.rating?.total));
    const history = runs.filter(run => run.search?.id === search.id && run.search?.provider === search.provider && run.search.revision === search.revision);
    return { id: search.id, provider: search.provider, revision: search.revision,
      captured: current.length, historicalCaptured: historical.length,
      exclusive: current.filter(job => new Set(discoveriesFor(job).map(d => `${d.search.provider}:${d.search.id}`)).size === 1).length,
      processed: scored.length,
      meanRating: scored.length ? Math.round(scored.reduce((sum, job) => sum + job.rating.total, 0) / scored.length * 100) / 100 : null,
      interesting: current.filter(job => job.status === 'interesting').length,
      runs: history.length, lastRun: history.at(-1) ?? null };
  });
}
