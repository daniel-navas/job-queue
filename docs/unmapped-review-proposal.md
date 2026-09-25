# Propuesta de revisión de tags pendientes

Fecha: 2026-09-22. Alcance: los 56 tags del lote original. Los números son
estables para que puedas referirte a cualquiera en tus comentarios. El lote ya
está revisado: 53 decisiones se aplicaron y 3 quedaron diferidas, con un TODO
explícito, porque requieren una categoría de requisito que hoy no existe.

**Cómo leerla**

- **Tag inicial:** lo que extrajo el procesador de una oferta.
- **Qué significa:** explicación práctica de cada concepto en esa frase.
- **Resultado propuesto:** identificador(es) canónico(s). Si hay varios, la
  frase debe separarse en esos conceptos; no es una decisión de alternativas.
- **Sin cambio:** no debe convertirse en un tag del catálogo actual.

| # | Tag inicial | Qué significa | Resultado propuesto |
|---:|---|---|---|
| 1 | Advanced automation | Crear automatizaciones que reemplazan procesos manuales de varios pasos. | capability:workflow-automation |
| 2 | AI or automation integration | **AI integration:** conectar IA a una app para hacer trabajo real. **Workflow automation:** automatizar procesos repetitivos. | capability:ai-integration, capability:workflow-automation |
| 3 | AI technology applications | Usar modelos, APIs o resultados de IA dentro de una app o proceso. | capability:ai-integration |
| 4 | AI-first solutions | Crear productos cuya función principal depende de IA. | capability:ai-integration |
| 5 | AI, ML, or agent systems | **AI integration:** usar IA en un producto. **Machine learning:** crear o usar sistemas que aprenden de datos. **AI agents:** agentes que usan herramientas para cumplir tareas. | capability:ai-integration, capability:machine-learning, capability:ai-agents |
| 6 | Airline industry experience | Conocer reservas, tarifas, inventario u operación de aerolíneas. | capability:airline-domain-experience |
| 7 | API design and management | Diseñar contratos de API y manejar sus cambios; la evidencia no justifica separar una especialidad de gestión. | capability:api-development |
| 8 | API design knowledge | Saber definir APIs claras, estables y escalables. | capability:api-development |
| 9 | API design principles | Aplicar reglas para errores, compatibilidad, paginación y cambios en APIs. | capability:api-development |
| 10 | API development | Construir endpoints, validaciones, lógica de negocio y respuestas. | capability:api-development |
| 11 | API knowledge | **Distributed systems:** servicios que colaboran por red. **API development:** diseñar o construir APIs. **Cloud native:** sistemas diseñados para correr en cloud. | capability:distributed, capability:api-development, capability:cloud-native |
| 12 | API orchestration | Combinar llamadas de varios servicios en un solo flujo. | capability:api-integration |
| 13 | Asynchronous workflows | **Asynchronous workflows:** tareas que continúan después de la petición inicial. **Distributed systems:** servicios coordinados por red. **Cloud infrastructure:** recursos cloud donde corren. | capability:asynchronous-workflows, capability:distributed, capability:cloud-infrastructure |
| 14 | Azure networking | **Azure:** usar servicios de Microsoft Azure. **Cloud networking:** configurar redes, rutas, firewalls y endpoints en cloud. | technology:azure, capability:cloud-networking |
| 15 | BFF or middleware integration | Crear una capa intermedia que adapta o combina servicios para un frontend. | capability:api-integration |
| 16 | ClickHouse or Aurora | **ClickHouse:** base de datos para analítica. **Amazon Aurora:** base de datos administrada de AWS compatible con MySQL/PostgreSQL. | technology:clickhouse, technology:amazon-aurora |
| 17 | Cloud infrastructure | Diseñar o manejar cómputo, red y almacenamiento en la nube. | capability:cloud-infrastructure |
| 18 | Cloud service operations and optimization | Operar servicios cloud y mejorar su costo, capacidad o rendimiento. | capability:cloud-operations |
| 19 | Consumer product shipping | Lanzar productos usados directamente por consumidores; no todos los ingenieros senior tienen esta experiencia. | capability:consumer-product-development |
| 20 | Customer growth and provisioning | Mejorar activación, onboarding o conversión de clientes. “Provisioning” y “operational excellence” son demasiado vagos aquí. | capability:growth-engineering |
| 21 | Data infrastructure knowledge | **Data engineering:** construir pipelines y sistemas de datos. **Distributed systems:** mover y procesar datos entre servicios. | capability:data-engineering, capability:distributed |
| 22 | Data sourcing and integration | Traer datos de varias fuentes y combinarlos de forma confiable. | capability:data-integration |
| 23 | Data-driven applications or dashboards | **Data applications:** apps cuyo valor depende de datos. **Data visualization:** tableros o gráficas para entender datos. | capability:data-applications, capability:data-visualization |
| 24 | Database engineering | Diseñar, operar y mejorar bases de datos como responsabilidad principal. | capability:database-engineering |
| 25 | Database performance tradeoffs | **Data integrity:** proteger consistencia y corrección de datos. **Query optimization:** mejorar velocidad y costo de consultas. | capability:data-integrity, capability:query-optimization |
| 26 | Design systems experience | Crear componentes, estilos y reglas de interfaz reutilizables. | capability:design-systems |
| 27 | Developer platforms and tooling | Crear herramientas o plataformas internas para otros desarrolladores. | capability:developer-platforms |
| 28 | DevOps, CI/CD, or cloud infrastructure | **DevOps:** operar y entregar software de forma confiable. **CI/CD:** automatizar pruebas y despliegues. **Cloud infrastructure:** manejar recursos cloud. | capability:devops, capability:ci-cd, capability:cloud-infrastructure |
| 29 | Energy sector experience | Conocer generación, utilities, redes, medición o mercados de energía. | capability:energy-domain-experience |
| 30 | FinOps and cloud cost optimization | Medir, controlar y reducir gasto en la nube. | capability:finops |
| 31 | High-traffic reliable systems | **Large-scale systems:** sistemas que soportan mucho tráfico o datos. **High availability:** sistemas que siguen funcionando ante fallas. | capability:large-scale-systems, capability:high-availability |
| 32 | Highly available production systems | Diseñar redundancia y recuperación para que un sistema en vivo siga funcionando. | capability:high-availability |
| 33 | JSON and HTTP fundamentals | Conocimientos básicos esperables en un ingeniero web/backend experimentado. | Sin tag (no diferenciador) |
| 34 | Large or distributed codebases | Descripción vaga de experiencia con bases de código grandes, sin una especialidad medible. | Sin tag (no diferenciador) |
| 35 | Large-scale consumer products | **Large-scale systems:** soportar mucho tráfico o datos. **Consumer product development:** construir productos para usuarios finales. | capability:large-scale-systems, capability:consumer-product-development |
| 36 | Lending or related domain | Conocer préstamos, banca, fintech o reglas financieras. | capability:financial |
| 37 | MCP or agentic workflows | **MCP:** conectar modelos de IA con herramientas y datos. **AI agents:** agentes que usan herramientas para cumplir tareas. **Developer platforms:** herramientas internas para ingenieros. | technology:mcp, capability:ai-agents, capability:developer-platforms |
| 38 | Micro-frontends | Dividir un frontend en partes desarrollables y desplegables por separado. | capability:micro-frontends |
| 39 | Modern web technologies | **JavaScript:** lenguaje web. **TypeScript:** JavaScript con tipos. **React:** librería para interfaces web. | technology:javascript, technology:typescript, technology:react |
| 40 | OOP and design patterns | Diseñar software con objetos y patrones reutilizables. | capability:object-oriented-design |
| 41 | Other server-side language | Experiencia con Node.js o con algún lenguaje usado en backend. Se acepta la aproximación simple aunque no garantice que sea un lenguaje adicional a Node.js. | technology:nodejs \| technology:server-side-language |
| 42 | Platform reliability improvements | Mejorar disponibilidad, tolerancia a fallas y recuperación de una plataforma. | capability:high-availability |
| 43 | Production systems exposure | Haber trabajado con sistemas en vivo, despliegues y monitoreo. | capability:production-operations |
| 44 | PST timezone overlap | Poder trabajar horas que coincidan con la costa oeste de Estados Unidos; es disponibilidad, no habilidad. | Sin cambio |
| 45 | Python or data engineering exposure | **Python:** lenguaje de programación. **Data engineering:** construir pipelines y sistemas de datos. | technology:python, capability:data-engineering |
| 46 | Recommendation personalization or search | **Recommendation systems:** recomendar o personalizar contenido/productos. **Search engineering:** construir infraestructura de búsqueda. | capability:recommendation-systems, capability:search-engineering |
| 47 | SABRE knowledge | Usar Sabre, plataforma de reservas y distribución de viajes. | technology:sabre |
| 48 | Security standards | Aplicar manejo de secretos, protección de datos y prácticas seguras al programar. | capability:secure-coding |
| 49 | Self-healing systems | Detectar fallas y recuperarse automáticamente. | capability:self-healing-systems |
| 50 | Self-service onboarding platforms | **Self-service platforms:** permitir que el usuario configure o active servicios solo. **Growth engineering:** mejorar activación. **Workflow automation:** automatizar pasos de ese proceso. | capability:self-service-platforms, capability:growth-engineering, capability:workflow-automation |
| 51 | Software supply chain security | **Secure coding:** proteger la aplicación al programarla. **Software supply chain security:** proteger dependencias, builds, artefactos y releases. | capability:secure-coding, capability:software-supply-chain-security |
| 52 | Software testing | Expectativa genérica de probar software, sin una especialidad concreta de testing. | Sin tag (no diferenciador) |
| 53 | Technical debt management | Responsabilidad normal de ingeniería senior sin alcance especializado o medible. | Sin tag (no diferenciador) |
| 54 | Testing knowledge | Conocimiento genérico de pruebas; unit, integration, E2E u otra especialidad explícita sí conservarían su tag. | Sin tag (no diferenciador) |
| 55 | VBA or PowerShell automation | **VBA:** automatizar tareas de Microsoft Office. **PowerShell:** automatizar tareas de Windows y administración de sistemas. | technology:vba, technology:powershell |
| 56 | Workflow automation solutions | Crear soluciones que automaticen procesos repetitivos. | capability:workflow-automation |

## Resumen del lote

- Los resultados con varios identificadores separan conceptos diferentes.
- Los resultados con `|` representan alternativas aceptables.
- Los fundamentos o responsabilidades rutinarias marcados como no
  diferenciadores no entran al matching.
- El cruce con PST queda pendiente de un modelo para requisitos no técnicos.
- El conteo final por tipo se recalculará cuando termine la revisión completa.

Las decisiones aprobadas están implementadas. Los puntos 37, 44 y 45 están
pendientes en el review: requieren alternativas entre tipos distintos o una
categoría de elegibilidad no técnica. Permanecen visibles y sin resolver hasta
que se implemente ese modelo.
