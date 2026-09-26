# Quality And Verification

Quality means producing evidence that the requested outcome works while keeping
verification proportional to the risk of the change.

## Definition Of Done

A change is complete when:

- The requested behavior is implemented within the agreed scope.
- Relevant existing behavior is preserved.
- Appropriate verification has run and its result is known.
- Durable documentation is updated when the change makes it inaccurate.
- Remaining uncertainty, unverified behavior, or follow-up work is stated
  clearly.

## Risk-Based Verification

Use the lightest verification that provides credible evidence:

- Low risk: inspect the change and run a focused check when available.
- Medium risk: run focused tests plus the project's standard validation.
- High risk: use representative fixtures or scenarios, regression tests, and
  end-to-end or visual verification as appropriate.

Risk increases for destructive operations, migrations, security or privacy
boundaries, external data parsing, financial or numerical logic, concurrency,
and changes that affect many downstream behaviors.

## Regression Practice

When fixing a reproducible bug or a corrected product rule:

1. State the expected behavior in observable terms.
2. Add the smallest reliable regression check when practical.
3. Prefer behavioral assertions over internal implementation snapshots.
4. Verify that the check would detect the original failure.

Do not create brittle tests merely to increase test count. Some visual,
exploratory, or judgment-heavy behavior may require a documented scenario and
human inspection instead.

Run `node scripts/classifier-eval.mjs` for the synthetic live semantic eval
(uses subscription tokens), or `--audit REPORT` for offline output review.
Real-source runs additionally require explicit owner approval. Freeze reviewed
expectations before changing prompts; extend them when source review catches
an omission. Passing targeted checks is not a universal quality guarantee.

Behavioral tests use synthetic inputs from `test-support/fixtures.mjs`, not the
owner's editable profile or preference values. Check real configuration for
valid structure and catalog references, not exact experience durations, prose
or chosen scores. Group repeated threshold checks into named table cases while
keeping distinct domain rules (such as family versus vendor knowledge) explicit.

Use `npm test` for local rules and persistence. Run
`node scripts/searches-check.mjs` for isolated UI/API scenarios with temporary
profile, scoring and queue data. That scenario also verifies development-mode
browser reload and preservation of an unsaved Profile selection.
`node scripts/browser-check.mjs` is a read-only
smoke check against the running app; it requires a new processed salary offer,
but must not assume a particular JQ ID or fixed personal match coverage.
Verify desktop workflows. The small-device fallback is only a scaled desktop
viewport; check that mechanism when changing it, not a recurring mobile suite.

## Reproducibility

For complex or judgment-sensitive behavior, prefer reproducible inputs such as
fixtures, scenario generators, seed values, saved states, or shareable links.
Keep evaluation mechanics deterministic where possible, and keep human or AI
judgment explicit when it cannot be automated reliably.

For AI performance experiments, freeze the source sample and record the prompt,
schema, model/settings and usage alongside timings. Compare equal samples;
exclude interrupted runs from speed claims. Check meaning and omissions against
the source, not just valid JSON or another model's answer. Import experimental
results only after review, preserving existing decisions and source hashes.
Before live model trials, bound the number of calls and check current subscription
usage. Stop trials once the evidence supports a decision or the planned usage
budget is reached. A model's lower token or credit rate alone does not establish
that it can process the backlog within the account's time-window limits.

## Reporting

Final work summaries should distinguish:

- What changed.
- What was verified and how.
- What was not verified.
- Any remaining material risk.
