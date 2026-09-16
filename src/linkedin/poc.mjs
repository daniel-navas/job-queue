import { mkdir, writeFile, readFile, rename } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { normalizeCaptures } from '../queue.mjs';
import { normalizeSearch } from '../searches.mjs';
import { randomUUID } from 'node:crypto';
import { readJobDescription } from './description.mjs';

import {
  extractJobIds,
  isLikelyJobResponse,
  normalizeJobUrl,
  verifyCaptureHealth,
} from "./extract.mjs";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, "../..");
const localDirectory = path.join(projectRoot, ".local");
const profileDirectory = path.join(localDirectory, "linkedin-profile");
const captureDirectory = path.join(localDirectory, "linkedin-captures", new Date().toISOString().replace(/[:.]/g, '-'));
const dataDirectory = path.join(projectRoot, "data");
const chromeExecutable =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const options = parseArguments(process.argv.slice(2));
const search = options.searchJson ? normalizeSearch(JSON.parse(options.searchJson)) : null;
if (search) options.url = search.url;
validateLinkedInJobsUrl(options.url);
const runId = options.runId || randomUUID();
if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error('Invalid run ID');
const output = search ? path.join(dataDirectory, 'search-runs', `${runId}.json`) : path.join(dataDirectory, 'linkedin-poc.json');

await Promise.all([
  mkdir(profileDirectory, { recursive: true }),
  mkdir(captureDirectory, { recursive: true }),
  mkdir(dataDirectory, { recursive: true }),
  mkdir(path.dirname(output), { recursive: true }),
]);

console.log("Launching a persistent Chrome session for the LinkedIn POC.");
console.log(`Search URL: ${options.url}`);
console.log("If LinkedIn asks you to sign in, complete it in the browser window.");

const context = await chromium.launchPersistentContext(profileDirectory, {
  executablePath: chromeExecutable,
  headless: false,
  viewport: { width: 1440, height: 1000 },
});

let stoppedByLinkedIn = false;
let captureSequence = 0;
const capturedResponses = [];
const discoveredJobIds = new Set();
const payloads = [];
const pendingResponses = new Set();
let visibleJobs = [];
let stored = [];
let phase = 'idle', effectiveUrl = null, completed = false;
const searchJobIds = new Set();
const requestPhases = new WeakMap();
context.on('request', request => requestPhases.set(request, phase));
const drain = async () => { while (pendingResponses.size) await Promise.all([...pendingResponses]); };

const captureResponse = async (response) => {
  const responsePhase = requestPhases.get(response.request());
  const url = response.url();
  const status = response.status();
  const contentType = response.headers()["content-type"] ?? "";

  if (status === 429) {
    stoppedByLinkedIn = true;
    console.warn("LinkedIn returned HTTP 429. No further navigation will run.");
  }

  if (!isLikelyJobResponse({ url, contentType })) return;
  if (!['search', 'detail'].includes(responsePhase)) return;

  try {
    const body = await response.text();
    const payload = JSON.parse(body);
    const jobIds = extractJobIds(body);
    if (responsePhase === 'search') {
      for (const item of payload.included ?? []) {
        if (item.$type?.endsWith('.JobPostingCard') && /JOBS_SEARCH/.test(item.entityUrn ?? '')) {
          const id = item.entityUrn.match(/jobPostingCard:\(?(\d+)/)?.[1];
          if (id) searchJobIds.add(id);
        }
      }
    }
    if (jobIds.length === 0 && !body.toLowerCase().includes("jobposting")) {
      return;
    }

    for (const id of jobIds) discoveredJobIds.add(id);
    payloads.push(payload);

    captureSequence += 1;
    const captureName = `${String(captureSequence).padStart(3, "0")}.json`;
    await writeFile(path.join(captureDirectory, captureName), body, "utf8");

    capturedResponses.push({
      capturedAt: new Date().toISOString(),
      url,
      status,
      contentType,
      byteLength: Buffer.byteLength(body),
      jobIds,
      localCapture: path.relative(projectRoot, path.join(captureDirectory, captureName)),
    });

    console.log(
      `Captured candidate response ${captureName}: ${jobIds.length} job IDs`,
    );
  } catch (error) {
    console.warn(`Could not capture response from ${url}: ${error.message}`);
  }
};
context.on('response', response => {
  const pending = captureResponse(response);
  pendingResponses.add(pending);
  pending.finally(() => pendingResponses.delete(pending));
});

const pages = context.pages();
const page = pages[0] ?? (await context.newPage());

try {
  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
    timeout: options.navigationTimeoutMs,
  });

  await waitForLoginIfNeeded(page, options);
  await assertNoSecurityChallenge(page);

  console.log(`Authenticated browser page: ${page.url()}`);
  if (stoppedByLinkedIn) throw new Error('LinkedIn returned HTTP 429; stopped.');
  phase = 'search';
  await page.goto(options.url, {
    waitUntil: "domcontentloaded",
    timeout: options.navigationTimeoutMs,
  });

  await page.waitForTimeout(options.captureWindowMs);
  await assertNoSecurityChallenge(page);
  console.log(`Search page: ${page.url()}`);
  if (isLoginPage(page.url())) throw new Error('LinkedIn sign-in is required; stopped.');
  effectiveUrl = page.url();
  console.log(`Page title: ${await page.title()}`);

  if (stoppedByLinkedIn) {
    throw new Error("The run stopped after LinkedIn returned HTTP 429.");
  }

  visibleJobs = await collectVisibleJobs(page);
  for (const job of visibleJobs) { discoveredJobIds.add(job.id); searchJobIds.add(job.id); }
  await drain();
  phase = 'detail';
  const explicitEmpty = await page.getByText(/^(No matching jobs found|No results found|No jobs found|No se encontraron (empleos|resultados))/i).first().isVisible().catch(() => false);
  verifyCaptureHealth({ observed: searchJobIds.size, explicitEmpty, attempted: 0, completed: 0 });
  try { stored = JSON.parse(await readFile(path.join(dataDirectory, 'queue.json'), 'utf8')).jobs; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const complete = new Set([...stored.filter(job => job.description?.trim()), ...normalizeCaptures(payloads)].map(job => job.id));
  const targets = [...searchJobIds].filter(id => !complete.has(id)).slice(0, options.detailLimit);
  for (const [index, id] of targets.entries()) {
    if (stoppedByLinkedIn) throw new Error('LinkedIn returned HTTP 429; stopped.');
    await assertNoSecurityChallenge(page);
    console.log(`Detail ${index + 1}/${targets.length}: ${id}`);
    await page.goto(`https://www.linkedin.com/jobs/view/${id}/`, { waitUntil: 'domcontentloaded', timeout: options.navigationTimeoutMs });
    await page.waitForTimeout(3000);
    await assertNoSecurityChallenge(page);
    if (isLoginPage(page.url())) throw new Error('LinkedIn sign-in is required; stopped.');
    await drain();
    if (stoppedByLinkedIn) throw new Error('LinkedIn returned HTTP 429; stopped.');
    if (!normalizeCaptures(payloads, stored).some(job => job.id === id)) {
      const description = await readJobDescription(page, id);
      if (description) {
        const payload = { included: [{ $type: 'com.linkedin.voyager.dash.jobs.JobPosting', entityUrn: `urn:li:fsd_jobPosting:${id}`, description: { text: description } }] };
        const localCapture = path.join(captureDirectory, `detail-${id}.json`);
        await writeFile(localCapture, JSON.stringify(payload));
        payloads.push(payload);
        capturedResponses.push({ capturedAt: new Date().toISOString(), url: page.url(), status: 200, contentType: 'application/json', method: 'description-dom', jobIds: [id], localCapture: path.relative(projectRoot, localCapture) });
      }
    }
    const captured = normalizeCaptures(payloads, stored).some(job => job.id === id);
    console.log(`Detail ${index + 1}/${targets.length}: ${captured ? 'complete' : 'unavailable; not added'}`);
  }

  verifyCaptureHealth({ observed: searchJobIds.size, explicitEmpty, attempted: targets.length,
    completed: normalizeCaptures(payloads, stored).filter(job => targets.includes(job.id)).length });
  const screenshotPath = path.join(localDirectory, "linkedin-poc.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });

  console.log("");
  console.log('Collection completed. Saving capture manifest.');
  console.log(`Candidate network responses: ${capturedResponses.length}`);
  console.log(`Unique job IDs: ${discoveredJobIds.size}`);
  console.log(`Visible job links: ${visibleJobs.length}`);
  console.log(`Diagnostic screenshot: ${path.relative(projectRoot, screenshotPath)}`);
  completed = true;
} finally {
  // Save all successful captures, including partial progress before a challenge.
  try {
    if (options.keepOpenMs > 0 && !stoppedByLinkedIn) await page.waitForTimeout(options.keepOpenMs);
    await drain();
    await writeFile(`${output}.tmp`, JSON.stringify({ runId, search, status: completed ? 'complete' : 'interrupted', effectiveUrl, searchJobIds: [...searchJobIds], capturedAt: new Date().toISOString(), source: 'linkedin', searchUrl: options.url, network: { candidateResponses: capturedResponses, jobIds: [...discoveredJobIds] }, visibleJobs, completeCount: normalizeCaptures(payloads, stored).length }, null, 2) + '\n');
    await rename(`${output}.tmp`, output);
  } finally { await context.close(); }
}

function parseArguments(argumentsList) {
  const parsed = {
    url: "https://www.linkedin.com/jobs/search/",
    loginWaitMs: 5 * 60 * 1000,
    captureWindowMs: 15_000,
    navigationTimeoutMs: 60_000,
    keepOpenMs: 0,
    detailLimit: 5,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (argument === "--url" && value) parsed.url = value;
    if (argument === '--search-json' && value) parsed.searchJson = value;
    if (argument === '--run-id' && value) parsed.runId = value;
    if (argument === "--login-wait-ms" && value) parsed.loginWaitMs = Number(value);
    if (argument === "--capture-window-ms" && value) {
      parsed.captureWindowMs = Number(value);
    }
    if (argument === "--keep-open-ms" && value) parsed.keepOpenMs = Number(value);
    if (argument === '--detail-limit' && value) parsed.detailLimit = Number(value);

    if (argument.startsWith("--") && value && !value.startsWith("--")) {
      index += 1;
    }
  }

  for (const [name, value] of Object.entries(parsed)) {
    if (name.endsWith("Ms") && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`${name} must be a non-negative number.`);
    }
  }

  if (!Number.isInteger(parsed.detailLimit) || parsed.detailLimit < 1 || parsed.detailLimit > 10) throw new Error('detail-limit must be 1–10.');
  return parsed;
}

function validateLinkedInJobsUrl(value) {
  const url = new URL(value);
  const isLinkedInHost =
    url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com");
  if (url.protocol !== "https:" || !isLinkedInHost || !url.pathname.startsWith("/jobs")) {
    throw new Error("--url must be an HTTPS LinkedIn Jobs URL.");
  }
}

async function waitForLoginIfNeeded(page, options) {
  if (!isLoginPage(page.url())) return;

  console.log("Waiting for LinkedIn sign-in to complete in the browser...");
  await page.waitForURL(
    (url) => !isLoginPage(url.href),
    { timeout: options.loginWaitMs },
  );
}

function isLoginPage(url) {
  return url.includes("/login") || url.includes("/checkpoint/lg/login");
}

async function assertNoSecurityChallenge(page) {
  const url = page.url().toLowerCase();
  const title = (await page.title()).toLowerCase();
  const challengeMarkers = ["/checkpoint/", "/challenge/", "captcha"];

  if (
    challengeMarkers.some((marker) => url.includes(marker)) ||
    title.includes("security verification") ||
    title.includes("captcha")
  ) {
    throw new Error(
      `LinkedIn presented a security challenge at ${page.url()}. The POC stopped.`,
    );
  }
}

async function collectVisibleJobs(page) {
  const candidates = await page.locator('.jobs-search-results-list a[href*="/jobs/view/"], .scaffold-layout__list a[href*="/jobs/view/"], [data-view-name="job-card"] a[href*="/jobs/view/"]').evaluateAll((anchors) =>
    anchors.map((anchor) => ({
      href: anchor.href,
      text: anchor.textContent?.replace(/\s+/g, " ").trim() ?? "",
    })),
  );

  const jobsByUrl = new Map();
  for (const candidate of candidates) {
    const url = normalizeJobUrl(candidate.href);
    if (!url) continue;
    const id = url.match(/\/jobs\/view\/(\d+)\//)?.[1];
    if (!id || jobsByUrl.has(url)) continue;
    jobsByUrl.set(url, { id, url, title: candidate.text || null });
  }

  return [...jobsByUrl.values()];
}
