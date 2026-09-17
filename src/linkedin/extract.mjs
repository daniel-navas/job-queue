const JOB_ID_PATTERNS = [
  /urn:li:(?:fsd_)?jobPosting:(\d+)/gi,
  /\/jobs\/view\/(\d+)/gi,
  /[?&]currentJobId=(\d+)/gi,
  /\"jobPostingId\"\s*:\s*\"?(\d+)\"?/gi,
];

export function verifyCaptureHealth({ observed, explicitEmpty = false, attempted, completed }) {
  if (!observed && !explicitEmpty) throw new Error('Could not recognize LinkedIn search results; collector validation is required.');
  if (attempted > 0 && completed === 0) throw new Error('No attempted job descriptions were captured; the search stopped for collector validation.');
}

export function extractJobIds(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const ids = new Set();

  for (const pattern of JOB_ID_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      ids.add(match[1]);
    }
  }

  return [...ids];
}

export function normalizeJobUrl(value) {
  const url = new URL(value, "https://www.linkedin.com");
  const isLinkedInHost =
    url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com");
  if (!isLinkedInHost) return null;
  const match = url.pathname.match(/^\/jobs\/view\/(\d+)/);
  if (!match) return null;
  return `https://www.linkedin.com/jobs/view/${match[1]}/`;
}

export function isLikelyJobResponse({ url, contentType }) {
  if (!url.startsWith("https://www.linkedin.com/")) return false;

  const normalizedContentType = contentType.toLowerCase();
  const normalizedUrl = url.toLowerCase();

  return (
    normalizedContentType.includes("json") &&
    (normalizedUrl.includes("/voyager/api/") ||
      normalizedUrl.includes("/jobs/") ||
      normalizedUrl.includes("jobposting"))
  );
}

export function securityResponseReason({ url, status, contentType = '', body = '' }) {
  if (!/^https:\/\/www\.linkedin\.com\/(?:voyager\/api\/|jobs\/)/.test(url)) return null;
  if ([401, 403, 429].includes(status)) return `LinkedIn HTTP ${status}; stopped.`;
  if (status !== 200 || !contentType.toLowerCase().includes('json')) return null;
  let payload;
  try { payload = JSON.parse(body); } catch { return null; }
  if (Array.isArray(payload.included)) return null;
  return /unauthori[sz]ed|authentication|required.*login|sign.?in|captcha|checkpoint|security challenge/i.test(`${payload.serviceErrorCode ?? ''} ${payload.message ?? ''}`)
    ? 'LinkedIn security/sign-in response; stopped.' : null;
}

export function pageGateReason({ url, title = '' }) {
  if (/\/checkpoint\/|\/challenge\/|captcha/i.test(url) || /security verification|captcha/i.test(title)) {
    return 'LinkedIn security challenge; stopped.';
  }
  if (/\/login(?:\/|\?|$)/i.test(url) || /^(?:sign in|log in|iniciar sesi[oó]n)\b/i.test(title)) {
    return 'LinkedIn sign-in is required; stopped.';
  }
  return null;
}

export async function waitForSearchReadiness({ inspect, ensureAllowed, drain, timeoutMs = 15_000, intervalMs = 200 }) {
  const deadline = Date.now() + timeoutMs;
  let result;
  do {
    await drain();
    await ensureAllowed();
    result = await inspect();
    if (result.observed > 0 || result.explicitEmpty) return result;
    if (Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  } while (true);
  // DOM-only results are a bounded degraded path when the card response was
  // absent; capture health still rejects an unrecognized empty layout.
  return result;
}
