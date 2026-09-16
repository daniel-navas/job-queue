# Project Context Enrichment Evaluation

Date: 2026-09-11

## Question

Would a short company lookup materially improve the product/project context in
the ten currently summarized opportunities?

An adequate card must make it possible to understand what is being built or
operated, who uses it, and its concrete purpose or benefit. It does not need to
produce a preference score. Uncertain appeal remains neutral.

## Results

| Offer | Current card adequate | LinkedIn source adequate | Short lookup changes result |
|---|---:|---:|---:|
| JQ-001 Hire Feed | No | No | No; the client is undisclosed |
| JQ-002 Sonatype | No | Yes | Not needed |
| JQ-003 Kraken | Yes | Yes | Not needed |
| JQ-004 Kake | No | No | No; the end client/product is hidden |
| JQ-005 Reap | Yes | Yes | Not needed |
| JQ-006 Deel | Yes | Yes | Not needed |
| JQ-007 remoti | No | No | No; the end client is undisclosed |
| JQ-008 Sezzle | No | Yes | Not needed |
| JQ-009 Goodway Group | No | Yes | Not needed |
| JQ-010 Chainlink Labs | Yes | Yes | Not needed |

- Current cards adequate: 4/10 (40%).
- Correct extraction from existing LinkedIn text: 7/10 (70%).
- Short company lookup after correct extraction: still 7/10 (70%); zero
  percentage-point improvement in this sample.
- The remaining 3/10 are intermediary/client-hidden roles. Looking up Hire
  Feed, Kake, or remoti describes the intermediary, not the project the owner
  would join.

Official pages checked during the sample included Sezzle, Sonatype, Deel,
Goodway Group, and remoti. They confirmed company-level product facts, but the
useful facts for the direct employers were already present in the LinkedIn
descriptions.

## Decision

Fix listing-first extraction before adding web enrichment. Do not add company
lookup to the current MVP based on this sample. If later evidence changes the
decision, trigger lookup only when project context is insufficient and the
hiring company appears to be the direct product owner; cache the result by
company. Never use additional facts to manufacture a subjective score.
