# TAREAS-LAB-001 — Tareas preparadas de implementación

Documento de entrada congelado para el caso C de Sol. No marcar este archivo: registrar avance/evidencia en AVANCE.md.
Las tareas no están ejecutadas; ninguna casilla implica progreso de un modelo anterior.

| ID | Depende de | Trabajo | Terminado cuando | Trazabilidad |
|---|---|---|---|---|
| T01 | — | Leer contrato, contexto, catálogo, spec y plan; revisar configuración | Reconoce 7 operaciones y limitaciones; no altera entradas | R01–R17, O01–O07 |
| T02 | T01 | Implementar configuración y acceso PostgreSQL local; SQL inicial | 14 columnas principales, alcance/política persistentes y arranque documentado | R08–R12, R17 |
| T03 | T01 | Implementar validación de entradas y reglas de entidad completa | Rechaza rangos/fechas/referencias/canales inválidos, extras y campos de solo lectura | R01–R07, R10, R16 |
| T04 | T01,T03 | Configurar auth local y errores HTTP | GET lector/admin, escritura solo admin; auth previa a parseo; Problem correcto | R15–R16 |
| T05 | T02,T03,T04 | Implementar creación individual | O01 responde 201; UUID nuevo; estado inicial e historia correctos | O01, R01–R06, R08–R10 |
| T06 | T05 | Implementar creación por lote | O02 guarda todos o ninguno en transacción; 1–20; orden preservado | O02, R11 |
| T07 | T02,T03,T04,T05 | Implementar PATCH consistente | Valida fusión, conserva omisiones, bloquea modalidad histórica sin carreras | O03, R07–R10 |
| T08 | T02,T04,T05 | Implementar las tres consultas | Contratos de admin/resumen correctos; filtros, conteo y paginación correctos | O05–O07, R12–R14 |
| T09 | T02,T04,T07,T08 | Implementar eliminación lógica | O04 da 204 sin cuerpo; siguientes accesos 404; historial se conserva | O04, R12 |
| T10 | T03–T09 | Escribir unitarias y e2e, configurar scripts existentes | Casos normales, inválidos y fronteras cubiertos; no afirma ejecución sin salida | R01–R17 |
| T11 | T02–T10 | Documentar instalación, SQL, tokens, arranque y reinicio | Otro integrante puede reproducirlo sin credenciales G6 ni instrucciones omitidas | R15, R17 |
| T12 | T01–T11 | Revisar entrega completa y reportar resultados | AVANCE y respuesta final señalan implementado/pendiente, comandos reales y limitaciones | O01–O07, R01–R17 |

## Casos de aceptación mínimos

- Alta válida y nombres repetidos con IDs distintos; errores por porcentaje >100/valor <=0/fechas inválidas.
- Alcance inexistente/inactivo o vacío; canales vacíos/duplicados; lectura/escritura con roles distintos.
- Lote válido y lote cuyo segundo elemento falla: ningún registro del lote queda persistido.
- PATCH solo nombre conserva el resto; cambiar tipo sobre valor incompatible rechaza la entidad fusionada.
- Activar/desactivar y después intentar cambiar modalidad: 409; reenviar la misma modalidad: permitido.
- Administración pagina/filtra/cuenta; consulta comercial requiere canal y usa resumen snake_case.
- Eliminar, consultar, modificar y repetir eliminación: 204 inicial y luego 404; consultas excluyen eliminado.
- Reinicio conserva datos y antecedentes. Registrar ese caso NO_EJECUTADO si no se pudo verificar.
