# Preserve provider-scoped search criteria at discovery

## Status

Accepted

## Context

The owner needs to edit and enable LinkedIn searches and assess their results.
A single overwritten search URL cannot explain how an offer was found or
compare edited queries fairly. Future providers may have different search
semantics, but implementing them now would be speculative.

## Decision

Keep LinkedIn definitions in the existing JSON configuration, using stable
IDs, provider identity and deterministic fingerprints of query/location/filters.
Both the UI and LinkedIn-specific review skill use the same validated API.
Use optimistic configuration versions to reject stale editor writes.

Snapshot criteria on runs and offer discoveries. One offer can have multiple
origins; edits never rewrite previous snapshots. Legacy records remain limited
rather than being assigned retrospectively to a current query. Capture runs
are imported idempotently, including rediscoveries and partial progress.

Report distinct captured offers, processed sample size and current mean rating
for the current criteria. Preserve historical associations. Scores continue to
come from current local rules, never AI or an inferred probability of success.

## Consequences

Only LinkedIn is implemented and displayed. Provider-scoped identities avoid
coupling a future provider to LinkedIn queries or its review skill. There is no
generic provider framework, scheduling system, interview tracker or dashboard.
The skill can recommend a review when concrete information changes; time alone
does not mandate an update. Future outcome feedback remains in docs/mvp.md.

Version 6 adds nullable country, visa-support and funded relocation facts with
exact evidence. Older summaries adapt to null mobility facts without AI calls.
Work mode is neutral for source-backed EU relocation, while visa support
remains a separately visible requirement.
