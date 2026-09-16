# Separate recency, autonomy, and conceptual knowledge

## Status

Accepted

## Context

Job listings express different kinds of thresholds: hands-on duration, ability
to work independently, conceptual understanding, and how recently a skill was
used. Treating all of these as years of experience creates false precision.
Converting relative wording such as "recent" into a fixed calendar year during
AI extraction also makes cached facts become stale.

Generic expectations such as routine debugging can inflate a listing's
coverage denominator even though they do not distinguish an experienced
candidate. Specialized diagnosis and security knowledge remain meaningful.

## Options Considered

- Represent every qualification as a technology plus years of experience.
- Convert relative recency wording to an absolute year at extraction time.
- Preserve separate typed dimensions and evaluate relative time locally.

## Decision

Keep these dimensions independent:

- `minMonths` and `maxMonths` preserve explicitly published duration.
- `autonomy` describes hands-on basic, independent, or advanced execution.
- `knowledgeLevel` describes basic, intermediate, or advanced conceptual
  understanding without inventing duration.
- `lastUsedYear` preserves an explicit absolute cutoff.
- `maxYearsSinceUse` preserves relative recency. `current/currently` maps to one
  year, `recent/recently` maps to five years, and an explicit N remains exact.

Relative recency is evaluated against the current year by local code. The
five-year default is a conservative product policy informed by SFIA guidance
that contemporary skill assessment should generally focus on skills used in
the last five years, with variation by skill.

Slash-separated display labels represent one OR criterion; independent AND
requirements remain separate. Generic debugging is non-differentiating and is
excluded, while incident response, distributed diagnosis, profiling, and other
specialized debugging remain eligible.

## Consequences

- Cached extraction facts age correctly without new AI calls.
- Requirement labels can expose duration, autonomy, knowledge, and recency.
- Candidate questions about concepts use practical level examples rather than
  artificial years of use.
- Version-3 and version-4 cards require deterministic compatibility defaults;
  no backlog reprocessing is required.
- Changes to these meanings require schema, matcher, prompt, documentation, and
  regression checks to remain aligned.
