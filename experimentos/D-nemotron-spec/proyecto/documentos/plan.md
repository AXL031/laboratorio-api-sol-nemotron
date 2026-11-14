# PLAN-LAB-001 — Plan de implementación preparado

Entrada congelada compartida por el caso C de Sol, versión 3.0 de entorno. Ejecutar este plan; no volver a elaborarlo ni
detenerse esperando un segundo prompt o revisión. Las decisiones concretas de código son del modelo.

| Etapa | Resultado | Dependencia | Reglas |
|---|---|---|---|
| P01. Inspeccionar entradas y entorno | Identificar siete operaciones, scripts, DB local y configuración | Ninguna | R01–R17 |
| P02. Preparar persistencia | SQL reproducible, 14 columnas principales, datos asociados y conexiones | P01 | R08–R12, R17 |
| P03. Validación y errores | Validación estructural/semántica, fusión PATCH y respuestas Problem | P01 | R01–R07, R16 |
| P04. Entrada HTTP y auth | Prefijo, tokens locales y auth antes del análisis de cuerpo/ID | P01, P03 | R15–R16 |
| P05. Crear una y por lote | Dos creaciones con altas completas y lote atómico | P02–P04 | R01–R06, R08–R11 |
| P06. Modificar y eliminar | PATCH consistente, historial preservado y borrado lógico | P02–P05 | R07–R10, R12 |
| P07. Consultas | Tres rutas, DTO de resumen diferenciado y paginación/filtros | P02, P04 | R12–R14 |
| P08. Verificar y entregar | Unit/e2e, README, AVANCE y reporte de comandos real | P05–P07 | R01–R17 |

## Criterios técnicos

Separar transporte, validación/reglas y acceso a persistencia con responsabilidades claras.
Usar pg y las dependencias disponibles; no agregar ORM ni modificar package.json/tsconfig compartidos.
Mantener transacciones en la misma conexión, con rollback y liberación de conexión aun ante errores.
El lote abarca todas las altas y datos asociados dentro de la misma transacción.
PATCH valida contra el registro persistido bajo un mecanismo que impida carreras de estado/modalidad;
no debe perderse el primer antecedente de activación ni resucitar un registro eliminado.
Resolver autenticación antes del parseo de JSON/path, no asumir que un guard posterior al parser lo logra.
Los errores JSON se normalizan al contrato; no devolver automáticamente el formato por defecto del framework.
Las rutas estáticas /administracion y /lote no deben quedar ocultas por /{promocionId}.
No sustituir PostgreSQL por arrays si el entorno no está disponible: dejar el adaptador real y documentar
la limitación de ejecución; avanzar con lógica pura/pruebas que no dependan de DB.

## Comprobaciones previstas (no ejecutadas en esta preparación)

Unitarias: rangos/fechas, alcance/canales, fusión PATCH, cambio de modalidad e historia, mapeos de respuesta.
E2E: siete operaciones, auth/errores, lote que falla sin altas parciales, ausencia de eliminados,
filtros/paginación, antecedente de activación y preservación de campos omitidos.
Integración local: persistencia tras reinicio con misma DB y evidencia de transacción real.
Ejecutar scripts de build/tipos/pruebas si el entorno lo permite; registrar NO_EJECUTADO cuando no.
No desplegar, no usar servicios externos y no leer respuestas de otros casos.
