# Casos propuestos para una ejecución posterior

Este es un plan, no una suite ejecutada. No se ha llamado a ningún API de los modelos.
La primera comparación se hará con sus respuestas. Estos casos sirven si después se ejecuta el código.

| Caso | Resultado esperado |
|---|---|
| Crear promoción válida | 201; UUID; conserva configuración |
| Crear porcentaje >100, valor <=0 o fechas iguales/invertidas | 422 VALIDACION; sin alta |
| Crear con canales vacíos/duplicados o alcance vacío/inactivo | 422 VALIDACION |
| Crear lote válido | 201; todos guardados; orden de entrada |
| Lote con elemento inválido | 422; ningún elemento guardado |
| PATCH solo nombre | 200; conserva todos los campos omitidos |
| PATCH que deja porcentaje >100 al fusionar | 422; sin modificación parcial |
| Cambiar modalidad antes de primera activación, estando inactiva | 200 |
| Activar y luego desactivar por PATCH; intentar cambiar modalidad | 409 MODALIDAD_BLOQUEADA |
| Enviar puedeCambiarModalidad desde cliente | 422; no autoriza cambios |
| Consultas administrativa, detalle y comercial | Forma de respuesta y filtros del contrato |
| Consultar comercial sin canal o con query inválida | 400 VALIDACION |
| Sin token / token incorrecto / lector escribiendo | 401 / 401 / 403 |
| DELETE válido y consulta posterior | 204 sin cuerpo; luego 404 |
| Repetir DELETE o PATCH del eliminado | 404; antecedente conservado en DB |
| Reiniciar servicio usando la misma DB | Datos y antecedentes persisten |
| Inspeccionar estructura de persistencia | 13 columnas originales + deleted_at |

Registrar por caso entrada, esperado, observado y evidencia. No marcar PASS por leer código o documentos.
