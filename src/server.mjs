import http from 'node:http';
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SearchStore, searchAnalytics, discoveriesFor } from './searches.mjs';
import { runManagedSearchBatch } from './scan.mjs';
import { connectLinkedIn, connectionStatus } from './linkedin/collector.mjs';
import { Queue } from './queue.mjs';
import { Summarizer, pendingJobs, currentSummary, processingStatus } from './summarize.mjs';
import { evaluateJob } from './evaluate.mjs';
import { monthlySalary, withCOP, exchangeRates } from './salary.mjs';
import { inventoryUnmapped, loadUnmappedReview } from './unmapped-review.mjs';
import { applicationView } from './application-tracker.mjs';
import { profileReview, ProfileStore } from './profile-review.mjs';

const root = process.env.JOBQUEUE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const queue = new Queue(root);
await queue.load();
const summarizer = new Summarizer(queue, root);
const searches = new SearchStore(root);
const profiles = new ProfileStore(root);
const port = Number(process.env.PORT ?? 4317);
const development = process.env.JOBQUEUE_DEV === '1';
const devClients = new Set();
let devReloadTimer;
if (development) watch(path.join(root, 'public'), { recursive: true }, () => {
  clearTimeout(devReloadTimer);
  devReloadTimer = setTimeout(() => {
    for (const client of devClients) client.write('event: reload\ndata: {}\n\n');
  }, 75);
});
let scan = { running: false, message: 'Ready', finishedAt: null };
let connection = { running: false };
const server = http.createServer(async (req, res) => {
  const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  try {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return json(403, { error: 'Local access only' });
    if (req.method === 'POST' && req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return json(403, { error: 'Invalid origin' });
    if (development && req.method === 'GET' && req.url === '/__dev/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('retry: 100\n\n');
      devClients.add(res);
      req.on('close', () => devClients.delete(res));
      return;
    }
    if (req.method === 'GET' && req.url === '/api/linkedin/connection') return json(200, { ...await connectionStatus(root), ...connection });
    if (req.method === 'POST' && req.url === '/api/linkedin/connect') {
      if (connection.running || scan.running) return json(409, { error: 'LinkedIn is busy; wait for the current operation' });
      connection = { running: true, message: 'Connecting in Chrome…' };
      let selected;
      try {
        selected = (await searches.read()).searches;
        if (!selected.some(search => search.enabled)) throw new Error('Enable a search first');
      } catch (error) { connection = { running: false, error: error.message }; throw error; }
      connectLinkedIn(root, selected, message => { connection.message = message; })
        .then(() => { connection = { running: false }; })
        .catch(error => { connection = { running: false, error: error.message }; });
      return json(202, connection);
    }
    if (req.method === 'POST' && req.url === '/api/searches') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 10000) return json(413, { error: 'Request too large' }); }
      const { search, version } = JSON.parse(body);
      return json(200, await searches.update(search, version));
    }
    if (req.method === 'POST' && req.url === '/api/profile') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 10000) return json(413, { error: 'Request too large' }); }
      const { changes } = JSON.parse(body);
      await profiles.update(changes);
      return json(200, { ok: true });
    }
    if (req.method === 'GET' && ['/api/jobs', '/api/searches'].includes(req.url)) {
      const [scoringConfig, preferencesConfig] = await Promise.all(['scoring', 'preferences'].map(async name => JSON.parse(await readFile(path.join(root, `config/${name}.json`), 'utf8'))));
      const currentJobs = queue.state.jobs.map((job, index) => ({ ...job, reference: `JQ-${String(index + 1).padStart(3, '0')}`, processingStatus: processingStatus(job), summary: currentSummary(job) })).filter(job => job.description?.trim());
      const salaries = currentJobs.map(job => monthlySalary(job.summary?.fields.salary));
      const exchange = salaries.some(salary => salary?.currency) ? await exchangeRates() : null;
      const profile = JSON.parse(await readFile(path.join(root, 'profile/matching.json'), 'utf8'));
      const config = await searches.read();
      const jobs = currentJobs.map((job, index) => ({ ...evaluateJob(job, profile, preferencesConfig, scoringConfig, withCOP(salaries[index], exchange)), discoveries: discoveriesFor(job), applicationView: applicationView(job.application) }));
      const searchState = { ...config, stats: searchAnalytics(config.searches, jobs, queue.state.searchRuns) };
      if (req.url === '/api/searches') return json(200, searchState);
      let catalogReview;
      try {
        const review = await loadUnmappedReview(root);
        const inventory = inventoryUnmapped(queue.state.jobs, review);
        catalogReview = { pending: inventory.pending, threshold: inventory.threshold, recommended: inventory.recommended };
      } catch (error) { console.error(`Pending tag review unavailable: ${error.message}`); }
      return json(200, { jobs, searches: searchState, preferences: preferencesConfig, profileReview: profileReview(jobs, profile), scan, connection, ai: { ...summarizer.state, pending: pendingJobs(queue.state.jobs).length }, ...(development ? { development: true } : {}), ...(catalogReview ? { catalogReview } : {}) });
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
    if (req.method === 'POST' && req.url === '/api/availability') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 10000) return json(413, { error: 'Request too large' }); }
      const { id, status } = JSON.parse(body);
      await queue.setAvailability(id, status); return json(200, { ok: true });
    }
    if (req.method === 'POST' && req.url === '/api/application') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 10000) return json(413, { error: 'Request too large' }); }
      const { id, change } = JSON.parse(body);
      await queue.updateApplication(id, change); return json(200, { ok: true });
    }
    if (req.method === 'POST' && req.url === '/api/scan') {
      if (scan.running || connection.running) return json(409, { error: 'LinkedIn is busy; wait for the current operation' });
      if (scan.finishedAt && Date.now() - Date.parse(scan.finishedAt) < 60000) return json(429, { error: 'Please wait a minute before searching again' });
      // Reserve before awaiting disk so concurrent clicks cannot start two batches.
      scan = { running: true, message: 'Searching LinkedIn…', finishedAt: null };
      let selected;
      try {
        selected = (await searches.read()).searches;
        if (!selected.some(search => search.enabled)) throw new Error('Enable a search first');
      } catch (error) { scan = { running: false, message: error.message, error: true, finishedAt: null }; throw error; }
      const progress = (message, query) => { scan.message = message; scan.query = query; };
      runManagedSearchBatch(root, queue, selected, progress)
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
