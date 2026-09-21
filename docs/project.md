# JobQueue

Status: Local LinkedIn MVP

## Purpose

Replace manual vacancy searching with a compact, ranked queue for one owner.
The owner reviews useful facts, marks interest or dismisses with a reason, and
applies manually. The app is exclusively personal and local: no deployment,
marketing, accounts, multi-user infrastructure, or additional providers.

## Product contract

1. Collect complete LinkedIn descriptions and metadata, not search-card stubs.
2. Extract source-backed structured facts once with AI; never AI-generated scores.
3. Match every processed job to structured profile data and preferences using
   local code. Profile, preference and weight changes require no AI calls.
4. Show compact decision cards, source quotes, weighted contributions, and a
   priority-ordered review queue. Unknown remains visible and is not invented.
   Each relevant requirement, nice-to-have, experience criterion, and company
   stack technology is explicitly assessed as match, non-match, missing profile
   information, or unmapped. The queue shows whether that evaluation is pending,
   needs information, or complete.
5. Preserve reviews, reasons, availability history, source records, stable IDs
   and original CVs. Manually closed offers leave active review tabs but remain
   recoverable in All opportunities.
6. Manage LinkedIn searches locally with per-offer historical criteria and
   measured capture results. Definitions and provenance identify their provider;
   review skills are provider-specific. Only LinkedIn is currently implemented.

Machine-readable preferences live in config/preferences.json; weights and
recency bands in config/scoring.json; candidate facts in profile/matching.json.
Their interpretation and minimal UI rules live in docs/preferences.md.
The extraction/matching boundary is recorded in decision 0002.

## Constraints

- Desktop-only product. Small-device access uses the same desktop layout scaled
  down with browser zoom available, not a separate mobile UI or blocking notice.
  Do not invest in mobile layouts or a mobile test matrix.
- Preserve the approved sober two-pane interface and minimal Searches dialog.
  Add controls only for current owner needs, not hypothetical future features.
- Capture fewer complete jobs when necessary. Do not present incomplete cards
  as review-ready or claim that a search exhausted all LinkedIn results.
- LinkedIn searches use authenticated HTTP; Chrome opens only for explicit
  connection/session renewal and request-template discovery. The owner accepts unofficial
  integration/account-restriction risk. Stay sequential and bounded; stop on
  rate limiting, CAPTCHA or checkpoints, without bypassing them.
- At most two AI jobs per Process click; no automatic retries or background
  processing of the whole queue. No API-billing fallback.
- Treat the owner's existing ChatGPT Plus and Google AI Pro subscriptions as
  the primary AI resources. Do not activate paid Gemini/Cloud/other AI API
  billing or add a new paid service without explicit authorization. Prefer the
  least intensive already-paid option that meets source-reviewed extraction
  quality; test settings on a bounded sample before changing them.
- Ask up to two focused profile questions per response, ordered by processed
  offer score from highest to lowest. Prioritize incomplete matches and audit
  apparent matches for false positives. Collect only practical duration,
  current autonomy, and last-used year for a technology or measurable capability.
- For conceptual-knowledge questions, do not ask for artificial years of use.
  Give concise, practical examples of basic, intermediate, and advanced so the
  owner can calibrate the level consistently.
- Source quotations prove provenance, not perfect AI interpretation. Extraction
  errors must be fixed generically, not with hidden per-offer score exceptions.
- Keep the verified GitHub remote (`origin/main`) synchronized after coherent
  local changes. Inspect the diff before committing and do not publish
  unrelated changes from another workstream without reviewing them.

## Success criteria

A repeatable search captures full jobs, Process produces structured cards and
scores for any job ID, duplicates do not reset decisions, and profile/config
changes rerank cached facts without AI. The owner can use the queue instead of
reading full LinkedIn descriptions during an actual job-search trial.

## Manual application-writing assistance

The owner may request cover letters or application-form answers in chat by JQ
reference. The repo-scoped `assist-job-application` skill uses the full saved
offer, confirmed profile facts, owner-approved voice examples, and optional
public company research. Only owner-approved final text and reusable feedback
are saved under private `.local/`. The owner reviews and submits manually; this
does not add application actions, status tracking, or AI-generated queue scores.

## Later, not implemented

Application tracking, then progressively approved submissions, then
interviews/preparation/calendar. Future providers should feed the same source
contract. No application, recruiter message, scheduling, or external submission
is authorized merely by marking a vacancy Interested today.
