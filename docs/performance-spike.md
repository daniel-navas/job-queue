# Processing and LinkedIn performance spike

Dates: 2026-09-16–17 (America/Bogota). Status: completed exploratory spike.
The reduced-agent-context attempt is inconclusive, not a successful optimization.
The tables below describe the original experiment. Production adoption and
subsequent verification are recorded separately at the end of this document.

## Scope and method

Owner-approved experiment, not a production migration. Keep ChatGPT subscription
authentication, no API billing fallback, no automatic backlog processing, and
stop LinkedIn activity on challenges or throttling. At the experiment's start,
production used two independent concurrent AI calls and the browser collector.

Freeze ten pending descriptions spanning Colombia/LatAm, Spain and Germany,
English/Spanish, and explicit/absent visa information. Compare the first five
across variants; ten-offer batching adds five held-out records. Preserve full
descriptions, catalog and extraction rules. No candidate profile is sent.

Artifacts and throwaway scripts are local, not application components:

- `.local/performance-spike-20260916/`: frozen sources, original queue, raw
  outputs, usage, timing, source-reviewed audit and import evidence.
- `.local/processing-spike.mjs`: bounded CLI trials, never imports results.
- `.local/audit-spike.mjs`: source-derived checks, not production exceptions.
- `.local/linkedin-network-spike.mjs`: bounded read-only HTTP replay probe.

One exploratory trial per variant, not a statistically controlled benchmark.
Baseline and later variants ran in different time windows; cache and service
conditions differ. The CLI-default model was not pinned or recorded by the
old runner, so do not attribute all differences solely to batching. The light
variant explicitly used `gpt-5.6-luna`, low reasoning. Token counts describe
usage, not a measured subscription-dollar saving.

## AI results

| Variant | Offers | Wall time | Input tokens | Output tokens | Findings |
| --- | ---: | ---: | ---: | ---: | --- |
| Individual calls, maximum two concurrently | 5 | 136.1s | 104,930 | 8,963 | All five structurally/source valid; 27 targeted checks pass |
| Compact individual calls, maximum two concurrently | 5 | 103.5s | 104,273 | 7,175 | All five structurally/source valid; 27 targeted checks pass; broader interpretation differences remain |
| One batch, habitual CLI settings | 5 | 131.4s | 24,907 | 6,745 | Structurally valid, but four targeted semantic checks fail |
| One batch, Luna / low | 5 | 106.8s | 22,944 | 5,576 | Two cards fail strict validation; six targeted checks fail |
| Compact wire format, habitual CLI settings | 5 | 93.2s | 24,786 | 4,837 | Structurally valid; two targeted omission checks fail |
| One batch, habitual CLI settings | 10 | 221.5s | 28,478 | 11,785 | Structurally valid; three of 43 targeted checks fail |

The first five-offer attempt was interrupted without usable output, with
network/plugin-refresh warnings. Its 1,057.8s elapsed time is excluded: the
cause of the interruption is unresolved. The explicit benchmark retry above
completed; production retry policy did not change.

The reduced-agent-context attempt also ended without output and reported a
timeout (999.2s wall time despite a 240s timer). Interrupted execution makes its
duration unusable; neither a speed nor a quality conclusion is supported. It
will not be retried as part of this bounded experiment.

The compact trial shortens repeated property names and encodes only non-null
thresholds, then restores the existing full card before validation. It does not
remove evidence, source text, or catalog entries. The provider schema shrinks
from 11,215 to 9,435 characters. At that checkpoint it was experimental only.

The compact individual trial was about 24% faster in this sample and emitted
20% fewer reported output tokens; input usage barely changed. This is a useful
candidate, not a promised per-click speedup. Round-trip checks restored all
fields of the five baseline cards losslessly and rejected duplicate thresholds.

Quality checking includes schema, IDs, exact quotations, required versus bonus
criteria, OR grouping, duration, geography, visa and assigned-product audience.
The 27 source-derived checks for the common five were refined during manual
review; they are not a blinded or exhaustive accuracy evaluation. Examples of
observed regressions: missing API-design requirements, split OR bonuses,
internal tools mislabeled B2B, invented citation text, and preferred experience
made mandatory. Passing JSON validation alone does not establish completeness.
The ten-offer trial adds 16 checks for its five additional records (43 total).
Manual comparison of compact individual outputs also found interpretation
differences outside the 27 checks: a broad data-infrastructure criterion was
not retained separately and a product integration tag was omitted. The baseline
itself is not a gold-standard annotation; neither output should be described as
perfect or semantically identical.

## LinkedIn findings

The pre-optimization collector already intercepted network JSON. It started
Chrome once per search, visits the feed, waits a fixed 15 seconds after search
navigation and 3 seconds after each detail navigation.

A fresh Germany search observed real private request URLs and headers in
memory, then replayed one search and one detail GET using the same authenticated
session. No session cookies or authentication headers were saved in artifacts.

- Browser startup: 0.780s; first search JSON: 2.964s after navigation.
- Direct search request: HTTP 200, 1.017s, 25 cards. 24/25 IDs overlap with the
  browser response; exact ordered equivalence did not hold. Dynamic ranking or
  promoted content is a possible explanation, not a verified cause.
- Direct detail request: HTTP 200, 0.255s, 1,845 description characters, exactly
  matching the browser response for that job.
- Entire probe: 5.421s. This is not the duration of a full Find opportunities
  run and does not establish success across all configured searches.

Direct HTTP retrieval is feasible for observed requests, but permanent
browser-free operation is unproven. Authentication refresh and private endpoint
changes remain concerns. Do not hard-code today's GraphQL query hashes or save
plaintext session secrets as a shortcut. Never retry a blocked request through
another transport to evade a challenge.

## Live data and next step

Five baseline cards passed strict validation and the targeted source review and
were imported once. Pending offers: 129 -> 124. All other stored records and all
158 review/status/history records remained unchanged. The server was stopped
briefly for the import and restarted; the API reports all five as processed.
Backup: `.local/performance-spike-20260916/queue-before-import.json`.

At the original spike checkpoint, no experimental model, batch size, wire
format, agent configuration, or HTTP collector was adopted in production. The
five imported cards are the reviewed baseline, not a mixture of faster variants.
Final verification: 57/57 existing tests pass, compact codec round-trip checks
pass, and the running API reports the five imported offers as processed.

## Original recommendation

1. Prioritize LinkedIn transport overhead: reuse one authenticated browser per
   scan, use data-readiness conditions instead of unconditional sleeps, and
   hydrate details through observed HTTP requests with validated browser
   fallback. First compare filters, pagination, provenance and completeness
   across the actual searches; the 24/25 overlap is not full parity proof.
   Stop, rather than falling back, on security challenges or throttling.
2. Keep independent per-offer AI calls and their durable saves. The compact
   individual format is the best candidate from this sample; promote it only
   with explicit codec validation and a broader source-reviewed quality gate.
   Do not replace the model with Luna or adopt large batches based on these
   results. Batch input savings did not provide a comparably large speed gain.
3. Do not discard arbitrary source sections or citations to force a latency
   target. Visa restrictions and concrete requirements can appear anywhere.
   The output volume appears material to latency, but the experiment does not
   isolate all provider/model/network effects or prove a universal bottleneck.

The owner subsequently approved production implementation, recorded below.

## Production adoption and verification (2026-09-17)

Implemented compact individual extraction, keeping the model, complete source,
catalog and two-call concurrency limit. The production decoder rejects malformed
or duplicate thresholds and restores the original version-6 schema. It decodes
all five frozen live compact outputs identically to the experimental decoder.
The actual CLI boundary is tested with a local fake executable, including full
source retention, schema delivery, auth constraints and result decoding.
Independent review found no blocking AI-code issues; the obsolete schema export
and its test were removed. No summaries require migration or reprocessing.

The owner explicitly authorized the initially blocked two-offer check, which
then completed on 2026-09-17. The classifier used the production runCodex path:
Stefanini 4456274071 took 38.060s; N26 4456384983 took 24.868s; concurrent wall
time was 38.063s. Combined usage: 41,266 input tokens, 2,880 output tokens,
844 reasoning output tokens; no cached input was reported. This different sample
does not demonstrate a speedup or isolate a bottleneck.

Both cards passed structural/source-quote validation, but manual source review
found semantic defects: N26 omitted the required modern-cloud-architecture
criterion and inferred independent Spring Boot autonomy without explicit
proficiency wording. Stefanini selected CO despite conflicting Colombia/Chile
role geography. These are evidence against claiming extraction quality is
fully solved; the earlier six targeted checks for these two offers alone would
not catch them. The cause is not isolated to the compact representation.
The results were saved in .local/performance-spike-20260916/
production-compact-holdout.json, not imported into the queue. Both descriptions
already exist in the queue; no offers, reviews or summaries were overwritten.
Generic classifier-quality corrections need a separate focused change, not
manual per-offer scoring exceptions or an automatic retry.

The app now uses one persistent browser per scan, browser-led searches,
readiness conditions, and observed HTTP detail requests with ordinary browser
fallback. Requests retain their observed REST.li escaping: re-encoding the
whole variables parameter produced HTTP 400 and was corrected. A regression
also ensures a browser security response received during HTTP work prevents
subsequent fallback navigation. No blocked request is retried through another
transport. Legacy poc:linkedin remains a browser-only diagnostic.

Bounded live checks, capture-only with no queue import:

- Colombia + Germany, one missing detail maximum per search: 13.192s total
  including browser startup, 25 observed results each, filters preserved.
  This first run exercised browser fallback, not successful HTTP hydration.
- Germany after the URL fix, two missing details maximum: 5.794s total,
  including 2.116s startup; search/capture 3.460s. Both HTTP details returned
  200 in 295ms and 256ms (1,855 and 5,460 characters). Three complete sources
  were captured including the search-page detail. This is not a full five-search
  benchmark or proof of exhaustive results.

Reports and diagnostic manifests live under
.local/performance-spike-20260916/production-hybrid*.json and
validation-hybrid-*.json. Raw capture folders remain local and ignored.
The production queue and owner review state were not changed by these checks.

Final checks: 70 tests pass; desktop Searches UI/API checks and the running-app
browser smoke check pass. The server was restarted with the new implementation.

## Further optimization: judgment, not an implementation backlog

### 2026-09-17 delivery follow-up

HTTP-only production collector verified live after one explicit Chrome
connection. Colombia and Germany, one result page and at most two missing
details each: **3.106s total**, **zero browser launches** during collection.
The two search calls took **1,025ms / 846ms**; four detail calls took
**337 / 272 / 321 / 256ms**. Each search observed 25 IDs. Saved query, location
and filters were replayed; no offers or reviews were imported. This is a bounded
diagnostic, not a full-batch or exhaustive-coverage benchmark. Report:
.local/http-finder-verification/report.json. Production allows at most two
pages and five missing descriptions per search.

Classifier corrections retain the model/default settings, full descriptions,
catalog, compact transport and two independent calls. Source-derived evals
reproduced five known semantic failures in the earlier two-offer outputs.
Generic prompt corrections address conflicting geography, required general
concepts versus preferred vendors, required lists, explicit proficiency, and
AND/OR semantics in all groups. Technology knowledge-level misuse is rejected.
Review also discovered a schema cap of 30 criteria that dropped the tail of a
long list; criteria now allow 100. Cached cards are not silently reprocessed.

Final reviewed run: **19/19 targeted semantic checks** across two real offers
and one synthetic case. Real offers took **52.904s / 31.819s concurrently**;
the later synthetic call took **13.929s**. This is a correctness correction,
**not a demonstrated classifier speedup**. The final two real calls reported
41,990 input and 3,928 output tokens, including 25,600 cached input tokens.
Report: .local/classifier-eval-reviewed.json; no automatic queue import.
A subsequent prose-only grammar correction does not change extraction rules.
The evals cover known failure modes, not every possible omission. A source quote
is an excerpt, not proof of every clause in a synthesized display sentence;
review against the full source remains necessary for ambiguous facts.

SQLite migration and restoration matched the entire original state (158 records,
including reviews/history/metadata). It improves write safety, not model latency.
91 automated tests and both desktop checks passed. Browser connection testing
caught and fixed an unbound launcher and an unbounded unrelated-response wait.

- **Keep:** cached facts for unchanged sources, deterministic local scoring,
  compact output, two independent concurrent calls, HTTP session reuse and
  readiness instead of sleeps. These remove repeated work without intentionally
  removing source information. Concurrency does not increase the number of
  per-offer calls; actual tokens/cache usage can still vary.
- **Next experiment if needed:** reference repeated exact quotations once per
  output and expand their IDs locally. This might reduce generated tokens while
  preserving evidence, but must prove correct mappings and extraction coverage.
- **Measure before changing:** CLI startup/base-context overhead and cache reuse.
  Stable instructions/catalog already precede variable source text; identical
  prefixes do not guarantee cache hits, and API caching controls are not assumed
  available through the subscription CLI. The earlier lean-context run failed
  to produce usable evidence.
- **Do not adopt from current evidence:** cheaper-model substitution, big
  batches, arbitrary description truncation or keyword-pruned catalogs. Trials
  showed semantic errors/omissions; input-token savings alone are not enough.
  More concurrent calls may reduce backlog time but increase burst/rate-limit
  pressure; the owner-approved cap remains two.

## References

- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference):
  `model_instructions_file` replaces built-in agent instructions; used only in
  the reduced-context trial, not as a change to personal Codex settings.
- [Playwright APIRequestContext](https://playwright.dev/docs/api/class-apirequestcontext):
  direct requests can share the browser context's cookie storage.
- [OpenAI latency guidance](https://developers.openai.com/api/docs/guides/latency-optimization):
  fewer generated tokens and parallel independent calls are useful levers.
- [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching):
  cache reuse depends on matching prefixes/settings and eligible boundaries;
  no fixed subscription-cost saving is inferred from API documentation.
