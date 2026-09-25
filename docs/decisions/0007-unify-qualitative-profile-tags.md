# Unify qualitative profile tags

## Status

Accepted

## Decision

Technologies and engineering knowledge share one canonical tag namespace.
Candidate tags use one qualitative value: none, basic, independent, or
advanced. Genuine binary qualifications use none or present. Missing tags are
unknown. General professional tenure remains separate and is calculated from
employment periods.

Listings retain explicit duration for display. When no explicit level is
stated, local matching maps up to 12 months to basic, 13–48 months to
independent, and more than 48 months to advanced. An explicit level takes
precedence. A requirement with neither duration nor level defaults to basic.
Recency is not part of matching.

## Consequences

- Mixed alternatives such as Python | data engineering are ordinary OR tags.
- Candidate profiles no longer store duration, recency, narrative evidence, or
  separate autonomy and conceptual-knowledge scales.
- Existing summaries are normalized locally without AI calls or data rewrites.
- Published duration remains visible but is not compared directly with the
  candidate profile.
