import assert from "node:assert/strict";
import test from "node:test";

import {
  extractJobIds,
  isLikelyJobResponse,
  normalizeJobUrl,
} from "../src/linkedin/extract.mjs";

test("extractJobIds recognizes LinkedIn job URNs and URLs", () => {
  const payload = {
    entityUrn: "urn:li:fsd_jobPosting:1234567890",
    duplicate: "https://www.linkedin.com/jobs/view/1234567890/?trackingId=x",
    another: "urn:li:jobPosting:9876543210",
  };

  assert.deepEqual(extractJobIds(payload), ["1234567890", "9876543210"]);
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
