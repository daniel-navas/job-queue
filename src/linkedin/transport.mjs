const detailQuery = /^voyagerJobsDashJobPostings\.[\w-]+$/;
const urnPattern = /jobPostingUrn:urn:li:fsd_jobPosting:(\d+)/;
const replayHeaders = ['accept', 'csrf-token', 'x-restli-protocol-version', 'x-li-lang', 'x-li-track', 'x-li-page-instance'];

// A template is learned from this browser session, never from a saved hash or
// a response belonging to a different private endpoint.
export function observedDetailTemplate(value, requestHeaders = {}) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.linkedin.com' || url.pathname !== '/voyager/api/graphql') return null;
  if (!detailQuery.test(url.searchParams.get('queryId') ?? '')) return null;
  const variables = url.searchParams.get('variables') ?? '';
  const originalId = variables.match(urnPattern)?.[1];
  if (!originalId) return null;
  const headers = Object.fromEntries(replayHeaders.filter(key => requestHeaders[key]).map(key => [key, requestHeaders[key]]));
  return { url: url.href, originalId, headers };
}

export async function fetchObservedDetail(request, template, id) {
  if (!template || !/^\d+$/.test(id)) return null;
  // REST.li distinguishes escaped values from its literal structural
  // punctuation. URLSearchParams.set would escape both and produce HTTP 400.
  const url = template.url.replace(/(jobPostingUrn(?::|%3A)urn(?::|%3A)li(?::|%3A)fsd_jobPosting(?::|%3A))\d+/i,
    (_match, prefix) => `${prefix}${id}`);
  if (url === template.url && id !== template.originalId) return null;
  let response;
  try { response = await request.get(url, { headers: template.headers, maxRedirects: 0, timeout: 30_000 }); }
  catch { return null; }
  const status = response.status();
  if ([401, 403, 429].includes(status) || (status >= 300 && status < 400)) {
    throw new Error(`LinkedIn HTTP ${status}; stopped without browser fallback.`);
  }
  if (status !== 200) return null;
  const contentType = response.headers()['content-type'] ?? '';
  const body = await response.text();
  if (!contentType.toLowerCase().includes('json')) {
    if (/captcha|checkpoint|challenge|security verification|sign.?in|login/i.test(body)) {
      throw new Error('LinkedIn security/sign-in response; stopped without browser fallback.');
    }
    return null;
  }
  let payload;
  try { payload = JSON.parse(body); } catch { return null; }
  if (!payload || typeof payload !== 'object') return null;
  if (!Array.isArray(payload.included)) {
    if (/unauthori[sz]ed|authentication|required.*login|sign.?in|captcha|checkpoint|security challenge/i.test(`${payload.serviceErrorCode ?? ''} ${payload.message ?? ''}`)) {
      throw new Error('LinkedIn security/sign-in response; stopped without browser fallback.');
    }
    return null;
  }
  const complete = payload.included.some(item => {
    const itemId = typeof item?.entityUrn === 'string' ? item.entityUrn.match(/jobPosting:(\d+)/)?.[1] : null;
    const description = typeof item?.description?.text === 'string' ? item.description.text.trim() : '';
    return itemId === id && description?.length >= 100 && !/(?:\.{3}|…)\s*$/.test(description);
  });
  return complete ? { payload, body, url, status, contentType } : null;
}
