# Discovery and storage assessment

Status: owner-approved and implemented, 2026-09-17. See decision 0006 and
docs/performance-spike.md for current verification. The assessment below
records why the change was chosen; it is not a list of outstanding approvals.

## Plain component roles

- Finder: fetch LinkedIn search results and complete job descriptions.
- Classifier: send a job's title, company, location and description plus the tag
  catalog/rules to Codex through the owner's ChatGPT login. No candidate profile
  or LinkedIn credentials are part of that input. Return source-backed tags.
- Queue: persist sources, classifications, discovery criteria and review history.
  Local matching code calculates scores from those facts and the owner profile.

## Finder: implemented direction

The previous implementation opened Chrome on every scan to handle
authentication and discover request templates afresh. A prior search
replay returned 25 results with 24 overlapping IDs; this alone neither proves
filter correctness nor establishes that a browser is necessary. Dynamic results
must be assessed by filters, membership semantics and pagination, not only an
exact live ID comparison.

Find now uses HTTP-only searches/details with a reusable session. Chrome is
limited to explicit Connect/Reconnect, for sign-in and learning current private
request templates. The saved connection lives in .local/linkedin-connection.json
with owner-only 0600 permissions. This is plaintext, not Keychain encryption;
never share it. HTTP cookies are refreshed and search filters validated. Missing
or stale connections request reconnect rather than opening Chrome. Security and
rate-limit failures stop, with no fallback to bypass them. Browser-free login
and fixed latency are not promised.

The measured 5.794s was startup + search + two details + cleanup, not one request.
The detail requests took 295ms and 256ms. Browser-independent request contexts
can reuse authenticated storage: [Playwright API testing](https://playwright.dev/docs/api-testing).
See `docs/performance-spike.md` for the bounded live check.

## Queue: SQLite storage

The pre-migration data/queue.json contains 158 records and is approximately 0.98 MB.
It holds descriptions, classifications, discoveries, decisions and history.
Legacy writes replaced the file via a temporary file/rename. Each mutation
rewrote the whole document and separate writers could lose updates.
This file is not the cause of the measured 38s classifier call.

| Option | Assessment |
| --- | --- |
| Keep JSON | Simplest today, human-readable; full-file writes and weak cross-process coordination. |
| Local SQLite | Recommended storage evolution: transactional per-record updates, relational provenance/review queries, no database server. |
| PostgreSQL or hosted database | Unnecessary administration/network dependency for a one-owner desktop-only app. Reconsider only if requirements become genuinely multi-user/remote. |

The live queue is now data/jobqueue.sqlite, excluded from source control. Ordered
job records retain source facts, classifications, discoveries and review history;
queue metadata retains search runs. Transactions refresh current state and
persist changed records. This is deliberately not a speculative fully normalized
reporting schema. Catalog/profile/config remain JSON. The legacy file is imported
once and retained; editing it afterward does not edit the live queue.

Run `node scripts/backup-queue.mjs` for a SQLite-native snapshot in data/backups.
To restore: stop the app, preserve the current DB separately, and copy a verified
snapshot to data/jobqueue.sqlite before restarting. Never copy over a running DB.
The UI is a single running process; restart after maintenance by another process
to reload its in-memory view. Normal app writes are immediately reflected.
The initial import and isolated snapshot restore were compared against all 158
records and all metadata. Both had exact full-state parity. Git is not a live
database backup strategy.
SQLite fits device-local application data: [official guidance](https://www.sqlite.org/whentouse.html).

Raw LinkedIn captures and trial outputs in .local are diagnostics, not the live
queue. Keep credentials separate from both offers and diagnostic artifacts.
Historical queue data is already tracked/published by owner authorization;
excluding a future database does not remove past Git history. No history rewrite
or publication-policy change is part of this assessment.

## Engineering terms used here

- **Bounded concurrency:** two independent classifier calls overlap; the same
  sequential calls would send the same inputs. Output variability and caching
  can still change actual token counts.
- **Structured outputs:** constrain JSON shape. **Grounding:** check quoted
  source evidence. **Semantic evals:** check selected meanings and omissions.
  None by itself proves an AI answer is perfectly correct.
- **Content-hash caching:** reuse classifications while the source is unchanged.
  **Deterministic scoring:** calculate profile fit locally, without more AI.
- **Transactions:** all-or-nothing queue updates. SQLite improves durability,
  not the model's response time.
