# Laboratorio: generación de un API con Sol y Nemotron

Comparación académica de dos modelos y dos enfoques para construir el mismo API de promociones.
**Estado al 14 de noviembre de 2026: hay resultados de GPT-6.1 Sol; Nemotron está preparado y pendiente de ejecución.**

## Objetivo y diseño

Evaluar qué cambia al generar código directamente desde un contrato y al usar además una spec,
un plan y tareas preparados. Cada caso recibe **un solo prompt**, en una conversación nueva.

| Caso | Modelo | Enfoque | Estado |
|---|---|---|---|
| [A](experimentos/A-sol-directo/proyecto) | GPT-6.1 Sol | Directo | Implementado, con evidencia de pruebas |
| [C](experimentos/C-sol-spec/proyecto) | GPT-6.1 Sol | Con spec preparada | Implementado, con evidencia de pruebas |
| [B](experimentos/B-nemotron-directo/proyecto) | Nemotron 3.5 Super VL Free | Directo | Entradas listas; resultados pendientes |
| [D](experimentos/D-nemotron-spec/proyecto) | Nemotron 3.5 Super VL Free | Con spec preparada | Entradas listas; resultados pendientes |

La spec, el plan y las tareas son entradas redactadas antes de las corridas; los agentes C/D deben usarlas,
no generarlas como una fase previa. Se conservan el mismo contrato, reglas, catálogo, versiones y lock.
Cada caso usa PostgreSQL 17.11 y bases locales separadas de aplicación y e2e.

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

## Resultados de Sol

Los siguientes resultados proceden de los logs y reportes conservados de las ejecuciones locales.
**No son resultados de GitHub Actions ni una repetición independiente de las pruebas por el evaluador.**

| Comprobación | A: directo | C: con spec |
|---|---|---|
| `npm run build` | Exit 0 | Exit 0 |
| `npm run typecheck` | Exit 0 | Exit 0 |
| `npm test` | 87/87 aprobadas | 91/91 aprobadas |
| `npm run test:e2e` | 59/59 aprobadas | 68/68 aprobadas |
| Siete operaciones HTTP | Evidencia PASS | Evidencia PASS |
| Rollback ante fallo SQL del lote | Cubierto por e2e | Cubierto por e2e |
| Persistencia al reiniciar Node | Evidencia PASS | Evidencia PASS |
| Entradas congeladas | Sin cambios | Sin cambios |

Fuentes: [reporte A](experimentos/A-sol-directo/evidencia/REPORTE.md),
[HTTP y persistencia A](experimentos/A-sol-directo/evidencia/API-PERSISTENCIA.json),
[AVANCE C](experimentos/C-sol-spec/proyecto/AVANCE.md),
[e2e C](experimentos/C-sol-spec/proyecto/evidencias/e2e.json) y
[persistencia C](experimentos/C-sol-spec/proyecto/evidencias/persistencia.json).

[Nota de disponibilidad de evidencia](docs/limitaciones-evidencia.md).

### Análisis de los resultados

**Los dos enfoques produjeron un API que compila y pasa sus propias suites.** A concentra el SQL de
promociones en el servicio, con una clase de conexión aparte. C separa dominio, repositorio y base de
datos y relaciona tareas/etapas con archivos y evidencia en `AVANCE.md`. Esa trazabilidad hace más
fácil revisar cómo se atendió lo solicitado, aunque una estructura con más archivos no garantiza calidad.

El hallazgo más útil está en concurrencia. C pasó primero 67 e2e, pero una prueba adicional que fuerza
una espera de bloqueo encontró un error: un PATCH recuperaba alcance y política antiguos. La prueba
esperaba `SKU-LAB-002` y recibió `SKU-LAB-001`, junto con la política anterior.
Se conserva el [fallo real antes de corregir](experimentos/C-sol-spec/proyecto/evidencias/regresion-concurrencia-antes.txt).

C corrigió la lectura: primero bloquea la promoción y después consulta la configuración asociada en
una nueva sentencia de la misma transacción. La suite final de 68 e2e incluye la regresión aprobada.
Esto aporta una cadena comprobable de **fallo → corrección → prueba de regresión**.

A conserva una lectura con JOIN y `FOR UPDATE OF p` similar al patrón que falló en C. Su prueba concurrente
cambia nombre y prioridad de la tabla principal; no fuerza el caso de configuración asociada. Se registra
como **riesgo por inspección, pendiente de reproducir en A**, no como un fallo ya observado allí.
Que sus 59 e2e pasen no descarta escenarios que no forman parte de esa suite.

Por tanto, **C muestra una ventaja concreta en trazabilidad y tratamiento del caso concurrente documentado**.
Esa conclusión se apoya en el contenido del código y las pruebas, no en tener 91 frente a 87 o 68 frente a 59:
las suites fueron escritas por cada agente y sus cantidades no representan la misma cobertura.

### ¿Dónde falló la IA y qué aprendimos?

La primera implementación de C parecía correcta y pasaba las pruebas existentes, pero podía perder cambios
asociados bajo concurrencia. Una prueba más exigente hizo visible el defecto y permitió corregirlo dentro
de la misma ejecución del agente. Un único prompt puede incluir varios ciclos internos de prueba y corrección.

A también documenta un límite adicional: restringe prioridad a enteros seguros de JavaScript, mientras el
contrato solo establece entero positivo. Debe aceptarse como límite del ejercicio o resolverse en una fase
posterior; documentarlo por sí solo no modifica el contrato.

La reflexión del laboratorio es que **la documentación previa orienta y hace trazable el trabajo, pero no
sustituye las pruebas de situaciones difíciles ni la revisión humana**. Tampoco aprobar pruebas propias
equivale a demostrar ausencia de errores. El [informe completo](evaluacion/informe-A-C.md) desarrolla los hallazgos.

### Límites de la comparación

- Una corrida por enfoque; no demuestra superioridad general ni causalidad de la spec.
- Sin suite externa común ejecutada contra ambas entregas ni tiempos/tokens/costos comparables.
- Persistencia verificada al reiniciar el proceso del API; no se verificó reinicio del contenedor PostgreSQL en este intento.
- Cupones/usos, integraciones externas y despliegue están fuera del alcance; catálogo y tokens son fixtures académicos.
- El primer intento tuvo bloqueos de dependencias/permisos. Se resolvieron antes de esta repetición y no se cuentan como fallos funcionales del código.

## Nemotron: próxima etapa

Modelo seleccionado: **Nemotron 3.5 Super VL Free**, identificador de OpenCode
`opencode/nemotron-3.5-super-vl-free`, según el [catálogo oficial](https://opencode.ai/docs/console/models/).
En B y D se publican únicamente las entradas, configuración y herramientas de entorno;
**su implementación y sus resultados se incorporarán en una actualización**.
[Prompts de Nemotron](PROMPTS-NEMOTRON.md) · [Guía de ejecución](EMPEZAR-NEMOTRON.md).

Al recibir sus respuestas se compararán A/B (directo), C/D (con spec) y B/D (enfoques de Nemotron).
Si se usa Codex para Sol y OpenCode para Nemotron, el cliente/configuración también varía y debe declararse.
No se completa ninguna métrica ni conclusión de Nemotron hasta contar con evidencia.

## Reproducir las entregas de Sol

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

Para preparar Nemotron, usar `nemotron/infra/compose.yaml`, B/D y sus ejemplos de entorno; la implementación
debe generarse después mediante sus prompts. Los prechecks guardados registran la preparación en la máquina
original; un clon necesita instalar dependencias e iniciar sus propios servicios.

## Contenido y procedencia

```text
comun/                 Contrato y reglas compartidas
entrada-spec/          Spec, plan y tareas preparados
experimentos/          Código/evidencias de Sol y entradas de Nemotron
evaluacion/            Análisis y material de evaluación
intento-2/infra/       PostgreSQL de A/C
nemotron/infra/        PostgreSQL de B/D
docs/                  Trazabilidad y publicación
```

Se conservan las implementaciones medidas. Las copias públicas de algunos logs/JSON/documentos normalizan
rutas de la máquina original. El [manifiesto](docs/manifiesto-publicacion.json) distingue copias exactas de
esas transformaciones. Los originales locales no fueron modificados al publicar.
