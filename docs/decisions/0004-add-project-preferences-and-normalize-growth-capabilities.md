# 0004: Add project preferences and normalize growth capabilities

Status: Accepted

## Context

Project scoring previously selected only the strongest project-tag signal. That
lost information when an offer independently appealed because of its audience,
domain, and assigned work. The catalog also represented A/B testing as a narrow
capability while related analytics and experimentation criteria remained
unmapped.

## Decision

Every configured project/work tag contributes algebraically to the project
score. Audience tags remain mutually exclusive, but orthogonal tags may coexist.
The initial positive tags are consumer, mixed audience, consumer credit, crypto
trading, and growth-focused work, each worth +1.

Use four capability concepts for the growth-product area: product
experimentation, analytics instrumentation, product analytics, and growth
engineering. A/B testing is an alias/example of product experimentation rather
than a standalone canonical capability. Existing source-backed cards are
normalized generically at read time; no job ID changes the result.

## Consequences

An offer can gain several points when it combines several explicitly preferred
traits. This makes the total a stronger preference-ranking signal, not a fit
probability. New positive tags must still be individually approved, because tag
volume now matters. Candidate qualification matching remains separate from
personal project/work preferences.

