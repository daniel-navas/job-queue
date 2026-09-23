# Controlled tag catalog

The executable source of truth is `config/tag-catalog.json`. Both the extraction
schema and profile matcher consume it through `src/tag-catalog.mjs`. The worker
passes a compact rendering of its keys/definitions to AI; no profile or scores
are included. There is no second hand-maintained vocabulary in the prompt.

## Initial review

Reviewed the descriptions of all 40 complete stored listings on 2026-09-12:
JQ-001–025, JQ-041, JQ-045, and JQ-051–063. Legacy records without descriptions
were excluded. The two Sezzle ads substantially overlap, but have distinct IDs.
This is a starting vocabulary, not a claim that every requirement is covered.

Representative sources for the initial groups:

| Group | Examples | Listings |
| --- | --- | --- |
| Languages, frameworks, OR families | Node.js, NestJS, Go, JVM languages, React, ORM equivalents | 001–008, 014, 019, 022, 041, 053, 061 |
| Data and infrastructure | SQL/NoSQL, pipelines, queues, cloud services, IaC, observability | 002–004, 011, 015–020, 025, 055–063 |
| AI use versus AI engineering | Coding assistants, model integration, RAG, agents, evaluation | 008–012, 018, 024–025, 041, 055, 057 |
| Engineering capabilities | Testing subtypes, APIs, security, mentoring, explicit credentials | 001–025, 053–063 |
| Product audience | Corporate treasury; consumer purchases; internal operations | 005, 007–011, 020, 023, 051, 053 |
| Product domains | HR, education, utilities, property valuation, developer tooling | 002, 006, 018, 041, 054, 060, 063 |

The catalog contains 113 technology/tool/family keys, 76 capability keys, one
general-experience key, and 20 project keys. It also keeps
14 non-selectable commodity concepts solely so legacy output can be discarded
deterministically. Adding an entry establishes
neither candidate competence nor a preference score. Most new entries remain
unmatched until the profile supplies specific evidence. Neutral domains are
context, not automatically positive signals.

## Rules

- Technology, capability, experience and project IDs are selected from enums.
  The validator rejects unknown IDs or IDs assigned to the wrong kind.
- Display labels come from the catalog. Aliases are for deterministic legacy
  normalization, not extra AI-generated options.
- Families list explicit alternatives, not inferred mastery. PostgreSQL does
  not prove MySQL; generic AWS experience does not prove every AWS service.
- A concrete out-of-catalog criterion uses kind `unknown`, key `unmapped`, a
  short source-derived label and an exact quote. It remains in the denominator,
  with no match credit. Distinct unmapped criteria are not merged away.
- Future additions require a human-reviewed meaning, kind, label, and source
  example. Add regression cases for semantic boundaries. Do not automatically
  accept AI proposals into the catalog or candidate profile.
- Review `unmapped` criteria in compact batches through
  `docs/unmapped-review.md`, separately from routine profile questions. Search
  catalog keys, aliases, families, and compatibility normalizers before
  proposing a new concept. Do not collect a profile answer that cannot yet be
  stored or matched deterministically.
- Generic teamwork, problem solving, communication, debugging, code review, Git basics,
  Agile ceremonies, clean code, adaptability, ownership and fast-paced work
  are non-differentiating. New extraction cannot select them. The compatibility
  adapter removes recognized legacy instances from display and coverage for
  every offer. Specialized measurable criteria remain eligible.
- Catalog/label changes require a server restart. Profile/preferences/weights
  remain live on refresh. New extraction facts can require a deliberate schema
  version update; do not automatically spend AI tokens on the backlog.

## Audience correction

B2B means the assigned software primarily serves business/professional
workflows. A merchant participating in a consumer checkout/lending journey is
not sufficient. Classify the assigned product area, not who pays the employer
or the recruiting intermediary's own business.

Audience is at most one of B2B, Consumer product, Mixed audience, Internal tools.
Unknown is omitted. Domains can coexist with the audience. Consumer and mixed
audience are +1 preferences; internal tools remain neutral. Orthogonal project
tags such as consumer credit, crypto trading, and growth-focused work also add
their configured score independently.

JQ-008's existing extraction tagged both consumers and businesses from the same
consumer-and-merchant description. The generic version-3 adapter converts that
contradictory pair to Mixed audience, removing the erroneous B2B penalty without
inventing a positive score. Pure business use cases such as corporate treasury
retain B2B. New extractions use the narrower definitions and cannot emit
conflicting audience tags. This is a schema-level correction, not an ID override.

## Experience correction and compatibility

Version 4 stores minimum and published upper duration separately. Display shows
`3–7 years`; matching checks the minimum, never treats seven as a hiring ceiling.
Version-3 cards remain usable through a source-preserving adapter: canonical
aliases are resolved, unmapped criteria retained, and an explicit quoted range
is recovered only when its lower bound agrees with the stored minimum.
Original extraction data and reviews remain unchanged; no AI call is needed.

Version 5 adds relative last-use windows and conceptual knowledge levels.
`current/currently` maps to one year, `recent/recently` to five years, and an
explicit relative number remains exact. These windows are evaluated against the
current year so cached facts do not become frozen absolute dates. Conceptual
capabilities use basic/intermediate/advanced knowledge independently from
hands-on autonomy and duration. Version-3 and version-4 cards receive compatible
defaults locally; generic debugging is removed from their denominator without
an AI rerun.

## Growth-product capability boundary

Growth-related experience uses four reusable concepts rather than a separate
tag for every experiment type:

- Product experimentation covers A/B, split, multivariate and feature
  experiments plus experimentation frameworks. `ab-testing` remains an alias
  for compatibility.
- Analytics instrumentation covers event/property planning, implementation and
  validation.
- Product analytics covers funnels, conversion, retention, cohorts and
  behavioral analysis.
- Growth engineering covers activation, onboarding, lifecycle, engagement and
  conversion engineering.

An OR criterion keeps these as alternatives. For example, "A/B testing,
analytics instrumentation, or experimentation platforms" maps to Product
  experimentation | Analytics instrumentation. Source-backed stored cards are
normalized locally, including Growth-focused work when their assigned-work
evidence explicitly establishes it; no offer ID is consulted.
