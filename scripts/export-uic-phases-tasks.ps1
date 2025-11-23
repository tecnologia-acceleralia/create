# Script PowerShell para ejecutar el exportador de fases y tareas UIC
# Este script simplemente llama al script Node.js principal
#
# Uso:
#   .\scripts\export-uic-phases-tasks.ps1
#   O directamente: node scripts\export-uic-phases-tasks.js
#
# Requisitos:
#   - Node.js instalado
#   - mysql2 instalado (npm install mysql2 en backend/)
#   - Variables de entorno configuradas (ver README)

$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Verificar que Node.js está instalado
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Error "Node.js no está instalado. Por favor, instálalo primero."
    Write-Error ""
    Write-Error "Puedes:"
    Write-Error "  1. Instalar Node.js desde https://nodejs.org/"
    Write-Error "  2. O ejecutar directamente: node scripts\export-uic-phases-tasks.js"
    exit 1
}

# Obtener directorio del script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

# Cambiar al directorio raíz del proyecto
Set-Location $projectRoot

# Verificar que el script Node.js existe
$jsScript = Join-Path $scriptDir "export-uic-phases-tasks.js"
if (-not (Test-Path $jsScript)) {
    Write-Error "No se encontró el script Node.js: $jsScript"
    exit 1
}

# Verificar que mysql2 está instalado
$backendMysql2 = Join-Path $projectRoot "backend\node_modules\mysql2"
$rootMysql2 = Join-Path $projectRoot "node_modules\mysql2"

if (-not (Test-Path $backendMysql2) -and -not (Test-Path $rootMysql2)) {
    Write-Warn "mysql2 no está instalado. Instalando..."
    $backendPackageJson = Join-Path $projectRoot "backend\package.json"
    if (Test-Path $backendPackageJson) {
        Set-Location (Join-Path $projectRoot "backend")
        npm install mysql2
        Set-Location $projectRoot
    } else {
        npm install mysql2
    }
}

# Ejecutar el script Node.js
Write-Info "Ejecutando exportador de fases y tareas UIC..."
& node $jsScript

