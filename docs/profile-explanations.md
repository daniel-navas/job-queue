# Profile Skill Explanations

Profile → Generate explanations generates only missing guidance for facts in
Profile → Missing. It does not select or save the owner's skill levels. Cards
remain available in Saved and catalog family members after the owner answers.
Previously saved skills outside Missing are not bulk-generated.

The owner explicitly triggers each run. Opening Profile, refreshing, saving a
level, and discovering a new skill never trigger an AI call. There is no pending
count threshold: a single new skill can be processed immediately when needed.
The runner deduplicates skills and divides the snapshot into sequential chunks
of up to ten. Ten is a conservative starting size, not a measured optimum.
One active run is allowed. A failed chunk stops the run without retries or
provider fallback; already saved chunks remain available.

The generator uses `gpt-6-luna` with `medium` reasoning through Codex subscription
authentication. API-key environment variables are removed. An empty temporary
working directory, ignored user configuration and task-specific
`model_instructions_file` keep project, CV and job context out of the prompt.
Only canonical skill keys, names, modes and catalog definitions are sent to
OpenAI. No browser opens. The job classifier remains independently configured.

In-app cards contain concise conversational English: one definition and one practical
ability/example for Basic, Independent and Advanced. Presence facts instead
explain Yes/No. The owner must assess their understanding and ability to check
and correct work, rather than what an AI coding agent can produce. The generator
prompt is in `src/profile-explanations.mjs`; the separate Spanish chat workflow is
`.agents/skills/explain-profile-skills/SKILL.md`. Chat language preferences do not
set the language of generated app content.

The ignored local `.local/profile-explanations.json` cache is written atomically
with private file permissions. Input hashes include the explanation contract,
canonical key, label, mode and definition. A changed input makes its card missing
until the owner generates it again. Cards are not stored in the owner's matching
profile and have no effect on scores. Invalid cache contents block generation
and show a scoped error without overwriting the file or preventing app startup;
repair/preserve the file and restart the app before continuing. External cache
maintenance also requires a restart to refresh the in-memory view.

Each run records model/settings, input hashes, keys, per-call usage and duration
in ignored `.local/profile-explanation-runs/`. Failed validation retains the raw
output there. Report-write failures do not discard successfully saved cards.
Schema checks catch missing/duplicate keys, wrong modes and malformed text;
they do not establish that the explanations are semantically correct.

## Verification

`node --test test/profile-explanations.test.mjs` verifies persistent reuse,
deduplication, changed definitions, invalid outputs, exclusive runs, retained
successful chunks and cache-error isolation. `node scripts/searches-check.mjs`
uses synthetic cached cards to verify guidance in Missing, Saved and family
members, escaped text, and preserved profile completion behavior.

On October 9, 2026, a bounded comparison used the same first ten current Missing
skills, Luna medium and the same card contract. Default runner instructions used
14,151 input and 1,220 output tokens in 16,218 ms for one call. Task-specific
instructions used 10,631 input and 1,338 output tokens in 16,592 ms for one call.
Input usage fell about 25%; these two calls do not establish a stable latency
improvement, subscription debit, model superiority or optimum batch size.
The comparison is retained locally in `.local/profile-first-trial.txt` and
`.local/profile-isolated-trial.json`. Initial review found distinguishable levels
but some residual jargon; owner review of readability remains useful.

The live trial saved all 63 current Missing facts: ten in the initial call and
53 in six sequential calls with task-specific instructions (77,682 ms for the
whole second run). All chunks passed structural validation. Read-only browser
verification rendered the cards without runtime errors; the owner's 133 saved
profile values were unchanged. Content review found useful distinctions and
examples, with residual technical jargon and mixed first/second-person voice;
this remains a calibration sample rather than a claim of universal quality.

On October 26, 2026, all 71 locally cached cards were reviewed and rewritten in
English through eight bounded Luna-medium calls. A private pre-change backup and
translation report remain under `.local/profile-language-repair-2026-10-26/`.
The 52 current cards retain their availability; the 19 already-stale cards remain
stale, so translating does not resurrect retired skills or obsolete definitions.
The generator now explicitly uses English regardless of input/chat language.
A regression verifies that cards from the former Spanish contract are not served.
The Spanish chat-card skill remains separate from the English app-content rule.
