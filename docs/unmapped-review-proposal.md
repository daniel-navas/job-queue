# Propuesta de revisión de tags pendientes

Fecha: 2026-09-22. Alcance: los 56 tags sin mapear que están pendientes.
Los números son estables para que puedas referirte a cualquiera en tus
comentarios. Esto revisa el **catálogo**: decidir si algo ya existe, si hay que
crearlo, si una frase contiene varios conceptos, o si no corresponde a un tag.

**Cómo leer la tabla**

- **Tag inicial:** lo que extrajo el procesador de una oferta.
- **Qué significa:** explicación corta y práctica del conocimiento o experiencia.
- **Qué hacer:** decisión propuesta para el catálogo.
- **Resultado:** tag canónico que quedaría. El texto entre paréntesis invertidos
  es solo su identificador interno; el nombre legible es el que está antes.
- **Separar:** una frase menciona dos o más cosas; cada una debe quedar como tag
  independiente. No significa nada sobre `OR` o `AND` de la vacante.

| # | Tag inicial | Qué significa | Qué hacer | Resultado propuesto |
|---:|---|---|---|---|
| 1 | Advanced automation | Automatizar procesos repetitivos de varios pasos. | Crear. | Workflow automation (`capability:workflow-automation`) |
| 2 | AI or automation integration | Conectar IA o automatizaciones a un producto. | Separar. | AI integration + Workflow automation |
| 3 | AI technology applications | Usar IA dentro de apps o procesos reales. | Usar existente. | AI integration (`capability:ai-integration`) |
| 4 | AI-first solutions | Crear productos cuya función central depende de IA. | Usar existente. | AI integration (`capability:ai-integration`) |
| 5 | AI, ML, or agent systems | Trabajar con IA, modelos de ML o agentes. | Separar. | AI integration + Machine learning + AI agents |
| 6 | Airline industry experience | Conocer operación de aerolíneas, reservas o tarifas. | Crear. | Airline domain experience (`capability:airline-domain-experience`) |
| 7 | API design and management | Diseñar APIs y manejar sus versiones y reglas. | Separar. | API design + API lifecycle management |
| 8 | API design knowledge | Saber definir APIs claras, estables y escalables. | Crear. | API design (`capability:api-design`) |
| 9 | API design principles | Aplicar reglas de compatibilidad, errores y paginación en APIs. | Unir al #8. | API design (`capability:api-design`) |
| 10 | API development | Construir endpoints, validaciones y respuestas. | Crear. | API development (`capability:api-development`) |
| 11 | API knowledge | Conocer APIs junto con sistemas distribuidos y cloud. | Separar. | Distributed systems + API design + Cloud native |
| 12 | API orchestration | Combinar llamadas de varios servicios en un flujo. | Usar existente. | API integrations (`capability:api-integration`) |
| 13 | Asynchronous workflows | Coordinar tareas, eventos o jobs que siguen fuera de la petición inicial. | Separar. | Asynchronous workflows + Distributed systems + Cloud infrastructure |
| 14 | Azure networking | Configurar redes, rutas, firewalls y endpoints privados en Azure. | Separar. | Azure + Cloud networking |
| 15 | BFF or middleware integration | Crear una capa intermedia entre frontend y servicios. | Usar existente. | API integrations (`capability:api-integration`) |
| 16 | ClickHouse or Aurora | Usar ClickHouse para analítica o Aurora como base de datos administrada de AWS. | Separar. | ClickHouse + Amazon Aurora |
| 17 | Cloud infrastructure | Diseñar o manejar cómputo, red y almacenamiento en la nube. | Crear. | Cloud infrastructure (`capability:cloud-infrastructure`) |
| 18 | Cloud service operations and optimization | Operar servicios cloud y mejorar costo, capacidad o rendimiento. | Crear. | Cloud operations and optimization (`capability:cloud-operations`) |
| 19 | Consumer product shipping | Lanzar productos usados directamente por clientes finales. | Crear. | Consumer product experience (`capability:consumer-product-experience`) |
| 20 | Customer growth and provisioning | Mejorar activación de clientes o preparar sus recursos/servicios. | Separar; ignorar “operational excellence”. | Growth engineering + Service provisioning |
| 21 | Data infrastructure knowledge | Conocer pipelines, almacenamiento y movimiento de datos. | Separar. | Data engineering + Distributed systems |
| 22 | Data sourcing and integration | Traer datos de varias fuentes y combinarlos de forma confiable. | Crear. | Data integration (`capability:data-integration`) |
| 23 | Data-driven applications or dashboards | Crear apps basadas en datos o tableros para verlos. | Separar. | Data applications + Data visualization |
| 24 | Database engineering | Diseñar, operar y mejorar bases de datos como responsabilidad principal. | Crear. | Database engineering (`capability:database-engineering`) |
| 25 | Database performance tradeoffs | Balancear integridad de datos con velocidad y costo de consultas. | Separar. | Data integrity + Query optimization |
| 26 | Design systems experience | Crear componentes, estilos y reglas de interfaz reutilizables. | Crear. | Design systems (`capability:design-systems`) |
| 27 | Developer platforms and tooling | Crear herramientas o plataformas internas para otros desarrolladores. | Crear. | Developer platforms (`capability:developer-platforms`) |
| 28 | DevOps, CI/CD, or cloud infrastructure | Manejar despliegues, pipelines o infraestructura cloud. | Separar; ignorar “systems engineering”. | DevOps + CI/CD + Cloud infrastructure |
| 29 | Energy sector experience | Conocer energía, utilities, redes, medición o mercados energéticos. | Crear. | Energy domain experience (`capability:energy-domain-experience`) |
| 30 | FinOps and cloud cost optimization | Controlar y reducir gasto en la nube. | Crear. | FinOps (`capability:finops`) |
| 31 | High-traffic reliable systems | Mantener sistemas estables bajo mucho tráfico. | Separar. | Large-scale systems + High availability |
| 32 | Highly available production systems | Diseñar sistemas que sigan funcionando ante fallas. | Crear. | High availability (`capability:high-availability`) |
| 33 | JSON and HTTP fundamentals | Entender peticiones web, respuestas, códigos HTTP y JSON. | Crear HTTP; JSON queda como contexto. | HTTP fundamentals (`capability:http-fundamentals`) |
| 34 | Large or distributed codebases | Trabajar en código grande repartido entre módulos, repos o equipos. | Crear. | Large codebase experience (`capability:large-codebase-experience`) |
| 35 | Large-scale consumer products | Trabajar en productos de consumo con muchos usuarios. | Separar. | Large-scale systems + Consumer product experience |
| 36 | Lending or related domain | Conocer préstamos, banca, fintech o reglas financieras. | Usar existente. | Financial domain (`capability:financial`) |
| 37 | MCP or agentic workflows | Conectar herramientas por MCP o coordinar agentes de IA. | Separar. | MCP + AI agents + Developer platforms |
| 38 | Micro-frontends | Dividir un frontend en partes desplegables por separado. | Crear. | Micro-frontends (`capability:micro-frontends`) |
| 39 | Modern web technologies | Usar tecnologías web actuales como JavaScript, TypeScript o React. | Separar. | JavaScript + TypeScript + React |
| 40 | OOP and design patterns | Diseñar software con objetos y patrones reutilizables. | Crear. | Object-oriented design (`capability:object-oriented-design`) |
| 41 | Other server-side language | Usar un lenguaje backend distinto al principal de esa oferta. | Diferir; depende del contexto de la oferta. | Sin cambio de catálogo |
| 42 | Platform reliability improvements | Mejorar disponibilidad, tolerancia a fallas y recuperación. | Unir al #32. | High availability (`capability:high-availability`) |
| 43 | Production systems exposure | Haber trabajado con sistemas en vivo, despliegues y monitoreo. | Usar existente. | Production operations (`capability:production-operations`) |
| 44 | PST timezone overlap | Poder trabajar horas que coincidan con la costa oeste de EE. UU. | Diferir; es disponibilidad, no habilidad. | Futuro campo de horario/zona horaria |
| 45 | Python or data engineering exposure | Usar Python o trabajar con pipelines y procesamiento de datos. | Separar. | Python + Data engineering |
| 46 | Recommendation personalization or search | Recomendar, personalizar o buscar contenido para usuarios. | Separar. | Recommendation systems + Personalization + Search engineering |
| 47 | SABRE knowledge | Usar Sabre, plataforma de reservas y distribución de viajes. | Crear. | Sabre (`technology:sabre`) |
| 48 | Security standards | Aplicar manejo de secretos, protección de datos y prácticas seguras. | Usar existente. | Secure coding (`capability:secure-coding`) |
| 49 | Self-healing systems | Detectar fallas y recuperarse automáticamente. | Crear. | Self-healing systems (`capability:self-healing-systems`) |
| 50 | Self-service onboarding platforms | Permitir que usuarios activen o configuren servicios solos. | Separar. | Self-service platforms + Growth engineering + Workflow automation |
| 51 | Software supply chain security | Proteger dependencias, builds, artefactos y releases. | Separar. | Secure coding + Software supply chain security |
| 52 | Software testing | Probar software de forma manual o automatizada. | Crear. | Software testing (`capability:software-testing`) |
| 53 | Technical debt management | Identificar y reducir deuda técnica sin frenar el producto. | Crear. | Technical debt management (`capability:technical-debt-management`) |
| 54 | Testing knowledge | Saber elegir y estructurar pruebas para evitar regresiones. | Unir al #52; ignorar diseño/debugging genéricos. | Software testing (`capability:software-testing`) |
| 55 | VBA or PowerShell automation | Automatizar Office con VBA o tareas de Windows con PowerShell. | Separar. | VBA + PowerShell |
| 56 | Workflow automation solutions | Crear soluciones que automaticen procesos repetitivos. | Unir al #1. | Workflow automation (`capability:workflow-automation`) |

## Resumen del lote

- 11 tags se resuelven por completo con conceptos que ya existen.
- 25 proponen crear un concepto canónico directo.
- 18 frases contienen varios conceptos y deben separarse para evitar un tag
  combinado artificial.
- 2 no pertenecen hoy al catálogo de habilidades: “other server-side language”
  depende de la oferta y el cruce con PST es disponibilidad.
- En 20, 28 y 54 solo se ignoran fragmentos genéricos; no se pierde su parte
  concreta.

Esta es una propuesta: no cambia el catálogo, los matches ni los puntajes hasta
que apruebes los cambios que quieras aplicar.
