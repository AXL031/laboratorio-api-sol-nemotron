$ErrorActionPreference='Stop'
$attemptRoot=Split-Path -Parent $PSScriptRoot
docker compose --file (Join-Path $attemptRoot 'infra/compose.yaml') up -d --wait
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL del segundo intento. Comprueba Docker Desktop y permisos.' }
