# Active unmapped-tag proposal

Date: 2026-09-22. Scope: all 56 pending fingerprints. Numbers remain stable
until this proposal is applied or replaced. This is a **catalog review**: each
row decides whether the extracted label already has a canonical tag, needs a
new canonical tag or family, is too broad and must be split by the extractor,
or belongs outside the catalog. Requirement alternatives/conjunctions are a
separate extraction-quality TODO, not a catalog property.

| # | Initial tag | Catalog decision | Final catalog result | Why |
|---:|---|---|---|---|
| 1 | Advanced automation | Create canonical capability | `capability:workflow-automation` — Workflow automation | Concrete automation engineering, not generic process improvement. |
| 2 | AI or automation integration | Split source phrase | Existing `ai-integration`; new `workflow-automation` | It names two catalog concepts, not one combined tag. |
| 3 | AI technology applications | Reuse existing tag | `capability:ai-integration` — AI integration | Applying AI inside products/workflows fits the definition. |
| 4 | AI-first solutions | Reuse existing tag | `capability:ai-integration` — AI integration | Do not create a second broad AI-product synonym. |
| 5 | AI, ML, or agent systems | Split source phrase | `ai-integration`, new `machine-learning`, existing `ai-agents` | The umbrella contains distinct AI specialties. |
| 6 | Airline industry experience | Create canonical capability | `capability:airline-domain-experience` — Airline domain experience | Candidate experience differs from a product-domain tag. |
| 7 | API design and management | Split source phrase | New `api-design`; new `api-lifecycle-management` | Design and lifecycle governance are separate concepts. |
| 8 | API design knowledge | Create canonical capability | `capability:api-design` — API design | Precise conceptual API-design knowledge is missing. |
| 9 | API design principles | Reuse proposed tag | `capability:api-design` — API design | Same concept as #8. |
| 10 | API development | Create canonical capability | `capability:api-development` — API development | Broader than the existing REST-specific capability. |
| 11 | API knowledge | Reject umbrella; split extraction | Existing `distributed`, new `api-design`, existing `cloud-native` | The evidence lists independent concepts. |
| 12 | API orchestration | Reuse existing tag | `capability:api-integration` — API integrations | Aggregating backend service data fits this tag. |
| 13 | Asynchronous workflows | Split source phrase | New `asynchronous-workflows`, existing `distributed`, new `cloud-infrastructure` | The source combines three concepts. |
| 14 | Azure networking | Split source phrase | Existing `technology:azure`; new `cloud-networking` | A platform and a networking capability are distinct. |
| 15 | BFF or middleware integration | Reuse existing tag | `capability:api-integration` — API integrations | BFF/middleware is an API-integration form. |
| 16 | ClickHouse or Aurora | Split into technologies | New `technology:clickhouse`; new `technology:amazon-aurora` | Named products must remain individual technologies. |
| 17 | Cloud infrastructure | Create canonical capability | `capability:cloud-infrastructure` — Cloud infrastructure | Cloud-native apps and IaC do not cover it fully. |
| 18 | Cloud service operations and optimization | Create canonical capability | `capability:cloud-operations` — Cloud operations and optimization | It is a specific operational responsibility. |
| 19 | Consumer product shipping | Create canonical capability | `capability:consumer-product-experience` — Consumer product experience | Candidate history differs from product audience. |
| 20 | Customer growth and provisioning | Split; ignore generic fragment | Existing `growth-engineering`; new `service-provisioning` | Ignore only “operational excellence”. |
| 21 | Data infrastructure knowledge | Split source phrase | Existing `data-engineering`; existing `distributed` | Data infrastructure and distributed systems remain separate. |
| 22 | Data sourcing and integration | Create canonical capability | `capability:data-integration` — Data integration | Candidate work, not the product-domain tag. |
| 23 | Data-driven applications or dashboards | Split source phrase | New `data-applications`; existing `data-visualization` | Applications and dashboards are distinct valid concepts. |
| 24 | Database engineering | Create canonical capability | `capability:database-engineering` — Database engineering | Do not infer the discipline from a narrow DB skill. |
| 25 | Database performance tradeoffs | Split source phrase | Existing `data-integrity`; existing `query-optimization` | Integrity and performance are separately concrete. |
| 26 | Design systems experience | Create canonical capability | `capability:design-systems` — Design systems | Reusable UI-system work is a specialty. |
| 27 | Developer platforms and tooling | Create canonical capability | `capability:developer-platforms` — Developer platforms | Candidate platform work differs from project classification. |
| 28 | DevOps, CI/CD, or cloud infrastructure | Split; ignore generic fragment | Existing `devops`, `ci-cd`; new `cloud-infrastructure` | Ignore only vague “systems engineering”. |
| 29 | Energy sector experience | Create canonical capability | `capability:energy-domain-experience` — Energy domain experience | Candidate history differs from `project:energy-utilities`. |
| 30 | FinOps and cloud cost optimization | Create canonical capability | `capability:finops` — FinOps | Measurable cloud-cost specialty. |
| 31 | High-traffic reliable systems | Split source phrase | New `large-scale-systems`; new `high-availability` | Scale and reliability are different capabilities. |
| 32 | Highly available production systems | Create canonical capability | `capability:high-availability` — High availability | More specific than production operations. |
| 33 | JSON and HTTP fundamentals | Create canonical capability | `capability:http-fundamentals` — HTTP fundamentals | JSON stays supporting context, not a separate tag. |
| 34 | Large or distributed codebases | Create canonical capability | `capability:large-codebase-experience` — Large codebase experience | Codebase scale is not runtime distribution. |
| 35 | Large-scale consumer products | Split source phrase | New `large-scale-systems`; new `consumer-product-experience` | Scale and consumer experience are separate. |
| 36 | Lending or related domain | Reuse existing tag | `capability:financial` — Financial domain | Lending/banking/fintech are already covered. |
| 37 | MCP or agentic workflows | Split source phrase | Existing `technology:mcp`, `ai-agents`; new `developer-platforms` | These are separate technologies/capabilities. |
| 38 | Micro-frontends | Create canonical capability | `capability:micro-frontends` — Micro-frontends | Architectural capability, not a framework. |
| 39 | Modern web technologies | Split into technologies | Existing `javascript`, `typescript`, `react` | The source already names concrete technologies. |
| 40 | OOP and design patterns | Create canonical capability | `capability:object-oriented-design` — Object-oriented design | Language-independent software-design knowledge. |
| 41 | Other server-side language | Defer outside current catalog | No catalog change | “Other” depends on the job’s primary language. |
| 42 | Platform reliability improvements | Reuse proposed tag | `capability:high-availability` — High availability | Reliability/uptime work shares #32's concept. |
| 43 | Production systems exposure | Reuse existing tag | `capability:production-operations` — Production operations | A stronger existing concept covers exposure. |
| 44 | PST timezone overlap | Defer outside skill catalog | Future availability/time-zone field | Real requirement, but not a technology/capability. |
| 45 | Python or data engineering exposure | Split source phrase | Existing `technology:python`; existing `data-engineering` | Language and data capability remain distinct. |
| 46 | Recommendation personalization or search | Split source phrase | New `recommendation-systems`, `personalization`, `search-engineering` | Related specialties are not interchangeable facts. |
| 47 | SABRE knowledge | Create canonical technology | `technology:sabre` — Sabre | Named travel-industry platform. |
| 48 | Security standards | Reuse existing tag | `capability:secure-coding` — Secure coding | Secrets and data protection fit the definition. |
| 49 | Self-healing systems | Create canonical capability | `capability:self-healing-systems` — Self-healing systems | More specific than reliability or observability. |
| 50 | Self-service onboarding platforms | Split source phrase | New `self-service-platforms`, existing `growth-engineering`, new `workflow-automation` | It names distinct product-work concepts. |
| 51 | Software supply chain security | Split source phrase | Existing `secure-coding`; new `software-supply-chain-security` | Application security differs from build/dependency security. |
| 52 | Software testing | Create canonical capability | `capability:software-testing` — Software testing | Broader than automated testing. |
| 53 | Technical debt management | Create canonical capability | `capability:technical-debt-management` — Technical debt management | Concrete planning/maintainability capability. |
| 54 | Testing knowledge | Reuse proposed tag; ignore generic fragments | `capability:software-testing` — Software testing | Keep testing; ignore generic design/debugging. |
| 55 | VBA or PowerShell automation | Split into technologies | New `technology:vba`; new `technology:powershell` | Named technologies stay separate. |
| 56 | Workflow automation solutions | Reuse proposed tag | `capability:workflow-automation` — Workflow automation | Same concept as #1. |

## Practical meaning

1. **Advanced automation:** designing software that replaces multi-step manual
   work with reliable automated flows.
2. **AI or automation integration:** connecting AI services or automation
   engines to an application so they perform real product work.
3. **AI technology applications:** using model APIs, AI frameworks, or AI
   outputs inside products and operational workflows.
4. **AI-first solutions:** building a product whose central behavior depends on
   AI rather than adding AI only as an incidental tool.
5. **AI, ML, or agent systems:** practical familiarity with AI integrations,
   machine-learning systems, or autonomous tool-using agents.
6. **Airline industry experience:** understanding airline/travel operations,
   reservations, inventory, fares, or related workflows.
7. **API design and management:** defining API contracts and maintaining their
   lifecycle, versions, policies, and governance.
8. **API design knowledge:** knowing how to define clear, stable, scalable API
   contracts and behavior.
9. **API design principles:** applying conventions for resources, errors,
   compatibility, pagination, and change management.
10. **API development:** implementing endpoints, request handling, validation,
    business logic, and responses.
11. **API knowledge:** understanding APIs together with distributed-service and
    cloud-native architecture concerns.
12. **API orchestration:** combining or transforming calls to multiple backend
    services into one application flow.
13. **Asynchronous workflows:** coordinating work that continues outside the
    original request, often across jobs, events, or distributed services.
14. **Azure networking:** configuring Azure network boundaries such as VNets,
    private endpoints, routing, and firewalls.
15. **BFF or middleware integration:** building an intermediate backend that
    adapts and combines services for a frontend or client.
16. **ClickHouse or Aurora:** ClickHouse is a column-oriented analytics
    database; Amazon Aurora is AWS's managed MySQL/PostgreSQL-compatible database.
17. **Cloud infrastructure:** designing and operating compute, networking,
    storage, and platform resources in cloud environments.
18. **Cloud service operations and optimization:** running cloud services while
    improving their reliability, performance, capacity, or cost.
19. **Consumer product shipping:** delivering software used directly by end
    consumers and handling the usability and scale expectations involved.
20. **Customer growth and provisioning:** improving onboarding/conversion or
    automating the setup and activation of customer resources.
21. **Data infrastructure knowledge:** understanding data pipelines, storage,
    movement, and their distributed-system behavior.
22. **Data sourcing and integration:** acquiring data from multiple systems,
    improving its quality, and combining it reliably.
23. **Data-driven applications or dashboards:** building applications powered
    by data or visual interfaces for exploring and reporting it.
24. **Database engineering:** designing, evolving, operating, and improving
    databases as a primary engineering responsibility.
25. **Database performance tradeoffs:** balancing transactions and correctness
    with indexes, query behavior, latency, and throughput.
26. **Design systems experience:** building reusable UI components, tokens,
    patterns, and documentation shared across product teams.
27. **Developer platforms and tooling:** creating internal platforms or tools
    that make other engineers more productive.
28. **DevOps, CI/CD, or cloud infrastructure:** delivery pipelines, operational
    engineering practices, or the cloud resources applications run on.
29. **Energy sector experience:** understanding energy generation, utilities,
    grids, metering, markets, or related operational workflows.
30. **FinOps and cloud cost optimization:** measuring and controlling cloud
    spend through architecture, usage, capacity, and cost accountability.
31. **High-traffic reliable systems:** delivering systems that remain available
    and predictable under large request or data volumes.
32. **Highly available production systems:** designing redundancy and failure
    handling so live services continue operating during faults.
33. **JSON and HTTP fundamentals:** understanding requests, responses, methods,
    headers, status codes, payloads, and JSON serialization.
34. **Large or distributed codebases:** navigating and changing a large codebase
    spread across many modules, repositories, or teams.
35. **Large-scale consumer products:** operating consumer-facing software with
    high user or traffic volume.
36. **Lending or related domain:** understanding lending, banking, fintech,
    financial-services, or closely related product rules.
37. **MCP or agentic workflows:** connecting tools through MCP, orchestrating AI
    agents, or building platforms used by developers.
38. **Micro-frontends:** splitting a frontend into independently developed and
    deployed application sections.
39. **Modern web technologies:** practical development with JavaScript,
    TypeScript, React, or an explicitly accepted equivalent.
40. **OOP and design patterns:** structuring software around objects and applying
    reusable patterns to responsibilities and dependencies.
41. **Other server-side language:** backend development in a language other than
    the primary language named by that particular offer.
42. **Platform reliability improvements:** increasing uptime, fault tolerance,
    recoverability, and operational efficiency of a platform.
43. **Production systems exposure:** having worked with live systems, real users,
    deployments, monitoring, and operational consequences.
44. **PST timezone overlap:** being available for the required number of working
    hours shared with Pacific Time.
45. **Python or data engineering exposure:** either using Python or working with
    data processing, pipelines, and related systems.
46. **Recommendation personalization or search:** ranking items, tailoring
    experiences to users, or building information-retrieval infrastructure.
47. **SABRE knowledge:** experience with the Sabre travel reservation and airline
    distribution platform.
48. **Security standards:** applying secrets handling, data protection, and
    secure application-development practices.
49. **Self-healing systems:** automatically detecting failures and restoring or
    replacing unhealthy components without manual intervention.
50. **Self-service onboarding platforms:** letting users configure or activate
    services themselves through onboarding and automated workflows.
51. **Software supply chain security:** protecting dependencies, builds,
    artifacts, repositories, and release pipelines from compromise.
52. **Software testing:** systematically checking behavior and quality through
    appropriate manual or automated testing techniques.
53. **Technical debt management:** identifying, prioritizing, and reducing
    maintainability risks while balancing product delivery.
54. **Testing knowledge:** understanding how tests are selected, structured, and
    used to prevent regressions; hands-on depth is not implied automatically.
55. **VBA or PowerShell automation:** scripting Microsoft Office processes with
    VBA or Windows/system administration tasks with PowerShell.
56. **Workflow automation solutions:** designing and implementing software that
    automates repeatable business or operational processes.

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
