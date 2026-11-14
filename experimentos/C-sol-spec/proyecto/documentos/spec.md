# SPEC-LAB-001 — API académica de Promociones

Versión de entrada: 2.0, preparada por el coordinador antes de las nuevas corridas.
Estado: especificación de entrada, sin implementación ni resultados. Idéntica para C y D.
No procede de las respuestas descartadas de A/B/el caso C de Sol. No requiere que el modelo la vuelva a generar.

## 1. Propósito y fuentes

Implementar un API NestJS/TypeScript con persistencia PostgreSQL local para administrar promociones.
El contrato ejecutable es contrato/openapi.yaml (idéntico a openapi.json); las reglas completas
están en contrato/contexto.md (R01–R17) y los identificadores elegibles en contrato/catalogo.json.
El contrato fija formas de request/response; el contexto completa las invariantes entre campos.
Esta spec concreta la implementación sin sustituir ni ampliar esas fuentes.
Si existe una contradicción, conservar contrato/contexto, registrarla y no inventar otra interfaz.

## 2. Alcance y actores

Administrador local: crear, modificar, eliminar y consultar. Lector local: las tres consultas.
Credenciales leídas de LAB_ADMIN_TOKEN y LAB_READER_TOKEN, exclusivamente de fixtures de laboratorio.
Entidad principal con 13 columnas originales y deleted_at como columna 14 académica.
Se implementan exactamente siete operaciones; no se implementan evaluación de cestas, consumo de
cupones, pedidos, mensajería, integraciones G6 ni despliegue. El catálogo es un fixture explícito.

## 3. Operaciones y criterios de aceptación

| ID | Operación | Entrada y salida | Criterio de aceptación |
|---|---|---|---|
| O01 | POST /promociones | PromocionCreate → 201 PromocionAdmin | Alta única con UUID nuevo y configuración completa; un fallo no deja filas parciales |
| O02 | POST /promociones/lote | LoteCreate → 201 LoteResponse | 1–20 elementos; todos o ninguno en una transacción real; respuesta en el orden recibido |
| O03 | PATCH /promociones/{promocionId} | PromocionPatch → 200 PromocionAdmin | Fusiona lo enviado, conserva lo omitido y valida el resultado completo; no altera datos si falla |
| O04 | DELETE /promociones/{promocionId} | Sin request body → 204 sin cuerpo | Marca deleted_at, pasa a INACTIVO y conserva historia de activación; futuras operaciones sobre el ID dan 404 |
| O05 | GET /promociones | canal requerido, vigentes/estado opcionales → 200 PromocionesComerciales | Filtra por canal, estado y vigencia según R14; usa PromocionResumen, no PromocionAdmin |
| O06 | GET /promociones/administracion | pagina/tamanio/estado/modalidad → 200 PaginaPromocionesAdmin | Filtra, cuenta antes de paginar y ordena de forma estable; excluye eliminados |
| O07 | GET /promociones/{promocionId} | UUID → 200 PromocionAdmin | Devuelve configuración y capacidad calculada; inexistente/eliminado da 404 |

Todas las rutas usan el prefijo /api/v1. Crear lote y eliminar son extensiones académicas,
no funcionalidades atribuidas al contrato oficial G6. La ruta administrativa fuente era provisional-internal.

## 4. Validación y semántica

R01: nombre con contenido, máximo 160; descuento finito >0 y porcentaje <=100.
R02: timestamps válidos con zona e inicio < fin; vigencia [inicio, fin).
R03: alcance no vacío, referencias activas del fixture, listas únicas y separación productIds/skus.
R04: enums exactos y prioridad entera positiva.
R05: canales explícitos, únicos, no vacíos y pertenecientes al enum contractual.
R06: política con sus tres booleanos requeridos; no calcular beneficios en este alcance.
R07: PATCH no vacío; rechazar desconocidos y campos de solo lectura; sustituir objetos/listas enviados
y conservar lo omitido. Validar la entidad fusionada. Cambiar solo tipoDescuento a PORCENTAJE sobre
un valor persistido >100 debe fallar, aunque el fragmento no incluya valor.

R08: primera activación persistente. Crear ACTIVO o pasar a ACTIVO deja first_activated_at una única vez.
Desactivar no lo borra. puedeCambiarModalidad es calculado por el servidor: INACTIVO, nunca activada,
sin cupones ni usos. Un cambio real incumpliendo la condición devuelve 409 MODALIDAD_BLOQUEADA;
reenviar la misma modalidad no es un cambio. Serializar lectura/actualización del registro para que
operaciones concurrentes no permitan cambiar modalidad o perder el antecedente a partir de datos antiguos.
R09: en el laboratorio no se crean cupones ni usos; ambos antecedentes están ausentes. No afirmar
que esta versión valida integraciones históricas externas. Sí implementar el antecedente de activación.
R10: UUID nuevo por alta; nombres repetidos permitidos y fechas de auditoría calculadas por servidor.
R11: lote en una transacción que incluye filas principales y sus datos asociados; cualquier fallo revierte todo.
R12: eliminación lógica, sin exponer borrados en consultas ni perder first_activated_at; repetición da 404.
R13: administración con defaults pagina=1/tamanio=20, máximo 100; total antes de paginar;
totalPaginas=ceil(total/tamanio), 0 si no hay datos; orden created_at ASC e id ASC.
R14: consulta comercial exige canal; ACTIVO y vigentes=true son defaults. vigentes=false solo omite
el filtro temporal. Resumen usa promotion_id/name/status/valid_from/valid_until/channels.
R15: autenticar antes de analizar cuerpo o ID; lector solo GET; tokens de entorno, sin JWT externo.
R16: JSON malformado, query/UUID inválido → 400 VALIDACION; entidad/fragmento/lote inválido → 422
VALIDACION; sin token o token incorrecto → 401 NO_AUTENTICADO; lector escribiendo → 403 NO_AUTORIZADO;
ausente/eliminado → 404 PROMOCION_NO_ENCONTRADA. Errores con application/problem+json,
status/code/title y detail opcional, sin stack ni credenciales. Las respuestas deben corresponder a cada
operación del OpenAPI, no añadirse códigos por conveniencia.
R17: PostgreSQL local real; persistencia tras reinicio y ausencia de repositorios finales en memoria.

## 5. Persistencia y representación

Tabla principal con id, name, discount_type, discount_value, modality, state, valid_from, valid_until,
priority, enabled_channels, first_activated_at, created_at, updated_at y deleted_at.
No contar objetos calculados como columnas para cumplir la consigna. Alcance/política también se
persisten vinculados; la representación física de esos datos asociados queda a criterio del implementador.
La API usa los nombres del contrato, no los nombres físicos. No exponer auditoría o deleted_at en
PromocionAdmin. Incluir SQL/migraciones iniciales y pasos reproducibles para una DB académica vacía.
No tocar migraciones ni credenciales de G6. Proteger las invariantes tanto en la aplicación como con
restricciones locales apropiadas; demostrar las transacciones en código, no solo documentarlas.

## 6. Entregables y aceptación

Código de las siete operaciones, SQL de laboratorio, pruebas unitarias/e2e, vitest.e2e.config.ts,
README de instalación/arranque/reinicio y reporte final. Conservar las dependencias/configuración base.
Build, typecheck, unit y e2e solo se declaran PASS con comandos y salida reales; si no pueden ejecutarse,
marcar NO_EJECUTADO y causa. Una dependencia de PostgreSQL no justifica omitir el resto de archivos.
No generar otra spec/plan/tareas: son entradas congeladas. Registrar cumplimiento y evidencia en
AVANCE.md propio, sin marcar ni reescribir este material. Completar desde un solo prompt de principio a fin.
