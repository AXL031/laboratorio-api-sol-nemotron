# Contexto común congelado — laboratorio 1.0.0

Este documento se entrega idéntico en los cuatro experimentos. Es el requisito base del ejercicio,
no sustituye la spec, el plan y las tareas que el coordinador entrega ya preparados en C/D.

## Consigna y alcance

Entidad Promoción con más de 10 columnas. Implementar exactamente las 7 operaciones del OpenAPI.
La representación .yaml usa sintaxis JSON, válida en YAML 1.2; .json contiene los mismos bytes.
Fuente: contrato G6 0.6.0-rc.1, SPEC-006, HU-006 y modelo físico de Promociones.
La trazabilidad y las copias originales están fuera del contexto inicial, en fuentes/ y trazabilidad.md.

## Reglas compartidas

R01. nombre no vacío ni solo espacios; máximo académico 160 caracteres. tipoDescuento PORCENTAJE
o MONTO_FIJO; valor > 0; si PORCENTAJE, valor <= 100. Rechazar números no finitos.
R02. Fechas ISO 8601 con zona; validFrom < validUntil. Vigente si validFrom <= ahora < validUntil.
R03. Alcance con al menos un productId o SKU activo de catalogo.json. Conservar ambas identidades,
no convertir productIds a una foto de SKUs. Listas sin duplicados; referencias inexistentes/inactivas: 422.
R04. modalidad AUTOMATICA o CUPON; estado ACTIVO o INACTIVO; prioridad entero >= 1.
R05. canalesHabilitados explícitos, no vacíos y sin duplicados; solo canales del contrato.
R06. politicaCombinacion contiene tres booleanos obligatorios. No calcular descuentos ni evaluar cestas.
R07. PATCH conserva los campos omitidos y sustituye por completo los objetos/listas presentes.
Validar la entidad fusionada, no solo el fragmento. PATCH vacío o propiedades desconocidas: 422.
Campos de solo lectura (promotionId, puedeCambiarModalidad, auditoría) no se admiten como entrada.
R08. Crear ACTIVO o pasar a ACTIVO registra first_activated_at una sola vez. Desactivar mediante PATCH
conserva ese antecedente. puedeCambiarModalidad solo es true estando INACTIVO y nunca activada,
sin cupones asociados ni usos históricos. Un cambio real de modalidad incumpliendo esto devuelve 409
MODALIDAD_BLOQUEADA. Reenviar la misma modalidad no cuenta como cambio.
R09. El entorno académico empieza vacío y no implementa cupones/usos. Esos antecedentes empiezan
ausentes; no deben inventarse operaciones HTTP para modificarlos. La limitación se declara en el informe.
El control de activación histórica sí debe implementarse y probarse.
R10. Cada creación genera un UUID distinto. Nombres repetidos son válidos: no inventar unicidad.
R11. POST lote acepta {items:[...]} de 1 a 20. Es creación múltiple de la misma entidad.
Validar todos, guardar todos o ninguno en UNA transacción real. Respuesta 201 conserva el orden de entrada.
R12. DELETE es eliminación lógica: marcar deleted_at, pasar a INACTIVO y conservar first_activated_at.
Responder 204 sin cuerpo. Excluir eliminados de todas las consultas. Repetir DELETE, leer o modificar
un eliminado: 404 PROMOCION_NO_ENCONTRADA. No afirmar idempotencia de respuesta 204 en la repetición.
R13. Administración: pagina=1, tamanio=20 por defecto, máximo 100. Filtros estado/modalidad exactos.
Orden estable created_at ASC, id ASC. meta.total cuenta resultados filtrados, antes de paginar;
totalPaginas=ceil(total/tamanio); para total 0, totalPaginas 0.
R14. Consulta comercial exige canal; filtra pertenencia al canal y estado (ACTIVO por defecto).
vigentes=true por defecto aplica R02; false omite solo el filtro temporal. Devuelve PromocionResumen,
con nombres snake_case y status ACTIVA/INACTIVA. No inventar cálculo de precios ni consumo de cupón.
R15. Auth de laboratorio: dos tokens estáticos leídos del entorno. Sin token/token incorrecto: 401.
Lector y admin pueden GET; solo admin puede POST/PATCH/DELETE. Lector escribiendo: 403.
Autenticar antes de procesar cuerpo/identificador. No conectar con Seguridad, JWT o Supabase.
R16. JSON malformado, UUID de path inválido o query inválida: 400 VALIDACION.
JSON válido que incumple esquema/regla de creación/PATCH/lote: 422 VALIDACION.
Errores: application/problem+json con status coincidente, code y title. No filtrar stack ni credenciales.
R17. Persistencia real PostgreSQL LOCAL, aislada del proyecto original. Los datos sobreviven al reinicio.
No arrays como repositorio final. Puede haber tablas hijas para alcance/política. Sin servicios externos.

## Más de 10 columnas

Mantener las 13 columnas físicas de la entidad original: id, name, discount_type, discount_value,
modality, state, valid_from, valid_until, priority, enabled_channels, first_activated_at, created_at,
updated_at. Añadir deleted_at (columna 14) exclusivamente para R12. Alcance y política deben persistirse
asociados a la promoción. No contar campos calculados/objetos anidados como columnas adicionales.
La API de respuesta mantiene los campos de PromocionAdmin; no expone auditoría interna.

## Cambios académicos explícitos

NUEVOS: POST /promociones/lote, DELETE /promociones/{promocionId}, deleted_at.
ADAPTADOS: autenticación por tokens de fixture, catálogo local, UUID obligatorio, paginación acotada,
rechazo de campos extra (el contrato fuente permite varios), límites del nombre y semántica de errores.
Listado administrativo sigue derivado de una ruta fuente provisional-internal.
OMITIDOS: evaluar, activar/desactivar como rutas separadas, mensajería, pricing, reservas, cupones y despliegue.
Los cambios de estado necesarios se hacen con PATCH. No son cambios al contrato oficial del proyecto.
