# Propuesta de revisión de tags pendientes

Fecha: 2026-09-22. Alcance: los 56 tags sin mapear que están pendientes. Los
números son estables para que puedas referirte a cualquiera en tus comentarios.

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
| 7 | API design and management | **API design:** definir contratos claros de API. **API lifecycle management:** manejar versiones, compatibilidad y reglas de una API. | capability:api-design, capability:api-lifecycle-management |
| 8 | API design knowledge | Saber definir APIs claras, estables y escalables. | capability:api-design |
| 9 | API design principles | Aplicar reglas para errores, compatibilidad, paginación y cambios en APIs. | capability:api-design |
| 10 | API development | Construir endpoints, validaciones, lógica de negocio y respuestas. | capability:api-development |
| 11 | API knowledge | **Distributed systems:** servicios que colaboran por red. **API design:** contratos claros entre servicios. **Cloud native:** sistemas diseñados para correr en cloud. | capability:distributed, capability:api-design, capability:cloud-native |
| 12 | API orchestration | Combinar llamadas de varios servicios en un solo flujo. | capability:api-integration |
| 13 | Asynchronous workflows | **Asynchronous workflows:** tareas que continúan después de la petición inicial. **Distributed systems:** servicios coordinados por red. **Cloud infrastructure:** recursos cloud donde corren. | capability:asynchronous-workflows, capability:distributed, capability:cloud-infrastructure |
| 14 | Azure networking | **Azure:** usar servicios de Microsoft Azure. **Cloud networking:** configurar redes, rutas, firewalls y endpoints en cloud. | technology:azure, capability:cloud-networking |
| 15 | BFF or middleware integration | Crear una capa intermedia que adapta o combina servicios para un frontend. | capability:api-integration |
| 16 | ClickHouse or Aurora | **ClickHouse:** base de datos para analítica. **Amazon Aurora:** base de datos administrada de AWS compatible con MySQL/PostgreSQL. | technology:clickhouse, technology:amazon-aurora |
| 17 | Cloud infrastructure | Diseñar o manejar cómputo, red y almacenamiento en la nube. | capability:cloud-infrastructure |
| 18 | Cloud service operations and optimization | Operar servicios cloud y mejorar su costo, capacidad o rendimiento. | capability:cloud-operations |
| 19 | Consumer product shipping | Lanzar productos usados directamente por clientes finales. | capability:consumer-product-experience |
| 20 | Customer growth and provisioning | **Growth engineering:** mejorar activación o conversión de clientes. **Service provisioning:** crear y preparar recursos o servicios para un cliente. | capability:growth-engineering, capability:service-provisioning |
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
| 33 | JSON and HTTP fundamentals | **HTTP fundamentals:** entender peticiones, respuestas, métodos y códigos HTTP. **JSON:** formato común de datos que queda como contexto, no como tag. | capability:http-fundamentals |
| 34 | Large or distributed codebases | Trabajar en código grande repartido entre módulos, repositorios o equipos. | capability:large-codebase-experience |
| 35 | Large-scale consumer products | **Large-scale systems:** soportar mucho tráfico o datos. **Consumer product experience:** construir productos para usuarios finales. | capability:large-scale-systems, capability:consumer-product-experience |
| 36 | Lending or related domain | Conocer préstamos, banca, fintech o reglas financieras. | capability:financial |
| 37 | MCP or agentic workflows | **MCP:** conectar modelos de IA con herramientas y datos. **AI agents:** agentes que usan herramientas para cumplir tareas. **Developer platforms:** herramientas internas para ingenieros. | technology:mcp, capability:ai-agents, capability:developer-platforms |
| 38 | Micro-frontends | Dividir un frontend en partes desarrollables y desplegables por separado. | capability:micro-frontends |
| 39 | Modern web technologies | **JavaScript:** lenguaje web. **TypeScript:** JavaScript con tipos. **React:** librería para interfaces web. | technology:javascript, technology:typescript, technology:react |
| 40 | OOP and design patterns | Diseñar software con objetos y patrones reutilizables. | capability:object-oriented-design |
| 41 | Other server-side language | Un lenguaje backend distinto al lenguaje principal de esa oferta; no identifica una tecnología concreta. | Sin cambio |
| 42 | Platform reliability improvements | Mejorar disponibilidad, tolerancia a fallas y recuperación de una plataforma. | capability:high-availability |
| 43 | Production systems exposure | Haber trabajado con sistemas en vivo, despliegues y monitoreo. | capability:production-operations |
| 44 | PST timezone overlap | Poder trabajar horas que coincidan con la costa oeste de Estados Unidos; es disponibilidad, no habilidad. | Sin cambio |
| 45 | Python or data engineering exposure | **Python:** lenguaje de programación. **Data engineering:** construir pipelines y sistemas de datos. | technology:python, capability:data-engineering |
| 46 | Recommendation personalization or search | **Recommendation systems:** sugerir contenido o productos. **Personalization:** adaptar una experiencia a cada usuario. **Search engineering:** construir búsqueda de información. | capability:recommendation-systems, capability:personalization, capability:search-engineering |
| 47 | SABRE knowledge | Usar Sabre, plataforma de reservas y distribución de viajes. | technology:sabre |
| 48 | Security standards | Aplicar manejo de secretos, protección de datos y prácticas seguras al programar. | capability:secure-coding |
| 49 | Self-healing systems | Detectar fallas y recuperarse automáticamente. | capability:self-healing-systems |
| 50 | Self-service onboarding platforms | **Self-service platforms:** permitir que el usuario configure o active servicios solo. **Growth engineering:** mejorar activación. **Workflow automation:** automatizar pasos de ese proceso. | capability:self-service-platforms, capability:growth-engineering, capability:workflow-automation |
| 51 | Software supply chain security | **Secure coding:** proteger la aplicación al programarla. **Software supply chain security:** proteger dependencias, builds, artefactos y releases. | capability:secure-coding, capability:software-supply-chain-security |
| 52 | Software testing | Probar software manual o automáticamente para encontrar fallas. | capability:software-testing |
| 53 | Technical debt management | Identificar y reducir deuda técnica sin frenar el producto. | capability:technical-debt-management |
| 54 | Testing knowledge | Saber elegir y estructurar pruebas para evitar regresiones. | capability:software-testing |
| 55 | VBA or PowerShell automation | **VBA:** automatizar tareas de Microsoft Office. **PowerShell:** automatizar tareas de Windows y administración de sistemas. | technology:vba, technology:powershell |
| 56 | Workflow automation solutions | Crear soluciones que automaticen procesos repetitivos. | capability:workflow-automation |

## Resumen del lote

- 11 tags se resuelven por completo con conceptos que ya existen.
- 25 proponen crear un concepto canónico directo.
- 18 frases contienen varios conceptos y deben separarse para evitar un tag
  combinado artificial.
- 2 no pertenecen hoy al catálogo de habilidades: “other server-side language”
  depende de la oferta y el cruce con PST es disponibilidad.

Esta es una propuesta: no cambia el catálogo, los matches ni los puntajes hasta
que apruebes los cambios que quieras aplicar.
