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
