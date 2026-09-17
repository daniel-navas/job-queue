# Latest Heavy Delivery

Delivery: **H-2026-09-17-hybrid**
Status: Implementation verified; live classifier review found semantic defects.

## Outcome

- Find opportunities reuses one authenticated browser for all enabled searches.
  Search membership remains browser-led; missing details use an observed HTTP
  template with browser fallback for ordinary incomplete/unavailable responses.
  Readiness replaces fixed sleeps. Security/authentication/rate limits stop.
- Process keeps individual AI calls, two concurrently per click, with independent
  saves. Compact output restores the unchanged version-6 facts before validation.
  Full sources/catalog, source-hash caching and subscription-only auth remain.
- Prior UI refinements remain: query titles, active filters, no Searches footer,
  search progress in the button. No mobile redesign or new controls.

## Files for Light

- Processing: src/extraction-wire.mjs, src/summarize.mjs and corresponding tests.
- Discovery: src/linkedin/{collector,transport,extract}.mjs, src/scan.mjs,
  src/server.mjs and corresponding tests.
- UI: public/{app,searches}.js, public/index.html, public/style.css.
- Rationale/evidence: decisions 0001/0002, docs/performance-spike.md.
- Current product rules: docs/preferences.md, docs/linkedin-searches.md.

## Preserve

Maximum two AI offers per click; wait for both even on failure. No retries,
whole-backlog automation, model downgrade or API fallback. Preserve reviews,
individual durable saves and full sources. LinkedIn remains sequential with
at most five missing-detail attempts/search. Never bypass a security stop.
Legacy poc:linkedin is still the separate browser-only diagnostic.

## Verification and limits

70 tests and both desktop browser checks pass; screenshots inspected. Live
Colombia/Germany collection preserved filters and used one session. After fixing
REST.li URL escaping, a Germany run took 5.794s including startup; two HTTP
details took 295/256ms. These bounded diagnostics did not import offers.

The authorized two-offer classifier check completed in 38.063s concurrently.
Schema/quotes pass, but source review found omitted cloud qualification,
unsupported proficiency and conflicting-country handling. Results remain local
test artifacts, not queue summaries. See docs/performance-spike.md for details.
Classifier quality remains open; do not claim semantic parity or a speedup.
The owner wants ordinary searches without Chrome; current production still
opens it. HTTP-first session reuse and SQLite storage are proposals, not shipped.

Use **Retoques del heavy:** for follow-up adjustments; read this file fresh.
