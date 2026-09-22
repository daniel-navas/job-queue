# Active unmapped-tag proposal

Date: 2026-09-22. Scope: all 56 pending fingerprints. Numbers remain stable
until this proposal is applied or replaced. `Existing` reuses the catalog,
`New` adds canonical entries, `Rewrite` preserves compound source meaning with
explicit AND/OR mappings, and `Defer` keeps a real criterion outside the skill
catalog until the correct structured field exists.

| # | Source label | Decision | Proposed canonical result |
|---:|---|---|---|
| 1 | Advanced automation | New | `capability:workflow-automation` — Workflow automation |
| 2 | AI or automation integration | Rewrite (OR) | `capability:ai-integration` / `capability:workflow-automation` |
| 3 | AI technology applications | Existing | `capability:ai-integration` — AI integration |
| 4 | AI-first solutions | Existing | `capability:ai-integration` — AI integration |
| 5 | AI, ML, or agent systems | Rewrite (OR) | `capability:ai-integration` / new `capability:machine-learning` / `capability:ai-agents` |
| 6 | Airline industry experience | New | `capability:airline-domain-experience` — Airline domain experience |
| 7 | API design and management | Rewrite (AND) | new `capability:api-design` + new `capability:api-lifecycle-management` |
| 8 | API design knowledge | New | `capability:api-design` — API design |
| 9 | API design principles | New | `capability:api-design` — API design |
| 10 | API development | New | `capability:api-development` — API development |
| 11 | API knowledge | Rewrite (AND) | `capability:distributed` + new `capability:api-design` + `capability:cloud-native` |
| 12 | API orchestration | Existing | `capability:api-integration` — API integrations |
| 13 | Asynchronous workflows | Rewrite (AND) | new `capability:asynchronous-workflows` + `capability:distributed` + new `capability:cloud-infrastructure` |
| 14 | Azure networking | Rewrite (AND) | `technology:azure` + new `capability:cloud-networking` |
| 15 | BFF or middleware integration | Existing | `capability:api-integration` — API integrations |
| 16 | ClickHouse or Aurora | Rewrite (OR) | new `technology:clickhouse` / new `technology:amazon-aurora` |
| 17 | Cloud infrastructure | New | `capability:cloud-infrastructure` — Cloud infrastructure |
| 18 | Cloud service operations and optimization | New | `capability:cloud-operations` — Cloud operations and optimization |
| 19 | Consumer product shipping | New | `capability:consumer-product-experience` — Consumer product experience |
| 20 | Customer growth and provisioning | Rewrite (OR) | `capability:growth-engineering` / new `capability:service-provisioning`; ignore generic “operational excellence” wording |
| 21 | Data infrastructure knowledge | Rewrite (AND) | `capability:data-engineering` + `capability:distributed` |
| 22 | Data sourcing and integration | New | `capability:data-integration` — Data integration |
| 23 | Data-driven applications or dashboards | Rewrite (OR) | new `capability:data-applications` / `capability:data-visualization`; preserve both valid alternatives |
| 24 | Database engineering | New | `capability:database-engineering` — Database engineering; do not infer the whole discipline from one narrower database skill |
| 25 | Database performance tradeoffs | Existing (AND) | `capability:data-integrity` + `capability:query-optimization` |
| 26 | Design systems experience | New | `capability:design-systems` — Design systems |
| 27 | Developer platforms and tooling | New | `capability:developer-platforms` — Developer platforms |
| 28 | DevOps, CI/CD, or cloud infrastructure | Rewrite (OR) | `capability:devops` / `capability:ci-cd` / new `capability:cloud-infrastructure`; ignore vague “systems engineering” |
| 29 | Energy sector experience | New | `capability:energy-domain-experience` — Energy domain experience |
| 30 | FinOps and cloud cost optimization | New | `capability:finops` — FinOps |
| 31 | High-traffic reliable systems | Rewrite (AND) | new `capability:large-scale-systems` + new `capability:high-availability` |
| 32 | Highly available production systems | New | `capability:high-availability` — High availability |
| 33 | JSON and HTTP fundamentals | New | `capability:http-fundamentals` — HTTP fundamentals; JSON remains supporting context |
| 34 | Large or distributed codebases | New | `capability:large-codebase-experience` — Large codebase experience; do not confuse codebase layout with distributed systems |
| 35 | Large-scale consumer products | Rewrite (AND) | new `capability:large-scale-systems` + new `capability:consumer-product-experience` |
| 36 | Lending or related domain | Existing | `capability:financial` — Financial domain |
| 37 | MCP or agentic workflows | Rewrite (OR) | `technology:mcp` / `capability:ai-agents` / new `capability:developer-platforms` |
| 38 | Micro-frontends | New | `capability:micro-frontends` — Micro-frontends |
| 39 | Modern web technologies | Existing (OR) | `technology:javascript` / `technology:typescript` / `technology:react` |
| 40 | OOP and design patterns | New | `capability:object-oriented-design` — Object-oriented design |
| 41 | Other server-side language | Defer | Keep outside catalog: “other” depends on the job’s primary language and the current matcher cannot exclude it safely |
| 42 | Platform reliability improvements | New | `capability:high-availability` — High availability |
| 43 | Production systems exposure | Existing | `capability:production-operations` — Production operations |
| 44 | PST timezone overlap | Defer | Real eligibility constraint, but it belongs in a future availability/time-zone field, not a skill tag |
| 45 | Python or data engineering exposure | Existing (OR) | `technology:python` / `capability:data-engineering` |
| 46 | Recommendation personalization or search | Rewrite (OR) | new `capability:recommendation-systems` / new `capability:personalization` / new `capability:search-engineering` |
| 47 | SABRE knowledge | New | `technology:sabre` — Sabre |
| 48 | Security standards | Existing | `capability:secure-coding` — Secure coding |
| 49 | Self-healing systems | New | `capability:self-healing-systems` — Self-healing systems |
| 50 | Self-service onboarding platforms | Rewrite (OR) | new `capability:self-service-platforms` / `capability:growth-engineering` / new `capability:workflow-automation` |
| 51 | Software supply chain security | Rewrite (AND) | `capability:secure-coding` + new `capability:software-supply-chain-security` |
| 52 | Software testing | New | `capability:software-testing` — Software testing |
| 53 | Technical debt management | New | `capability:technical-debt-management` — Technical debt management |
| 54 | Testing knowledge | Existing after #52 | `capability:software-testing` with conceptual knowledge; ignore generic design/debugging fragments |
| 55 | VBA or PowerShell automation | Rewrite (OR) | new `technology:vba` / new `technology:powershell` |
| 56 | Workflow automation solutions | New | `capability:workflow-automation` — Workflow automation |

## Batch summary

- 11 candidates map entirely to existing catalog concepts.
- 25 candidates introduce one direct canonical concept.
- 18 compound candidates are rewritten into explicit AND/OR mappings; these
  introduce additional canonical concepts where the catalog has a real gap.
- 2 candidates are deferred rather than forced into skill tags: contextual
  “other language” and PST overlap.
- No complete candidate is discarded as non-differentiating. Generic fragments
  inside 20, 28, and 54 are ignored without discarding their concrete meaning.
- The proposal adds 38 unique canonical entries: 33 capabilities and five
  technologies. Existing project tags remain descriptions of assigned products,
  not evidence of candidate domain experience.

This document is a proposal only. It changes neither catalog matching nor
scores until objections are resolved and the approved batch is implemented.
