# Laboratorio — GPT-6.1 Sol: directo frente a spec preparada

Segundo intento. Fecha de evaluación: 14 de noviembre de 2026, America/Lima.
Integrantes: por completar. Modelo seleccionado por el usuario: GPT-6.1 Sol.
Estado: análisis final de entregas y evidencias guardadas, con observaciones de revisión.

## 1. Qué comparamos

Se comparan dos formas de construir el mismo API, usando un único modelo y un prompt por caso:

| Caso | Enfoque | Entrada diferencial |
|---|---|---|
| A2 | Generación directa | Contrato OpenAPI, contexto, catálogo y configuración |
| C2 | Implementación con spec preparada | Las mismas entradas más spec, plan y tareas preparados antes de la corrida |

Los documentos de C fueron preparados por el coordinador; no se evalúa su generación por el agente C.
Big Pickle quedó fuera del experimento. El primer intento, afectado por bloqueos de entorno, se conserva
en historial/intento-1 y no se mezcla con los resultados de esta corrida.

Antes de esta repetición se corrigió en la base común @types/supertest 7.0.0, no encontrado en npm,
por 7.2.1. Se instaló el mismo lock en ambos casos y se prepararon dos PostgreSQL 17.11 equivalentes,
cada uno con una base de aplicación y otra de pruebas. El cambio resolvió una condición de la preparación;
los bloqueos iniciales no eran evidencia de defectos del código generado.

## 2. Método y alcance de esta revisión

El coordinador revisó fuentes, SQL, pruebas, reportes de ejecución y hashes de las entradas actuales.
No volvió a ejecutar las aplicaciones ni sus suites, ni corrigió las implementaciones para elaborar este informe.
Los estados de pruebas siguientes proceden de los logs/JSON conservados por los agentes y concordantes
con sus respuestas, no de una segunda ejecución independiente del coordinador.

Se verificó que ambos controladores declaran exactamente 2 POST, 1 PATCH, 1 DELETE y 3 GET.
Ambos SQL contienen las 14 columnas exigidas en la tabla principal. Se cotejaron las entradas actuales
contra la base común: 8 archivos comparables en A y 11 en C incluyendo sus tres documentos adicionales.
Además, los 8 hashes iniciales registrados por A y los 11 registrados por C coinciden con los archivos actuales.
Las listas de archivos protegidos de ambos agentes no son idénticas; no se interpreta su cantidad como calidad.
El package-lock común tiene SHA-256 df9d4b26d79f33404fe4f605831e4daa30db450ae7ce14c82923fb0b1246a223.

## 3. Resultados registrados

| Comprobación | A2 — directo | C2 — con spec |
|---|---|---|
| npm run build | Exit 0 | Exit 0 |
| npm run typecheck | Exit 0 | Exit 0 |
| npm test | 87/87 aprobadas | 91/91 aprobadas |
| npm run test:e2e | 59/59 aprobadas | 68/68 aprobadas |
| Siete operaciones HTTP del API compilado | Evidencia PASS | Evidencia PASS |
| Lote con fallo SQL y rollback real | Cubierto en e2e guardado | Cubierto en e2e guardado |
| Persistencia al reiniciar el proceso Node | Evidencia PASS | Evidencia PASS |
| Reinicio del contenedor PostgreSQL | No verificado en este intento | No verificado en este intento |
| Entradas protegidas | Sin cambios | Sin cambios |
| Bloqueos pendientes reportados | Ninguno | Ninguno |

Fuentes A: experimentos/A-sol-directo/evidencia/REPORTE.md, build.log, typecheck.log, unitarias.log,
e2e.log y API-PERSISTENCIA.json. Fuentes C: experimentos/C-sol-spec/proyecto/AVANCE.md y
evidencias/build.txt, typecheck.txt, unitarias.json, e2e.json y persistencia.json.

Las siete operaciones cubiertas son: creación individual, creación por lote, PATCH, eliminación lógica,
consulta comercial, consulta administrativa y detalle, todas bajo /api/v1. Las evidencias de persistencia
registran procesos Node distintos y conservación de configuración e historial. No se confunden con el
preflight de infraestructura ni con una prueba de reinicio de la máquina o del servidor PostgreSQL.

**91 frente a 87 y 68 frente a 59 no constituyen una comparación directa de calidad.** Cada agente escribió
su propia suite, con casos y agrupación distintos. No existe todavía una suite externa idéntica ejecutada
por el coordinador contra ambas entregas ni una métrica común de cobertura. Las duraciones de Vitest
son tiempos de esas suites; no miden el tiempo total de generación ni el esfuerzo humano.

## 4. Diferencias verificables del resultado

### Trazabilidad y separación de responsabilidades

A concentra el acceso SQL de promociones en su servicio, con una clase Database aparte; tiene un reporte
operativo detallado y pruebas de comportamiento. C separa dominio, repositorio y base de datos, y AVANCE
relaciona archivos/resultados con P01–P08 y T01–T12 de las entradas preparadas. En esta entrega, C ofrece
una trazabilidad más explícita del plan al código. No se afirma que más archivos garanticen calidad.

### Integridad y migraciones

Ambas entregas persisten 14 columnas y configuración asociada, usan consultas parametrizadas y
transacciones para las altas/lotes. A ofrece SQL reaplicable mediante IF NOT EXISTS y un bloqueo asesor.
C registra migraciones con checksum y agrega restricciones/triggers de alcance, política, catálogo,
historia y existencia de configuración asociada. Son defensas observables adicionales de C.
Las pruebas de ambos incluyen un fallo SQL deliberado y comprueban que no queden altas parciales.

### Concurrencia: diferencia principal

El código final de A hace JOIN entre promoción y configuración y solicita FOR UPDATE solo para la
promoción en esa misma consulta (experimentos/A-sol-directo/proyecto/src/promotions.service.ts:53). Su prueba concurrente cambia nombre y prioridad,
dos campos de la tabla principal (experimentos/A-sol-directo/proyecto/test/promotions.e2e.spec.ts:141). Esa prueba no cubre la lectura desactualizada de la tabla asociada.

C conserva una evidencia especialmente útil: después de pasar sus primeras 67 e2e, añadió una prueba
determinista que mantiene un bloqueo externo, cambia alcance/política y verifica con pg_stat_activity
que otro PATCH está esperando. Esa prueba falló: esperaba SKU-LAB-002 y la política nueva, pero recibió
SKU-LAB-001 y la política anterior. El log de fallo está en
experimentos/C-sol-spec/proyecto/evidencias/regresion-concurrencia-antes.txt.

El agente corrigió su repositorio para obtener primero el bloqueo sobre la promoción y después releer
promoción/configuración en otra sentencia de la misma transacción (experimentos/C-sol-spec/proyecto/src/promotions.repository.ts:24). La suite final de 68 e2e
incluye el caso de regresión aprobado (experimentos/C-sol-spec/proyecto/test/promotions.e2e.spec.ts:219); se conservaron la prueba fallida y la evidencia final.
La documentación de PostgreSQL explica que READ COMMITTED usa una instantánea por sentencia y puede
combinar cambios concurrentes en la fila bloqueada con una vista anterior de otras filas.
[PostgreSQL 17: aislamiento transaccional](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED).

En C hay, por tanto, **un defecto reproducido, corregido y cubierto por una regresión** dentro de la corrida.
En A el patrón susceptible permanece, pero **no se ejecutó contra A esa misma prueba determinista**.
Se registra como riesgo fundado por inspección, no como un fallo experimental ya observado en A.
Su 59/59 significa que pasó los casos de su suite, no que el riesgo haya quedado descartado.

## 5. ¿Dónde falló la IA?

El ejemplo concreto mejor sustentado es la pérdida de configuración de C bajo concurrencia. La versión
inicial parecía correcta y pasaba su suite, pero esas pruebas no cubrían una espera de bloqueo con cambios
en otra tabla. La prueba adicional encontró el defecto y la revisión del agente lo corrigió sin relajar la aserción.
Esto muestra tanto un fallo de la primera implementación como el valor de comprobar invariantes con casos difíciles.
Un único prompt puede incluir múltiples ciclos internos de prueba/corrección: la corrección de C no implica
que se haya enviado otro prompt del usuario.

Otros puntos de revisión:

- A restringe prioridad a Number.MAX_SAFE_INTEGER en aplicación y SQL (experimentos/A-sol-directo/proyecto/src/validation.ts:78). El contrato solo
  indica entero positivo sin ese máximo. Es una limitación reconocida por A, pero documentarla no equivale
  a que el contrato la autorice. Debe aceptarse como límite del ejercicio o corregirse en una fase posterior.
- Los validadores de ambos trabajan con fechas mediante JavaScript Date; la evidencia queda limitada a su
  precisión temporal. A declara expresamente milisegundos. No se verificó aquí la semántica de intervalos
  menores a un milisegundo y no se presenta como cobertura completa de cualquier date-time posible.
- Aprobar pruebas escritas por la misma IA no garantiza que todos los requisitos hayan sido interpretados
  sin omisiones. C añade un verificador de respuestas contra el OpenAPI usado, que es útil pero es un
  comprobador propio de ese contrato, no una certificación externa completa de OpenAPI/JSON Schema.

No se atribuyen a la IA como defectos funcionales ni el EACCES inicial ni el error de directorio inicial.
Ambos agentes documentaron el directorio correcto y la elevación local; las comprobaciones posteriores
terminaron correctamente. Tampoco la ausencia de cupones/usos es una omisión: está fuera del alcance por R09.

## 6. Conclusión de la comparación

Las dos entregas consiguen un API ejecutable que pasa sus propias suites y aporta evidencia de las siete
operaciones, rollback y persistencia entre procesos. El segundo intento resuelve el problema de entorno
que impedía evaluar el funcionamiento en la primera corrida.

**Para esta entrega, C tiene una ventaja observable en trazabilidad, defensa de integridad y tratamiento de
un caso de concurrencia documentado.** La razón no es su mayor número de tests, sino que contiene una
regresión que descubrió y corrigió un error real, mientras el patrón relacionado permanece como riesgo en A.
A también entrega una solución funcional dentro de lo probado, con estructura más concentrada y límites
expresamente documentados. Su resultado no debe presentarse como totalmente incorrecto.

No se puede concluir que disponer de una spec siempre cause mejores resultados: hay una sola ejecución
por enfoque, no se midieron tiempos/tokens/costos comparables y no se dispone de una transcripción completa
para auditar todos los ajustes del cliente. La spec y las tareas ayudaron a hacer el trabajo de C más trazable;
la eficacia general del enfoque necesitaría más repeticiones y una evaluación común independiente.

## 7. Reflexión lista para la exposición

> Usamos GPT-6.1 Sol con dos enfoques: generación directa y generación guiada por una spec, un plan y tareas
> preparados. Ambos lograron compilar, superar sus pruebas y demostrar las siete operaciones con PostgreSQL.
> La entrega con spec dejó mayor trazabilidad y corrigió un fallo de concurrencia detectado por una prueba
> adicional. Ese error no era visible con las primeras pruebas aprobadas. Aprendimos que la documentación
> ayuda a orientar el desarrollo, pero no sustituye las pruebas que fuerzan situaciones difíciles ni la revisión
> de una persona. Tampoco basta contar tests: debemos examinar qué verifican, qué requisitos quedan fuera
> y qué evidencia real respalda cada afirmación. Esta comparación favorece cualitativamente a C en esos
> aspectos concretos, sin demostrar que el enfoque sea superior en todos los proyectos.

## 8. Estado de cierre y pendientes

Comparación y reflexión completadas con las evidencias disponibles. Resultado de ambas suites propias:
PASS, según logs guardados. Estado de la revisión: CON OBSERVACIONES, no certificación exhaustiva.
No se cambiaron ni volvieron a ejecutar las soluciones para producir este informe.

Queda como validación adicional posible aplicar el mismo caso determinista a A y una suite común a ambas,
resolver o aceptar formalmente los límites contractuales y registrar integrantes/modelo/tiempos que falten.
Estas acciones se separan del análisis actual para conservar intactas las entregas medidas. El reinicio del
contenedor PostgreSQL, el despliegue y las integraciones externas no se afirman como verificados en este intento.
