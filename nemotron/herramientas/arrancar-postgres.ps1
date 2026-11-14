$ErrorActionPreference='Stop'
$supportRoot=Split-Path -Parent $PSScriptRoot
docker compose --file (Join-Path $supportRoot 'infra/compose.yaml') up -d --wait
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL Nemotron no pudo iniciarse; comprobar Docker y permisos.' }
