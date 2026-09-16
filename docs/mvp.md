# LinkedIn-Only MVP Plan

Status: Accepted

## Product Idea

The MVP is a personal job-opportunity queue sourced only from LinkedIn. It
should search automatically, turn LinkedIn results into consistent opportunity
records, avoid showing the same vacancy repeatedly, and present a small set of
relevant new opportunities for the owner to review.

The MVP proves the complete discovery loop with one provider before additional
providers are considered.

## Intended Outcome

The owner should not need to browse LinkedIn searches manually. They should be
able to review newly discovered, relevant vacancies in one place and decide
which ones deserve further action.

## Core Workflow

1. Use enabled LinkedIn searches from the Searches dialog and collect
   preferences gradually through reviews and dismissal reasons. See
   docs/linkedin-searches.md for current strategy and provenance semantics.
2. JobQueue runs those LinkedIn searches through the local authenticated
   browser session.
3. It hydrates each discovered job detail and persists only complete vacancies
   with a full description into the review queue.
4. It merges duplicates and remembers vacancies seen in previous runs.
5. AI extracts facts; local code matches the profile and ranks using preferences.
6. It presents a review queue with direct links back to LinkedIn.
7. The owner records a simple decision so dismissed or reviewed vacancies do
   not return as new.

## MVP Scope

### Source and collection

- LinkedIn is the only vacancy provider.
- Reuse a local authenticated browser profile.
- Support a small configurable set of saved searches.
- Run searches sequentially and conservatively.
- Stop on throttling, CAPTCHA, checkpoint, or security challenge.
- Support repeatable execution without requiring the owner to browse LinkedIn.

### Opportunity record

Extract the fields that are reliably available and useful for initial review:

- LinkedIn job ID and canonical URL.
- Title.
- Company.
- Location and remote or workplace information when available.
- Publication or relative age when available.
- Full description. Search-card-only records may exist ephemerally during
  discovery but do not enter the review queue.
- Discovery time and source search.

Missing source data should remain missing rather than being guessed.

### Queue behavior

- Deduplicate vacancies across searches and runs using the LinkedIn job ID.
- Distinguish new, reviewed, dismissed, and interesting vacancies.
- Preserve the owner's decisions between runs.
- Show why a vacancy was included or highly ranked when practical.
- Keep a direct LinkedIn link for source verification and further action.

### Relevance

- Use explicit owner criteria rather than LinkedIn personalization alone.
- Existing rules are in config/preferences.json. Confirm new rules with the
  owner after collecting feedback from real reviews; do not infer exclusions.
- Add scoring only where it improves ordering or reduces review effort.
- Keep borderline results visible enough to correct the criteria.

### Operation

- Run locally using the owner's authenticated session.
- Run collection on demand. Scheduling is a later optional step, not enabled.
- Report when a run succeeds, fails, requires sign-in, or stops for a LinkedIn
  security control.
- Keep captured session and raw LinkedIn data local.

## Out of Scope

- Sources other than LinkedIn.
- Automatic job applications.
- Automatic messaging to recruiters.
- Resume or cover-letter generation.
- A public, multi-user, or hosted product.
- Mobile applications.
- Attempts to bypass or disguise LinkedIn security controls.
- Long-term hardening against changes to LinkedIn's private interfaces.

## Delivery Stages

### Stage 0: Mechanism validation — complete

- Open LinkedIn through a persistent authenticated Chrome profile.
- Capture job-related responses and visible links.
- Stop on throttling or explicit security challenges.
- Demonstrate real job discovery from one generic search.

Evidence from 2026-09-10: 39 candidate responses, 50 unique job IDs, and 7
visible job links were captured without a security challenge.

### Stage 1: Reliable extraction — implemented, validate during use

- Identify the useful LinkedIn response payloads.
- Visit discovered detail URLs sequentially to capture the complete job text.
- Do not persist partial search cards as reviewable opportunities.
- Extract normalized opportunity records.
- Clean duplicated or decorative text from visible-page fallbacks.
- Add fixtures and focused extraction tests.

### Stage 2: Persistent queue — implemented

- Store normalized opportunities and scan history locally.
- Deduplicate across searches and runs.
- Preserve simple review decisions.
- Provide a practical local review view or report.

### Stage 3: Relevance rules — implemented, refine from owner feedback

- Establish the owner's initial job criteria conversationally.
- Use AI only to convert new or changed descriptions into canonical facts and
  evidence-backed tags.
- Match those tags against structured profile and preference data with local
  deterministic code for every processed offer.
- Implement inclusion, exclusion, and ordering rules.
- Explain the most important match or mismatch signals.
- Refine the rules using reviewed examples.

### Stage 4: Optional recurring discovery — deferred

- Run the configured searches on a conservative schedule.
- Add backoff and clear operational status.
- Surface only new or meaningfully changed results.
- Make authentication or security interruptions visible to the owner.

### Stage 5: MVP validation

- Exercise repeated scans against the configured searches.
- Confirm that duplicates and previously reviewed jobs stay out of the new
  queue.
- Confirm that the resulting queue is useful enough to replace manual LinkedIn
  searching for an agreed trial period.
- Record shortcomings before deciding whether to add another provider.

## Proposed Success Criteria

The LinkedIn-only MVP is successful when:

- Recurring scans discover real vacancies from the owner's configured searches.
- Each useful result contains enough information for an initial decision and a
  working LinkedIn link.
- The queue does not present the same LinkedIn job as new more than once.
- Review decisions persist between runs.
- The owner can find relevant new vacancies without manually running LinkedIn
  searches during an agreed trial period.
- Sign-in requirements, throttling, and security stops fail visibly and do not
  expose session credentials.

## Expansion Rule

Do not add another provider until the LinkedIn workflow completes the full
discovery loop and the trial identifies a concrete coverage gap that another
provider would address. New providers should map into the same opportunity and
queue concepts rather than create a separate workflow.

## Confirmed MVP Boundary

The MVP ends at a prioritized review queue with the owner manually applying on
LinkedIn. Automatic applications, application-material generation, and
interview operations are later stages and are not part of this MVP.

## Post-MVP Direction

After the LinkedIn discovery loop is proven useful, develop the broader job
search workflow in this order:

1. Application assistance and tracking: prepare tailored materials, help answer
   application questions, record submissions, and manage follow-ups. Begin with
   owner review and manual submission before considering automatic submission.
2. Interview operations: detect interview invitations, coordinate available
   times with the owner's calendar, create events with explicit approval where
   needed, send reminders, and prepare an interview brief.
3. Outcome feedback: associate application and interview stages with the stable
   opportunity ID, including initial, subsequent, and technical interviews and
   final outcomes. Relate progress back to every recorded discovery search and
   its historical revision, so search review can consider interview progression
   as well as ratings and owner interest. Keep unique-opportunity counts,
   application denominators, sample size, and multiple-search attribution
   explicit; raw interview counts do not establish a probability of success.
   Use this evidence to inform future search prioritization. Do not implement
   interview tracking or an automatic search-success score in the current
   search-management change.

Each stage should be validated before expanding automation or adding external
providers and integrations.
