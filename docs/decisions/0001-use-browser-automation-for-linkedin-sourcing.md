# Use browser automation for LinkedIn sourcing

## Status

Accepted

## Context

LinkedIn is an important vacancy source but does not provide a general public
job-search API. Its rules prohibit third-party scraping and browser automation,
so an unofficial integration can break or cause the owner's account to be
restricted. JobQueue is a personal, temporary tool, and avoiding repetitive
manual searching is more important to the owner than integration stability or
account continuity.

## Options Considered

- Consume LinkedIn job-alert emails without automating the site.
- Exclude LinkedIn and rely on aggregators and employer ATS APIs.
- Automate a logged-in browser and capture the job-search responses it
  receives.

## Decision

Use a local persistent browser session to run LinkedIn job searches and capture
their results. Reuse one browser context across an enabled-search batch, with
readiness checks instead of unconditional sleeps. Searches remain browser-led:
the September 2026 HTTP spike did not establish exact search-result parity.

Missing details may replay a request template observed in that same browser
session. Keep authentication headers in memory and let the browser context
manage cookies; never hard-code GraphQL hashes or persist replay credentials.
Ordinary missing, malformed or incomplete responses permit browser fallback.
Authentication failures, security challenges and throttling stop the batch,
without switching transport to bypass the block. See docs/performance-spike.md.

The owner explicitly accepts the possibility that the integration will break
or that LinkedIn will restrict the account. Execution will be sequential and
rate-limited to reduce unnecessary load, will back off on throttling, and will
stop when LinkedIn presents a CAPTCHA, checkpoint, or security challenge. It
will not attempt to disguise automation or bypass those controls.

## Consequences

- LinkedIn vacancies can enter JobQueue without daily manual searches.
- The integration depends on private behavior and may require occasional
  repair.
- The scanner must remain local and must not publish session credentials.
- Account restriction remains an accepted risk, not a risk eliminated by rate
  limiting.
