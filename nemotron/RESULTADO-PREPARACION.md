# Nemotron listo para ejecutar por el usuario

Modelo: Nemotron 3.5 Super VL Free. ID de catálogo: opencode/nemotron-3.5-super-vl-free.
Confirmado en el catálogo oficial OpenCode el 14 de noviembre de 2026.
Dos casos nuevos, sin código del API: B-nemotron-directo y D-nemotron-spec.
Un único prompt por caso; documentación preparada y copiada sin modificar desde la entrada de Sol para D.

| Preparación real | Resultado |
|---|---|
| npm ci en B/D, lock de Sol | PASS, 199 paquetes en cada uno |
| Node 24, TypeScript 6.0.2, Vitest 4.1.2, imports Nest/pg | PASS en ambos |
| PostgreSQL aplicación/e2e de B y D | PASS, cuatro bases independientes accesibles |
| Escritura temporal y rollback de preflight | PASS, sin tablas de negocio creadas |
| Bases sin tablas de usuario | 0 en las cuatro bases nuevas |
| Puertos HTTP3303/3304 | Disponibles durante la comprobación |
| Paquetes, lock, tsconfig, contratos y documentos | Hashes equivalentes a Sol en el mismo enfoque |
| Entregas y evidencias de Sol | SHA-256 preservados |

PostgreSQL usa la misma imagen/digest que Sol y versión 17.11, puertos 55436/55437 y volúmenes nuevos.
PRECHECK-ENTORNO.json de cada proyecto registra el entorno; no son pruebas de la solución Nemotron.
El usuario todavía debe ejecutar los prompts y compartir las respuestas. El coordinador no invocó el modelo.
Los permisos específicos de OpenCode/terminal pueden requerir autorización local; no se cambió configuración global.
