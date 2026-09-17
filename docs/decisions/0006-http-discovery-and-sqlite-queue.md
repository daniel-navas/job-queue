# HTTP-first discovery and transactional local storage

## Status

Accepted, owner-approved 2026-09-17. Supersedes decision 0001's browser-led
transport, not its account-risk acceptance or security-stop policy.

## Context

Starting Chrome on every search added unnecessary work. Observed LinkedIn
requests can be replayed directly; changing rankings do not require identical
live result IDs to establish correct filters. The growing queue also needs
durable concurrent updates without rewriting a whole JSON file on each review.

## Decision

Separate explicit browser connection from ordinary HTTP collection. Connect
learns current private request templates and saves authentication locally.
Find uses only an HTTP request context. Missing/expired templates require
reconnection; security failures stop without transport fallback. Preserve
bounded, sequential retrieval and exact search provenance.

Use Node's built-in SQLite for ordered job records and queue metadata, retaining
the existing Queue API and JSON-shaped domain records. Transactions refresh
current state and persist changed records. No database server, ORM, new package,
or speculative normalized reporting system is needed. Profile, preferences,
catalog and search definitions remain editable JSON.

Import legacy JSON exactly once; preserve it and a private backup. SQLite is
then authoritative. Verify complete state parity and backup restoration. Do
not publish the database or credentials. Existing published history is unchanged.

## Tradeoffs

Private LinkedIn APIs can change and account restrictions remain possible.
Reusable session data is stored as an owner-readable 0600 local file, not in
Keychain: simpler, but plaintext and sensitive to other processes running as
that OS user. Do not claim encryption or copy it into reports/captures.

SQLite protects writes, not AI correctness. It will not remove tens of seconds
spent in model inference. Semantic evals, grounded quotes, full sources and
deterministic matching address that separate boundary.
