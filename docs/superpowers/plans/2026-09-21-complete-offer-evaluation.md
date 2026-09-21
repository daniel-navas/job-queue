# Complete Offer Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show whether every hiring-relevant criterion has a definitive candidate result, score confirmed company-stack familiarity, and distinguish match, non-match, missing profile information, and unmapped criteria.

**Architecture:** Extend the pure local matcher so every displayed tag carries an assessment in addition to its compatible numeric score. Derive offer-level completeness and stack contribution in `evaluateJob`, return them through the existing jobs API, and render one compact lifecycle badge plus contextual tag styles in the existing desktop UI.

**Tech Stack:** Node.js ES modules, built-in test runner, JSON configuration, SQLite-backed existing queue, vanilla browser JavaScript/CSS, Playwright UI scenario.

**Spec:** `docs/superpowers/specs/2026-09-21-complete-offer-evaluation.md`

## Global Constraints

- Use only local deterministic code; no AI call, queue rewrite, migration, browser launch, or new dependency.
- Preserve the current source-backed facts, review state, availability state, and score meanings outside the new stack contribution.
- Use `Pending analysis`, `Needs info · R/T`, and `Complete`; do not display `Extracted`, `Evaluated`, or `Provisional`.
- Stack familiarity contributes at most `+0.5`, never subtracts, and reuses the canonical technology catalog/profile.
- Preserve the compact two-row offer header and desktop-only layout.
- Update durable docs and exclude unrelated dirty profile, catalog, queue, and search-run changes from commits.

## Review Focus

- An explicit zero-experience record must be a resolved non-match, while a missing technology must remain unknown.
- An OR group with one known non-match and one missing alternative must remain unknown; one match resolves the group.
- Capability confirmation supplies basic conceptual familiarity but not missing intermediate/advanced knowledge or typed thresholds.
- An empty criteria set must be complete, while any unmapped item must block completion.
- Stack duplicates already represented by requirements/nice-to-haves must neither score nor count twice.

---

### Task 1: Tri-state matching and completeness

**Files:**
- Modify: `src/matching.mjs`
- Modify: `src/evaluate.mjs`
- Test: `test/matching.test.mjs`
- Test: `test/tag-catalog.test.mjs`

**Interfaces:**
- Produces: `matchRequirement(requirement, profile, currentYear, options)` returning existing `label`, `score`, `evidence`, and `source` plus `assessment: "match" | "no-match" | "unknown" | "unmapped"`.
- Produces: `evaluationProgress(job, tags)` returning `{ status, resolved, total, profileGaps, unmapped }`.
- Consumes: current catalog aliases/families, typed profile values, normalized summary facts, and current processing status semantics.

- [ ] **Step 1: Write failing matcher tests**

Add literal cases proving:

```js
assert.equal(matchRequirement(requirement('kubernetes'), explicitNoProfile).assessment, 'no-match');
assert.equal(matchRequirement(requirement('kubernetes'), missingProfile).assessment, 'unknown');
assert.equal(matchRequirement(requirement('kubernetes'), matchingProfile()).assessment, 'no-match');
assert.equal(matchRequirement(requirement('unmapped', { kind: 'unknown' }), profile).assessment, 'unmapped');
```

Add OR cases for all-no, mixed unknown/no, and one match; add capability cases for `confirmed: false`, implicit basic knowledge, missing advanced knowledge, and missing typed thresholds.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/matching.test.mjs test/tag-catalog.test.mjs`
Expected: FAIL because `assessment` and tri-state aggregation do not exist.

- [ ] **Step 3: Implement tri-state assessment without changing match credit**

Refactor `matchRequirement` around per-alternative assessment helpers. Preserve `score: assessment === 'match' ? 1 : 0`, existing labels, evidence, family expansion, capability-backed technology handling, relative recency, and threshold comparisons. Use the stack option to require only confirmed practical exposure rather than the default independent-autonomy threshold.

- [ ] **Step 4: Write failing completeness tests**

Exercise:

```js
assert.deepEqual(evaluationProgress(processed, resolvedTags), {
  status: 'complete', resolved: 2, total: 2, profileGaps: 0, unmapped: 0
});
assert.equal(evaluationProgress(processed, mixedTags).status, 'needs-info');
assert.equal(evaluationProgress(pending, null).status, 'pending-analysis');
assert.equal(evaluationProgress(processed, emptyTags).status, 'complete');
```

- [ ] **Step 5: Run focused tests and verify RED**

Run: `node --test test/matching.test.mjs`
Expected: FAIL because `evaluationProgress` does not exist.

- [ ] **Step 6: Implement `evaluationProgress` and expose it from `evaluateJob`**

Flatten required, preferred, experience, and deduplicated stack tags. Count match/no-match as resolved, unknown as `profileGaps`, and unmapped separately. Return `{ ...job, tags, evaluation, projectTags, rating, monthlySalary }`.

- [ ] **Step 7: Run focused tests and commit**

Run: `node --test test/matching.test.mjs test/tag-catalog.test.mjs`
Expected: PASS.

Commit only Task 1 files with message `Add complete evaluation assessments`.

### Task 2: Stack familiarity contribution

**Files:**
- Modify: `src/evaluate.mjs`
- Modify: `config/scoring.json`
- Modify: `test-support/fixtures.mjs`
- Test: `test/matching.test.mjs`
- Test: `test/profile.test.mjs`

**Interfaces:**
- Consumes: `tags.stack` assessments from Task 1.
- Produces: `rating.fields.stack` with an unweighted matched fraction, reason, configured weight `0.5`, and contribution capped by that weight.

- [ ] **Step 1: Write failing stack-score tests**

Use fixed fixtures to assert zero for empty stack, `0.5` contribution for all matched, `0.25` for one of two matched, zero contribution for explicit non-match, unknown blocking completeness, and no duplicate stack entry when the same catalog technology is required.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/matching.test.mjs test/profile.test.mjs`
Expected: FAIL because stack has no rating field or configured weight.

- [ ] **Step 3: Implement stack scoring through the existing weighted path**

Set `rating.fields.stack = { score: coverageScore(tags.stack), reason: "M/N confirmed stack advantages; optional non-matches and unresolved facts receive no advantage credit." }`, add `"stack": 0.5` to scoring weights and synthetic evaluation config, and let the existing weight/contribution loop calculate the capped value.

- [ ] **Step 4: Run focused tests and commit**

Run: `node --test test/matching.test.mjs test/profile.test.mjs`
Expected: PASS.

Commit only Task 2 files with message `Score confirmed stack familiarity`.

### Task 3: Evaluation lifecycle and contextual tag UI

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`
- Modify: `scripts/searches-check.mjs`

**Interfaces:**
- Consumes: `job.evaluation` and each tag's `assessment` from Tasks 1-2.
- Produces: one list-card lifecycle badge, one detail evaluation line, and group-aware tag classes/labels.

- [ ] **Step 1: Add failing browser assertions**

Extend the isolated scenario with fixtures containing match, required non-match, optional non-match, unknown, and unmapped tags. Assert exact text for `Pending analysis`, `Needs info · R/T`, and `Complete`; assert the detail summary counts and accessible names/classes for green check, red cross, blue dash, amber question mark, and gray diamond.

- [ ] **Step 2: Run the UI/API scenario and verify RED**

Run: `node scripts/searches-check.mjs`
Expected: FAIL because evaluation lifecycle text and contextual classes are absent.

- [ ] **Step 3: Render the lifecycle and summary**

Replace `processingBadge` output with evaluation-driven copy. Render below the header:

```text
Evaluation · 8/10 resolved · 1 profile gap · 1 unmapped
```

Omit zero segments and render `Evaluation · Complete` when complete.

- [ ] **Step 4: Render group-aware assessment chips**

Pass the field group into `tagsHTML`. Render `match` as green `✓`, required/experience non-match as red `×`, preferred/stack non-match as blue `–`, unknown as amber `?`, and unmapped as gray `◇`. Preserve source/profile evidence in accessible tooltip text and do not rely on color alone.

- [ ] **Step 5: Run the UI/API scenario and commit**

Run: `node scripts/searches-check.mjs`
Expected: PASS with no page errors.

Commit only Task 3 files with message `Show offer evaluation completeness`.

### Task 4: Durable rules and complete verification

**Files:**
- Modify: `docs/project.md`
- Modify: `docs/preferences.md`
- Modify: `docs/ai-context.md` (local ignored handoff state)
- Test: all existing tests and UI/API scenario

**Interfaces:**
- Consumes: shipped behavior from Tasks 1-3.
- Produces: current authoritative product rules and verification evidence.

- [ ] **Step 1: Update authoritative documentation**

Document the three lifecycle labels, completeness denominator, four assessment outcomes, contextual color meanings, local recalculation, stack `+0.5` cap, and explicit-negative interpretation. Replace the old rule that `Processed` means both extraction and deterministic matching.

- [ ] **Step 2: Run full verification**

Run: `npm test`
Expected: all tests pass with zero failures.

Run: `node scripts/searches-check.mjs`
Expected: availability, searches, evaluation lifecycle, tag semantics, and browser runtime checks pass.

Run: `git diff --check`
Expected: no whitespace errors.

- [ ] **Step 3: Inspect scope and commit**

Inspect staged and unstaged diffs. Exclude `data/queue.json`, `docs/tag-catalog.md`, `profile/matching.json`, and untracked search-run manifests unless a line was intentionally changed for this feature. Commit documentation and any final test adjustment with message `Document complete offer evaluation`.

- [ ] **Step 4: Restart and hand off**

Restart the local `npm start` process so the existing Chrome page can load the new server code, verify the jobs endpoint read-only, push `main` to `origin`, and tell the owner to refresh Chrome. Report what was and was not verified.
