# Current TODOs

1. **Teach the classifier reviewed aliases.** If the classifier cannot connect
   source wording such as `NodeJS` to the existing canonical tag `nodejs`
   (`Node.js`), it leaves the criterion `unmapped`; it does not create a tag.
   During review, record the wording as an alias only when it always means the
   same thing as the canonical tag. Then include that reviewed alias beside the
   canonical tag in the compact catalog sent to the classifier, so future
   extractions can select `nodejs` from context. The alias is guidance for the
   classifier: it must never cause an automatic raw-text match, and aliases
   must not be invented in advance.
2. **Run the dynamic classifier-payload spike.** Evaluate a smaller
   locally-retrieved catalog payload against the full-catalog baseline before
   any production change. See `docs/dynamic-classifier-payload-spike.md`.
3. **Evaluate requirement alternatives and conjunctions.** Freeze examples
   where a vacancy permits alternatives versus independently requires multiple
   skills, then verify the classifier preserves that meaning.
4. **Complete the bounded AI-provider experiment only with owner approval.**
   Follow `docs/ai-provider-plan.md`; do not process queue records or enable
   paid API billing during it.
5. **Add a local job-market tag insights screen.** Show which canonical tags
   occur in the most processed jobs, with job counts and percentages separated
   into requirements, nice-to-haves, and company stack. Count each tag at most
   once per job, keep unmapped criteria visibly separate, and derive everything
   from the saved queue without opening Chrome or calling AI. Include links or
   a drill-down to the affected jobs so the owner can interpret each aggregate.
