# Instructions for AI Agents

All project files must be written in English. The user may speak Spanish and
may use voice dictation. Infer likely transcription errors from context before
asking for clarification. Ask only when ambiguity could materially change the
result.

## Start Here

For non-trivial work, read in this order:

1. `docs/project.md` for product purpose, scope, and constraints.
2. `docs/ai-context.md` for the current working state.
3. `docs/quality.md` for verification expectations.
4. Relevant records in `docs/decisions/` when prior rationale matters.

If `docs/project.md` is marked `Uninitialized`, treat the first substantive
request as project initialization. Infer the project name from the root folder,
replace the starter content in `README.md` and `docs/project.md`, and record the
initial working state in `docs/ai-context.md`. Do not choose a language, stack,
architecture, or dependency until the product need justifies it.

## Working Principles

- Inspect the repository before proposing or changing implementation.
- Lead with the intended outcome and keep communication concise.
- Make the smallest coherent change that satisfies the current requirement.
- Prefer existing project patterns once they exist.
- Do not add features, abstractions, dependencies, or infrastructure for
  hypothetical future needs.
- Preserve unrelated user changes.
- Do not perform destructive actions or modify user data without clear
  authorization.
- Distinguish observed facts, inferences, decisions, and unresolved questions.
- Never claim that behavior was verified when it was not.
- Verify changes in proportion to their risk and report the evidence.

## Durable Project Memory

Chat history is not a durable source of truth. Store reusable knowledge in the
repository, in the narrowest appropriate location:

- `docs/project.md`: stable product purpose, scope, and constraints.
- `docs/ai-context.md`: concise current state and handoff information.
- `docs/quality.md`: durable quality and verification policy.
- `docs/decisions/`: consequential decisions and their rationale.
- Tests or executable checks: behavior that can be verified automatically.
- Domain documentation: specialized judgment that does not belong elsewhere.

Avoid duplicating the same rule across files. Update the authoritative source
instead.

## Learning From Corrections

When the user corrects an agent:

1. Apply the correction to the current work.
2. Extract a concise principle only if it is likely to matter again.
3. Store it in the appropriate durable source.
4. Add a regression test or executable check when the expected behavior can be
   stated reliably.

Preserve the reusable judgment, not the conversation transcript. Do not turn a
provisional preference or one-off observation into a permanent rule.

## Documentation Discipline

- Keep `docs/ai-context.md` short, current, and useful for the next agent.
- Move stable product rules to `docs/project.md`.
- Use a decision record only when future contributors may reasonably ask why a
  consequential choice was made.
- Update durable documentation in the same change that makes it outdated.
- Remove superseded current-state notes instead of accumulating a diary.

## Cross-Conversation Workstreams

The owner may alternate between two conversations that share this repository:

- Light: profile/preferences calibration, offer-tag review, scoring tuning,
  documentation, and small process or matcher corrections.
- Heavy: new systems, architecture, substantial features, migrations, or broad
  UI/implementation work.

Treat repository documentation as the handoff between both conversations.
Before substantive work, read `docs/project.md`, `docs/ai-context.md`, and any
relevant decision records; after work, update the narrow authoritative source
and replace stale handoff facts. Never rely on the other conversation's chat
history. Avoid simultaneous overlapping edits; inspect current files again
before modifying shared profile, scoring, schema, or context files.
