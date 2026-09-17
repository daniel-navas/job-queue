# Latest Heavy Delivery

Delivery: **H-2026-09-17-http-sqlite**
Status: Implemented and verified; AI remains fallible, not universally certified.

## Outcome

- Find opportunities calls LinkedIn HTTP endpoints without Chrome. Searches →
  Connect/Reconnect opens Chrome explicitly for login and request discovery.
  Connection saved privately (0600, plaintext) in .local/linkedin-connection.json.
- Queue migrated to data/jobqueue.sqlite: all 158 records and metadata preserved.
  Legacy JSON remains untouched and is no longer live. Private JSON and SQLite
  backups are in data/backups; `node scripts/backup-queue.mjs` creates snapshots.
- Classifier corrections cover geography conflicts, required/optional criteria,
  unsupported proficiency and AND/OR. The old 30-criterion cap truncated long
  lists; it is now 100. No model downgrade or full-source truncation.

## Files for Light

src/linkedin/{collector,connection,transport}.mjs; src/queue{,-storage}.mjs;
src/server.mjs; public/{app,searches}.js; docs/summary-prompt.md;
src/{facts,summarize}.mjs; scripts/classifier-eval.mjs;
test-support/classifier-cases.mjs. Decision 0006 explains storage/transport.

## Preserve

Two independent AI calls maximum/click, no retries/backlog automation/API
billing fallback. Full source and deterministic matching. LinkedIn sequential,
two pages/five details maximum/search; security failures stop, never browser
fallback. Preserve reviews, IDs/order, provenance and the minimal desktop UI.

## Verification and limits

91 automated tests; both desktop checks passed. Full migration and isolated
SQLite backup restoration had exact state parity. Live HTTP test: two searches
plus four details, 3.106s total, zero browser launches, no queue import. Search
requests 846–1,025ms; details 256–337ms. Not an exhaustive benchmark.

Classifier: 19 targeted semantic checks passed. Real pair took 52.904s in
parallel; no speedup claim. Outputs remain diagnostic, not imported; 124 pending
offers unchanged. Cached older cards are not automatically reclassified.
Private APIs and session expiry may require explicit reconnect. See
docs/performance-spike.md and docs/storage-and-discovery-options.md.

Use **Retoques del heavy:**; read this file fresh.
