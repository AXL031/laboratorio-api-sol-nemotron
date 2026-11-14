# Consigna, entradas y extensiones

La consigna requiere una entidad con más de 10 columnas y siete operaciones: dos de creación,
una modificación, una eliminación y tres consultas. Se usa Promoción con 13 columnas de origen
más deleted_at, incorporada para la eliminación lógica académica.

| Elemento | Tratamiento |
|---|---|
| Creación individual, PATCH, tres consultas | Derivados del contrato del proyecto académico |
| Creación por lote | Extensión: 1–20 promociones, transacción atómica |
| Eliminación lógica | Extensión: INACTIVO/deleted_at, conservando antecedente de activación |
| Auth y catálogo | Fixtures explícitos locales, sin integración externa |
| R01–R17 | Reglas comunes congeladas en comun/contexto.md |
| Spec, plan y tareas | Preparados antes de correr el enfoque guiado; entradas, no resultados del agente |
| Reglas y schemas por caso | Copias en contrato/; cotejados por hashes |

OpenAPI académico 3.1.0, versión 1.0.0-lab. openapi.yaml emplea sintaxis JSON, válida como
subconjunto de YAML 1.2, con copia openapi.json idéntica.
La documentación del proyecto de origen no se presenta como implementación/despliegue probado.
No se evalúan cupones/usos (R09), pricing, mensajería, pedidos ni integraciones con otros módulos.
