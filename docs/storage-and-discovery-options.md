# Discovery and storage assessment

Status: recommendation only, 2026-09-17. No migration or HTTP-first rollout.

## Plain component roles

- Finder: fetch LinkedIn search results and complete job descriptions.
- Classifier: send a job's title, company, location and description plus the tag
  catalog/rules to Codex through the owner's ChatGPT login. No candidate profile
  or LinkedIn credentials are part of that input. Return source-backed tags.
- Queue: persist sources, classifications, discovery criteria and review history.
  Local matching code calculates scores from those facts and the owner profile.

## Finder: recommended direction

Current behavior opens Chrome on every scan. That is an implementation choice:
it handles authentication and discovers request templates afresh. A prior search
replay returned 25 results with 24 overlapping IDs; this alone neither proves
filter correctness nor establishes that a browser is necessary. Dynamic results
must be assessed by filters, membership semantics and pagination, not only an
exact live ID comparison.

Recommend HTTP-first searches/details with a reusable protected session. Browser
use should be limited to explicit sign-in/session renewal and relearning changed
private request templates. Missing pieces: protected auth persistence (prefer
macOS Keychain to plaintext exported cookies), cookie updates/expiry, saved
non-secret request templates, filter/pagination validation and clear reconnect
behavior. Stop on throttling/security challenges; do not switch transport to
bypass them. Do not promise permanently browser-free login or fixed latency.

The measured 5.794s was startup + search + two details + cleanup, not one request.
The detail requests took 295ms and 256ms. Browser-independent request contexts
can reuse authenticated storage: [Playwright API testing](https://playwright.dev/docs/api-testing).
This direction still needs implementation approval and a bounded live check.

## Queue: current storage and recommendation

Current data/queue.json contains 158 records and is approximately 0.98 MB.
It holds descriptions, classifications, discoveries, decisions and history.
Writes are serialized within the server and replace the file via a temporary
file/rename. That is reasonable for today's single-process local workload, but
each mutation rewrites the whole document and separate writers can lose updates.
This file is not the cause of the measured 38s classifier call.

| Option | Assessment |
| --- | --- |
| Keep JSON | Simplest today, human-readable; full-file writes and weak cross-process coordination. |
| Local SQLite | Recommended storage evolution: transactional per-record updates, relational provenance/review queries, no database server. |
| PostgreSQL or hosted database | Unnecessary administration/network dependency for a one-owner desktop-only app. Reconsider only if requirements become genuinely multi-user/remote. |

Proposed SQLite destination: a local data/jobqueue.sqlite database, excluded from
source control, with job/source facts, classifications, search revisions,
discoveries and review events. Keep editable catalog/profile/config JSON files.
Use real database backups with a tested restore; Git is not the live-data backup
strategy. Migration must preserve IDs/order, every review, source hashes and
search history, retain a pre-migration JSON backup and verify record parity.
SQLite fits device-local application data: [official guidance](https://www.sqlite.org/whentouse.html).

Raw LinkedIn captures and trial outputs in .local are diagnostics, not the live
queue. Keep credentials separate from both offers and diagnostic artifacts.
Historical queue data is already tracked/published by owner authorization;
excluding a future database does not remove past Git history. No history rewrite
or publication-policy change is part of this assessment.
