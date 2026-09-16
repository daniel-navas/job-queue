# Use AI only for structured opportunity extraction

## Status

Accepted

## Context

JobQueue must minimize both owner effort and AI usage. LinkedIn descriptions
are unstructured and inconsistent, but candidate facts, preferences, matching,
weights, and arithmetic can be represented and evaluated deterministically.
The initial implementation persisted partial search cards, produced some text
lists, and implemented detailed profile matching only for two reviewed offers.
That proves presentation concepts but is not the intended automated pipeline.

## Options Considered

- Let AI read every offer and assign a subjective total score each time.
- Keep narrative summaries and manually add matching exceptions per offer.
- Use AI once per new or changed full description to produce a validated,
  controlled schema, then use local code for matching, scoring, and ordering.

## Decision

Use this pipeline:

1. Discover LinkedIn job identifiers and URLs ephemerally.
2. Visit job details sequentially and persist an opportunity only after its
   full description and core metadata have been captured. Partial search cards
   are not review-queue opportunities.
3. Run AI once for each new or changed source hash. AI extracts concise display
   text plus canonical facts and tags with direct source evidence. It never
   assigns preference points or a total score.
4. Compare extracted requirements with structured candidate data and extracted
   project/work facts with structured preferences using local deterministic
   code. Recalculate all scores without AI whenever profile facts, preferences,
   rules, or weights change.
5. Present the fully processed queue in deterministic priority order. Unknown
   evidence stays neutral and remains visible.

The machine-readable candidate record is `profile/matching.json`. Narrative
source context remains in `profile/raw.md` and in evidence strings, but matching
must use typed fields such as practical months, autonomy, last-used year, and
professional-use status. Preference values live in
`config/preferences.json`; weights and recency bands live in
`config/scoring.json`.

## Consequences

- AI cost is paid only when a full LinkedIn description is new or changes.
- Changing a preference or candidate fact reranks every processed offer without
  spending AI tokens.
- Version 4 enforces a shared finite tag catalog for extraction and matching.
  See docs/tag-catalog.md for definitions, unknown handling and v3 compatibility.
- Existing version-2 summaries must be migrated or reprocessed once after the
  structured schema is implemented.
- The collector hydrates detail pages and does not import partial review cards.
- The two-offer pilot code has been removed. Every current extraction uses the
  same typed matcher; previously reviewed jobs remain useful validation cases.
- A simple Node process and local JSON storage are sufficient for this personal
  workload. Preserve the useful UI/persistence, not a wholesale rewrite or
  speculative services. Future providers feed the same source contract; future
  application actions remain outside extraction and scoring.
- Process saves one offer at a time (maximum two per click). This repeats CLI
  context overhead but gives real durable 1/2 progress and preserves successful
  work if the second offer fails. Never silently retry or process the backlog.
