# Laboratorio de API: GPT-6.1 Sol y Nemotron

Resultados de **dos modelos y dos enfoques** para el mismo API de promociones. Fecha: 14 de noviembre de 2026.
Las cuatro entregas están incorporadas; la revisión distingue resultados declarados, evidencia guardada y comprobación independiente.

## Diseño y resultados

Un chat nuevo y **un único prompt por caso**. Directo: contrato/contexto. Con spec: las mismas entradas más spec/plan/tareas preparados.

| Caso | Modelo | Enfoque | Tiempo (mm:ss) | Unitarias propias | E2E propias |
|---|---|---|---:|---:|---:|
| [A](experimentos/A-sol-directo/proyecto) | GPT-6.1 Sol | Directo | **16:47** | 87/87 | 59/59 |
| [C](experimentos/C-sol-spec/proyecto) | GPT-6.1 Sol | Con spec | **12:19** | 91/91 | 68/68 |
| [B](experimentos/B-nemotron-directo/proyecto) | Nemotron 3.5 Super VL Free | Directo | **13:06** | 39/39 | 35/35 reportadas |
| [D](experimentos/D-nemotron-spec/proyecto) | Nemotron 3.5 Super VL Free | Con spec | **18:37** | 44/44 | 37/37 reportadas |

Build y typecheck: exit 0 en las cuatro entregas según sus reportes; B/D se repitieron durante la revisión con exit 0.
Los tiempos son los **informados por el usuario en minutos:segundos**, no la duración de Vitest ni mediciones instrumentadas.
C tardó 4:28 menos que A; D tardó 5:31 más que B. El enfoque con spec no fue más rápido en ambos modelos.
Entre modelos, B tardó 3:41 menos que A y C tardó 6:18 menos que D. C tiene el menor tiempo informado de la muestra.

**Las cantidades de tests no miden calidad ni cobertura comparable:** las suites las escribió cada agente.
Sol cuenta con logs/JSON guardados de unit/e2e y comprobaciones HTTP/reinicio de proceso.
Para Nemotron, 35/37 e2e son las cifras comunicadas por el usuario/agente; no se encontraron logs originales guardados
ni se repitieron las e2e completas. El evaluador repitió build/tipos/unitarias B/D y ejecutó sondas puntuales sin escrituras
de negocio, encontrando incumplimientos que sus suites no detectaban. No son resultados de GitHub Actions.

Fuentes: [A: reporte](experimentos/A-sol-directo/evidencia/REPORTE.md), [C: AVANCE](experimentos/C-sol-spec/proyecto/AVANCE.md),
[B: README](experimentos/B-nemotron-directo/proyecto/README.md), [D: AVANCE](experimentos/D-nemotron-spec/proyecto/AVANCE.md),
[verificación independiente de Nemotron](evaluacion/verificacion-nemotron/revision-nemotron.json),
[tiempos](evaluacion/tiempos.json), [disponibilidad de evidencia](docs/limitaciones-evidencia.md).

## API del laboratorio

Entidad Promoción con **14 columnas físicas**: 13 del modelo de origen más `deleted_at`.
Las siete operaciones, bajo `/api/v1`, son:

| Tipo | Método y ruta |
|---|---|
| Crear una | `POST /promociones` |
| Crear varias | `POST /promociones/lote` |
| Modificar | `PATCH /promociones/{promocionId}` |
| Eliminar lógicamente | `DELETE /promociones/{promocionId}` |
| Consulta comercial | `GET /promociones?canal=MARKETPLACE` |
| Consulta administrativa | `GET /promociones/administracion` |
| Consulta de detalle | `GET /promociones/{promocionId}` |

El lote atómico y la eliminación lógica son extensiones académicas. Contrato: [OpenAPI](comun/openapi.yaml).
Reglas: [R01–R17](comun/contexto.md). [Trazabilidad y alcance](docs/trazabilidad.md).

## ¿En qué falló la IA? Los cuatro casos

| Caso | Fallo o limitación identificada | Estado de la evidencia |
|---|---|---|
| **A — Sol directo** | JOIN con bloqueo parcial puede leer configuración antigua tras esperar; prueba concurrente solo cubre campos principales. Además limita prioridad más que el contrato. | Riesgo por inspección, no reproducido directamente en A. Suites propias pasan. |
| **C — Sol con spec** | La primera implementación perdía alcance/política bajo concurrencia; pasaba 67 e2e porque faltaba ese escenario. | Prueba determinista falló; agente corrigió y acabó 68/68. Defecto inicial corregido. |
| **B — Nemotron directo** | Omite /api/v1; procesa JSON antes de autenticar; acepta fecha imposible y extras en alcance. | Reproducido por sondas independientes. Transacción PATCH sin FOR UPDATE: riesgo adicional por inspección. |
| **D — Nemotron con spec** | Errores incluyen timestamp/path no permitidos; JSON malformado autenticado usa formato por defecto; acepta fechas imposibles/extras. | Reproducido. SELECT FOR UPDATE usa pool.query fuera del client transaccional: defecto de bloqueo por inspección. |

**Sol C** conserva [el log de una regresión fallida](experimentos/C-sol-spec/proyecto/evidencias/regresion-concurrencia-antes.txt):
esperaba SKU-LAB-002/política nueva pero recibía la configuración antigua. Corrigió a bloquear primero y releer asociados
después. El [repositorio final de C](experimentos/C-sol-spec/proyecto/src/promotions.repository.ts) incluye esa solución;
el [servicio A](experimentos/A-sol-directo/proyecto/src/promotions.service.ts) conserva el patrón susceptible, sin que esta revisión haya reproducido el fallo en A.

**Nemotron B** devuelve 404 al pedir `/api/v1/promociones/no-uuid`; su bootstrap no configura el prefijo y sus e2e prueban
`/promociones`. Con cuerpo malformado sin token devuelve 400 en lugar de 401, porque el guard se ejecuta después del parser.
**D** sí devuelve 401 sin token antes del parser, pero con token y JSON malformado devuelve `application/json` con
`message/error/statusCode`, no el Problem contractual. Sus errores de dominio añaden `timestamp/path`, aunque el schema
prohíbe propiedades adicionales. Ambos validadores aceptan 30 de febrero y campos extra dentro de alcance.

En **D** escribir `SELECT FOR UPDATE` no basta: la consulta usa el pool, no el client de `withTransaction`, por lo que
el bloqueo de esa transacción implícita termina antes de proteger la escritura principal. La carrera resultante no fue
reproducida en esta revisión. En B tampoco se encontró un bloqueo que abarque su lectura/validación y actualización.

La frase «todo completo y verificado» de las respuestas B/D queda, por tanto, **acotada a sus pruebas propias**:
build, tipos y unitarias aprobados pueden coexistir con un API que incumple el contrato. No se corrigieron sus soluciones
durante la evaluación. [Informe completo con fuentes y alcance](evaluacion/informe-comparativo.md).

### Reflexión final

> La IA falló al cubrir casos difíciles y detalles del contrato, no solo al escribir código. Sol tuvo un defecto concurrente
> que C detectó y corrigió con una regresión; Nemotron dejó diferencias en rutas, errores, validación y bloqueos que sus
> pruebas no detectaban. La spec ayudó a orientar y revisar, pero no evitó automáticamente los errores ni redujo siempre
> el tiempo. Aprendimos a comprobar el contrato con casos independientes y a distinguir una afirmación de éxito de su evidencia.

En esta muestra **Sol C es la entrega mejor sustentada** por trazabilidad, evidencia y regresión corregida, además del
menor tiempo informado. No es un ranking universal: una corrida por celda, clientes distintos (Codex/OpenCode), pruebas
propias no equivalentes y sin desglose de tiempos impiden atribuir causalidad solo al modelo o a la spec.
El reinicio de proceso Node está documentado en Sol; D prueba cerrar/recrear Nest en el mismo proceso, no otro proceso.
No se afirma reinicio de contenedores PostgreSQL ni integración externa. Cupones/usos están fuera de alcance por R09.

## Prompts utilizados

Se verificó por comparación de texto que **A/B usaron el mismo prompt directo y C/D el mismo prompt con spec**, salvo
el nombre del modelo en la primera línea. Abajo se reemplaza únicamente por `{MODELO}`: `GPT-6.1 Sol` en A/C,
`Nemotron 3.5 Super VL Free` en B/D. Los textos exactos permanecen en `PROMPT-INICIAL.md` de cada proyecto y
en [PROMPTS-SOL.md](PROMPTS-SOL.md) / [PROMPTS-NEMOTRON.md](PROMPTS-NEMOTRON.md).

### Prompt directo — A y B

```text
Implementa el API académico de Promociones completo en este proyecto con {MODELO}.
Este es el único prompt del caso; completa código, SQL, pruebas y reporte en esta misma ejecución.
Lee contrato/openapi.yaml, contrato/contexto.md, contrato/catalogo.json, ENTREGA.md y ENTORNO.md.

Enfoque DIRECTO: implementa desde contrato/contexto. No generes spec, plan o tareas formales como fase previa. Puedes organizar internamente tu implementación.

Las dependencias ya están instaladas, el lock está fijado y PostgreSQL local está preparado.
Primero ejecuta node herramientas/comprobar-entorno.mjs y revisa PRECHECK-ENTORNO.json.
No uses npm install --offline. Si necesitas reinstalar, usa npm ci --no-audit --no-fund:
se permite acceso al registro npm para instalar exactamente el lock; eso no autoriza servicios de negocio externos.
Si una operación local da EACCES/EPERM por el sandbox, solicita la elevación de esa herramienta cuando el cliente
la admita, indicando que el usuario autorizó preparar/probar este laboratorio local. No confundas permiso denegado
con ausencia del compilador o de PostgreSQL. Respeta cualquier rechazo de permisos y registra el bloqueo real.

Implementa exactamente las siete operaciones con PostgreSQL real usando las URLs de .env y .env.test.
No cambies entradas, package.json, package-lock.json o tsconfig.json. No leas otros intentos/proyectos.
Mantén SQL/migraciones de negocio propios en sql/. La infraestructura común solo crea bases vacías;
debes crear las tablas de tu implementación antes de comprobarla. La DB e2e está separada de la de aplicación.
Puedes instalar/restaurar dependencias del lock y usar los contenedores locales del caso. No despliegues,
no conectes servicios de negocio externos, no cambies configuraciones globales y no delegues en otros agentes.
Entrega src/main.ts y el API NestJS, SQL reproducible, pruebas unitarias/e2e, sus configuraciones y README.
Ejecuta npm run build, npm run typecheck, npm test y npm run test:e2e; resuelve los errores del código
dentro de esta misma ejecución. Comprueba las siete operaciones y la persistencia local según el contexto.
No cuentes el preflight de infraestructura como pruebas de tu API. No cambies pruebas para ocultar errores.
Termina con archivos producidos, comandos/resultados reales, evidencias y limitaciones. No declares PASS sin salida.
No esperes otro mensaje para implementar ni te detengas tras redactar documentación.
```

### Prompt con spec preparada — C y D

```text
Implementa el API académico de Promociones completo en este proyecto con {MODELO}.
Este es el único prompt del caso; completa código, SQL, pruebas y reporte en esta misma ejecución.
Lee contrato/openapi.yaml, contrato/contexto.md, contrato/catalogo.json, ENTREGA.md y ENTORNO.md.

Enfoque CON SPEC: usa documentos/spec.md, documentos/plan.md y documentos/tareas.md ya preparados. No los reescribas; sigue sus dependencias y registra el avance propio en AVANCE.md.

Las dependencias ya están instaladas, el lock está fijado y PostgreSQL local está preparado.
Primero ejecuta node herramientas/comprobar-entorno.mjs y revisa PRECHECK-ENTORNO.json.
No uses npm install --offline. Si necesitas reinstalar, usa npm ci --no-audit --no-fund:
se permite acceso al registro npm para instalar exactamente el lock; eso no autoriza servicios de negocio externos.
Si una operación local da EACCES/EPERM por el sandbox, solicita la elevación de esa herramienta cuando el cliente
la admita, indicando que el usuario autorizó preparar/probar este laboratorio local. No confundas permiso denegado
con ausencia del compilador o de PostgreSQL. Respeta cualquier rechazo de permisos y registra el bloqueo real.

Implementa exactamente las siete operaciones con PostgreSQL real usando las URLs de .env y .env.test.
No cambies entradas, package.json, package-lock.json o tsconfig.json. No leas otros intentos/proyectos.
Mantén SQL/migraciones de negocio propios en sql/. La infraestructura común solo crea bases vacías;
debes crear las tablas de tu implementación antes de comprobarla. La DB e2e está separada de la de aplicación.
Puedes instalar/restaurar dependencias del lock y usar los contenedores locales del caso. No despliegues,
no conectes servicios de negocio externos, no cambies configuraciones globales y no delegues en otros agentes.
Entrega src/main.ts y el API NestJS, SQL reproducible, pruebas unitarias/e2e, sus configuraciones y README.
Ejecuta npm run build, npm run typecheck, npm test y npm run test:e2e; resuelve los errores del código
dentro de esta misma ejecución. Comprueba las siete operaciones y la persistencia local según el contexto.
No cuentes el preflight de infraestructura como pruebas de tu API. No cambies pruebas para ocultar errores.
Termina con archivos producidos, comandos/resultados reales, evidencias y limitaciones. No declares PASS sin salida.
No esperes otro mensaje para implementar ni te detengas tras redactar documentación.
```

### ¿Qué dicen la spec, el plan y las tareas que reciben C y D?

Son los **mismos tres documentos preparados** para ambos modelos; no son archivos que los agentes deban generar.
Los nombres históricos de casos dentro de algunos encabezados indican procedencia, no requisitos distintos.

**[Spec completa](entrada-spec/spec.md)**: define propósito, actores ADMIN/LECTOR, siete operaciones O01–O07,
criterios observables de entrada/salida y estas reglas compartidas:

| Reglas | Contenido que el agente debe implementar |
|---|---|
| R01–R02 | Nombre válido, descuento positivo/finito, porcentaje <=100; fechas con zona, inicio<fin y vigencia [inicio,fin) |
| R03–R06 | Alcance por productIds/SKUs activos conservando identidades; enums/prioridad; canales explícitos únicos; tres booleanos de combinación |
| R07 | PATCH conserva omitidos, sustituye objetos/listas presentes y valida la entidad fusionada; rechaza extras/solo lectura |
| R08–R10 | Primera activación persistente, capacidad de cambio de modalidad calculada; R09 excluye cupones/usos; UUID nuevo y nombres repetidos permitidos |
| R11–R12 | Lote 1–20, todos o ninguno en una transacción; DELETE lógico, historial conservado y posteriores accesos 404 |
| R13–R14 | Listado administrativo paginado/filtrado con conteo previo y orden estable; comercial por canal/estado/tiempo y resumen snake_case |
| R15–R17 | Tokens locales y autenticación antes de JSON/ID; errores Problem con códigos/status pactados; PostgreSQL real con persistencia tras reinicio |

La spec exige 13 columnas originales más deleted_at, configuración asociada persistida, SQL reproducible,
pruebas unitarias/e2e y comandos reales. Delimita fixtures académicos, ausencia de servicios externos y prohibición
de inventar rutas. Pide conservar el contrato/contexto si una decisión de implementación los contradice.

**[Plan completo](entrada-spec/plan.md)**: ocho etapas P01–P08:
1. Leer entradas y comprobar entorno.
2. Preparar persistencia y SQL.
3. Implementar validación, fusión PATCH y errores.
4. Configurar HTTP y autenticación antes del parser.
5. Crear individualmente y por lote transaccional.
6. Modificar/eliminar conservando historia y consistencia concurrente.
7. Implementar las tres consultas.
8. Ejecutar pruebas y entregar documentación/evidencias.

El plan exige una misma conexión por transacción, rollback/liberación, serializar lectura/fusión/escritura,
normalizar errores del framework y no ocultar PostgreSQL detrás de arrays. No proporciona código solución.

**[Tareas completas](entrada-spec/tareas.md)**: doce tareas T01–T12 con dependencias y criterio de terminación:
lectura → configuración/SQL → validación → auth/errores → alta → lote → PATCH → consultas → eliminación →
pruebas → documentación → revisión final. Cada una traza O01–O07/R01–R17. Sus casos mínimos incluyen
rollback, PATCH cruzado, historia, filtros, roles y reinicio. Los documentos se mantienen congelados;
el agente registra su progreso aparte en AVANCE.md y no espera un segundo prompt.

## Reproducir

Requisitos: Node 24, npm y Docker Desktop con contenedores Linux. Desde la raíz del clon:

```powershell
docker pull postgres@sha256:748a18a54d3842d43bc156f0840d78029b8d349e0feca98c12b9c4ce3404a6b3
docker compose -f intento-2/infra/compose.yaml up -d --wait
cd experimentos/A-sol-directo/proyecto
Copy-Item .env.example .env
Copy-Item .env.test.example .env.test
npm ci --no-audit --no-fund
npm run build
node --env-file=.env herramientas/migrar.mjs
node --env-file=.env.test herramientas/migrar.mjs --test
npm run typecheck
npm test
npm run test:e2e
npm start
```

Para C, usar `experimentos/C-sol-spec/proyecto` en lugar de A. HTTP: A 3301, C 3302; PostgreSQL: A 55434,
C 55435. Cada caso utiliza `lab_promociones` y `lab_promociones_test` en su instancia aislada.
Consultar el README de cada entrega para comandos y límites específicos. Las pruebas e2e limpian su base de pruebas.
Los `.env` no se publican: se crean desde ejemplos que contienen exclusivamente valores de desarrollo local.

Para Nemotron, usar `nemotron/infra/compose.yaml`, las carpetas B/D y sus ejemplos de entorno. Aplicar el SQL de cada proyecto con psql antes de arrancar; B y D no incluyen el migrador de Sol. Los prechecks guardados registran la preparación en la máquina
original; un clon necesita instalar dependencias e iniciar sus propios servicios.

## Estructura y procedencia

- `comun/`: contrato y reglas comunes; `entrada-spec/`: spec, plan y tareas de entrada.
- `experimentos/`: implementaciones A/B/C/D, prompts y evidencia disponible.
- `evaluacion/`: análisis, tiempos y sondas del evaluador, separados de pruebas de los agentes.
- `intento-2/infra/`: PostgreSQL Sol; `nemotron/infra/`: PostgreSQL Nemotron.
- `docs/`: trazabilidad, disponibilidad de evidencia y publicación.

No se publican `.env` reales, node_modules, builds, cachés ni datos PostgreSQL. Los ejemplos usan fixtures locales.
El código entregado se conserva sin correcciones de evaluación. Los logs públicos normalizan rutas de la máquina
original; ver [manifiesto](docs/manifiesto-publicacion.json). [Análisis histórico A/C](evaluacion/informe-A-C.md).
