import assert from "node:assert/strict";
import test from "node:test";

import {
  extractJobIds,
  isLikelyJobResponse,
  normalizeJobUrl,
  waitForSearchReadiness,
  securityResponseReason,
  pageGateReason,
} from "../src/linkedin/extract.mjs";

test("extractJobIds recognizes LinkedIn job URNs and URLs", () => {
  const payload = {
    entityUrn: "urn:li:fsd_jobPosting:1234567890",
    duplicate: "https://www.linkedin.com/jobs/view/1234567890/?trackingId=x",
    another: "urn:li:jobPosting:9876543210",
  };

  assert.deepEqual(extractJobIds(payload), ["1234567890", "9876543210"]);
});

test('search readiness waits for recognized cards even when a DOM link appears first', async () => {
  let observed = 0;
  setTimeout(() => { observed = 2; }, 20);
  const result = await waitForSearchReadiness({
    inspect: async () => ({ observed, visible: 1, explicitEmpty: false }),
    ensureAllowed: async () => {}, drain: async () => {}, timeoutMs: 100, intervalMs: 5,
  });
  assert.equal(result.observed, 2);
});

test('search readiness accepts explicit empty results without waiting for a deadline', async () => {
  const started = Date.now();
  const result = await waitForSearchReadiness({
    inspect: async () => ({ observed: 0, visible: 0, explicitEmpty: true }),
    ensureAllowed: async () => {}, drain: async () => {}, timeoutMs: 1000,
  });
  assert.equal(result.explicitEmpty, true);
  assert.ok(Date.now() - started < 100);
});

test('browser job API security JSON is a stop, not an incomplete capture', () => {
  const url = 'https://www.linkedin.com/voyager/api/graphql';
  assert.match(securityResponseReason({ url, status: 200, contentType: 'application/json', body: JSON.stringify({ serviceErrorCode: 'AUTHENTICATION_REQUIRED', message: 'Login required' }) }), /sign-in|security/i);
  assert.match(securityResponseReason({ url, status: 429, contentType: 'application/json', body: '{}' }), /429/);
  assert.equal(securityResponseReason({ url, status: 200, contentType: 'application/json', body: JSON.stringify({ included: [] }) }), null);
});

test('a same-URL sign-in wall or challenge page stops collection', () => {
  assert.match(pageGateReason({ url: 'https://www.linkedin.com/jobs/search/', title: 'Sign In | LinkedIn' }), /sign-in/i);
  assert.match(pageGateReason({ url: 'https://www.linkedin.com/checkpoint/challenge', title: 'LinkedIn' }), /security/i);
  assert.equal(pageGateReason({ url: 'https://www.linkedin.com/jobs/search/', title: 'Jobs | LinkedIn' }), null);
});

test("normalizeJobUrl removes tracking data", () => {
  assert.equal(
    normalizeJobUrl("/jobs/view/1234567890/?trackingId=secret"),
    "https://www.linkedin.com/jobs/view/1234567890/",
  );
  assert.equal(normalizeJobUrl("https://example.com/jobs/view/123"), null);
});

test("isLikelyJobResponse accepts LinkedIn JSON endpoints only", () => {
  assert.equal(
    isLikelyJobResponse({
      url: "https://www.linkedin.com/voyager/api/voyagerJobsDashJobCards",
      contentType: "application/json; charset=utf-8",
    }),
    true,
  );
  assert.equal(
    isLikelyJobResponse({
      url: "https://www.linkedin.com/voyager/api/feed",
      contentType: "text/html",
    }),
    false,
  );
  assert.equal(
    isLikelyJobResponse({
      url: "https://example.com/voyager/api/jobs",
      contentType: "application/json",
    }),
    false,
  );
});
