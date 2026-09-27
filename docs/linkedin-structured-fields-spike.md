# LinkedIn structured job fields spike

Status: Pending

## Objective

Determine which useful job facts can be stored directly from LinkedIn's
structured responses without sending the description to AI. The spike must
produce an evidence-backed mapping proposal; it must not change production
storage, import existing captures, migrate jobs, or process queue records.

The intended precedence is:

`LinkedIn structured value -> description classifier fallback -> unknown`

A finite output vocabulary does not make a field deterministic. A value is
deterministic here only when LinkedIn explicitly supplies it for that job and
local code can normalize it without interpreting prose.

## Already stored without AI

- LinkedIn job ID and canonical URL.
- Title, company name, and the published location text.
- Publication timestamp when supplied.
- Complete source description.
- Confirmed Easy Apply signal.
- Provider and saved-search provenance, including query, location, filters,
  criteria revision, and first/last observed dates.
- Local derivations such as deduplication, publication age, and rediscovery.

## Structured fields observed in local LinkedIn captures

The saved payloads contain structured objects or references for the following
candidate facts. Availability varies by response and job.

| Candidate | Observed source data | Proposed normalized value |
| --- | --- | --- |
| Workplace mode | `workplaceTypeEnum` | `remote`, `hybrid`, `onsite` |
| Employment type | LinkedIn employment-status reference | A reviewed finite catalog such as full-time, part-time, contract, temporary, internship, or other |
| Work geography | Geo reference, canonical names, ISO country code | Country code plus original LinkedIn location text |
| Application method | On-site/Easy Apply detail and external company URL | `easy-apply`, `external`, `unknown` |
| Job lifecycle | State, listed, original-listed, created, expiry, and closed timestamps | Current source state and individual timestamps |
| Repost status | Repost flag and prior job ID | Reposted boolean and prior LinkedIn ID when present |
| Job function | LinkedIn codes observed as `ENG`, `IT`, and `SCI` | Preserved LinkedIn taxonomy value; not Backend/Frontend role focus |
| Industry | LinkedIn industry taxonomy references | Preserved LinkedIn taxonomy IDs and labels |
| Canonical company | Company ID, name, profile URL, and universal name | Stable LinkedIn company identity |
| Company size | Employee count or range | Published count/range with no interpolation |
| Posting verification | Verification badge and trust fields | Source-backed verification state |
| Screening questions | Structured talent questions when present | Preserved questions or a count, only if useful to manual application |
| Contractor flag | LinkedIn contractor boolean | Preserve separately until its relationship to employment type is verified |

The observed captures include all three workplace enums (`REMOTE`, `HYBRID`,
`ON_SITE`), ISO geography, employment status, job lifecycle timestamps, repost
metadata, application routing, job functions, industry references, and company
records. Presence in a payload is not yet proof that every search/detail route
returns the field consistently.

## Fields that remain semantic

Do not derive these solely from company industry, job function, title keywords,
search filters, or another nearby structured field:

- Product company, outsourcing company, or recruiting intermediary.
- Backend, frontend, or full-stack role focus.
- Assigned client, software, work, and project-domain tags.
- Visa sponsorship, relocation funding, and required timezone overlap.
- Salary unless a reviewed LinkedIn response supplies a structured amount,
  currency, period, and range. No such stable field is established by the
  current captures.
- Requirements, nice-to-haves, company stack, required level, and experience
  thresholds.
- Concrete culture or working conditions described only in prose.

Search criteria are provenance, not facts about an individual job. A remote
search does not prove that every result is remote. Company headquarters do not
establish the work country. Missing structured data remains unknown and does
not establish the opposite value.

## Spike procedure

1. Select a bounded, read-only sample of existing local captures spanning
   search cards and hydrated detail responses. Do not contact LinkedIn.
2. Inventory field presence by response type and resolve referenced objects.
   Record the sample size and presence rate for every candidate.
3. Freeze raw examples for remote, hybrid, onsite, contract, external apply,
   Easy Apply, reposted, expired/closed, and missing-field cases.
4. Prototype a pure normalizer that accepts saved payload data and returns
   candidate job metadata. Keep it outside the production import path.
5. Compare normalized values with the exact payload and, where relevant, the
   full description. Separate incorrect mappings from missing source data.
6. Propose the smallest storage shape and migration strategy. Existing jobs
   must not be rewritten until the owner approves the result.
7. Identify classifier inputs that can be removed when a structured value is
   present and those that still require a description fallback.

## Success criteria

- Every proposed value is traceable to a specific structured LinkedIn field.
- Supported enums and unknown behavior are explicit.
- Conflicts between structured metadata and description text are represented,
  not silently resolved.
- The proposal distinguishes job facts from provider/search metadata.
- No browser opens, no network request runs, no AI call occurs, and no queue,
  profile, preference, or production schema is mutated during the spike.
- The final recommendation states which fields to implement, defer, or reject,
  with sample coverage and known private-API stability risk.

## Expected follow-up

Only after owner review, implement approved fields in the LinkedIn normalizer,
job storage, API presentation, and classifier input boundary. Add fixture-based
regression tests before importing or backfilling any saved jobs.
