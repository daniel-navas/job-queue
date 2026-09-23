# Current TODOs

1. **Complete and apply the remaining pending-tag batch.** Resolve the remaining
   owner objections in `docs/unmapped-review-proposal.md`, then update the
   catalog, current stored facts, tests, and profile-question flow generically.
2. **Model non-skill eligibility requirements.** Decide where timezone overlap,
   location, work authorization and similar constraints belong so they remain
   visible without becoming technology or capability tags.
3. **Send reviewed aliases to the classifier.** Render only aliases confirmed by
   review in the compact catalog payload. They guide the AI's classification;
   they must not trigger raw-text auto-assignment.
4. **Run the dynamic classifier-payload spike.** Evaluate a smaller
   locally-retrieved catalog payload against the full-catalog baseline before
   any production change. See `docs/dynamic-classifier-payload-spike.md`.
5. **Evaluate requirement alternatives and conjunctions.** Freeze examples
   where a vacancy permits alternatives versus independently requires multiple
   skills, then verify the classifier preserves that meaning.
6. **Complete the bounded AI-provider experiment only with owner approval.**
   Follow `docs/ai-provider-plan.md`; do not process queue records or enable
   paid API billing during it.
