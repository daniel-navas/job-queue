# Current TODOs

1. **Model non-skill eligibility requirements.** Decide where timezone overlap,
   location, work authorization and similar constraints belong so they remain
   visible without becoming skill tags. Include the pending
   PST-overlap review item.
2. **Send reviewed aliases to the classifier.** Render only aliases confirmed by
   review in the compact catalog payload. They guide the AI's classification;
   they must not trigger raw-text auto-assignment.
3. **Run the dynamic classifier-payload spike.** Evaluate a smaller
   locally-retrieved catalog payload against the full-catalog baseline before
   any production change. See `docs/dynamic-classifier-payload-spike.md`.
4. **Evaluate requirement alternatives and conjunctions.** Freeze examples
   where a vacancy permits alternatives versus independently requires multiple
   skills, then verify the classifier preserves that meaning.
5. **Complete the bounded AI-provider experiment only with owner approval.**
   Follow `docs/ai-provider-plan.md`; do not process queue records or enable
   paid API billing during it.
