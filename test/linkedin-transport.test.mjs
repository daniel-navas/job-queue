import test from 'node:test';
import assert from 'node:assert/strict';
import { observedDetailTemplate, fetchObservedDetail } from '../src/linkedin/transport.mjs';

const observedUrl = 'https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A1234567890)&queryId=voyagerJobsDashJobPostings.observedHash';
const detailPayload = id => ({ included: [{ $type: 'com.linkedin.voyager.dash.jobs.JobPosting', entityUrn: `urn:li:fsd_jobPosting:${id}`, description: { text: 'Complete source description. '.repeat(8) } }] });

test('HTTP detail uses an observed request template and retains only needed in-memory headers', async () => {
  const template = observedDetailTemplate(observedUrl, { accept: 'application/json', 'csrf-token': 'session-only', cookie: 'never-copy', 'x-restli-protocol-version': '2.0.0' });
  const calls = [];
  const request = { async get(url, options) {
    calls.push({ url, options });
    return { status: () => 200, headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify(detailPayload('9876543210')) };
  } };
  const result = await fetchObservedDetail(request, template, '9876543210');
  assert.equal(result.payload.included[0].entityUrn, 'urn:li:fsd_jobPosting:9876543210');
  assert.equal(new URL(calls[0].url).searchParams.get('variables'), '(jobPostingUrn:urn:li:fsd_jobPosting:9876543210)');
  assert.equal(new URL(calls[0].url).searchParams.get('queryId'), 'voyagerJobsDashJobPostings.observedHash');
  assert.equal(calls[0].url, observedUrl.replace('1234567890', '9876543210'), 'Preserve observed REST.li punctuation/escaping; re-encoding the whole variables parameter returns HTTP 400');
  assert.deepEqual(calls[0].options.headers, { accept: 'application/json', 'csrf-token': 'session-only', 'x-restli-protocol-version': '2.0.0' });
  assert.equal(calls[0].options.maxRedirects, 0);
});

test('ordinary missing or incomplete detail allows browser fallback', async () => {
  const template = observedDetailTemplate(observedUrl, {});
  for (const response of [
    { status: 404, type: 'application/json', body: '{}' },
    { status: 200, type: 'application/json', body: JSON.stringify(detailPayload('9999999999')) },
    { status: 200, type: 'application/json', body: '{broken' },
    ...['null', '{"included":{}}', '{"included":[null,{"entityUrn":123},{"entityUrn":"urn:li:fsd_jobPosting:1234567890","description":{"text":{}}}]}']
      .map(body => ({ status: 200, type: 'application/json', body })),
  ]) {
    const request = { get: async () => ({ status: () => response.status, headers: () => ({ 'content-type': response.type }), text: async () => response.body }) };
    assert.equal(await fetchObservedDetail(request, template, '1234567890'), null);
  }
});

test('HTTP detail stops without browser fallback on blocked or sign-in responses', async () => {
  const template = observedDetailTemplate(observedUrl, {});
  for (const status of [401, 403, 429]) {
    const request = { get: async () => ({ status: () => status, headers: () => ({}), text: async () => '' }) };
    await assert.rejects(fetchObservedDetail(request, template, '1234567890'), /LinkedIn.*stop/i);
  }
  const redirected = { get: async () => ({ status: () => 302, headers: () => ({ location: '/checkpoint/lg/login' }), text: async () => '' }) };
  await assert.rejects(fetchObservedDetail(redirected, template, '1234567890'), /LinkedIn.*stop/i);
  const challenge = { get: async () => ({ status: () => 200, headers: () => ({ 'content-type': 'text/html' }), text: async () => '<title>Security Verification</title>captcha' }) };
  await assert.rejects(fetchObservedDetail(challenge, template, '1234567890'), /LinkedIn.*stop/i);
  const loginJson = { get: async () => ({ status: () => 200, headers: () => ({ 'content-type': 'application/json' }), text: async () => JSON.stringify({ message: 'Authentication required', serviceErrorCode: 'UNAUTHORIZED' }) }) };
  await assert.rejects(fetchObservedDetail(loginJson, template, '1234567890'), /LinkedIn.*stop/i);
});

test('an unrelated or fixed private URL cannot become a detail template', () => {
  assert.equal(observedDetailTemplate('https://www.linkedin.com/voyager/api/graphql?queryId=other.hash&variables=(jobPostingUrn:urn:li:fsd_jobPosting:1234567890)', {}), null);
  assert.equal(observedDetailTemplate('https://example.com/voyager/api/graphql?queryId=voyagerJobsDashJobPostings.hash&variables=(jobPostingUrn:urn:li:fsd_jobPosting:1234567890)', {}), null);
});
