# AI provider handoff: subscription-only processing

Date: 2026-09-20 (America/Bogota)
Status: planned; no provider change, installation, or live Gemini evaluation
has occurred.

## Owner direction

JobQueue must not create a new AI bill. The available paid capacity is the
owner's existing ChatGPT Plus subscription and Google AI Pro subscription.
The goal is to use whichever already-paid quota gives source-faithful offer
extraction at the lowest practical consumption, not to maximize speed.

Production therefore remains the verified Codex path: `gpt-5.6-terra` with
medium reasoning, one full description per call, at most two concurrent calls
per Process click. Terra is the current baseline, not a claim that it is
universally accurate. Its reviewed evidence is in `docs/performance-spike.md`.

The owner observed roughly 1% Codex usage for two offers. That is encouraging,
but it is an observed rounded meter reading, not a forecast that every 200
offers fit one usage window. Source size, cache behavior and five-hour/weekly
limits vary.

## Proposed Gemini Pro route

Evaluate Google Antigravity CLI authenticated with the owner's Google AI Pro
account. This is deliberately not the Gemini Developer API:

- Do not enable Google Cloud billing, buy API credits, create a paid API key,
  or use a Gemini API fallback.
- Do not automate the Gemini web application.
- Use the provider's supported terminal login and its headless/print mode only
  if the installed tool supports the required deterministic JSON exchange.
- Initial Google authentication may open a browser. Ordinary processing should
  not open a browser after authentication; confirm this rather than assuming it.
- The job description, catalog and extraction prompt would leave the computer
  for Google's service. The candidate profile must continue to stay local and
  must not be included. Extracted results continue to be saved only in the
  local SQLite queue after validation.
- Gemini Pro quota consumption is acceptable because it is already paid for;
  it is still finite. Never silently move to a paid API once that quota is
  exhausted.

Google moved individual Google AI Pro terminal use from Gemini CLI to
Antigravity CLI in June 2026. This makes Antigravity the route to investigate,
not a promise that its current model, quota or headless JSON behavior meets the
classifier contract. Reference: [Google's transition announcement](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/).

## Evaluation sequence

Do this only after the owner explicitly authorizes live Gemini-Pro quota use.
Do not import or overwrite queue records in any stage.

1. Confirm Antigravity is available and can authenticate with the owner's
   Google AI Pro account without an API key or billing setup. Run one bounded
   synthetic/headless smoke call. Record selected model, command mode,
   authentication path, elapsed time and any quota signal. Stop if it requires
   paid API billing or cannot supply machine-readable output.
2. Adapt only the provider boundary: feed it the existing production prompt,
   compact schema, catalog and one complete source description. Preserve local
   schema and quote validation. Do not redesign scoring or extraction rules for
   Gemini before seeing comparable failures.
3. Run the frozen three-case evaluation already used for the final Terra
   decision: two source-reviewed real offers plus one synthetic case, with the
   current 27 source-derived checks. Keep outputs/reports under `.local/`; do
   not import them.
4. Manually review the full descriptions for omissions and over-interpretation,
   not merely valid JSON. Record per-call elapsed time and actual Pro-quota
   behavior if the tool exposes it. Do not equate agent requests with output
   quality or assume a percentage conversion.
5. Adopt Gemini Pro only if it produces valid controlled JSON, passes the 27
   checks, survives source review, and remains usable within the Pro quota.
   Then expand to a larger, diverse source-reviewed sample before making it the
   production default.

## Provider behavior if Gemini passes

Keep Codex/Terra available as the known baseline. Provider selection must be
explicit and visible to the owner. A failed Gemini call must remain a failure;
do not automatically retry it with Terra or another provider, since that can
spend two quotas and semantic omissions may not trigger the validator. Preserve
the two-offer Process limit, independent saves, full-source extraction and
local deterministic matching/scoring.

## Alternatives, not current work

- A free Gemini API tier is not the primary route: it is a separate API quota,
  may have lower limits/data-use tradeoffs, and is not needed while Google AI
  Pro terminal capacity is available. Do not enable paid API billing.
- A local model has no provider quota or external data transfer. On the owner's
  M4 MacBook Air with 16 GB unified memory, a quantized Qwen 3.5 9B or Gemma 4
  12B is technically plausible; larger 27B+ options do not fit comfortably.
  Local models are not approved for production because they have not faced the
  source-reviewed extraction evaluation and lower-capability Luna already
  missed important semantic requirements. Consider them only after the Gemini
  experiment, with the identical gate and no queue imports.

## Explicit non-goals

No new billing, no background/backlog processor, no batching, no more than two
offers per click, no automatic cross-provider retries, no profile upload, no
manual Gemini-web copying, and no score generation by AI.
