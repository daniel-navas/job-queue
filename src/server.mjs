import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SearchStore, searchAnalytics, discoveriesFor } from './searches.mjs';
import { runSearchBatch, collectSearch } from './scan.mjs';
import { Queue } from './queue.mjs';
import { Summarizer, pendingJobs, currentSummary, processingStatus } from './summarize.mjs';
import { evaluateJob } from './evaluate.mjs';
import { monthlySalary, withCOP, exchangeRates } from './salary.mjs';

const root = process.env.JOBQUEUE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const queue = new Queue(root);
await queue.load();
const summarizer = new Summarizer(queue, root);
const searches = new SearchStore(root);
const port = Number(process.env.PORT ?? 4317);
let scan = { running: false, message: 'Ready', finishedAt: null };
const server = http.createServer(async (req, res) => {
  const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  try {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return json(403, { error: 'Local access only' });
    if (req.method === 'POST' && req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return json(403, { error: 'Invalid origin' });
    if (req.method === 'POST' && req.url === '/api/searches') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 10000) return json(413, { error: 'Request too large' }); }
      const { search, version } = JSON.parse(body);
      return json(200, await searches.update(search, version));
    }
    if (req.method === 'GET' && ['/api/jobs', '/api/searches'].includes(req.url)) {
      const [scoringConfig, preferencesConfig] = await Promise.all(['scoring', 'preferences'].map(async name => JSON.parse(await readFile(path.join(root, `config/${name}.json`), 'utf8'))));
      const currentJobs = queue.state.jobs.map((job, index) => ({ ...job, reference: `JQ-${String(index + 1).padStart(3, '0')}`, processingStatus: processingStatus(job), summary: currentSummary(job) })).filter(job => job.description?.trim());
      const salaries = currentJobs.map(job => monthlySalary(job.summary?.fields.salary));
      const exchange = salaries.some(salary => salary?.currency) ? await exchangeRates() : null;
      const profile = JSON.parse(await readFile(path.join(root, 'profile/matching.json'), 'utf8'));
      const config = await searches.read();
      const jobs = currentJobs.map((job, index) => ({ ...evaluateJob(job, profile, preferencesConfig, scoringConfig, withCOP(salaries[index], exchange)), discoveries: discoveriesFor(job) }));
      const searchState = { ...config, stats: searchAnalytics(config.searches, jobs, queue.state.searchRuns) };
      if (req.url === '/api/searches') return json(200, searchState);
      return json(200, { jobs, searches: searchState, preferences: preferencesConfig, scan, ai: { ...summarizer.state, pending: pendingJobs(queue.state.jobs).length } });
    }
    if (req.method === 'POST' && req.url === '/api/summarize') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 10000) return json(413, { error: 'Request too large' }); }
      const { id } = body ? JSON.parse(body) : {};
      summarizer.start(id); return json(202, summarizer.state);
    }
    if (req.method === 'POST' && req.url === '/api/review') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 10000) return json(413, { error: 'Request too large' }); }
      const { id, status, reason = '' } = JSON.parse(body);
      await queue.review(id, status, reason); return json(200, { ok: true });
    }
    if (req.method === 'POST' && req.url === '/api/scan') {
      if (scan.running) return json(409, { error: 'A search is already running' });
      if (scan.finishedAt && Date.now() - Date.parse(scan.finishedAt) < 60000) return json(429, { error: 'Please wait a minute before searching again' });
      // Reserve the batch before awaiting disk so concurrent clicks cannot launch
      // two persistent browsers against the same authenticated profile.
      scan = { running: true, message: 'Opening LinkedIn. Complete sign-in in Chrome if requested.', finishedAt: null };
      let selected;
      try {
        selected = (await searches.read()).searches;
        if (!selected.some(search => search.enabled)) throw new Error('Enable a search first');
      } catch (error) { scan = { running: false, message: error.message, error: true, finishedAt: null }; throw error; }
      const progress = message => { scan.message = message; };
      runSearchBatch(selected, search => collectSearch(root, queue, search, progress), progress)
        .then(result => { scan = { ...result, running: false, finishedAt: new Date().toISOString() }; })
        .catch(error => { scan = { running: false, error: true, message: error.message, finishedAt: new Date().toISOString() }; });
      return json(202, scan);
    }
    if (req.method === 'GET' && req.url === '/rating.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(await readFile(path.join(root, 'src/rating.mjs'))); }
    const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/searches.js': ['searches.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    if (req.method !== 'GET' || !assets[req.url]) return json(404, { error: 'Not found' });
    const [file, type] = assets[req.url];
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(await readFile(path.join(root, 'public', file)));
  } catch (error) { json(error.status ?? 400, { error: error.message }); }
});
server.listen(port, '127.0.0.1', () => console.log(`JobQueue: http://127.0.0.1:${port}`));
