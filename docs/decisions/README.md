# Decision Records

Use this directory for consequential decisions whose rationale should survive
chat history and agent handoffs.

Create a record when future contributors may reasonably ask why a choice was
made, especially when the choice affects architecture, data ownership, safety,
compatibility, or long-term constraints. Do not create records for routine,
easily reversible implementation details.

Name records sequentially with a short descriptive title:

```text
0001-use-local-storage.md
0002-keep-domain-logic-independent-from-ui.md
```

Use this format:

```markdown
# Decision title

## Status

Proposed | Accepted | Superseded

## Context

What problem or constraint requires a decision?

## Options Considered

What realistic alternatives were evaluated?

## Decision

What was chosen and why?

## Consequences

What benefits, costs, constraints, and follow-up work result?
```

When a decision changes, preserve the old record and mark it `Superseded`, then
link to the replacement record.

