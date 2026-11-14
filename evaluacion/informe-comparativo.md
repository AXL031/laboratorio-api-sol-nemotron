# Resultados de los cuatro casos y respuesta final

Fecha: 14 de noviembre de 2026. Modelos: GPT-6.1 Sol y Nemotron 3.5 Super VL Free.
Enfoques: directo y con spec/plan/tareas preparados. Un prompt por caso; las iteraciones internas no son prompts adicionales.

## Resultados y tiempos

| Caso | Modelo / enfoque | Tiempo (mm:ss) | Build/tipos | Unitarias | E2E propias |
|---|---|---:|---|---:|---:|
| A | Sol directo | 12:19 | PASS en logs | 87/87 | 59/59 |
| C | Sol con spec | 16:47 | PASS en logs | 91/91 | 68/68 |
| B | Nemotron directo | 13:06 | PASS reportado y repetido | 39/39 repetidas | 35/35 reportadas |
| D | Nemotron con spec | 18:37 | PASS reportado y repetido | 44/44 repetidas | 37/37 reportadas |

Los tiempos de Sol se corrigieron mediante los eventos task_started/task_complete de sus sesiones finales:
A = 739,468 segundos y C = 1007,843 segundos. La tabla omite milisegundos. Los tiempos de Nemotron fueron
comunicados por el usuario. No son duraciones de Vitest ni se dispone de desglose por actividad.
C tardó 4:28 más que A; D tardó 5:31 más que B. A tardó 0:47 menos que B, mientras C tardó 1:50 menos que D.
En esta muestra, la spec aumentó el tiempo en ambos modelos. A fue el caso más rápido, sin que ello pruebe una
ventaja general o causal. No se convierten cantidades de tests en cobertura comparable. [Procedencia y corrección](tiempos.json).

## Evidencia y método

Sol: se revisaron logs/JSON guardados, no se repitieron en esta revisión las suites A/C.
Nemotron: las respuestas del usuario declaran 35/37 e2e; no se encontraron logs originales de esas ejecuciones en
los directorios revisados. Se repitieron build, typecheck y unitarias, obteniendo exit 0 y 39/44 tests aprobados.
No se repitieron e2e completas para evitar limpiar/modificar los datos de los experimentos. En cambio se ejecutaron
sondas independientes de lectura, autenticación/validación y funciones puras, sobre el código compilado actual,
replicando el bootstrap de cada main con puerto efímero. No se escribieron datos de negocio ni se corrigieron fuentes.
Los logs/resultados están en [verificacion-nemotron](verificacion-nemotron/).

Se verificaron los hashes de entradas actuales contra la base común. Los prompts de A/B son iguales tras sustituir
el nombre del modelo; los de C/D también. Contrato, contexto, catálogo, package/lock/tsconfig y documentos C/D se
conservan equivalentes. El uso de clientes distintos (Codex/OpenCode) es otra variable; no atribuir todo al modelo.

## ¿En qué falló la IA? Respuesta por caso

### A — GPT-6.1 Sol directo

Pasó sus suites y conserva evidencia HTTP/persistencia. Por lectura, mantiene un JOIN de promoción/configuración
con bloqueo solo de la fila principal ([A: promotions.service.ts:53](../experimentos/A-sol-directo/proyecto/src/promotions.service.ts#L53)). Es el patrón que causó el fallo reproducido en C; en A continúa
como riesgo de perder configuración concurrente, **no reproducido directamente contra A**. Su test cambia nombre
y prioridad, ambos campos principales, y no fuerza cambios asociados mientras otro PATCH espera.
Además limita prioridad a enteros seguros de JavaScript aunque el contrato solo exige entero positivo; declara el
límite, pero no cambia por ello el contrato. Su fallo de calidad es la cobertura insuficiente para justificar que no
existen carreras, y una restricción adicional documentada. No se afirma que toda la entrega sea incorrecta.

### C — GPT-6.1 Sol con spec

Existe un defecto inicial **realmente observado y corregido**: tras esperar un bloqueo, PATCH leía alcance/política
antiguos y podía perder el cambio ya confirmado. La primera suite de 67 e2e no lo detectaba. Una prueba determinista
falló con SKU/política antiguos; se conservó el log y se corrigió a bloquear primero y releer asociados en otra sentencia.
La suite final pasó 68/68. Evidencia: [regresión antes de corregir](../experimentos/C-sol-spec/proyecto/evidencias/regresion-concurrencia-antes.txt).
La IA falló en su primera solución concurrente, pero su ciclo de revisión/pruebas lo corrigió durante la misma corrida.
No se presenta ese defecto inicial como pendiente en el código final. Tampoco la spec impidió el error por sí sola.

### B — Nemotron directo

**Reproducido:** el bootstrap no configura /api/v1 ([B: main.ts:6](../experimentos/B-nemotron-directo/proyecto/src/main.ts#L6)); GET /api/v1/promociones/no-uuid devuelve 404,
cuando la ruta contractual debe reconocer el ID y devolver 400 VALIDACION. Sus e2e usan /promociones sin el prefijo,
por lo que pueden pasar sin detectar la discrepancia del API publicado en el contrato.

**Reproducido:** con JSON malformado sin token, la respuesta es 400 y no 401: el parser actúa antes del guard
([B: auth.guard.ts:23](../experimentos/B-nemotron-directo/proyecto/src/common/auth.guard.ts#L23)), incumpliendo R15. El validador acepta 2026-02-30T00:00:00Z y descarta silenciosamente un campo
extra intruso dentro de alcance en vez de rechazarlo. Estas funciones se comprobaron directamente sin crear promociones.

**Por inspección:** PATCH lee/valida antes de escribir y el repositorio no adquiere FOR UPDATE durante su transacción
([B: promociones.repository.ts:371](../experimentos/B-nemotron-directo/proyecto/src/promociones/promociones.repository.ts#L371)); puede tomar decisiones de modalidad/historia sobre un estado antiguo. No se reprodujo esa carrera
en esta revisión. El filtro incluye String(exception) en errores genéricos, que podría revelar detalles de infraestructura;
no se provocó un error con credenciales para evaluarlo. Su declaración «todo verificado» excede lo que cubren sus tests.

### D — Nemotron con spec

**Reproducido:** un error por UUID inválido añade timestamp/path, campos que el schema Problem congelado prohíbe.
Con JSON malformado y token válido responde application/json con message/error/statusCode de Nest, en vez de
application/problem+json y status/code/title. El filtro solo captura ProblemError ([D: problem-exception.filter.ts:17](../experimentos/D-nemotron-spec/proyecto/src/common/problem-exception.filter.ts#L17)); no normaliza los
errores del parser. En cambio, sí se observó 401 antes del parser cuando falta token: no se le atribuye el fallo de auth de B.

**Reproducido en funciones puras:** acepta el 30 de febrero y lo normaliza al 2 de marzo; también acepta campos
extra en alcance. GET con vigentes=banana no devolvió el 400 requerido en la sonda (se observó 500); por lectura,
el controlador convierte cualquier valor distinto de true en false. No se atribuye aquí una causa al 500 sin más evidencia.

**Por inspección:** declara SELECT FOR UPDATE, pero lo ejecuta mediante pool.query dentro de una función que
no recibe el client de withTransaction ([D: promociones.repository.ts:166](../experimentos/D-nemotron-spec/proyecto/src/promociones/promociones.repository.ts#L166)). El bloqueo pertenece a otra transacción implícita y termina
al completar esa sentencia; no protege el ciclo de lectura/fusión/escritura de la transacción principal. Es un defecto
de uso del bloqueo observable por código, con efecto concurrente pendiente de reproducción.

Su prueba «reinicio» cierra y recrea Nest en el mismo proceso y usa el pool global hasta el afterAll; esto acredita
un escenario distinto de detener Node y arrancar otro proceso, como los comprobadores de Sol. No se elevan esas
afirmaciones a una prueba de reinicio de proceso ni de PostgreSQL sin evidencia equivalente.

## Fallo transversal y conclusión

El error común fue **confundir pruebas propias aprobadas con cumplimiento completo del contrato**. En Nemotron se
demostró que build, tipos y unitarias aprobadas conviven con rutas/errores/validaciones incorrectos. En Sol se documentó
que una suite inicialmente verde no cubría una carrera real. La respuesta correcta no es «la IA no falló»: falló en
casos de concurrencia, detalles contractuales y cobertura/alcance de sus afirmaciones, con distinto estado en cada caso.

En esta muestra, Sol C ofrece la entrega mejor sustentada de las cuatro por trazabilidad, evidencia preservada y
regresión concurrente corregida. Sol A fue el caso más rápido (12:19). Es una conclusión cualitativa de este laboratorio,
no un ranking universal: hay una corrida por celda, distintos clientes y suites propias no equivalentes. La spec no garantiza
mejor resultado: ambos casos con spec tardaron más que sus pares directos y Nemotron D conserva incumplimientos pese a disponer de las mismas entradas preparadas.
La revisión humana debe comprobar el contrato de forma externa, diseñar casos adversos y distinguir reporte del agente,
ejecución real y riesgos por inspección. No se modificaron las implementaciones para hacerlas pasar durante el análisis.

## Reflexión para exponer

> La IA generó las siete operaciones y pruebas en los cuatro casos, pero acertar la estructura y aprobar sus propias
> pruebas no garantizó cumplir el contrato. Sol tuvo un fallo concurrente que C detectó y corrigió con una prueba adicional;
> Nemotron dejó diferencias en prefijo, errores, fechas y bloqueos que sus suites no detectaban. La spec ayudó a orientar
> y revisar el trabajo, pero no evitó automáticamente los errores y en esta muestra aumentó el tiempo. Aprendimos a validar con
> casos independientes y a exigir evidencia antes de aceptar «todo está verificado».
