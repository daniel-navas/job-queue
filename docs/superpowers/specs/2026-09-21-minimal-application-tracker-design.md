# Minimal application tracker

Status: first release implemented. Later possibilities remain unimplemented.

This spec defined the first release in the same checkout. It deliberately
leaves later possibilities open. Preserve unrelated local changes and private
queue data in any future extension.

## Intent

Give the owner one place to answer: where have I applied, which interview is
next, does it need scheduling, and which processes have ended? Keep the first
release manual and small. The tracker must be able to accept verified updates
from future automation without losing the owner's prior job-review decision.

The owner expects to accept an offer in most cases, so offer negotiation is not
a first-release workflow.

## Boundary and navigation

Keep the desktop two-pane layout. Add `Applications` as a peer of `Jobs`, not
another `New`/`Interesting`/`Dismissed` filter. The existing tabs remain review
decisions. `Interested` does not imply applied, while `Applied` implies
`Interested`. A job can be marked applied even if its AI analysis is pending or
LinkedIn now shows it as closed. LinkedIn availability, review decision, and
application progress remain separate. A tracked job leaves the `New` and
`Interesting` review tabs so active decisions stay focused; it remains in `All
jobs` with its current application stage and in `Applications`.

The `Applications` list contains tracked jobs only. Active processes come
first; ended processes remain accessible in a compact `Closed` filter. Each
active row shows company, role, current stage, and one next-action/date line.
The detail panel shows the same job context, a short timeline, and one
`Update progress` action. No kanban, dashboard, or extra sidebar is needed.

## First-release actions and display

1. `Applied` on a job starts tracking, records the actual application date
   (default today, editable), and sets the review decision to `Interested` in
   the same transaction. The action never submits an application or opens a
   browser. Repeated clicks cannot create duplicates.
2. `Add interview` records a short free-text round name (for example,
   `Recruiter` or `System design`). The owner selects `Needs scheduling`,
   `Scheduled` with a date/time, or `Completed`. A pending interview can later
   be scheduled or completed; a scheduled interview can be rescheduled or
   completed. The interface labels which round is next without imposing a
   fixed number or order of rounds.
3. `End process` records `Rejected`, `Withdrawn`, or `No response`, plus an
   optional date and note. `Offer received` is a simple outcome; `Accepted`
   can close it. `Offer received` remains active until accepted or otherwise
   ended. No negotiation or offer-detail form. An ended process can be reopened
   without losing prior history.
4. Allow the owner to correct an erroneous date, name, state, or outcome, and
   remove an accidentally added milestone. Corrections do not delete the
   underlying job or its review history. `Not applied` corrects an accidental
   application only while no later tracker milestone exists and restores the
   exact review decision and reason that preceded it.

The current stage is derived: `Applied` after submission, `Interviewing` once
an interview exists, `Offer received` if recorded, and a closed outcome when
ended. The next-action line is derived from the earliest interview needing
scheduling or upcoming scheduled interview; otherwise it says `Waiting for
response` after application or after the last completed interview. No separate
manually maintained next-step field is required. Active rows prioritize needs
scheduling, then upcoming dates, then waiting. Past scheduled interviews remain
visible and are flagged for an update; they are not silently marked completed.
Dates and times display in the owner's local timezone; stored instants retain
their offset so a later calendar integration will not reinterpret them.

## Data and component roles

Store one optional `application` object on the existing job record, keyed by
its stable source ID, in the authoritative SQLite queue. It contains the
submission milestone and an ordered list of interview and outcome milestones.
Each milestone has a stable local ID, type, relevant date/time, optional note,
and `manual` provenance. An interview also has its free-text name and
scheduling state. Current stage and next action are projections of these
milestones, not an independently editable status. All writes use the queue's
existing transactional mutation path and validate type, length, date, and
allowed transitions. No second database or service is needed.

The queue owns persistence; a small tracker domain module validates changes
and derives stage/next action; the local API accepts owner updates; the UI
renders the two views. A future integration may submit a candidate milestone
through the same domain boundary, but must prove an application was actually
submitted or request owner confirmation before recording it as fact. No
integration, browser action, network request, AI call, or external message is
part of this release. Candidate profile data stays local.

Duplicate LinkedIn discoveries must preserve the `application` object. A
closed job does not hide an active application. Existing jobs have no
application object and must not be inferred as applied from `Interesting` or
other review history. The public JQ reference is display-only; persistence
uses the stable source ID.

## Failure and correction behavior

Invalid or conflicting updates return a visible error and leave the stored
process unchanged. A failed save must not appear successful in the UI. A
second attempt to mark the same job applied returns the existing process.
Reopening an ended process appends a reopen milestone; it does not erase the
outcome. Edits to existing milestones preserve their stable IDs and do not
alter unrelated queue fields. Notes are plain text and escaped for display.

## Verification for the first release

- A job can be marked applied and appears in `Applications` after restart.
- Applying sets the review decision to `Interested`; correcting it with `Not
  applied` restores the exact previous decision and reason. LinkedIn
  availability remains unchanged.
- The applied card leaves `New`/`Interesting` and remains recoverable in `All
  jobs`.
- Scheduling, rescheduling, completing, and adding another interview produce
  the correct next-action line and timeline.
- Ended processes leave the active list, remain recoverable, and can reopen.
- Duplicate imports preserve progress; invalid writes roll back; repeated
  `Applied` actions do not duplicate submission.
- Desktop UI/API checks cover list selection, correction, and empty states.
  No live LinkedIn scan or AI extraction is required for these checks.

Run `npm test` and the isolated desktop UI/API scenarios in
`node scripts/searches-check.mjs`, extending their synthetic fixtures for the
tracker. Do not write to the owner's live queue or process real offers to
verify this feature. Report what was and was not verified.

## Later, deliberately open

After real use, consider reminders and richer preparation notes. Later,
calendar and email may suggest scheduling or process updates with confirmation;
application assistance may prepare materials or submit only under a separately
approved workflow. Analytics can use the saved milestones and search provenance
with explicit denominators. Those stages do not require new fields or controls
in the first release merely because they might be useful someday.
