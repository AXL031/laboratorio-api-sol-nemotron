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

## Consumo de tokens por intento

Contadores recuperados de las sesiones finales del laboratorio el 14 de noviembre de 2026. Se excluyen intentos anteriores, el chat del evaluador y las sesiones separadas `codex-auto-review`.

| Caso | Modelo | Entrada sin caché | Lectura de caché | Salida con razonamiento | Total normalizado |
|---|---|---:|---:|---:|---:|
| A | GPT-6.1 Sol | 36,251 | 618,496 | 28,974 | **683,721** |
| C | GPT-6.1 Sol | 42,453 | 912,896 | 38,294 | **993,643** |
| B | Nemotron | 171,042 | 4,548,464 | 77,298 | **4,796,804** |
| D | Nemotron | 461,637 | 13,571,680 | 87,445 | **14,120,762** |

**Método.** En Codex se toma el último `total_token_usage`, sin sumar sus eventos acumulados. Su entrada ya incluye caché y su salida incluye razonamiento. En OpenCode se suman los contadores de cada respuesta del modelo (53 en B y 100 en D); entrada, salida, razonamiento y caché están separados. Aquí la salida incorpora razonamiento para presentar columnas equivalentes. Todas las escrituras de caché registradas son cero.

Las capturas aportadas muestran **126.550 tokens en B y 295.761 en D**. Estos valores coinciden exactamente con los contadores de la **última respuesta**, no con el consumo acumulado del intento. El agregado interno de sesión de OpenCode es ligeramente mayor que la suma de respuestas: 4.797.856 en B y 14.121.824 en D. Se conservan ambas medidas en la evidencia; no se atribuye la diferencia a una causa sin comprobarla. El costo registrado por OpenCode es US$0 para ambas sesiones gratuitas; no se calculó un costo monetario equivalente para Sol.

**Límites de comparación.** Los proveedores pueden usar tokenizadores y criterios de reporte distintos. El total incluye lecturas repetidas de contexto y caché; no representa texto único generado, calidad, costo comparable ni eficiencia universal del modelo. En esta muestra, la variante con spec acumuló más tokens en ambos modelos.

**Discrepancia de tiempos.** Los valores de la tabla inicial se conservan como fueron informados por el usuario. Sin embargo, los eventos `task_started`/`task_complete` de las sesiones que entregaron 87/59 pruebas (A) y 91/68 (C) registran A = **12:19,468** y C = **16:47,843**, respectivamente. Los tiempos informados de Sol parecen intercambiados; las conclusiones de velocidad basadas en ellos quedan pendientes de reconciliar ambas fuentes.

Evidencia seleccionada y fórmulas: [tokens.json](evaluacion/tokens.json). No se publican conversaciones ni bases locales.

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

## Análisis de GPT-6.1 Sol

Sol construyó dos implementaciones NestJS con PostgreSQL real: A desde contrato/contexto y C con la spec, el plan y las tareas preparados. En ambos casos entregó las siete operaciones, SQL, autenticación, validaciones, pruebas y documentación. Los logs guardados muestran build y typecheck correctos, pruebas unitarias/e2e aprobadas y comprobadores HTTP que conservaron datos al detener Node y arrancar otro proceso.

### Caso A — generación directa

**Qué hizo.** Implementó el acceso SQL de promociones principalmente en el servicio, con una clase de conexión aparte. Incluyó creación individual y por lote, fusión de PATCH, historial de activación, borrado lógico y consultas comerciales/administrativas. Conservó reportes de las siete operaciones, rollback de lote ante un fallo SQL y persistencia entre procesos.

**Resultados.** Tiempo informado: **16:47**. Unitarias: **87/87**. E2E: **59/59**. Build y typecheck: exit 0, según las evidencias de la entrega. [Reporte de A](experimentos/A-sol-directo/evidencia/REPORTE.md).

**Errores, riesgos y limitaciones.** El servicio lee promoción y configuración mediante un JOIN y bloquea solo la fila principal. Si espera a otra transacción que cambia los datos asociados, existe riesgo de leer configuración antigua y perder cambios omitidos por el PATCH. Su prueba concurrente solo cambia nombre y prioridad de la tabla principal; no fuerza ese escenario asociado. Es un **riesgo por inspección, no reproducido directamente en A**. También restringe prioridad a enteros seguros de JavaScript, un máximo que el contrato no declara. Esta limitación está documentada, pero documentarla no modifica el contrato.

**Valoración.** A produjo una entrega ejecutable dentro de los casos probados y con evidencia útil. Sus pruebas aprobadas no permiten descartar el escenario concurrente que no cubren. [Servicio de A](experimentos/A-sol-directo/proyecto/src/promotions.service.ts).

### Caso C — implementación con spec preparada

**Qué hizo.** Usó los mismos requisitos de A más los tres documentos preparados. Separó dominio, repositorio y base de datos, incorporó defensas de integridad en SQL y relacionó tareas/etapas con archivos y resultados en `AVANCE.md`. Incluyó pruebas de contrato, concurrencia, rollback y persistencia.

**Resultados.** Tiempo informado: **12:19**. Unitarias: **91/91**. E2E finales: **68/68**. Build y typecheck: exit 0, según los logs conservados. [AVANCE de C](experimentos/C-sol-spec/proyecto/AVANCE.md).

**Error observado y corrección.** La primera versión pasó 67 e2e, pero una prueba adicional que fuerza una espera de bloqueo encontró un error real: PATCH recuperaba alcance/política antiguos. Esperaba `SKU-LAB-002` y la política recién confirmada, pero recibía `SKU-LAB-001` y la política anterior. Se conserva [la prueba fallida antes de corregir](experimentos/C-sol-spec/proyecto/evidencias/regresion-concurrencia-antes.txt). El agente corrigió la lectura para bloquear primero la promoción y releer después los asociados en una nueva sentencia de la misma transacción. La regresión forma parte de las 68 e2e finales aprobadas. **Es un defecto inicial corregido, no un fallo pendiente del código final de C.**

**Valoración.** C dejó mayor trazabilidad y una cadena comprobable de fallo, corrección y regresión. Un solo prompt incluyó varias iteraciones internas; no fue necesaria otra instrucción del usuario. La spec ayudó a organizar el trabajo, pero no impidió por sí sola el error. [Repositorio final de C](experimentos/C-sol-spec/proyecto/src/promotions.repository.ts).

## Análisis de Nemotron 3.5 Super VL Free

Nemotron también entregó dos implementaciones NestJS/PostgreSQL: B directa y D con los mismos documentos preparados que C. Declaró completar y verificar las siete operaciones. La revisión repitió build, typecheck y unitarias de ambos casos: pasaron. Sus **35/37 e2e son resultados reportados por el usuario/agente**: no se encontraron logs originales conservados ni se reejecutaron esas suites completas.

Se realizaron sondas independientes de HTTP y funciones de validación, sin escrituras de negocio ni correcciones de las entregas. Esas comprobaciones reprodujeron incumplimientos que las pruebas propias no detectaban. [Evidencias de la revisión](evaluacion/verificacion-nemotron/revision-nemotron.json).

### Caso B — generación directa

**Qué hizo.** Entregó controlador, servicio, repositorio `pg`, guard de autenticación, filtro de errores, validadores, SQL con tabla principal de 14 columnas y tres tablas asociadas, además de pruebas unitarias/e2e y README. Incluyó transacciones para las creaciones y el lote.

**Resultados.** Tiempo informado: **13:06**. Build/typecheck repetidos por el evaluador: exit 0. Unitarias repetidas: **39/39**. E2E: **35/35 reportadas**, no reejecutadas en la revisión. [README de B](experimentos/B-nemotron-directo/proyecto/README.md).

**Errores reproducidos.**
- El bootstrap no configura el prefijo `/api/v1`: la solicitud contractual `GET /api/v1/promociones/no-uuid` devuelve 404 en lugar del 400 de validación esperado. Sus e2e prueban `/promociones`, por lo que no detectan el prefijo faltante.
- Con JSON malformado sin token devuelve 400 en lugar de 401: el parser procesa el cuerpo antes de que actúe el guard, incumpliendo el orden de autenticación requerido.
- El validador acepta el 30 de febrero y descarta una propiedad extra en `alcance` en lugar de rechazarla.

**Riesgos por inspección.** PATCH lee y valida el estado antes de escribir, pero su transacción no adquiere un bloqueo `FOR UPDATE` que proteja ese ciclo. Hay riesgo de decidir modalidad/historia con un estado antiguo; no se reprodujo aquí esa carrera. El filtro genérico también devuelve `String(exception)`, que podría mostrar detalles de infraestructura; no se provocó un error con credenciales para evaluarlo.

**Valoración.** B produjo una implementación que compila y supera su suite, pero «todo verificado» no equivale a conformidad integral: las sondas independientes encontraron diferencias contractuales concretas. [Sondas de B](evaluacion/verificacion-nemotron/B-probes.json).

### Caso D — implementación con spec preparada

**Qué hizo.** Entregó middleware de autenticación, validación, controlador/servicio/repositorio, un pool con transacciones, tabla principal de 14 columnas y tablas asociadas de alcance y política. Documentó el avance respecto a los requisitos y añadió pruebas de cierre/recreación de la aplicación.

**Resultados.** Tiempo informado: **18:37**. Build/typecheck repetidos por el evaluador: exit 0. Unitarias repetidas: **44/44**. E2E: **37/37 reportadas**, no reejecutadas en la revisión. [AVANCE de D](experimentos/D-nemotron-spec/proyecto/AVANCE.md).

**Errores reproducidos.**
- Los errores de dominio añaden `timestamp` y `path`, campos que el schema `Problem` congelado no permite.
- Con token válido y JSON malformado responde `application/json` con `message/error/statusCode` de Nest, en vez del `application/problem+json` contractual. Su filtro solo captura `ProblemError` y no normaliza el error del parser.
- Acepta el 30 de febrero, normalizándolo al 2 de marzo, y acepta campos extra dentro de `alcance`.
- La sonda con `vigentes=banana` no devolvió el 400 requerido: se observó 500. Por lectura, el controlador convierte valores distintos de `true` en `false`; no se atribuye aquí una causa al 500 sin evidencia adicional.

D **sí** devolvió 401 antes de procesar JSON malformado cuando faltaba token; no se le atribuye el fallo de orden de autenticación observado en B.

**Defecto de bloqueo por inspección.** Aunque usa `SELECT FOR UPDATE`, ejecuta esa consulta mediante `pool.query`, fuera del `client` de `withTransaction`. El bloqueo termina con la transacción implícita de esa sentencia y no protege la lectura/fusión/escritura de la transacción principal. El código demuestra el uso incorrecto del bloqueo; sus efectos concurrentes no fueron reproducidos en esta revisión.

**Limitación de la evidencia de persistencia.** Su prueba cierra y recrea Nest en el mismo proceso, usando el pool global hasta el `afterAll`. No equivale a detener Node y arrancar un proceso nuevo, como en los comprobadores de Sol, ni demuestra reinicio de PostgreSQL.

**Valoración.** Tener spec no eliminó las desviaciones de contrato ni garantizó un bloqueo transaccional correcto. D tardó más que B en el tiempo informado y mantuvo fallos que sus pruebas no detectaban. [Sondas de D](evaluacion/verificacion-nemotron/D-probes.json).

## Comparación de lo observado

- **A frente a C, dentro de Sol:** C tardó 4:28 menos y ofreció mayor trazabilidad, además de corregir el caso concurrente documentado. A pasó sus pruebas, pero no cubre ese mismo escenario.
- **B frente a D, dentro de Nemotron:** D tardó 5:31 más. Mejoró el orden de autenticación observado en B y configuró el prefijo, pero conservó problemas de errores, validación y uso del bloqueo.
- **A frente a B, enfoque directo:** B tardó 3:41 menos, pero las sondas encontraron diferencias contractuales que su suite no detectaba. Un tiempo menor no basta para considerar mejor una entrega.
- **C frente a D, con spec:** C tardó 6:18 menos y dejó evidencia más completa de regresión y reinicio de proceso. Los documentos de entrada eran iguales, pero su aplicación no produjo resultados equivalentes.

No se comparan cantidades de tests como si fueran la misma cobertura. Para las fuentes y límites de cada hallazgo, consultar el [informe completo](evaluacion/informe-comparativo.md).

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

## ¿En qué falló la IA?

La IA falló en **traducir todos los detalles del contrato y las invariantes a comportamiento verificable**, y en cubrir con sus pruebas los escenarios que podían contradecir una afirmación de éxito. Los fallos no fueron iguales ni quedaron en el mismo estado:

- **Sol A:** dejó un riesgo de concurrencia sin cubrir en su suite y añadió un límite de prioridad no declarado por el contrato. No se presenta ese riesgo como una carrera ya reproducida contra A.
- **Sol C:** su primera implementación perdía configuración bajo concurrencia. La IA detectó el error con una prueba más exigente, lo corrigió y conservó la regresión aprobada.
- **Nemotron B:** omitió el prefijo contractual y el orden requerido de autenticación; sus validadores aceptaron entradas que debían rechazarse.
- **Nemotron D:** aun con spec, generó errores con formato/campos distintos al contrato y usó un bloqueo que no protegía la transacción principal; también aceptó entradas inválidas.

El fallo transversal fue **tomar pruebas propias aprobadas como evidencia suficiente de cumplimiento completo**. Compilar y superar una suite no descarta errores que la suite no comprueba. La documentación previa ayudó a orientar y hacer trazable el trabajo, pero no sustituyó las pruebas independientes ni la revisión humana.

Los bloqueos iniciales de caché/dependencias y permisos fueron problemas del entorno, corregidos antes de estas corridas; no se cuentan como defectos funcionales de los modelos. Tampoco la ausencia de cupones/usos es un fallo: queda excluida por R09. Los hallazgos de revisión se documentaron sin corregir las implementaciones medidas.

## Conclusión final

En este laboratorio, **Sol C fue la entrega mejor sustentada**: tuvo el menor tiempo informado, mayor trazabilidad y evidencia de un fallo concurrente descubierto y corregido con una regresión. Sol A también entregó un API que pasó sus comprobaciones, con el riesgo concurrente y las limitaciones señaladas. Nemotron produjo código compilable y pruebas aprobadas en ambos enfoques, pero la revisión independiente encontró incumplimientos que limitan su afirmación de verificación completa.

La spec **no mejoró automáticamente todos los resultados ni redujo siempre el tiempo**: Sol C fue más rápido que A, mientras Nemotron D tardó más que B y conservó fallos. La conclusión práctica es usar la IA como apoyo de implementación, mantener requisitos explícitos y validar el contrato con pruebas que puedan refutar la solución, especialmente en errores, límites y concurrencia.

Estos resultados describen una muestra de una corrida por caso, con clientes distintos y tiempos informados por el equipo, sin desglose instrumentado ni suites propias equivalentes. No demuestran superioridad universal ni causalidad de un enfoque. El aprendizaje principal es **evaluar lo que el sistema hace y la evidencia que lo demuestra, no solo lo que el agente afirma haber completado**.
