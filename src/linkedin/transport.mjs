const detailQuery = /^voyagerJobsDashJobPostings\.[\w-]+$/;
const urnPattern = /jobPostingUrn:urn:li:fsd_jobPosting:(\d+)/;
const replayHeaders = ['accept', 'csrf-token', 'x-restli-protocol-version', 'x-li-lang', 'x-li-track', 'x-li-page-instance'];
const searchPath = '/voyager/api/voyagerJobsDashJobCards';
const dateRanges = { day: 'r86400', week: 'r604800', month: 'r2592000' };
const encodeValue = value => encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

export function observedSearchTemplate(value, requestHeaders = {}) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.linkedin.com' || url.pathname !== searchPath) return null;
  if (url.searchParams.get('q') !== 'jobSearch' || !/^\d+$/.test(url.searchParams.get('start') ?? '')) return null;
  const raw = url.search.match(/(?:^|[?&])query=([^&]*)/)?.[1];
  if (!raw || !/\borigin:[A-Z_]+/.test(raw) || !/keywords:.*?,locationUnion:/.test(raw)
    || !/locationUnion:\(seoLocation:\(location:.*?\)\)/.test(raw)
    || !/selectedFilters:\((?:[^()]|\([^()]*\))*\)/.test(raw)) return null;
  const headers = Object.fromEntries(replayHeaders.filter(key => requestHeaders[key]).map(key => [key, requestHeaders[key]]));
  return { url: url.href, headers };
}

export function searchUrlFromTemplate(template, search, start = 0) {
  if (!template || !Number.isInteger(start) || start < 0 || start > 100) throw new Error('LinkedIn search template is stale. Connect LinkedIn again.');
  const value = template.url;
  const raw = value.match(/(?:^|[?&])query=([^&]*)/)?.[1];
  if (!raw) throw new Error('LinkedIn search template is stale. Connect LinkedIn again.');
  const filters = [search.datePosted !== 'any' ? `timePostedRange:List(${dateRanges[search.datePosted]})` : null,
    search.workplace === 'remote' ? 'workplaceType:List(2)' : null].filter(Boolean).join(',');
  const query = raw.replace(/keywords:.*?(?=,locationUnion:)/, `keywords:${encodeValue(search.query)}`)
    .replace(/locationUnion:\(seoLocation:\(location:.*?\)\)/, `locationUnion:(seoLocation:(location:${encodeValue(search.location)}))`)
    .replace(/selectedFilters:\((?:[^()]|\([^()]*\))*\)/, `selectedFilters:(${filters})`);
  const url = value.replace(/([?&]query=)[^&]*/, (_all, prefix) => `${prefix}${query}`)
    .replace(/([?&]start=)\d+/, (_all, prefix) => `${prefix}${start}`);
  if (url === value && start) throw new Error('LinkedIn search template is stale. Connect LinkedIn again.');
  return url;
}

export async function fetchObservedSearch(request, template, search, start = 0) {
  const url = searchUrlFromTemplate(template, search, start);
  const response = await request.get(url, { headers: template.headers, maxRedirects: 0, timeout: 30_000 });
  const status = response.status();
  if ([401, 403, 429].includes(status) || (status >= 300 && status < 400)) throw new Error(`LinkedIn HTTP ${status}; stopped without browser fallback.`);
  if (status !== 200) throw new Error(`LinkedIn search HTTP ${status}; stopped. Connect LinkedIn again if the search template changed.`);
  const contentType = response.headers()['content-type'] ?? '';
  const body = await response.text();
  if (!contentType.toLowerCase().includes('json')) {
    if (/captcha|checkpoint|challenge|security verification|sign.?in|login/i.test(body)) throw new Error('LinkedIn security/sign-in response; stopped without browser fallback.');
    throw new Error('LinkedIn search template is stale. Connect LinkedIn again.');
  }
  let payload;
  try { payload = JSON.parse(body); } catch { throw new Error('LinkedIn search template is stale. Connect LinkedIn again.'); }
  if (!Array.isArray(payload?.included)) {
    if (/unauthori[sz]ed|authentication|required.*login|sign.?in|captcha|checkpoint|security challenge/i.test(`${payload?.serviceErrorCode ?? ''} ${payload?.message ?? ''}`)) throw new Error('LinkedIn security/sign-in response; stopped without browser fallback.');
    throw new Error('LinkedIn search template is stale. Connect LinkedIn again.');
  }
  const data = payload.data;
  if (data?.$type !== 'com.linkedin.restli.common.CollectionResponse' || !Array.isArray(data.elements)
    || data.metadata?.keywords !== search.query || data.paging?.start !== start
    || !Number.isInteger(data.paging?.total) || !Number.isInteger(data.paging?.count)) {
    throw new Error('LinkedIn search metadata does not match the selected criteria. Connect LinkedIn again.');
  }
  const ids = [...new Set(payload.included.flatMap(item => {
    if (!item?.$type?.endsWith('.JobPostingCard') || !/JOBS_SEARCH/.test(item.entityUrn ?? '')) return [];
    const id = item.entityUrn.match(/jobPostingCard:\((\d+),JOBS_SEARCH\)/)?.[1];
    return id ? [id] : [];
  }))];
  if (!ids.length && data.paging.total > 0) throw new Error('LinkedIn search card membership is unrecognized. Connect LinkedIn again.');
  return { payload, body, url, status, contentType, ids, total: data.paging.total,
    count: data.paging.count, explicitEmpty: data.paging.total === 0 };
}

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
