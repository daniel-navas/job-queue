# Complete offer evaluation

Date: 2026-09-21  
Status: Implemented

## Outcome

JobQueue must distinguish source processing from evaluation completeness. A
processed description is not complete while a catalog criterion is unmapped or
the candidate profile lacks enough information to conclude whether the owner
matches it. The queue must make those gaps visible and must eventually reach a
definitive state in which every relevant criterion is either a confirmed match
or a confirmed non-match.

Completeness is about the available listing and candidate profile, not a claim
that the employer will hire the owner. It is derived locally and deterministically
and makes no AI call when profile facts, catalog mappings, preferences, or
weights change.

## User-visible states

Use one mutually exclusive evaluation state in the list-card location that
currently shows `Processed`:

- `Pending analysis`: there is no current structured extraction for the full
  description.
- `Needs info · R/T`: extraction is current, but only `R` of `T` relevant
  criteria have a definitive result.
- `Complete`: extraction is current and every relevant criterion is resolved.

A current extraction with zero relevant criteria is `Complete`: there is no
candidate fact left to collect. `Complete` describes the present source,
catalog, profile, and scoring configuration; it is recalculated rather than an
immutable historical assertion.

Do not display `Extracted`, `Evaluated`, or `Provisional`. The numeric score
remains the score supported by current facts. `Needs info` already communicates
that unresolved positive contributions may still change it.

`Closed` remains an independent availability marker. Closing an offer does not
erase its evaluation result.

## Criteria included in completeness

The denominator contains the deduplicated criteria displayed in:

- requirements, including general experience;
- nice-to-haves;
- company stack.

Company-stack technologies use the same canonical technology catalog and
candidate profile as requirements and nice-to-haves. No second vocabulary or
profile model is introduced. A stack item already represented by a requirement
or nice-to-have remains deduplicated as it is today.

New stack extraction accepts canonical technology criteria only. A concrete
technology that is not yet in the catalog remains `unknown` / `unmapped` until
catalog review. The current stored stack already contains only technology
criteria, so this restriction does not require offer migration or reprocessing.

Project/work tags are already closed enums validated against the project
catalog and require no candidate answer. They affect the score where configured
but add no completeness denominator entry. A source field that the listing does
not state, such as salary, is neutral but not unresolved: there is no candidate
question that can complete absent source information.

An extracted `unknown` / `unmapped` criterion remains in the denominator and is
unresolved until it is generically mapped or deliberately excluded as
non-differentiating under the catalog review rules.

## Tri-state candidate evaluation

Replace the binary interpretation of tag score `1`/`0` with an explicit runtime
result:

- `match`: the profile establishes every applicable threshold;
- `no-match`: complete profile facts establish that the criterion is not met;
- `unknown`: at least one fact needed for the conclusion is missing;
- `unmapped`: the extracted concept has no approved canonical representation.

The last two states are unresolved. `match` and `no-match` are resolved.

Expose the assessment alongside the existing tag data. Keep numeric compatibility
for scoring: `match` maps to `score: 1`; every other assessment maps to
`score: 0`. Completeness and visual semantics must use the assessment, never
attempt to reconstruct it from the numeric score.

This result is derived at refresh time and is not written into each queue
record. Source facts remain cached in the offer, while candidate facts remain
centralized in `profile/matching.json` and `profile/raw.md`.

### Technology criteria

For a requirement or nice-to-have alternative:

- `match` requires all published or default autonomy, duration, and recency
  thresholds to pass.
- `no-match` applies when the profile explicitly records no practical
  experience, or when all values needed for comparison are known and at least
  one threshold fails.
- `unknown` applies when the technology is absent from the profile or a value
  required by an explicit threshold is missing.

The existing negative representation is authoritative: zero practical months,
unknown autonomy, no last-used year, and `professionalUse: false` means the
owner confirmed no practical experience. It is a resolved non-match, not
missing information. Kubernetes currently has this representation.

### Capability criteria

`confirmed: false` is a resolved non-match. `confirmed: true` establishes basic
conceptual familiarity, preserving the existing profile rule, but intermediate
or advanced knowledge requires an explicit `knowledgeLevel`. Explicit autonomy,
duration, and recency thresholds require their corresponding profile values. A
missing value matters only when the listing requires that dimension.

### General experience criteria

An explicit professional-experience duration is resolved from the union of the
profile's employment periods: it is a match when the duration reaches the
published minimum and a non-match otherwise. A missing or malformed employment
history is unknown rather than a confirmed zero. Any experience concept that
cannot be represented by the approved experience catalog remains unmapped.

### OR criteria

An OR group is:

- `match` when any alternative matches;
- `no-match` when every alternative is a confirmed non-match;
- `unknown` when none matches and at least one alternative remains unknown;
- `unmapped` when the group itself lacks an approved canonical mapping.

This prevents a known negative for one family member from hiding missing
information about another acceptable alternative.

### Company stack

Stack is an optional hiring advantage, not a requirement. A stack criterion is:

- `match` when the profile confirms practical exposure at any level;
- `no-match` when the profile explicitly confirms no practical exposure;
- `unknown` when the profile has no conclusive record;
- `unmapped` when the technology is outside the approved catalog.

A stack non-match never subtracts points. It contributes zero.

## Stack score

Add a configurable `stack` weight of `0.5` in `config/scoring.json`. The stack
contribution is:

```text
confirmed stack matches / total deduplicated stack criteria × 0.5
```

Unresolved criteria remain in the denominator and currently contribute no
match credit. Resolving one as a non-match leaves the score unchanged;
resolving it as a match can increase the score. An empty stack contributes
zero. The total stack contribution can never exceed `+0.5`, so verbose listings
cannot dominate ranking.

Represent the unweighted fraction as `rating.fields.stack.score` and let the
existing weighted-total path apply the configured `0.5` weight. This preserves
the single centralized scoring mechanism and exposes the calculation in the
same tooltip format as other contributions.

## Visual language

Every displayed criterion combines color, icon, text/tooltip, and source
evidence. Color is never the only distinction.

| Result | Presentation | Meaning |
| --- | --- | --- |
| Match | Green `✓` | Confirmed qualification or optional advantage |
| Required non-match | Red `×` | Confirmed mandatory criterion not met |
| Optional non-match | Blue `–` | Confirmed nice-to-have or stack advantage not present; no penalty |
| Unknown profile fact | Amber `?` | Owner information is needed |
| Unmapped criterion | Gray `◇` | Catalog work is needed before profile matching |

Required experience uses the red non-match treatment. Nice-to-haves and company
stack use blue for confirmed non-match because they add no advantage but do not
represent a mandatory deficit. Unknown and unmapped styles are independent of
criterion group.

The list badge uses neutral styling for `Pending analysis`, amber for
`Needs info · R/T`, and green for `Complete`. Offer-level state never becomes
red merely because one required criterion is not met; the red tag already
communicates that fact.

## Detail presentation

Preserve the compact two-row offer header. Immediately below the header and
before the existing provenance/facts content, show one compact evaluation line:

```text
Evaluation · 8/10 resolved · 1 profile gap · 1 unmapped
```

Omit zero-valued segments. When complete, show `Evaluation · Complete`. The
individual amber and gray tags identify the blockers. Tooltips state the exact
reason, such as missing duration, insufficient autonomy, confirmed zero
experience, or missing catalog mapping, and retain the listing quote and profile
evidence already exposed by the tag.

`Profile gap` counts unresolved criteria, not conversational questions. One
owner answer may resolve several gaps or offers, and one OR criterion may
require asking about several alternatives together.

No profile editor, manual per-offer override, new tab, modal, or additional
dashboard is part of this change.

## Completion workflow

Unresolved items support the existing owner-question workflow rather than
creating a new automated messaging path:

1. Review unmapped criteria against catalog keys, aliases, families, and
   compatibility normalization. Add a catalog entry only through the existing
   human-reviewed process.
2. Ask at most two focused profile questions, prioritizing the highest-rated
   processed offer and reusable facts that resolve multiple offers.
3. Record positive and explicit negative answers in both profile sources.
4. Refresh the app to recompute every offer locally.

The evaluated job returned by the existing jobs API includes the offer-level
summary (`status`, resolved count, total count, profile-gap count, unmapped
count) and each tag assessment/reason. The UI and an agent inspecting the queue
consume that same derived data. JobQueue does not initiate a conversation,
schedule questions, or write profile answers itself.

The owner is never asked again for Kubernetes unless explicitly auditing the
stored answer: it is already a resolved negative fact.

## Compatibility and persistence

No SQLite migration or queue-record rewrite is required. Current version-3 to
version-6 compatibility adapters continue to supply normalized criteria.
Existing processed offers receive completeness immediately from their current
source facts and the current profile.

The feature does not reprocess the backlog, change the AI model or extraction
limit, upload the profile, open Chrome, or send additional data outside the
computer. Catalog changes that require new extraction facts continue to follow
the existing deliberate reprocessing rule.

## Verification

Automated checks must cover:

- match, confirmed non-match, unknown, and unmapped results;
- explicit zero-experience technology records such as Kubernetes;
- missing versus known threshold dimensions;
- OR groups with mixed match, non-match, and unknown alternatives;
- required red versus optional blue presentation semantics;
- stack deduplication, fractional score, empty stack, and the `+0.5` cap;
- `Pending analysis`, `Needs info · R/T`, and `Complete` derivation;
- local profile changes recomputing completeness and score without AI;
- the desktop list and detail presentation with no runtime errors.

Run `npm test` and the isolated desktop UI/API scenario. Refresh the owner's
existing Chrome page after restarting the local server; do not open the app in
Codex.

## Non-goals

- Predicting the employer's hiring probability.
- Treating the priority score as a normalized percentage.
- Penalizing absent nice-to-have or stack experience.
- Automatically adding AI-proposed catalog or profile facts.
- Editing the profile inside JobQueue.
- Re-extracting offers solely to calculate completeness.
