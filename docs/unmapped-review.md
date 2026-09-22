# Pending tag review

Processed offers can contain concrete criteria that do not yet have a canonical
entry in `config/tag-catalog.json`. The classifier stores those criteria as
`unknown` / `unmapped`, preserving a short source-derived label and exact offer
evidence. They remain visible and receive no match credit until reviewed.

## Cheap local trigger

The application inventories distinct pending criteria locally. It fingerprints
the criterion group, normalized label, evidence, and matching thresholds, then
deduplicates repeated occurrences across offers. This reads SQLite and
`config/unmapped-review.json`; it does not open Chrome, call a model, send data
off the computer, or modify offers.

```sh
node scripts/unmapped-review.mjs --status
node scripts/unmapped-review.mjs --report
```

`--status` returns only the pending count, threshold, and recommendation.
`--report` returns the compact source-backed candidates and their occurrences.
The default threshold is 20 distinct pending fingerprints. At or above it, JQ
shows a passive `N tags pending review` message in the existing header status
space. The message is deliberately not clickable or actionable.

The owner can start the AI-assisted work by asking **“revisa los unmapped”** or
**“haz una revisión de tags pendientes”**. No scheduled or background model run
is used, so merely reaching the threshold consumes no Codex usage.

## Review cycle

1. Run the local report and process only pending fingerprints. Do not resend
   full offer descriptions or the candidate profile to a model.
2. Group equivalent concepts across offers and compare them with catalog keys,
   aliases, families, and compatibility normalization.
3. Review the entire pending batch autonomously. For each group, decide whether
   to map an existing tag, create a canonical tag, split distinct meanings,
   exclude a non-differentiating criterion, or keep it unmapped until there is
   enough evidence. Do not interrupt the cycle for item-by-item approval.
4. Present one compact, stably numbered proposal covering every candidate. The
   owner can identify objections by number. Do not apply semantic catalog or
   profile decisions until that batch-level objection window is complete.
5. Record approved decisions in `config/unmapped-review.json`, update the
   catalog/normalizer/profile as appropriate, and add boundary regression tests.
   Decisions must be generic and source-based, never per-offer exceptions.

Decision states are `proposed`, `applied`, `deferred`, and `reopened`.
`applied` and `deferred` fingerprints leave the pending inventory; `proposed`
and `reopened` remain pending. Stored decisions make later cycles incremental,
which is the main usage optimization: the model sees new or reopened candidates,
not the entire historical backlog.

Routine profile-completion questions stay separate. Once a reviewed criterion
has a canonical tag, it can enter the normal highest-rated-offer question flow.
Questions must name that exact tag ID and catalog label.
