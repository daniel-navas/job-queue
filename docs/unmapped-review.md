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
   When an unmapped source label is unconditionally the same meaning as an
   existing canonical tag, record it as a reviewed alias. The compact catalog
   supplied to the AI must include that alias so it can choose the canonical key
   from the source context in future extractions. Do not add speculative aliases
   merely because they might be useful, and do not automatically rewrite an
   extraction merely because its raw text contains an alias.
4. Present one compact, stably numbered proposal covering every candidate. The
   owner can identify objections by number. During that objection window, an
   item the owner does not mention is approved; apply it with the rest of the
   batch. Do not require one-by-one confirmation.
5. Record approved decisions in `config/unmapped-review.json`, update the
   catalog/extraction prompt/profile as appropriate, and add boundary regression
   tests. Apply an approved mapping to the reviewed stored criterion explicitly;
   the presence of an alias alone never authorizes a raw-text reassignment.
   An alias needs evidence of unconditional semantic equivalence; a narrower or
   context-dependent phrase remains a source example rather than an alias.
   Decisions must be generic and source-based, never per-offer exceptions.

Decision states are `proposed`, `applied`, `deferred`, and `reopened`.
Only `applied` fingerprints leave the pending inventory. `proposed`, `deferred`
and `reopened` remain pending: a deferred item means its correct representation
is not implemented yet, not that it has been resolved. Stored decisions make
later cycles incremental, which is the main usage optimization: the model sees
new or unresolved candidates, not the entire historical backlog.

Routine profile-completion questions stay separate. Once a reviewed criterion
has a canonical tag, it can enter the normal highest-rated-offer question flow.
Questions must name that exact tag ID and catalog label.
