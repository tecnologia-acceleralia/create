<#
.SYNOPSIS
    Conecta a la base de datos MySQL en Docker leyendo credenciales del archivo .env

.DESCRIPTION
    Este script lee automáticamente las credenciales de MySQL desde el archivo .env
    y se conecta al contenedor Docker de la base de datos.

.PARAMETER Database
    Nombre de la base de datos a la que conectarse. Por defecto usa el valor de MYSQL_DATABASE del .env

.PARAMETER User
    Usuario de MySQL. Por defecto usa 'root'

.EXAMPLE
    .\scripts\connect-mysql.ps1
    Se conecta a MySQL usando las credenciales del .env

.EXAMPLE
    .\scripts\connect-mysql.ps1 -Database create
    Se conecta directamente a la base de datos 'create'

.EXAMPLE
    .\scripts\connect-mysql.ps1 -User create_user
    Se conecta usando el usuario 'create_user' (requiere MYSQL_PASSWORD del .env)
#>

param(
    [string]$Database = "",
    [string]$User = "root"
)

# Obtener el directorio raíz del proyecto
$scriptRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $scriptRoot ".env"

# Verificar que existe el archivo .env
if (-not (Test-Path $envFile)) {
    Write-Host "Error: No se encontró el archivo .env en $scriptRoot" -ForegroundColor Red
    exit 1
}

# Leer el archivo .env
$envContent = Get-Content $envFile -Raw

# Extraer credenciales
$rootPassword = ""
$mysqlPassword = ""
$mysqlDatabase = ""

if ($envContent -match 'MYSQL_ROOT_PASSWORD=([^\r\n]+)') {
    $rootPassword = $matches[1].Trim()
}

if ($envContent -match 'MYSQL_PASSWORD=([^\r\n]+)') {
    $mysqlPassword = $matches[1].Trim()
}

if ($envContent -match 'MYSQL_DATABASE=([^\r\n]+)') {
    $mysqlDatabase = $matches[1].Trim()
}

# Determinar qué contraseña usar según el usuario
$password = if ($User -eq "root") { $rootPassword } else { $mysqlPassword }

if ([string]::IsNullOrWhiteSpace($password)) {
    $varName = if ($User -eq "root") { "MYSQL_ROOT_PASSWORD" } else { "MYSQL_PASSWORD" }
    Write-Host "Error: No se encontró $varName en el archivo .env" -ForegroundColor Red
    exit 1
}

# Usar la base de datos especificada o la del .env
$targetDatabase = if ($Database) { $Database } else { $mysqlDatabase }

# Verificar que el contenedor está corriendo
$containerStatus = docker ps --filter "name=create-database" --format "{{.Status}}" 2>&1
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerStatus)) {
    Write-Host "Error: El contenedor 'create-database' no está corriendo" -ForegroundColor Red
    Write-Host "Ejecuta 'docker-compose up -d database' para iniciarlo" -ForegroundColor Yellow
    exit 1
}

Write-Host "Conectando a MySQL..." -ForegroundColor Green
Write-Host "Usuario: $User" -ForegroundColor Cyan
if ($targetDatabase) {
    Write-Host "Base de datos: $targetDatabase" -ForegroundColor Cyan
}
Write-Host ""

# Construir y ejecutar el comando MySQL
# Usamos sh -c con comillas simples para evitar problemas de escape en PowerShell
if ($targetDatabase) {
    docker exec -it create-database sh -c "mysql -u $User -p'$password' $targetDatabase"
} else {
    docker exec -it create-database sh -c "mysql -u $User -p'$password'"
}

