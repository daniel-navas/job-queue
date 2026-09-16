# Review preferences

The machine-readable values are in `config/preferences.json`; this document
explains their meaning and guardrails. The owner wants a recognizable,
interesting product they might use or recommend.
Generic engineering responsibilities do not explain the product. Current rules
in `src/rating.mjs` are deterministic and visible through score tooltips.
Weights are centralized in `config/scoring.json` so priorities can be tuned
without changing the implementation:

- Preference fields retain their configured assessments and are multiplied by
  their configured weights. Project/work tags are additive: every explicit
  configured preference contributes, while descriptive neutral tags add zero.
- Requirements, nice-to-haves, and general experience contribute their backed
  fraction. Initial weights are 2, 0.5, and 1 respectively.
- Publication recency contributes at most one point: 1 through day 1, 0.8
  through day 3, 0.5 through day 7, 0.2 through day 14, then 0. This is a
  review-priority heuristic, not a claimed acceptance probability.
- Own product is a provisional +1 signal, not proof of personal interest.
- B2B is an owner-confirmed negative project preference (-1), for software
  primarily serving business/professional workflows. Merchant participation in
  a consumer journey is insufficient. Consumer and mixed-audience products are
  +1; internal tools stay neutral. Audience tags are mutually exclusive.
- Consumer credit, crypto trading, and growth-focused assigned work are each an
  independent +1 preference. They may coexist with an audience tag and with one
  another, so an explicitly mixed-audience crypto growth role receives +3.
- HR platforms are an owner-confirmed negative project preference (-1). Detect
  only explicit product wording; mentioning an HR team is insufficient.
- Sezzle JQ-008 is personally appealing to the owner, but that observation does
  not score because no deterministic reusable rule has been established. Do not
  translate per-offer subjective appeal into a numeric exception.
- Client identity is context under company type, never a scoring criterion.
- A processed offer without a supported explanation of what the software does:
  -1, even when specific work responsibilities are stated. No per-offer overrides.
- Unknown salary and fields without a defined preference: 0.
- Work mode: on-site -1, hybrid 0, remote +1; unknown or contradictory mode 0.
  Show mode in the detail table. Requirement/nice-to-have fields show coverage
  fractions with an outlined badge and contribute fractionally to the score.
- Role focus: backend +1, full-stack 0, frontend -1. Detect conservatively from
  the title and concrete role description; unknown focus stays 0. LinkedIn
  search definitions live in `config/searches.json`; their review procedure
  and analytics semantics live in `docs/linkedin-searches.md`.
  Backend is the owner's active search target. Full-stack is an acceptable
  employment fallback, not a desired search track. Growth remains a positive
  work preference and Go remains a technology interest; neither by itself
  justifies a dedicated search. Search selection should consider both personal
  appeal and source-backed qualification fit. The number and specificity of
  searches remain hypotheses to evaluate, not fixed owner constraints.
- Unsummarized offers are unrated and listed after summarized offers, with no
  negative score. Sort by weighted score, then publication time and LinkedIn
  ID. Context/stack/project tags add no points without an explicit preference
  rule. The total is a priority score, not a normalized fit percentage and has
  no fixed upper bound.

AI provides extracted text, not numerical ratings. Company classification is
still based on AI extraction and may need correction. Do not infer subjective
product appeal from technologies or generic wording. Do not hide low scores.
Product extraction must prioritize the product, intended users, and concrete
benefit before generic role responsibilities so the owner can judge it quickly.
External company research is not part of the current scoring workflow: more
facts do not make subjective appeal deterministic. If the listing does not
support an existing reusable rule, keep the project neutral. Classification
coverage is not a goal and uncertainty must not be converted into a score.

JQ references use append-only queue order; reimports preserve order and append
new IDs. The reference appears as non-copyable low-emphasis text on list cards
and remains copyable in the detail panel. Full LinkedIn IDs remain the
underlying identity. No deletion exists.

## Geography and relocation intent

The owner prefers remote work accessible while living in Bogota, Colombia.
Hybrid work in Bogota is acceptable but less desirable. Do not interpret a
remote label as proof that a company can hire someone based in Colombia.

Relocation to Spain or Germany is a separate desired search route; other
European Union countries are secondary options. For relocation opportunities,
remote, hybrid, and on-site work are equally acceptable. Employer support for
the work visa/permit process is required; employer-paid moving expenses are
not required. Visa sponsorship/work-permit support and relocation funding are
separate facts. Generic relocation wording does not establish visa support,
and an unspecified policy remains unknown rather than confirmed eligibility.
These are owner preferences, not legal conclusions about immigration routes.

Version 6 extraction records workCountry (one source-backed ISO country),
visaSupport and relocationFunding separately. A country in the configured
relocation set makes all explicit work modes neutral (0), independently of
visa eligibility. This is a work-mode preference, not an eligibility score.
Visa support and moving expenses appear with their own evidence when known;
visa support remains visible as unknown for a stated European work country.
The query never supplies offer facts. Older cards keep null mobility facts
without reprocessing, so geography-specific scoring requires new source-backed
extraction. Existing salary bands remain unchanged.

## Salary comparisons

Show one compact normalized monthly line; the source control preserves access
to the original statement without repeating it. Hourly assumes 40 hours/week ×
52/12; annual divides by 12. Preserve the original currency and
show COP conversion only for an explicit supported currency. A bare $ is
unknown, never assumed USD. Rates come from ExchangeRate-API and are cached in
memory for 24 hours. The interface does not show its provider link. Failed rates do not block the original
salary. Conversion does not adjust taxes, benefits or guarantee billable hours.
Unrecognized salary text remains original, without guessed normalization.

Salary preference is expressed in monthly USD: USD 3,000–4,000 is +1; USD
2,500–2,999 and USD 4,001–4,500 are neutral; amounts below USD 2,500 or above
USD 4,500 are -1. The high band is negative because it may signal role
expectations beyond the owner's intended level. For published ranges, score +1
whenever the range intersects the ideal band and -1 only when the entire range
is on one negative side. Convert explicit
currencies before comparison when a rate is available. Missing, ambiguous, or
unconvertible salary stays neutral.

## Interaction

Until the core profile is complete, end each response with up to three focused
profile questions. Order them by processed-offer score from highest to lowest,
prioritize incomplete or questionable tag matches, and audit possible false
positives as well as false negatives. For each technology or measurable
capability, collect only current autonomy, total practical experience, and last
used. Do not repeat known facts or collect unrelated inventory speculatively.

Keep top controls compact, scores next to field labels, and source toggles beside values. The owner refreshes
Chrome directly; do not open the page in Codex after changes.
Searches opens one minimal provider-labeled dialog for adding, editing and
enabling LinkedIn searches and viewing current-criteria counts and mean ratings.
Keep search provenance in a compact detail disclosure, not on list cards.
Keep work-mode detail on the same line as its normalized value and keep the
offer-detail header dense. Company stack should contain only useful technology
not already represented under requirements or nice-to-haves; omit explanatory copy.
Place the preference score beside the offer title. Keep the detail JQ reference
low-emphasis in unused header space and copy it when clicked.
Render the detail score directly adjacent to the title at the same typographic
scale. Process at most two AI summaries per click to control token use; show a
loader and how many offers will remain.
Prioritize the currently selected pending offer in that batch.
In list cards, omit initials and metadata tags, put the score beside the title,
and show a non-copyable low-emphasis JQ reference at bottom right. In the detail
header, keep the LinkedIn link at top-right, actions
and metadata together on a compact second row, and the copyable JQ reference at
the far right of that row. The desktop header should use two rows total.
Show one compact processing state in the existing company row: `Processed`
means current structured extraction plus deterministic matching/scoring,
`Pending` means the complete description still needs current extraction.
Incomplete legacy records are hidden from the review UI. Only `Processed`
offers show a numeric score; stale extractions must not appear current.

## Requirement tags

Every processed offer uses the same matcher in `src/matching.mjs`.
Preserve OR alternatives as one criterion and separate genuinely independent
AND criteria. Identical canonical criteria do not count twice. Exclude generic
employer values/personality rhetoric from criteria; concrete unsupported
qualifications remain unknown and visible. Internal 1 means confirmed match;
0 means unknown or insufficient evidence, not proof of inability. Tooltips
show profile and source evidence. No per-tag numbers are shown.
Generic professional hygiene is deliberately outside both numerator and
denominator: teamwork/problem solving/communication, generic debugging, code review, Git basics,
Agile ceremonies, clean code, adaptability, ownership, and fast-paced work.
This is one catalog policy applied to every offer, never an offer-specific edit.
Published experience ranges remain visible (e.g. 3–7 years); only the minimum
is used for matching, not the upper end as a rejection ceiling.
Requirement labels also show explicit autonomy and last-use thresholds. Slash-
separated labels are one OR criterion: matching any listed alternative satisfies
that denominator entry; independent AND requirements remain separate tags.
Relative recency stays relative in cached facts: `current/currently` means used
within one year, `recent/recently` means used within five years, and an explicit
"within N years" uses N. The matcher converts that window to a year cutoff at
evaluation time. Explicit calendar-year cutoffs remain absolute. Never store a
relative phrase as a fixed extraction-year cutoff.
Experience and technology groups contribute their matched fraction. Requirements
and nice-to-haves show a matched/total count. Never add raw counts to the score,
which would favor verbose ads. Tag numbers are hidden; colors and evidence tooltips remain. Company
stack is contextual and deduplicated against required/preferred tags. AI
selects project/requirement tags from config/tag-catalog.json, never creates
new tag IDs or numeric preferences. Concrete missing categories stay unmapped,
visible and neutral until reviewed. Configured project/work tags contribute
algebraically. Mutually exclusive audience tags cannot coexist, while
orthogonal preferences such as audience, consumer credit, crypto trading, and
growth-focused work each contribute independently.
The editable machine-readable subset in `profile/matching.json` derives from
`profile/raw.md`; update both when a relevant candidate fact changes.

Candidate technology levels are outcome-based (`basic`, `independent`,
`advanced`, `unknown`) and defined authoritatively in `profile/raw.md`. Years,
last use, and autonomy remain separate matching inputs.

Conceptual capabilities use a separate knowledge scale: `basic` recognizes and
applies common concepts with support; `intermediate` selects suitable concepts
and explains normal tradeoffs; `advanced` analyzes complex cases and can guide
others. Concept knowledge is not measured by time unless a listing explicitly
requires duration. Generic debugging is excluded, while specialized production,
distributed, performance, or incident diagnosis remains differentiating.
When asking the owner to calibrate conceptual knowledge, include one concise,
practical example for each level rather than asking only for an abstract label.

The default technology match requires independent or advanced autonomy.
Explicit basic/familiarity requirements may match basic autonomy. Explicit
minimum duration and last-used-year cutoffs must also be satisfied; missing
profile values cannot establish them. Do not invent decay by age or infer
technology years from total career duration. Interest in a technology never
counts as experience. A missing requirement threshold does not invent one.
CV-backed capability booleans establish general experience/basic familiarity,
not expert level, exact duration, or a narrower specialty. General career
experience uses the union of employment months, including boundary months,
without counting overlaps twice. It cannot establish technology/domain years.

All profile/config changes apply on refresh without AI. Existing factual tags
can be reweighted immediately; a newly requested extraction category requires
a deliberate contract update/reprocessing, not an invented retrospective tag.
