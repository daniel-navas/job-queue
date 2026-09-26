// Exercises the real server and browser against temporary data, never LinkedIn.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { normalizeSearch } from '../src/searches.mjs';
import { fingerprint, summaryVersion } from '../src/summarize.mjs';
import { emptyCard, requirement, matchingProfile, evaluationConfig } from '../test-support/fixtures.mjs';
import { readJobDescription } from '../src/linkedin/description.mjs';
import { readStoredJobs } from '../src/queue.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'jq-search-browser-'));
let child, browser;
try {
  for (const dir of ['config', 'profile', 'public', 'src', 'docs']) await cp(dir, path.join(root, dir), { recursive: true });
  await mkdir(path.join(root, 'data'));
  // Fixed scoring inputs keep UI expectations independent of owner calibration.
  const { preferences, scoring } = evaluationConfig();
  const scenarioProfile = matchingProfile();
  Object.assign(scenarioProfile.tags, {
    'c++': 'none', csharp: 'none', kotlin: 'none', scala: 'none',
  });
  delete scenarioProfile.tags.go;
  delete scenarioProfile.tags.rust;
  await writeFile(path.join(root, 'profile/matching.json'), JSON.stringify(scenarioProfile));
  await writeFile(path.join(root, 'config/preferences.json'), JSON.stringify(preferences));
  await writeFile(path.join(root, 'config/scoring.json'), JSON.stringify(scoring));
  await writeFile(path.join(root, 'config/unmapped-review.json'), JSON.stringify({ schemaVersion: 1, reviewThreshold: 1, decisions: [] }));
  const search = normalizeSearch({ id: 'backend', provider: 'linkedin', name: 'Backend · Colombia', query: 'backend engineer', location: 'Colombia', workplace: 'any', datePosted: 'month', enabled: true });
  await writeFile(path.join(root, 'config/searches.json'), JSON.stringify({ searches: [search] }));
  const source = { id: '100', title: 'Backend Engineer', company: 'Example', location: 'Colombia', description: 'Backend. Remote in Colombia. 3-7 years.', status: 'new', history: [], discoveries: [{ search, firstSeen: '2026-09-14', lastSeen: '2026-09-14' }] };
  const card = emptyCard({ id: source.id, roleFocus: { value: 'backend', evidence: 'Backend.' }, workplaceMode: { value: 'remote', evidence: 'Remote in Colombia.' }, requirements: [
    requirement('professional', { kind: 'experience', minMonths: 36, maxMonths: 84, evidence: '3-7 years.' }),
  ] });
  const mixedSource = { ...source, id: '103', title: 'Mixed evaluation job', discoveries: [], description: 'Node.js. Kubernetes. Unusual platform certification. Go. React. 6-8 hours overlap with PST.' };
  const mixedCard = emptyCard({ id: mixedSource.id,
    workplace: { value: 'Remote; 6-8 hours overlap with PST', evidence: '6-8 hours overlap with PST.' },
    timezoneOverlap: { value: '6-8 hours overlap with PST', evidence: '6-8 hours overlap with PST.' },
    requirements: [
      requirement('node.js', { evidence: 'Node.js.' }),
      requirement('kubernetes', { evidence: 'Kubernetes.' }),
      requirement('compiled-language', { label: 'Compiled statically typed languages', level: 'independent', evidence: 'Independent work in Go or a similar compiled statically typed language.' }),
      requirement('relational-db', { level: 'independent', evidence: 'Intermediate relational database knowledge.' }),
      requirement('unmapped', { kind: 'unknown', label: 'Unusual platform certification', evidence: 'Unusual platform certification.' }),
    ],
    preferred: [
      requirement('kubernetes', { evidence: 'Kubernetes.' }),
      requirement('angular', { evidence: 'Angular.' }),
    ],
    stack: [requirement('react', { evidence: 'React.' })],
  });
  const jobs = [
    { ...source, summary: { fields: card, version: summaryVersion, inputHash: fingerprint(source) } },
    { ...source, id: '101', title: 'Pending job' },
    { ...source, id: '102', title: 'Legacy job', discoveries: undefined, searchUrl: 'https://www.linkedin.com/jobs/search/?keywords=old&location=Colombia' },
    { ...mixedSource, summary: { fields: mixedCard, version: summaryVersion, inputHash: fingerprint(mixedSource) } },
  ];
  await writeFile(path.join(root, 'data/queue.json'), JSON.stringify({ jobs }));
  const styleFile = path.join(root, 'public/style.css');
  let styleRevision = 0;
  const changePublicFile = async () => writeFile(styleFile, `${await readFile(styleFile, 'utf8')}\n/* live reload probe ${++styleRevision} */\n`);
  const queueBefore = await readFile(path.join(root, 'data/queue.json'), 'utf8');
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening'); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  child = spawn(process.execPath, ['src/server.mjs'], { env: { ...process.env, JOBQUEUE_ROOT: root, PORT: String(port), JOBQUEUE_DEV: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('Test server exited'); })]);
  const base = `http://127.0.0.1:${port}`;
  const get = async () => (await fetch(`${base}/api/searches`)).json();
  const post = async body => fetch(`${base}/api/searches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const connection = await (await fetch(`${base}/api/linkedin/connection`)).json();
  assert.equal(connection.running, false); assert.equal(connection.connected, false);
  assert.equal((await fetch(`${base}/api/linkedin/connect`, { method: 'POST', headers: { Origin: 'https://untrusted.example' } })).status, 403);
  const initial = await get();
  assert.equal(initial.stats[0].captured, 2); assert.equal(initial.stats[0].processed, 1); assert.equal(initial.stats[0].meanRating, 2);
  const jobsResponse = await (await fetch(`${base}/api/jobs`)).json();
  assert.equal(jobsResponse.development, true);
  assert.deepEqual(jobsResponse.catalogReview, { pending: 1, threshold: 1, recommended: true });
  assert.equal(jobsResponse.profileReview.pendingCount, 3);
  assert.equal(jobsResponse.profileReview.items[0].label, 'Angular');
  const invalidProfile = await fetch(`${base}/api/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: [{ key: 'angular', value: 'basic' }, { key: 'financial', value: 'advanced' }] }) });
  assert.equal(invalidProfile.status, 400);
  assert.equal(JSON.parse(await readFile(path.join(root, 'profile/matching.json'))).tags.angular, undefined);
  const savedProfile = await fetch(`${base}/api/profile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: [{ key: 'angular', value: 'basic' }] }) });
  assert.equal(savedProfile.status, 200);
  assert.equal((await (await fetch(`${base}/api/jobs`)).json()).profileReview.pendingCount, 2);
  await writeFile(path.join(root, 'profile/matching.json'), JSON.stringify(scenarioProfile));
  await writeFile(path.join(root, 'config/unmapped-review.json'), '{"schemaVersion":1,"reviewThreshold":0,"decisions":[]}');
  const malformedReviewResponse = await (await fetch(`${base}/api/jobs`)).json();
  assert.ok(malformedReviewResponse.jobs.length > 0);
  assert.equal('catalogReview' in malformedReviewResponse, false);
  await writeFile(path.join(root, 'config/unmapped-review.json'), JSON.stringify({ schemaVersion: 1, reviewThreshold: 1, decisions: [] }));
  const invalid = await post({ version: initial.version, search: { ...search, provider: 'other' } }); assert.equal(invalid.status, 400);
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  // A local fixture reproduces the current LinkedIn HTML-only detail layout.
  const detail = await browser.newPage();
  await detail.route('https://www.linkedin.com/jobs/view/123/', route => route.fulfill({ contentType: 'text/html', body: '<section><div><h2>About the job</h2></div><div><span data-testid="expandable-text-box"><p>Build and maintain backend services using Python. This is the complete source description for a concrete engineering role.</p><p>Work with a distributed team.</p><button>… more</button></span></div></section><section><h2>Similar jobs</h2><span data-testid="expandable-text-box">Never capture this recommendation.</span></section>' }));
  await detail.goto('https://www.linkedin.com/jobs/view/123/');
  const description = await readJobDescription(detail, '123');
  assert.match(description, /Work with a distributed team/);
  assert.doesNotMatch(description, /Never capture|more/);
  assert.equal(await readJobDescription(detail, '999'), null);
  await detail.close();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base); await page.locator('.job').first().waitFor();
  await page.evaluate(() => { window.__liveReloadProbe = true; });
  const automaticReload = page.waitForEvent('load', { timeout: 3000 });
  await changePublicFile();
  await automaticReload;
  assert.equal(await page.evaluate(() => window.__liveReloadProbe), undefined);
  await page.locator('.job').first().waitFor();
  await page.getByRole('button', { name: 'Jobs', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Profile, 3 missing skills', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Profile, 3 missing skills', exact: true }).click();
  assert.equal(await page.getByRole('heading', { name: 'Complete your profile', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /^Missing 3/ }).count(), 1);
  assert.equal(await page.getByRole('button', { name: /^Saved / }).count(), 1);
  assert.equal(await page.getByText('3 facts need info', { exact: true }).count(), 0);
  assert.equal(await page.locator('[data-profile-item]', { hasText: 'Angular' }).count(), 1);
  assert.equal(await page.locator('[data-profile-item]', { hasText: 'Compiled languages' }).count(), 1);
  assert.equal(await page.getByText('Choose an answer for every missing fact.', { exact: true }).count(), 0);
  assert.equal(await page.getByText('can perform bounded tasks with support.', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Basic', exact: true }).click();
  await page.evaluate(() => { window.__liveReloadProbe = true; });
  let reloadedWithDraft = false;
  page.once('load', () => { reloadedWithDraft = true; });
  await changePublicFile();
  await page.waitForTimeout(400);
  assert.equal(reloadedWithDraft, false);
  await page.getByRole('button', { name: 'Save and continue', exact: true }).click();
  await page.waitForFunction(() => window.__liveReloadProbe === undefined);
  await page.getByRole('button', { name: 'Profile, 2 missing skills', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Profile, 2 missing skills', exact: true }).click();
  await page.getByRole('button', { name: 'None', exact: true }).nth(0).click();
  await page.getByRole('button', { name: 'None', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Save and continue', exact: true }).click();
  await page.getByText('Nothing missing', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Profile', exact: true }).waitFor();
  await page.getByText('Some active jobs still need tag review.', { exact: true }).waitFor();
  const storedProfile = JSON.parse(await readFile(path.join(root, 'profile/matching.json')));
  assert.equal(storedProfile.tags.angular, 'basic');
  assert.equal(storedProfile.tags.go, 'none');
  assert.equal(storedProfile.tags.rust, 'none');
  await page.getByRole('button', { name: /^Saved / }).click();
  assert.equal(await page.getByRole('heading', { name: 'Your profile', exact: true }).count(), 0);
  await page.locator('#search').fill('Angular');
  const savedAngular = page.locator('[data-profile-item]', { hasText: 'Angular' });
  assert.equal(await savedAngular.getByText('Basic', { exact: true }).count(), 1);
  await savedAngular.click();
  assert.equal(await page.getByText('1 fact', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Independent', exact: true }).click();
  await page.getByRole('button', { name: 'Save change', exact: true }).click();
  await page.waitForFunction(async () => (await (await fetch('/api/jobs')).json()).profileReview.allFacts.some(fact => fact.key === 'angular' && fact.value === 'independent'));
  await page.locator('[data-profile-item]', { hasText: 'Angular' }).getByText('Independent', { exact: true }).waitFor();
  assert.equal(JSON.parse(await readFile(path.join(root, 'profile/matching.json'))).tags.angular, 'independent');
  await mkdir('.local', { recursive: true });
  await page.screenshot({ path: '.local/profile-desktop.png' });
  await page.setViewportSize({ width: 1024, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1024);
  await page.screenshot({ path: '.local/profile-compact-desktop.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Jobs', exact: true }).click();
  await page.getByText('1 tag pending review', { exact: true }).waitFor();
  assert.equal(await page.locator('#run-status a, #run-status button').count(), 0);
  await page.getByRole('button', { name: /Backend Engineer/ }).click();
  await page.getByText(/Software engineering · 3–7 years/).waitFor();
  assert.ok(await page.getByText('Complete', { exact: true }).count());
  assert.ok(await page.getByText('Pending analysis', { exact: true }).count());
  assert.ok(await page.getByText('Needs info · 7/8', { exact: true }).count());
  await page.getByRole('button', { name: /Mixed evaluation job/ }).click();
  assert.deepEqual(await page.locator('.fact-group>h3').allTextContents(), ['Role fit', 'Opportunity', 'Work conditions']);
  assert.equal(await page.locator('.fact-group').last().getByText('Time overlap', { exact: true }).count(), 1);
  assert.equal(await page.locator('.fact-group').last().getByText('6-8 hours overlap with PST', { exact: true }).count(), 1);
  assert.equal((await page.locator('.fact-group').last().innerText()).match(/6-8 hours overlap with PST/g)?.length, 1);
  assert.equal(await page.locator('#detail .evaluation-summary').count(), 0);
  await page.getByText(/Compiled languages · Independent/).waitFor();
  const compiledTooltip = await page.locator('.assessment-no-match-required').filter({ hasText: 'Compiled languages' }).getAttribute('title');
  assert.equal(compiledTooltip, 'Java · Basic\nNone: Go, Rust, C++, C#, Kotlin, Scala');
  assert.doesNotMatch(compiledTooltip, /Requires|Assessment:|Offer:/);
  await page.getByText(/Relational databases · Independent/).waitFor();
  assert.doesNotMatch(await page.locator('.assessment-no-match-required').filter({ hasText: 'Relational databases' }).getAttribute('title'), /Requires|Assessment:|Offer:/);
  for (const [className, text] of [
    ['assessment-match', 'Node.js'],
    ['assessment-no-match-required', 'Kubernetes'],
    ['assessment-no-match-optional', 'Kubernetes'],
    ['assessment-match', 'Angular'],
    ['assessment-unmapped', 'Unusual platform certification'],
  ]) assert.equal(await page.locator(`.${className}`).filter({ hasText: text }).count(), 1);
  await page.screenshot({ path: '.local/evaluation-desktop.png' });
  await page.getByRole('button', { name: /Backend Engineer/ }).click();
  assert.equal(await page.locator('#detail .evaluation-summary').count(), 0);
  assert.deepEqual(await page.locator('.coverage').allInnerTexts(), ['1/1']);
  const detailHeader = page.locator('#detail .detail-head');
  assert.equal(await detailHeader.locator('.detail-meta [data-copy-id]').count(), 1);
  assert.equal(await detailHeader.locator('.detail-actions > button').count(), 3);
  await page.setViewportSize({ width: 1024, height: 900 });
  const headerBounds = await detailHeader.boundingBox();
  const actionsBounds = await detailHeader.locator('.detail-actions').boundingBox();
  assert.ok(actionsBounds.y > (await detailHeader.locator('.detail-meta').boundingBox()).y);
  assert.ok(actionsBounds.x + actionsBounds.width <= headerBounds.x + headerBounds.width + 1);
  await page.screenshot({ path: '.local/detail-header-compact.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await detailHeader.getByRole('button', { name: 'Applied', exact: true }).count(), 1);
  await page.locator('.detail-more summary[aria-label="More actions"]').click();
  await page.getByRole('button', { name: 'Closed', exact: true }).click();
  await page.getByRole('button', { name: 'All jobs', exact: false }).click();
  await page.locator('.job-closed .availability-state').waitFor();
  await page.locator('.job-closed .job-open').click();
  await page.locator('.detail-more summary[aria-label="More actions"]').click();
  assert.equal(await page.getByRole('button', { name: 'Closed', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Closed', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: false }).click();
  assert.equal(await page.locator('.job').count(), 4);
  await page.getByRole('button', { name: /Backend Engineer/ }).click();
  await page.getByRole('button', { name: 'Interested', exact: true }).click();
  await page.getByRole('button', { name: 'Interesting', exact: false }).click();
  await page.getByRole('button', { name: /Backend Engineer/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Interested', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.locator('#reason').fill('Not a fit');
  await page.getByRole('button', { name: 'Dismiss job', exact: true }).click();
  await page.getByRole('button', { name: 'Dismissed', exact: false }).click();
  await page.getByRole('button', { name: /Backend Engineer/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Dismissed', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Dismissed', exact: true }).click();
  await page.getByRole('button', { name: 'Interesting', exact: false }).click();
  await page.getByRole('button', { name: /Backend Engineer/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Interested', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Interested', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: false }).click();
  await page.locator('.search-origin summary').click(); await page.getByText('First found 2026-09-14 · Last seen 2026-09-14').waitFor();
  await page.getByRole('button', { name: 'Searches', exact: true }).click();
  await page.locator('.search-row').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Connect LinkedIn' }).count(), 1);
  const criteriaText = await page.locator('.search-copy').first().innerText();
  assert.equal(await page.locator('.search-copy strong').first().innerText(), 'backend engineer');
  assert.doesNotMatch(criteriaText, /Query:|Backend · Colombia/);
  assert.doesNotMatch(await page.locator('#searches-list-view').innerText(), /Checked searches|detail visits/);
  assert.equal(await page.locator('#searches-list-view .searches-note').count(), 0);
  assert.match(criteriaText, /Location: Colombia/);
  assert.match(criteriaText, /Date posted: Past month/);
  assert.doesNotMatch(criteriaText, /Work mode:|Any work mode|No other filters/);
  assert.equal(await page.locator('.search-metrics small').first().innerText(), '1 processed · avg 2');
  await page.locator('[data-offers="backend"]').click();
  assert.equal(await page.locator('.job').count(), 2);
  await page.getByRole('button', { name: 'Clear search filter' }).click();
  assert.equal(await page.locator('.job').count(), 4);
  await page.getByRole('button', { name: 'Searches', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: 'Enable backend engineer' });
  await checkbox.uncheck();
  await page.waitForFunction(() => document.querySelector('#scan').disabled);
  assert.equal((await get()).searches[0].enabled, false);
  assert.equal((await fetch(`${base}/api/scan`, { method: 'POST' })).status, 400);
  await page.getByRole('button', { name: 'Edit backend engineer', exact: true }).click();
  assert.equal(await page.locator('#search-name').count(), 0);
  await page.locator('#search-query').fill('Python backend');
  await page.getByRole('button', { name: 'Save search', exact: true }).click();
  await page.getByText('0 processed · avg —', { exact: true }).waitFor();
  assert.equal((await get()).stats[0].historicalCaptured, 2);
  await page.getByRole('button', { name: 'Add search', exact: true }).click();
  await page.locator('#search-query').fill('Backend with visa sponsorship'); await page.locator('#search-location').fill('Spain');
  await page.locator('#search-workplace').selectOption('remote');
  await page.locator('#search-date').selectOption('any');
  await page.getByRole('button', { name: 'Save search', exact: true }).click();
  await page.locator('.search-row').nth(1).waitFor();
  const remoteCriteria = await page.locator('.search-copy').nth(1).innerText();
  assert.match(remoteCriteria, /Work mode: Remote/);
  assert.doesNotMatch(remoteCriteria, /Date posted:|Any date/);
  assert.equal((await get()).searches.length, 2);
  // Stale editor must not overwrite a change made through the same API.
  await page.getByRole('button', { name: 'Edit Python backend', exact: true }).click();
  const current = await get();
  assert.equal((await post({ version: current.version, search: { ...current.searches[0], query: 'External query' } })).status, 200);
  await page.locator('#search-query').fill('Stale query'); await page.getByRole('button', { name: 'Save search', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Searches changed' }).waitFor();
  assert.equal((await get()).searches[0].query, 'External query');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByText('External query', { exact: true }).waitFor();
  await mkdir('.local', { recursive: true });
  await page.screenshot({ path: '.local/searches-desktop.png' });
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#searches-dialog').isVisible(), false);
  assert.deepEqual(errors, []);
  assert.equal(await readFile(path.join(root, 'data/queue.json'), 'utf8'), queueBefore);
  const storedJobs = await readStoredJobs(root);
  assert.equal(storedJobs[0].availability.status, 'open');
  assert.deepEqual(storedJobs[0].availabilityHistory.map(entry => entry.status), ['closed', 'open']);
  const jobsWithoutAvailability = structuredClone(storedJobs);
  delete jobsWithoutAvailability[0].availability;
  delete jobsWithoutAvailability[0].availabilityHistory;
  const originalJobs = JSON.parse(queueBefore).jobs;
  assert.deepEqual(jobsWithoutAvailability[0].history.map(entry => entry.status), ['interesting', 'dismissed', 'interesting', 'new']);
  jobsWithoutAvailability[0].history = originalJobs[0].history;
  delete jobsWithoutAvailability[0].reason;
  assert.deepEqual(jobsWithoutAvailability, originalJobs);
  // Simulate scan state only at the API boundary; never launch LinkedIn.
  const headerHeight = (await page.locator('header').boundingBox()).height;
  let scan = { running: true, message: 'Searching 2/5', query: 'Python backend' };
  await page.route('**/api/jobs', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), scan } });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Searching 2/5', exact: true }).waitFor();
  assert.equal(await page.locator('#scan').isDisabled(), true);
  assert.equal(await page.locator('#scan').getAttribute('title'), 'Python backend');
  assert.equal(await page.locator('#run-status').innerText(), '');
  assert.equal((await page.locator('header').boundingBox()).height, headerHeight);
  scan = { running: false, added: 3, finishedAt: '2026-09-16', message: '3 complete opportunities added · 5 searches' };
  await page.reload();
  await page.getByRole('status').filter({ hasText: '3 jobs added' }).waitFor();
  assert.equal(await page.locator('header #run-status').count(), 1);
  assert.equal((await page.locator('header').boundingBox()).height, headerHeight);
  // Tracker UI and API use only this temporary queue; no real application is changed.
  const workspaceNav = page.locator('#views');
  const brand = page.locator('header > strong');
  const jobNavBounds = await workspaceNav.boundingBox();
  const brandBounds = await brand.boundingBox();
  assert.ok(jobNavBounds.x - (brandBounds.x + brandBounds.width) < 32, 'the workspace switcher stays next to JobQueue');
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await page.getByText('No applications yet', { exact: true }).waitFor();
  const applicationNavBounds = await workspaceNav.boundingBox();
  assert.ok(Math.abs(applicationNavBounds.x - jobNavBounds.x) < 1, 'the workspace switcher stays in the same place in Applications');
  await page.getByRole('button', { name: 'Jobs', exact: true }).click();
  await page.getByRole('button', { name: /Backend Engineer/ }).click();
  await page.getByRole('button', { name: 'Applied', exact: true }).click();
  await page.locator('#application-date').fill('2026-09-21');
  await page.getByRole('button', { name: 'Save application', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#tabs [data-tab="new"]')?.textContent === 'New 3');
  assert.equal(await page.getByRole('button', { name: 'New', exact: false }).innerText(), 'New 3');
  assert.equal(await page.getByRole('button', { name: /Backend Engineer/ }).count(), 0);
  await page.getByRole('button', { name: 'All jobs', exact: false }).click();
  await page.getByRole('button', { name: /Backend Engineer/ }).click();
  await page.locator('#detail .detail-title .application-stage').getByText('Applied', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Applications', exact: true }).click();
  await page.locator('#detail').getByText('Waiting for response', { exact: true }).waitFor();
  await page.locator('#detail .detail-more summary[aria-label="More actions"]').click();
  await page.getByRole('button', { name: 'Not applied', exact: true }).waitFor();
  await page.locator('#detail .detail-more summary[aria-label="More actions"]').click();
  await page.getByRole('button', { name: 'Update progress', exact: true }).click();
  await page.locator('#application-action').selectOption('add-interview');
  await page.locator('#interview-name').fill('Technical');
  await page.getByRole('button', { name: 'Save update', exact: true }).click();
  await page.locator('#detail').getByText('Schedule Technical', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit Technical · Needs scheduling' }).click();
  await page.locator('#interview-state').selectOption('scheduled');
  await page.locator('#interview-time').fill('2027-09-25T15:00');
  await page.getByRole('button', { name: 'Save update', exact: true }).click();
  await page.locator('#detail').getByText('Technical', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Edit Technical · Scheduled' }).click();
  await page.locator('#interview-state').selectOption('completed');
  await page.locator('#application-date').fill('2027-09-25');
  await page.getByRole('button', { name: 'Save update', exact: true }).click();
  await page.locator('#detail').getByText('Waiting for response', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Update progress', exact: true }).click();
  await page.locator('#application-action').selectOption('outcome');
  await page.locator('#application-outcome').selectOption('offer-received');
  await page.getByRole('button', { name: 'Save update', exact: true }).click();
  await page.getByRole('button', { name: 'Update progress', exact: true }).click();
  await page.locator('#application-action').selectOption('outcome');
  await page.locator('#application-outcome').selectOption('accepted');
  await page.getByRole('button', { name: 'Save update', exact: true }).click();
  await page.getByRole('button', { name: 'Closed', exact: false }).click();
  await page.locator('#detail').getByText('Accepted', { exact: true }).first().waitFor();
  await page.getByRole('button', { name: 'Reopen process', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#tabs [data-tab="active"]')?.textContent.includes('1'));
  await page.locator('#detail .application-progress strong').getByText('Offer received', { exact: true }).waitFor();
  await page.screenshot({ path: '.local/applications-desktop.png' });
  await page.setViewportSize({ width: 1024, height: 768 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1024);
  await page.screenshot({ path: '.local/applications-compact-desktop.png' });
  const tracked = (await (await fetch(`${base}/api/jobs`)).json()).jobs.find(job => job.id === '100');
  assert.equal(tracked.status, 'interesting');
  assert.deepEqual(tracked.application.previousReview, { status: 'new', reason: '' });
  assert.equal(tracked.application.events[0].name, 'Technical');
  const invalidTracker = await fetch(`${base}/api/application`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '100', change: { type: 'outcome', outcome: 'bogus', date: '2026-09-21' } }) });
  assert.equal(invalidTracker.status, 400);
  assert.equal((await readStoredJobs(root)).find(job => job.id === '100').application.events.length, 4);
  const dstPage = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/New_York' });
  await dstPage.goto(base);
  await dstPage.getByRole('button', { name: /Pending job/ }).click();
  await dstPage.getByRole('button', { name: 'Applied', exact: true }).click();
  await dstPage.getByRole('button', { name: 'Save application', exact: true }).click();
  await dstPage.getByRole('button', { name: 'Applications', exact: true }).click();
  await dstPage.getByRole('button', { name: /Pending job/ }).click();
  await dstPage.getByRole('button', { name: 'Update progress', exact: true }).click();
  await dstPage.locator('#interview-name').fill('DST check');
  await dstPage.locator('#interview-state').selectOption('scheduled');
  await dstPage.locator('#interview-time').fill('2027-07-15T15:00');
  await dstPage.getByRole('button', { name: 'Save update', exact: true }).click();
  await dstPage.locator('#detail').getByText('DST check', { exact: true }).first().waitFor();
  const dstJob = (await (await fetch(`${base}/api/jobs`)).json()).jobs.find(job => job.id === '101');
  assert.equal(dstJob.application.events[0].scheduledAt, '2027-07-15T15:00:00-04:00');
  await dstPage.getByRole('button', { name: 'Edit DST check · Scheduled' }).click();
  await dstPage.locator('#interview-time').fill('2027-01-15T15:00');
  await dstPage.getByRole('button', { name: 'Save update', exact: true }).click();
  await dstPage.waitForFunction(() => document.querySelector('#detail .application-progress')?.textContent.includes('Jan 15, 2027'));
  const rescheduled = (await (await fetch(`${base}/api/jobs`)).json()).jobs.find(job => job.id === '101');
  assert.equal(rescheduled.application.events[0].scheduledAt, '2027-01-15T15:00:00-05:00');
  await dstPage.close();
  const legacyPage = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await legacyPage.route('**/api/jobs', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jobs: [] }) }));
  await legacyPage.goto(base);
  await legacyPage.getByRole('button', { name: 'Profile', exact: true }).click();
  await legacyPage.getByText('Profile unavailable. Restart JobQueue.', { exact: true }).waitFor();
  assert.equal(await legacyPage.getByText('Nothing missing', { exact: true }).count(), 0);
  await legacyPage.close();
  assert.deepEqual(errors, []);
  console.log('Search and application UI/API checks passed: evaluation, availability, tracker lifecycle, search editing, provenance, and no runtime errors.');
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  await rm(root, { recursive: true, force: true });
}
