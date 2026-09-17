# LinkedIn searches

## Current strategy and review

Initial review: 2026-09-14. The five definitions in config/searches.json are
starting hypotheses, not empirically winning queries. Broad backend Colombia
preserves coverage (including possible Bogota hybrid roles); Node/TypeScript
and Python remote searches focus on confirmed strengths. Spain and Germany
have separate backend/visa-support queries and no work-mode restriction.
No dedicated full-stack, Go, growth or other-EU queries are included initially.
Personal geographic and relocation requirements live in docs/preferences.md.

The first useful review is after comparable bounded runs and some processed
offers from each route, or a material change in target skills, geography or
preferences. Keep a small portfolio when specific queries add no useful
coverage. Do not set an arbitrary recurring schedule or equate more queries
with better search. See the project skill review-linkedin-search-strategy.

LinkedIn is moving to AI-powered search; query interpretation and accepted
filters depend on the account's experience. Requested criteria and effective
page URLs are retained, but neither proves that LinkedIn applied every filter.
On 2026-09-14 the authenticated backend Colombia / past-month search was
validated with one detail visit: 50 observed result IDs, 26 complete source
descriptions (25 delivered by search responses and one HTML-only detail),
and 33 complete offers attributed after including seven existing rediscoveries.
Import added 14 offers and preserved all existing review decisions and IDs.
The other four routes remain unvalidated hypotheses. No AI extraction ran.

## Query review — 2026-09-16

LinkedIn's current Jobs help says AI-powered search is available worldwide and
classic job search is being retired starting in September. It explicitly
recommends describing the desired role in natural language. General LinkedIn
Boolean documentation still requires uppercase AND/OR/NOT and quotes for exact
phrases; that is not proof the new Jobs experience enforces Boolean semantics.

The Spain/Germany wording ("backend engineer with visa sponsorship or work
permit support") is a reasonable natural-language hypothesis, not an established
best query. "with" and lowercase "or" express intent here, not Boolean operators.
Do not replace it with a long synonym list based on an assumed search backend.
The public help describes LLM-based semantic matching; the exact implementation
is not a client-side query contract.

No query definitions changed in this review. Local run history still only has
the backend-Colombia validation; there is no comparative evidence for Europe.
A future bounded comparison should vary one phrasing at a time and inspect
actual descriptions for employer permit assistance, including false positives
such as "no sponsorship". Mentioning support in a query never proves eligibility;
silence in an ad also does not prove support is unavailable. No new collection
or AI extraction was performed for this review.

Sources checked:
- https://www.linkedin.com/help/linkedin/answer/a9677065
- https://www.linkedin.com/help/linkedin/answer/a524335/using-boolean-search-on-linkedin
- https://www.linkedin.com/help/linkedin/answer/a507441/filter-and-sort-job-search-results

## Editing

The Searches dialog groups definitions under LinkedIn. The query is the title;
there is no separate name field or repeated query line. Add or edit query,
location, work mode (any/remote) and date (any/day/week/month); use the
checkbox to enable or pause. Show location and active filters with explicit
labels; omit inactive filters and execution-limit instructions. Pausing preserves records. There is no deletion,
duplication, schedule, extra provider UI or interview dashboard.

GET /api/searches returns { version, searches, stats }. POST /api/searches
accepts { version, search }; search contains id (omit for create), provider
(linkedin), name, query, location, workplace, datePosted and enabled. Use the
fresh version on every save. The UI derives the legacy name field from the
query (up to 100 characters) for API compatibility; stable IDs and old snapshots
are unchanged. HTTP 409 means another edit occurred; reload and
reconcile. Requests use the local app origin. No authentication secrets belong
in queries or URLs.

The file fallback is config/searches.json. Prefer the API while the app runs.
For offline edits, preserve IDs and other entries, keep schemaVersion 2, and
validate through SearchStore.read() before resuming. URLs and revision hashes
are derived from criteria, so never manually invent versions. The app reloads
definitions on requests. An active batch uses its starting snapshot; edits
apply to the next batch. Provider identity is retained in definitions, run
records and provenance. Only LinkedIn is implemented; future providers should
have their own search adapter and review skill.

## Collection and provenance

Find opportunities reuses one authenticated browser for all enabled searches,
visited sequentially, with at most five missing detail attempts per search.
Searches wait for results instead of a fixed sleep. Missing descriptions use
HTTP requests learned from that browser session when available; ordinary
unavailable/incomplete responses fall back to the job page. Previously captured complete jobs are linked
to additional searches without another detail visit. The one-minute batch
cooldown remains. Any failed search stops the rest; successful captures remain.
Run-specific manifests prevent accidentally importing an earlier search after
a launch failure. Security challenges, authentication failures and HTTP 429
stop the batch without browser fallback for a blocked HTTP request.

Search-page cards/visible result links establish membership. Detail-page
recommendations and feed IDs do not establish discovery by that search.
Unrecognized empty result layouts and all-attempted-detail capture failures
stop the batch. An explicit LinkedIn no-results message permits a successful
empty run. No run claims exhaustive LinkedIn coverage. Only full descriptions
enter the queue. HTML-only details use the description scoped to About the job;
recommendation sections are excluded and the matching page ID is required.

Each offer stores discoveries with a provider, stable search ID, criteria
fingerprint, exact name/query/location/filters/URL and first/last observed dates.
Criteria edits create a different fingerprint. Name and activation changes do
not reset the criteria cohort. Prior snapshots are not rewritten.
The Found via disclosure is available even before processing. Legacy URL-only
records remain explicitly limited, without invented original discovery dates
or retroactive assignment to new searches.

## Metrics

The dialog shows unique complete offers for the current criteria; processed
count and current mean rating; exclusive offers and owner-marked interest;
run count, last date and interruptions. Historical totals remain visible after
criteria edits. Click an offer count to filter the queue to that cohort.

Ratings are recomputed using today's profile, preferences and weights. Pending
or stale summaries do not count as zero and are excluded from the mean. Current
means are not historical scores or acceptance probabilities. Selective
processing creates sampling bias. Exclusivity means not seen via another
recorded search, not proof that LinkedIn would never return it elsewhere.
Overlapping per-search counts must not be summed into a portfolio total.
Runs retain observed, captured and added counts and status, including zero
results and partial failures. Reimporting a run is idempotent.

Future application and interview progression is recorded only in the MVP
roadmap. Do not add fictitious conversion rates or automatic query scores.

## Sources

- https://www.linkedin.com/help/linkedin/answer/a9677065
- https://www.linkedin.com/help/linkedin/answer/a507441/filter-and-sort-job-search-results
- https://learn.chatgpt.com/docs/build-skills
