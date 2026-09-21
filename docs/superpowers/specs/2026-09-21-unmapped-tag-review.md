# Batched unmapped-tag review

Date: 2026-09-21
Status: Awaiting owner review

## Outcome

JobQueue must preserve concrete criteria that the controlled catalog cannot yet
represent, while giving the owner a low-usage way to improve that catalog over
time. The application will count new review candidates locally and show a
passive notice only when a useful batch has accumulated. Catalog review happens
in a dedicated Codex conversation, never inside JobQueue and never
automatically.

The first delivery includes the mechanism and a review proposal covering all
currently stored unmapped criteria. Later cycles analyze only new or materially
changed candidates. No review decision becomes canonical without owner approval
under the current policy.

## Existing extraction boundary

The extraction worker already receives the complete controlled catalog. It
must select a canonical technology, capability, experience, or project key when
the source supports one. A concrete, differentiating criterion outside that
vocabulary remains:

```json
{
  "kind": "unknown",
  "alternatives": ["unmapped"],
  "label": "Source-derived human label",
  "evidence": "Exact contiguous source quote"
}
```

`unmapped` is a storage fallback, not a candidate-profile tag. The label is a
compact description of the criterion, not a stable identity. Generic hiring
rhetoric and non-differentiating professional hygiene remain excluded rather
than becoming review candidates.

Capturing an unmapped criterion adds no AI call: it is part of the existing
per-offer extraction result. This feature does not change the two-offer Process
limit, classifier model, extraction prompt boundary, or subscription-only
provider policy.

## Usage policy

All inventory, counting, exact deduplication, status calculation, and decision
lookup run in local deterministic code. They consume no Codex usage and send no
data away from the computer.

Codex usage occurs only when the owner explicitly requests a review. That
review receives one compact batch containing the unresolved criteria, their
typed thresholds, frequency, offer references, and exact evidence. It does not
receive full job descriptions, the candidate profile, ratings, or unrelated
queue data.

Reviews are batched rather than mixed into every profile conversation. Use a
fresh, focused Codex conversation when practical so the model does not retain a
large unrelated context. Previously reviewed candidates are cached in the
decision registry and are not analyzed again unless their source-backed
identity changes or the owner deliberately reopens the decision. No scheduled,
background, or asynchronous model call is introduced.

The initial review processes the current backlog regardless of the threshold.
Afterward, recommend another review when at least 20 distinct unreviewed
candidate fingerprints exist. This is a notification threshold, not an
automatic action. The threshold is stored with the review state so it can be
changed without editing application code.

## Candidate identity and inventory

Add a local inventory module consumed by both the command-line review tool and
the jobs API. It reads current summaries from authoritative SQLite storage and
collects `unknown` criteria from requirements, nice-to-haves, and company
stack.

Each occurrence retains:

- criterion group;
- source-derived label;
- exact evidence;
- all explicit duration, autonomy, knowledge, and recency thresholds;
- stable LinkedIn ID and append-order JQ reference;
- title and company for human context.

The candidate fingerprint is a hash of the normalized criterion group, label,
evidence, and typed thresholds. It never includes the JQ reference, company,
score, candidate profile, or review decision. Identical occurrences therefore
share one candidate while materially different evidence remains reviewable.

Deterministic inventory output groups identical fingerprints and reports their
occurrence count and offer references. Semantic grouping across different
fingerprints is a review-time judgment performed by Codex and approved by the
owner; the local script must not pretend that similar wording proves identical
meaning.

## Durable review state

Store workflow state in `config/unmapped-review.json` with this conceptual
shape:

```json
{
  "schemaVersion": 1,
  "reviewThreshold": 20,
  "decisions": [
    {
      "id": "stable-review-id",
      "status": "applied",
      "action": "map-existing",
      "target": { "kind": "capability", "key": "example-key" },
      "fingerprints": ["sha256"],
      "rationale": "Human-reviewed reusable meaning and boundary.",
      "reviewedAt": "2026-09-21"
    }
  ]
}
```

Allowed decision statuses are:

- `proposed`: Codex has produced a recommendation but the owner has not
  approved it;
- `applied`: the owner approved it and any required catalog, normalization,
  documentation, and regression changes are present;
- `deferred`: the owner reviewed it but wants more examples before deciding;
- `reopened`: a prior decision must return to the next review batch.

Allowed actions are:

- `map-existing`: map the semantic cluster to an existing canonical tag;
- `create-canonical`: add a reusable catalog tag with a reviewed boundary;
- `split`: separate a composite criterion into independently checkable concepts;
- `exclude`: remove a generic, non-differentiating, or otherwise invalid
  criterion from the denominator;
- `keep-unmapped`: retain a concrete one-off criterion without expanding the
  shared vocabulary.

Only `applied` and `deferred` decisions suppress unchanged fingerprints from
the pending count. A `proposed` or `reopened` decision remains pending. The
registry is workflow memory, not scoring input: it cannot directly award a
match, remove a denominator entry, or rewrite an offer. Runtime behavior changes
only through the controlled catalog and generic compatibility normalization,
with tests.

## Local review command

Add `node scripts/unmapped-review.mjs` with two read-only modes:

- `--status` prints the number of distinct unreviewed candidates, the threshold,
  and whether review is recommended;
- `--report` prints compact structured JSON for the pending batch, suitable for
  a dedicated Codex review conversation.

The command reads SQLite, current summary compatibility rules, the tag catalog,
and the decision registry. It does not invoke a model, mutate the queue, alter
the profile, or write review decisions. Unknown arguments and malformed review
state fail closed with an actionable error.

The user-facing name of the process is **pending tag review**. Requests such as
“review pending tags,” “review the unmapped criteria,” or “run the catalog
review” refer to this process.

## Review conversation

A review conversation follows this sequence:

1. Run the compact report and inspect the current catalog, aliases, families,
   non-differentiating concepts, and compatibility normalizers.
2. Group candidates by reusable meaning. Preserve conflicting thresholds or
   genuinely different concepts as separate candidates.
3. For every group, recommend one allowed action and provide the relevant
   source examples, proposed canonical kind/ID/label/definition when applicable,
   and a concise semantic boundary.
4. Ask the owner only about decisions that require judgment. Do not ask for
   candidate-profile experience until a criterion has an approved canonical
   representation that can be matched deterministically.
5. Record approved decisions. Apply runtime changes generically and add boundary
   regression tests. Never use a LinkedIn ID or JQ reference as a matching
   exception.
6. Regenerate the report. Applied mappings and exclusions must disappear from
   the pending inventory; deferred unchanged candidates remain suppressed.

AI suggestions are advisory. The owner may later authorize autonomous decisions
through a separate explicit policy change, but that is not part of this design.

## Passive JobQueue notice

The jobs API exposes a derived catalog-review summary:

```json
{
  "pending": 23,
  "threshold": 20,
  "recommended": true
}
```

When `recommended` is true, use the existing compact header-message area to
show plain text such as `23 tags pending review`. The notice is not clickable,
has no tooltip action, opens no dialog, and adds no status row. It disappears
when the pending count falls below the configured threshold.

Active search, processing, connection, and error messages take precedence over
this passive notice. The pending-tag message returns when the operational
message clears; it must never obscure work in progress or an actionable error.

The count is computed locally during the normal jobs response. It makes no AI
call, does not open Chrome, and does not expose queue data outside the computer.
The interface does not explain the review workflow; durable documentation and
the owner’s explicit chat request remain the entry point.

A malformed review registry makes the command exit nonzero. The jobs API must
still return the queue: it omits the ancillary catalog-review summary and logs
the configuration problem instead of presenting a false count or blocking job
review.

## Profile-question workflow

Routine profile completion remains separate from catalog maintenance. A profile
conversation asks at most two questions, names canonical IDs and human labels,
checks complete family membership, and never repeats recorded facts except for
an explicit audit.

It may mention the passive pending count, but it does not analyze candidates or
spend one of the two profile questions on catalog review. The owner starts a
dedicated pending-tag review when convenient. After a tag becomes canonical,
later profile sessions may ask for the minimum duration, autonomy, recency, or
conceptual level needed to match it.

## Initial backlog cycle

After the mechanism is implemented and verified, generate one compact report
for every currently pending unmapped criterion. Produce a human-reviewable
proposal covering all candidates, grouped by meaning and action. Do not apply
semantic decisions until the owner approves them.

The initial proposal must distinguish at least:

- candidates that clearly map to existing catalog concepts;
- clusters that justify a new reusable canonical concept;
- composite criteria that must be split;
- non-differentiating or malformed extraction that should be excluded;
- concrete one-off criteria that should remain unmapped or deferred.

This first cycle establishes the reference decisions used to assess whether a
less capable or more autonomous reviewer could safely handle later batches.

## Documentation and handoff

Add `docs/unmapped-review.md` as the authoritative operating procedure. Link it
from the catalog documentation and the project context without copying its
rules. Update profile-interaction documentation to state that unmapped review is
batched separately rather than performed during every response.

The operating document must explain what leaves the computer: only the compact
pending batch when the owner starts a Codex review. Ordinary counting, display,
matching, and reranking remain local.

## Verification

Automated checks must cover:

- deterministic fingerprints and exact-occurrence aggregation;
- separation of semantically different evidence or thresholds;
- applied/deferred suppression and proposed/reopened visibility;
- malformed registry failure;
- threshold boundaries at 19 and 20 pending candidates;
- status and report output without writes or model invocation;
- API summary derivation from current SQLite and normalization state;
- malformed review state leaving the ordinary queue API usable while omitting
  the passive summary;
- passive notice hidden below threshold and visible at threshold;
- no clickable control, dialog, or additional header row;
- approved generic mappings or exclusions disappearing from the report;
- profile and scoring inputs remaining untouched by inventory generation.

Run `npm test` and the isolated desktop UI/API scenario. Browser automation is
needed only for local verification of the passive notice; ordinary operation
does not launch Chrome.

## Non-goals

- A review dashboard, editor, modal, or actionable JobQueue control.
- Automatic model calls, schedules, reminders, or background review.
- Automatic promotion of AI suggestions.
- A second tag vocabulary outside the controlled catalog.
- Per-offer score exceptions or review decisions used directly as scoring data.
- Full-description reprocessing solely because a catalog decision changed.
- Uploading the candidate profile or unrelated queue data for catalog review.
