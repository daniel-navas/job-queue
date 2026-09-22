# Dynamic classifier-payload spike

Status: planned. This is an experiment, not a production change.

## Question

Can a deterministic local retrieval step send the classifier a smaller,
job-relevant subset of the tag catalog while preserving source-reviewed
extraction quality and reducing subscription usage?

## Scope

- Keep one full job description per classifier call, the same schema, model,
  prompt rules, and source-evidence requirements as the baseline.
- Do not process or import queue records, change production prompts, open
  Chrome, activate paid API billing, or add a background processor.
- Use synthetic fixtures first. A frozen real-source sample requires explicit
  owner approval under `docs/quality.md`.

## Candidate retrieval design

Build a local index from canonical keys, labels, definitions, family members,
and only review-confirmed aliases. For a job description, select concepts by
deterministic lexical evidence and include their complete families. Keep the
ordinary `unknown` / `unmapped` fallback, so the model is never forced to fit a
criterion into the shortlist.

Compare at least these variants:

1. **Baseline:** current complete compact catalog.
2. **Retrieved catalog:** locally selected candidates plus their families and a
   fixed small core of high-frequency engineering concepts.
3. **Retrieved catalog with reviewed aliases:** same as #2, including aliases
   only for selected canonical concepts.

## Measurements and acceptance gate

For the same frozen inputs, record payload characters/tokens, output usage,
elapsed classifier time, valid-schema rate, and source-reviewed semantic
outcomes. Compare missing correct tags, wrong canonical tags, false
`unmapped`, and invented evidence against the full-catalog baseline.

Do not adopt a variant merely because it is smaller. It must show a material
usage reduction with no new source-reviewed semantic regression. If retrieval
misses a relevant concept, the safe result is to keep the full catalog rather
than widen production heuristics without evidence.

## Requirement-logic companion check

The spike must freeze paired examples where a listing says either “A or B” and
where it independently requires “A and B”. The classifier should preserve that
source meaning in its structured output. This is prompt and evaluation work,
not model training and not a request to create combined catalog tags.
