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
   Handle equivalent wording through the reviewed-alias flow below.
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

## Reviewed-alias flow

An alias fixes a naming mismatch without creating a duplicate tag:

1. An offer uses wording such as `NodeJS`.
2. If the classifier cannot confidently connect it to the canonical `nodejs`
   tag (`Node.js`), it returns the criterion as `unmapped`. It must not create a
   new canonical tag by itself.
3. Review confirms whether `NodeJS` always has the same meaning as `nodejs`. If
   so, save `NodeJS` as a reviewed alias and explicitly map the already-reviewed
   criterion to `nodejs`. If the meaning depends on context, do not make it an
   alias.
4. Future classifier payloads include the reviewed alias beside `nodejs`. This
   helps the AI select the existing canonical tag from the full sentence.

An alias is classifier guidance, not a raw-text rule: seeing `NodeJS` in text
must not assign `nodejs` automatically. Do not create speculative aliases before
an actual naming mismatch appears in review. Aliases do not modify the candidate
profile.

Decision states are `proposed`, `applied`, `deferred`, and `reopened`.
Only `applied` fingerprints leave the pending inventory. `proposed`, `deferred`
and `reopened` remain pending: a deferred item means its correct representation
is not implemented yet, not that it has been resolved. Stored decisions make
later cycles incremental, which is the main usage optimization: the model sees
new or unresolved candidates, not the entire historical backlog.

Routine profile completion stays separate. Once review maps a criterion to a
canonical tag that is absent from the profile, it enters the local Profile
Missing queue. Unmapped criteria remain visibly separate and cannot be
answered in Profile.
