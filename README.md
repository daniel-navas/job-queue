# JobQueue

Personal, local LinkedIn job tracker: complete source capture → structured AI
extraction → deterministic matching and ranking → manual review/application.

## Use

Run `npm install`, then `npm start`. Open http://127.0.0.1:4317 in Chrome.

- **Find opportunities** searches LinkedIn using the saved local Chrome login.
  One browser session serves all enabled searches. Missing descriptions use
  observed HTTP requests when available, with browser fallback, sequentially
  and at most five per search. Only complete jobs enter the UI.
- **Process** handles at most two pending jobs, selected pending job first.
  Each gets an independent AI call; both run concurrently and save individually.
  Progress shows 0/2, 1/2, 2/2. It does not search.
- **Processed** means current structured facts and deterministic scoring are
  available. **Pending** means a complete source still needs AI extraction.
- **Interested** saves a decision; **Dismiss** saves a reason. Neither submits
  an application. Use the LinkedIn link to apply manually.

AI requires the existing signed-in Codex CLI. The worker uses an ephemeral
read-only run without this conversation, project files, or candidate profile.
It requires subscription authentication and removes API-key environment values.
No automatic retries. Each job has a three-minute timeout. Per-job invocations
provide durable progress but repeat CLI prompt overhead. Usage reported by the
CLI is recorded in data/queue.json under lastSummaryRun.
The AI writes compact JSON; local code restores the full fact schema and checks
source quotes. Full descriptions and catalog rules are retained. Parallelism
does not add calls or duplicate more input than the same individual calls run
sequentially; actual usage still depends on output length and provider caching.

Source hashes and extraction versions avoid repeat AI work. A prompt wording
change alone does not invalidate saved cards; contract changes increment the
version. Pending legacy cards must be processed once with the current schema.

## Change preferences or profile

- profile/matching.json: typed candidate facts.
- config/preferences.json: preference values.
- config/scoring.json: weights and recency bands.
- config/tag-catalog.json: allowed tags, definitions, aliases and display labels.

Refresh Chrome after profile/preference/weight edits. All processed cards
recalculate without AI or a server restart. Technology levels are defined in profile/raw.md. Evidence and
scoring details are in docs/preferences.md.

Catalog changes require a restart; they do not establish candidate skills or
preference points. AI must pick catalog IDs, retaining out-of-catalog criteria
as unmapped. See docs/tag-catalog.md. Version-3 cards adapt locally to the new
catalog and range display; they do not require an extra AI call.

## Checks and diagnostics

`npm test` runs unit/integration tests. With the local server running,
`node scripts/browser-check.mjs` checks the UI headlessly.

`npm run poc:linkedin -- --url "https://www.linkedin.com/jobs/search/" --detail-limit 2`
runs the legacy browser-only diagnostic without importing. The app uses the
shared-session hybrid collector in src/linkedin/collector.mjs instead.
Raw responses live in unique run folders
under .local/linkedin-captures; the latest manifest is data/linkedin-poc.json.
The collector stops on security challenges/rate limiting. Failed runs retain
completed captures and show a visible error. It does not guarantee exhaustive
search coverage. Review state lives in data/queue.json with atomic writes.

Original CVs remain in profile/cv. The pre-refactor queue backup is
.local/queue-before-structured-v3.json. There is no deployment or scheduler.

See docs/project.md for scope and docs/ai-context.md for current handoff.
