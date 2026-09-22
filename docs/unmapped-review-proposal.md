# Active unmapped-tag proposal

Date: 2026-09-22. Scope: all 56 pending fingerprints. Numbers remain stable
until this proposal is applied or replaced. `Existing` reuses the catalog,
`New` adds canonical entries, `Rewrite` preserves compound source meaning with
explicit AND/OR mappings, and `Defer` keeps a real criterion outside the skill
catalog until the correct structured field exists.

| # | Initial tag | Group | Action and final tag(s) | Why |
|---:|---|---|---|---|
| 1 | Advanced automation | Automation | Create `capability:workflow-automation` — Workflow automation | Concrete automation engineering, not generic process improvement. |
| 2 | AI or automation integration | AI / automation | Map as OR: existing `ai-integration` or new `workflow-automation` | The offer explicitly accepts either route. |
| 3 | AI technology applications | AI | Map to existing `capability:ai-integration` — AI integration | It describes applying AI inside products or workflows. |
| 4 | AI-first solutions | AI | Map to existing `capability:ai-integration` — AI integration | AI-first product work is covered without inventing another synonym. |
| 5 | AI, ML, or agent systems | AI | Map as OR: `ai-integration`, new `machine-learning`, or `ai-agents` | These are three valid but distinct ways to satisfy the criterion. |
| 6 | Airline industry experience | Domain experience | Create `capability:airline-domain-experience` — Airline domain experience | Product tag would describe the job; this asks about candidate experience. |
| 7 | API design and management | APIs | Split as AND: new `api-design` + new `api-lifecycle-management` | Designing APIs and governing their lifecycle are separate abilities. |
| 8 | API design knowledge | APIs | Create/reuse new `capability:api-design` — API design | Specific conceptual API-design knowledge is missing from the catalog. |
| 9 | API design principles | APIs | Assign to new `capability:api-design` — API design | Same canonical meaning as #8. |
| 10 | API development | APIs | Create `capability:api-development` — API development | Building APIs is broader than the existing REST-only tag. |
| 11 | API knowledge | APIs / architecture | Split as AND: `distributed` + new `api-design` + `cloud-native` | The source lists all three knowledge areas, not one umbrella skill. |
| 12 | API orchestration | APIs | Assign to existing `capability:api-integration` — API integrations | Aggregating and transforming backend API data is API integration. |
| 13 | Asynchronous workflows | Architecture / cloud | Split as AND: new `asynchronous-workflows` + `distributed` + new `cloud-infrastructure` | The source independently asks for all three. |
| 14 | Azure networking | Cloud | Split as AND: existing `technology:azure` + new `capability:cloud-networking` | Azure familiarity alone does not prove networking knowledge. |
| 15 | BFF or middleware integration | APIs | Assign to existing `capability:api-integration` — API integrations | BFF/middleware work is a concrete API-integration form. |
| 16 | ClickHouse or Aurora | Database technologies | Map as OR: new `technology:clickhouse` or new `technology:amazon-aurora` | Named technologies should remain separate alternatives. |
| 17 | Cloud infrastructure | Cloud | Create `capability:cloud-infrastructure` — Cloud infrastructure | Neither cloud-native applications nor IaC fully covers infrastructure work. |
| 18 | Cloud service operations and optimization | Cloud | Create `capability:cloud-operations` — Cloud operations and optimization | Combines operating cloud services with explicit optimization responsibility. |
| 19 | Consumer product shipping | Product experience | Create `capability:consumer-product-experience` — Consumer product experience | Candidate experience is distinct from a job’s `project:consumer` classification. |
| 20 | Customer growth and provisioning | Growth / operations | Map as OR: `growth-engineering` or new `service-provisioning`; ignore “operational excellence” | Growth/onboarding and provisioning are concrete; the remaining phrase is vague. |
| 21 | Data infrastructure knowledge | Data / distributed systems | Split as AND: `data-engineering` + `distributed` | Deep data-infrastructure knowledge does not replace distributed-systems knowledge. |
| 22 | Data sourcing and integration | Data | Create `capability:data-integration` — Data integration | This is candidate integration work, not the existing product-domain tag. |
| 23 | Data-driven applications or dashboards | Data | Map as OR: new `data-applications` or existing `data-visualization` | Preserve both the application and dashboard paths stated by the offer. |
| 24 | Database engineering | Databases | Create `capability:database-engineering` — Database engineering | Do not infer the full discipline from one narrower DB skill. |
| 25 | Database performance tradeoffs | Databases | Split as AND: existing `data-integrity` + `query-optimization` | The evidence explicitly requires integrity/transactions and performance tradeoffs. |
| 26 | Design systems experience | Frontend architecture | Create `capability:design-systems` — Design systems | Shared component/design-library work is a reusable specialty. |
| 27 | Developer platforms and tooling | Developer tooling | Create `capability:developer-platforms` — Developer platforms | Candidate platform experience is not the same as a developer-tools product tag. |
| 28 | DevOps, CI/CD, or cloud infrastructure | Delivery / cloud | Map as OR: `devops`, `ci-cd`, or new `cloud-infrastructure`; ignore “systems engineering” | Three concrete alternatives remain; the last phrase is too broad. |
| 29 | Energy sector experience | Domain experience | Create `capability:energy-domain-experience` — Energy domain experience | Separate candidate history from `project:energy-utilities`. |
| 30 | FinOps and cloud cost optimization | Cloud economics | Create `capability:finops` — FinOps | This is a recognized, measurable cloud-cost specialty. |
| 31 | High-traffic reliable systems | Reliability / scale | Split as AND: new `large-scale-systems` + new `high-availability` | High traffic and reliability are both explicit requirements. |
| 32 | Highly available production systems | Reliability | Create `capability:high-availability` — High availability | More specific than merely operating production services. |
| 33 | JSON and HTTP fundamentals | Web protocols | Create `capability:http-fundamentals` — HTTP fundamentals; keep JSON as context | HTTP/status-code knowledge is measurable; JSON alone does not need another tag. |
| 34 | Large or distributed codebases | Engineering scale | Create `capability:large-codebase-experience` — Large codebase experience | A distributed codebase is not necessarily a distributed runtime system. |
| 35 | Large-scale consumer products | Product / scale | Split as AND: new `large-scale-systems` + new `consumer-product-experience` | The source requires both scale and consumer-product context. |
| 36 | Lending or related domain | Domain experience | Assign to existing `capability:financial` — Financial domain | Lending, banking and fintech are already covered by this canonical domain. |
| 37 | MCP or agentic workflows | AI / developer tooling | Map as OR: `technology:mcp`, `ai-agents`, or new `developer-platforms` | Preserve the three alternatives instead of inventing one mixed tag. |
| 38 | Micro-frontends | Frontend architecture | Create `capability:micro-frontends` — Micro-frontends | This is an architectural capability, not a framework. |
| 39 | Modern web technologies | Frontend technologies | Map as OR: existing `javascript`, `typescript`, or `react` | The evidence names these concrete acceptable alternatives. |
| 40 | OOP and design patterns | Software design | Create `capability:object-oriented-design` — Object-oriented design | Captures OOP plus design-pattern knowledge without tying it to a language. |
| 41 | Other server-side language | Languages | Defer; keep unmapped for now | “Other” depends on the job’s primary language; a static family would create false matches. |
| 42 | Platform reliability improvements | Reliability | Assign to new `capability:high-availability` — High availability | Reliability and uptime improvements share the canonical capability from #32. |
| 43 | Production systems exposure | Production | Assign to existing `capability:production-operations` — Production operations | Operating live services is stronger evidence and safely satisfies exposure. |
| 44 | PST timezone overlap | Work availability | Defer; move later to a timezone/availability field | It is a real constraint, but not a technology or capability. |
| 45 | Python or data engineering exposure | Data / language | Map as OR: existing `technology:python` or `capability:data-engineering` | Either alternative explicitly satisfies the offer. |
| 46 | Recommendation personalization or search | Search / recommendations | Map as OR: new `recommendation-systems`, `personalization`, or `search-engineering` | These specialties overlap but are not interchangeable profile facts. |
| 47 | SABRE knowledge | Travel technology | Create `technology:sabre` — Sabre | A named industry platform belongs in technologies. |
| 48 | Security standards | Security | Assign to existing `capability:secure-coding` — Secure coding | Secrets management and data protection fit application-security practice. |
| 49 | Self-healing systems | Reliability | Create `capability:self-healing-systems` — Self-healing systems | More specific than general high availability or observability. |
| 50 | Self-service onboarding platforms | Platforms / growth / automation | Map as OR: new `self-service-platforms`, `growth-engineering`, or new `workflow-automation` | The offer names three distinct acceptable product experiences. |
| 51 | Software supply chain security | Security | Split as AND: existing `secure-coding` + new `software-supply-chain-security` | Secure coding does not by itself prove dependency/build-chain security. |
| 52 | Software testing | Testing | Create `capability:software-testing` — Software testing | Broader than automated testing; the source does not limit the subtype. |
| 53 | Technical debt management | Maintainability | Create `capability:technical-debt-management` — Technical debt management | Concrete engineering-planning capability, not generic clean-code rhetoric. |
| 54 | Testing knowledge | Testing | Assign to new `software-testing` as conceptual knowledge; ignore generic design/debugging | Retain the specific measurable portion of the mixed sentence. |
| 55 | VBA or PowerShell automation | Automation technologies | Map as OR: new `technology:vba` or new `technology:powershell` | Named technologies remain separate alternatives. |
| 56 | Workflow automation solutions | Automation | Assign to new `capability:workflow-automation` — Workflow automation | Same canonical engineering capability introduced by #1. |

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
