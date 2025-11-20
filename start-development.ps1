<#
.SYNOPSIS
    Script de configuracion y arranque del entorno de desarrollo CREATE Platform.

.DESCRIPTION
    Este script automatiza la configuracion completa del entorno de desarrollo:
    - Sincroniza cambios desde Git (opcional)
    - Crea backups de configuracion (opcional)
    - Instala dependencias locales (backend y frontend)
    - Gestiona dependencias Docker con sincronizacion inteligente
    - Inicializa/configura la base de datos
    - Ejecuta migraciones y seeders
    - Arranca los contenedores Docker

    El script incluye proteccion contra bloqueos EPERM deteniendo automaticamente
    contenedores Docker y procesos de pnpm antes de instalar dependencias.

.PARAMETER Fresh
    Modo de instalacion limpia:
    - Elimina archivos lock (pnpm-lock.yaml)
    - Detiene y elimina todos los contenedores Docker
    - Reinstala todas las dependencias desde cero
    - Reconstruye las imagenes Docker
    - Si se combina con -ResetDB, tambien elimina el volumen de la base de datos

.PARAMETER ResetDB
    Resetea completamente la base de datos:
    - Elimina y recrea la base de datos
    - Ejecuta migraciones desde cero
    - Ejecuta todos los seeders (master + test)
    - Solo tiene efecto si se usa con -Fresh o si la base de datos ya existe

.PARAMETER SkipBackup
    Omite la creacion del backup automatico antes de sincronizar cambios.
    Los backups incluyen archivos .env y dump de la base de datos si esta disponible.

.PARAMETER SkipGit
    Omite todas las operaciones de Git (fetch, pull, deteccion de cambios).
    Util cuando trabajas offline o con cambios locales que no quieres sincronizar.

.PARAMETER ForceBuild
    Fuerza el rebuild de las imagenes Docker aunque no se detecten cambios.
    Util cuando necesitas reconstruir las imagenes sin modificar archivos.

.EXAMPLE
    .\start-development.ps1
    Ejecuta el flujo normal: sincroniza Git, crea backup, instala dependencias y arranca contenedores.

.EXAMPLE
    .\start-development.ps1 -Fresh
    Instalacion limpia completa: elimina locks, reconstruye todo desde cero.

.EXAMPLE
    .\start-development.ps1 -Fresh -ResetDB
    Instalacion limpia + reset completo de base de datos.

.EXAMPLE
    .\start-development.ps1 -SkipBackup -SkipGit
    Ejecucion rapida sin backups ni operaciones Git.

.EXAMPLE
    .\start-development.ps1 -ForceBuild
    Fuerza el rebuild de las imagenes Docker aunque no haya cambios detectados.

.FLOW
    FLUJO NORMAL (sin -Fresh):
    1. Git fetch y pull (si no -SkipGit)
    2. Crear backup (si no -SkipBackup)
    3. Detener contenedores Docker (para evitar bloqueos EPERM)
    4. Instalar dependencias locales (backend y frontend)
    5. Ejecutar audit fix en ambas carpetas
    6. Detectar cambios en Git para decidir rebuild
    7. Sincronizar dependencias Docker (solo si cambian los lockfiles)
    8. Arrancar contenedores Docker (con rebuild si es necesario)
    9. Inicializar base de datos (si no existe)
    10. Ejecutar migraciones pendientes
    11. Ejecutar seeders pendientes
    12. Mostrar resumen con URLs y credenciales

    FLUJO FRESH (-Fresh):
    1. Git fetch y pull (si no -SkipGit)
    2. Crear backup (si no -SkipBackup)
    3. Eliminar archivos lock (pnpm-lock.yaml)
    4. Detener y eliminar contenedores Docker
    5. Eliminar recursos Docker del proyecto (volumenes, redes)
    6. Instalar dependencias locales sin lockfiles
    7. Construir imagenes Docker (backend y frontend)
    8. Instalar dependencias Docker en volumenes
    9. Arrancar contenedores Docker
    10. Resetear o inicializar base de datos (segun -ResetDB)
    11. Ejecutar migraciones
    12. Ejecutar seeders (forzado si -ResetDB)
    13. Mostrar resumen con URLs y credenciales

.CARACTERISTICAS
    - Proteccion EPERM: Detiene automaticamente contenedores Docker antes de instalar dependencias
    - Reintentos inteligentes: Hasta 3 intentos con limpieza progresiva en caso de errores EPERM
    - Sincronizacion Docker: Solo reinstala dependencias Docker si cambian los lockfiles (hash SHA256)
    - Deteccion de cambios: Decide automaticamente si necesita rebuild basado en archivos modificados
    - Estado persistente: Guarda hashes de lockfiles en .docker-state para optimizar ejecuciones

.NOTAS
    - Requiere Docker y Docker Compose instalados y ejecutandose
    - Requiere pnpm instalado globalmente
    - Requiere acceso a Git remoto (a menos que uses -SkipGit)
    - El script debe ejecutarse desde la raiz del proyecto
    - En Windows, puede requerir permisos de administrador para algunas operaciones

#>

Param(
    [switch]$Fresh,
    [switch]$ResetDB,
    [switch]$SkipBackup,
    [switch]$SkipGit,
    [switch]$ForceBuild
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptRoot
$projectName = Split-Path $scriptRoot -Leaf
$stateDirectory = Join-Path $scriptRoot ".docker-state"
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message"
}

function Initialize-StateDirectory {
    if (-not (Test-Path $stateDirectory)) {
        New-Item -ItemType Directory -Path $stateDirectory | Out-Null
    }
}

function Get-FileHashValue {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        throw "No se encontro el archivo para calcular hash: $FilePath"
    }

    return (Get-FileHash -Path $FilePath -Algorithm SHA256).Hash.ToLower()
}

function Test-DockerVolumeExists {
    param(
        [string]$VolumeName,
        [string]$ProjectName
    )

    $candidates = @()
    if ($VolumeName) {
        $candidates += $VolumeName
    }
    if ($ProjectName) {
        $candidates += "$ProjectName`_$VolumeName"
    }

    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        try {
            $raw = Invoke-CliOutput "docker" @("volume", "ls", "--quiet", "--filter", "name=$candidate")
            if ($raw) {
                $match = $raw | Where-Object { $_ -and $_.Trim() -ne "" }
                if ($match) {
                    return $true
                }
            }
        } catch {
            continue
        }
    }

    return $false
}

function Update-DockerDependencies {
    param(
        [string]$ServiceName,
        [string]$VolumeName,
        [string]$LockFilePath,
        [string]$HashFileName,
        [string[]]$InstallCommandArgs
    )

    Initialize-StateDirectory

    $volumeExists = Test-DockerVolumeExists -VolumeName $VolumeName -ProjectName $projectName
    $currentHash = Get-FileHashValue -FilePath $LockFilePath
    $hashFilePath = Join-Path $stateDirectory $HashFileName
    $storedHash = $null

    if (Test-Path $hashFilePath) {
        $storedHash = (Get-Content -Path $hashFilePath -Raw).Trim().ToLower()
    }

    $needsInstall = $false
    $reason = ""

    if (-not $volumeExists) {
        $needsInstall = $true
        $reason = "el volumen '$VolumeName' no existe"
    } elseif ($storedHash -ne $currentHash) {
        $needsInstall = $true
        $reason = "se detectaron cambios en $LockFilePath"
    }

    if ($needsInstall) {
        if ($reason) {
            Write-Info "Reinstalando dependencias de Docker para '$ServiceName' porque $reason"
        } else {
            Write-Info "Reinstalando dependencias de Docker para '$ServiceName'"
        }
        Invoke-Cli "docker" $InstallCommandArgs
        Set-Content -Path $hashFilePath -Value $currentHash
    } else {
        Write-Info "Dependencias Docker para '$ServiceName' ya estan sincronizadas"
    }
}


function Invoke-Cli {
    param(
        [string]$Command,
        [string[]]$Arguments = @()
    )

    $processedArguments = $Arguments

    if ($Command -eq "docker" -and $Arguments.Count -gt 0 -and $Arguments[0] -eq "compose" -and -not ($Arguments -contains "--env-file")) {
        $envFile = Join-Path $scriptRoot ".env"
        if (Test-Path $envFile) {
            $remainingArgs = @()
            if ($Arguments.Count -gt 1) {
                $remainingArgs = $Arguments[1..($Arguments.Count - 1)]
            }
            $processedArguments = @("compose", "--env-file", $envFile) + $remainingArgs
        }
    }

    Write-Info "$Command $($processedArguments -join ' ')"
    & $Command @processedArguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE"
    }
}

function Invoke-CliOutput {
    param(
        [string]$Command,
        [string[]]$Arguments = @()
    )

    $processedArguments = $Arguments

    if ($Command -eq "docker" -and $Arguments.Count -gt 0 -and $Arguments[0] -eq "compose" -and -not ($Arguments -contains "--env-file")) {
        $envFile = Join-Path $scriptRoot ".env"
        if (Test-Path $envFile) {
            $remainingArgs = @()
            if ($Arguments.Count -gt 1) {
                $remainingArgs = $Arguments[1..($Arguments.Count - 1)]
            }
            $processedArguments = @("compose", "--env-file", $envFile) + $remainingArgs
        }
    }

    $result = & $Command @processedArguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Command failed with exit code $exitCode"
    }
    return $result
}

function Remove-ProjectDockerResources {
    param([string]$ProjectName)

    if (-not $ProjectName) {
        return
    }

    Write-Info "Eliminando recursos Docker del proyecto '$ProjectName'"

    try {
        $volumeRaw = Invoke-CliOutput "docker" @("volume", "ls", "--filter", "label=com.docker.compose.project=$ProjectName", "--format", "{{.Name}}")
        $volumes = @()
        if ($volumeRaw) {
            $volumes = ($volumeRaw -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
        }

        foreach ($volume in $volumes) {
            try {
                Invoke-Cli "docker" @("volume", "rm", "-f", $volume)
            } catch {
                Write-Info "No se pudo eliminar el volumen '$volume': $($_.Exception.Message)"
            }
        }
    } catch {
        Write-Info "No se pudieron listar los volumenes del proyecto '$ProjectName': $($_.Exception.Message)"
    }

    try {
        $networkRaw = Invoke-CliOutput "docker" @("network", "ls", "--filter", "label=com.docker.compose.project=$ProjectName", "--format", "{{.Name}}")
        $networks = @()
        if ($networkRaw) {
            $networks = ($networkRaw -split "`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
        }

        foreach ($network in $networks) {
            try {
                Invoke-Cli "docker" @("network", "rm", $network)
            } catch {
                Write-Info "No se pudo eliminar la red '$network': $($_.Exception.Message)"
            }
        }
    } catch {
        Write-Info "No se pudieron listar las redes del proyecto '$ProjectName': $($_.Exception.Message)"
    }
}

function Get-EnvFileValues {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        throw "No se encontro el archivo de entorno: $FilePath"
    }

    $values = @{}
    Get-Content $FilePath | ForEach-Object {
        $line = $_.Trim()
        if (-not $line) { return }
        if ($line.StartsWith('#')) { return }
        $parts = $line -split '=', 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $values[$key] = $value
        }
    }
    return $values
}

function Wait-ForDatabase {
    param(
        [securestring]$RootPassword,
        [int]$Retries = 30,
        [int]$DelaySeconds = 2
    )

    $rootPasswordPlain = [System.Net.NetworkCredential]::new('', $RootPassword).Password

    for ($attempt = 1; $attempt -le $Retries; $attempt++) {
        try {
            Invoke-Cli "docker" @("compose", "exec", "-T", "database", "env", "MYSQL_PWD=$rootPasswordPlain", "mysqladmin", "ping", "-h", "localhost", "-uroot")
            return
        } catch {
            if ($attempt -eq $Retries) {
                throw "La base de datos no respondio despues de $Retries intentos"
            }
            Start-Sleep -Seconds $DelaySeconds
        }
    }
}

function Initialize-Database {
    param([hashtable]$EnvValues)

    $rootPassword = $EnvValues['MYSQL_ROOT_PASSWORD']
    if (-not $rootPassword) {
        throw 'Falta MYSQL_ROOT_PASSWORD en .env'
    }

    $dbName = $EnvValues['DB_NAME']
    if (-not $dbName) {
        $dbName = $EnvValues['MYSQL_DATABASE']
    }
    if (-not $dbName) {
        throw 'Falta DB_NAME o MYSQL_DATABASE en .env'
    }

    $dbUser = $EnvValues['DB_USER']
    if (-not $dbUser) {
        $dbUser = $EnvValues['MYSQL_USER']
    }
    $dbPassword = $EnvValues['DB_PASSWORD']
    if (-not $dbPassword) {
        $dbPassword = $EnvValues['MYSQL_PASSWORD']
    }

    $rootPasswordSecure = ConvertTo-SecureString -String $rootPassword -AsPlainText -Force

    Write-Info "Esperando a que la base de datos este lista"
    Wait-ForDatabase -RootPassword $rootPasswordSecure

    Write-Info "Creando base de datos '$dbName' si no existe"
    $createDatabaseSql = "CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    Invoke-Cli "docker" @("compose", "exec", "-T", "database", "env", "MYSQL_PWD=$rootPassword", "mysql", "-uroot", "-e", $createDatabaseSql)

    if ($dbUser -and $dbPassword) {
        Write-Info "Asegurando usuario '$dbUser'"
        $escapedPassword = $dbPassword.Replace("'", "''")
        $grantSql = @"
CREATE USER IF NOT EXISTS '$dbUser'@'%' IDENTIFIED BY '$escapedPassword';
ALTER USER '$dbUser'@'%' IDENTIFIED BY '$escapedPassword';
GRANT ALL PRIVILEGES ON `$dbName`.* TO '$dbUser'@'%';
FLUSH PRIVILEGES;
"@
        Invoke-Cli "docker" @("compose", "exec", "-T", "database", "env", "MYSQL_PWD=$rootPassword", "mysql", "-uroot", "-e", $grantSql)
    }
}

function Reset-Database {
    param([hashtable]$EnvValues)

    Write-Info "Reseteando base de datos (eliminando y recreando)"

    $rootPassword = $EnvValues['MYSQL_ROOT_PASSWORD']
    if (-not $rootPassword) {
        throw 'Falta MYSQL_ROOT_PASSWORD en .env'
    }

    $dbName = $EnvValues['DB_NAME']
    if (-not $dbName) {
        $dbName = $EnvValues['MYSQL_DATABASE']
    }
    if (-not $dbName) {
        throw 'Falta DB_NAME o MYSQL_DATABASE en .env'
    }

    $rootPasswordSecure = ConvertTo-SecureString -String $rootPassword -AsPlainText -Force

    Write-Info "Esperando a que la base de datos este lista"
    Wait-ForDatabase -RootPassword $rootPasswordSecure

    Write-Info "Eliminando base de datos '$dbName' si existe"
    $dropDatabaseSql = "DROP DATABASE IF EXISTS `$dbName;"
    try {
        Invoke-Cli "docker" @("compose", "exec", "-T", "database", "env", "MYSQL_PWD=$rootPassword", "mysql", "-uroot", "-e", $dropDatabaseSql)
    } catch {
        Write-Info "No se pudo eliminar la base de datos (puede que no exista): $($_.Exception.Message)"
    }

    Initialize-Database -EnvValues $EnvValues
}

function Invoke-Migrations {
    Write-Info "Ejecutando migraciones pendientes"
    Invoke-Cli "docker" @("compose", "exec", "-T", "backend", "pnpm", "run", "migrate:up")
}

function Invoke-Seeders {
    Write-Info "Ejecutando seeders master"
    Invoke-Cli "docker" @("compose", "exec", "-T", "backend", "pnpm", "run", "seed:master")

    Write-Info "Ejecutando seeders de prueba"
    Invoke-Cli "docker" @("compose", "exec", "-T", "backend", "pnpm", "run", "seed:test")
}

function Get-SeedersStatus {
    try {
        $rawOutput = Invoke-CliOutput "docker" @("compose", "exec", "-T", "backend", "node", "src/scripts/db.js", "seed:status", "--json")
        if (-not $rawOutput) {
            return $null
        }

        $lines = @()
        if ($rawOutput -is [System.Array]) {
            $lines = $rawOutput
        } elseif ($rawOutput) {
            $lines = @($rawOutput)
        }

        foreach ($line in $lines) {
            if (-not $line) { continue }
            $trimmed = $line.Trim()
            if (-not $trimmed) { continue }

            try {
                return $trimmed | ConvertFrom-Json -ErrorAction Stop
            } catch {
                continue
            }
        }

        return $null
    } catch {
        Write-Info "No se pudo obtener el estado de los seeders: $($_.Exception.Message)"
        return $null
    }
}

function Invoke-SeedersIfPending {
    param([switch]$Force)

    $status = Get-SeedersStatus
    if ($Force -or -not $status) {
        if (-not $status) {
            Write-Info "Estado de seeders no disponible. Ejecutando seeders por defecto."
        }
        Invoke-Seeders
        return
    }

    $hasPending = $false
    foreach ($entry in $status) {
        $pending = $entry.pending
        $pendingItems = @()
        if ($pending -is [System.Array]) {
            $pendingItems = $pending
        } elseif ($pending) {
            $pendingItems = @($pending)
        }
        if ($pendingItems.Count -gt 0) {
            $hasPending = $true
            break
        }
    }

    if ($Force -or $hasPending) {
        if (-not $Force) {
            Write-Info "Seeders pendientes detectados. Ejecutando seeders."
        }
        Invoke-Seeders
    } else {
        Write-Info "Seeders ya aplicados. No se ejecutan nuevas semillas."
    }
}

function Get-GeneratedPasswords {
    try {
        $rawOutput = Invoke-CliOutput "docker" @("compose", "exec", "-T", "backend", "node", "src/scripts/show-passwords.js")
        if (-not $rawOutput) {
            return $null
        }

        $lines = @()
        if ($rawOutput -is [System.Array]) {
            $lines = $rawOutput
        } elseif ($rawOutput) {
            $lines = @($rawOutput)
        }

        $jsonContent = $lines -join "`n"
        if (-not $jsonContent -or $jsonContent.Trim() -eq '{}') {
            return $null
        }

        try {
            return $jsonContent | ConvertFrom-Json -ErrorAction Stop
        } catch {
            return $null
        }
    } catch {
        return $null
    }
}

function Write-EnvironmentSummary {
    Write-Host ""
    Write-Host "=================================================="
    Write-Host " create Platform lista"
    Write-Host "=================================================="
    Write-Host "Frontend:      http://localhost:3100/demo"
    Write-Host "Login tenant:  http://localhost:3100/demo/login"
    Write-Host "Backend API:   http://localhost:5100/api"
    Write-Host ""
    
    $passwords = Get-GeneratedPasswords
    
    if ($passwords) {
        Write-Host "Credenciales:"
        Write-Host ""
        
        # Superadmin
        $superAdmin = $passwords.PSObject.Properties | Where-Object { $_.Name -eq 'superadmin@create.dev' }
        if ($superAdmin) {
            Write-Host "Superadmin global:"
            Write-Host "  - Acceso:     http://localhost:3100/superadmin"
            Write-Host "  - Email:      superadmin@create.dev"
            Write-Host "  - Password:   $($superAdmin.Value.password)"
            Write-Host ""
        }
        
        # Demo tenant
        $demoUsers = $passwords.PSObject.Properties | Where-Object { 
            $_.Name -like '*@demo.com' 
        }
        if ($demoUsers) {
            Write-Host "Credenciales de demo (tenant 'demo'):"
            Write-Host "  - Frontend:   http://localhost:3100/demo"
            Write-Host ""
            foreach ($user in $demoUsers) {
                $role = if ($user.Value.role) { " ($($user.Value.role))" } else { "" }
                Write-Host "  - $($user.Name)$role / $($user.Value.password)"
            }
            Write-Host ""
        }
        
        # UIC tenant
        $uicUsers = $passwords.PSObject.Properties | Where-Object { 
            $_.Name -like '*@uic.*' 
        }
        if ($uicUsers) {
            Write-Host "Tenant UIC:"
            Write-Host "  - Frontend:   http://localhost:3100/uic"
            foreach ($user in $uicUsers) {
                $role = if ($user.Value.role) { " ($($user.Value.role))" } else { "" }
                Write-Host "  - $($user.Name)$role / $($user.Value.password)"
            }
            Write-Host ""
        }
    } 
    
    Write-Host "=================================================="
}

function New-Backup {
    $backupDir = Join-Path $scriptRoot "backups"
    if (-not (Test-Path $backupDir)) {
        Write-Info "Creating backups directory"
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupPath = Join-Path $backupDir "create-backup-$timestamp.zip"
    $databaseDumpLocalPath = $null
    $containerDumpPath = $null

    Write-Info "Creating backup at $backupPath"

    try {
        $shouldDumpDatabase = $false
        try {
            $runningServices = Invoke-CliOutput "docker" @("compose", "--profile", "dev", "ps", "--services", "--filter", "status=running")
            $runningServices = @($runningServices)
            if ($runningServices -contains "database") {
                $shouldDumpDatabase = $true
            } else {
                Write-Info "El contenedor 'database' no esta en ejecucion. Se omitira el backup de la base de datos."
            }
        } catch {
            Write-Info "No se pudo verificar el estado del contenedor 'database'. Se omitira el backup de la base de datos. Detalle: $($_.Exception.Message)"
        }

        if ($shouldDumpDatabase) {
            $envValues = $null
            $envFilePath = Join-Path $scriptRoot ".env"
            try {
                $envValues = Get-EnvFileValues -FilePath $envFilePath
            } catch {
                Write-Info "No se pudo leer .env. Se omitira el backup de la base de datos. Detalle: $($_.Exception.Message)"
                $shouldDumpDatabase = $false
            }

            if ($shouldDumpDatabase) {
                $rootPassword = $envValues['MYSQL_ROOT_PASSWORD']
                if (-not $rootPassword) {
                    Write-Info "Falta MYSQL_ROOT_PASSWORD en .env. Se omitira el backup de la base de datos."
                    $shouldDumpDatabase = $false
                }
            }

            if ($shouldDumpDatabase) {
                $dbName = $envValues['DB_NAME']
                if (-not $dbName) {
                    $dbName = $envValues['MYSQL_DATABASE']
                }

                if (-not $dbName) {
                    Write-Info "Falta DB_NAME o MYSQL_DATABASE en .env. Se omitira el backup de la base de datos."
                    $shouldDumpDatabase = $false
                }
            }

            if ($shouldDumpDatabase) {
                $containerDumpPath = "/tmp/db-backup-$timestamp.sql"
                $databaseDumpLocalPath = Join-Path $scriptRoot "db-backup-$timestamp.sql"

                Write-Info "Generando backup de la base de datos '$dbName'"
                Invoke-Cli "docker" @("compose", "exec", "-T", "database", "env", "MYSQL_PWD=$rootPassword", "mysqldump", "-uroot", "--single-transaction", "--routines", "--events", "--databases", $dbName, "--result-file=$containerDumpPath")
                Invoke-Cli "docker" @("compose", "cp", "database:$containerDumpPath", $databaseDumpLocalPath)
                Invoke-Cli "docker" @("compose", "exec", "-T", "database", "rm", "-f", $containerDumpPath)
            }
        }

        $itemsToArchive = @()

        $envFiles = Get-ChildItem -Path $scriptRoot -Filter ".env*" -File -Force -ErrorAction SilentlyContinue
        if ($envFiles) {
            $itemsToArchive += $envFiles.FullName
        }

        if ($databaseDumpLocalPath -and (Test-Path $databaseDumpLocalPath)) {
            $itemsToArchive += $databaseDumpLocalPath
        }

        if (-not $itemsToArchive -or $itemsToArchive.Count -eq 0) {
            Write-Info "No se encontraron ficheros .env ni dump de base de datos para incluir en el backup"
            return $null
        }

        Compress-Archive -LiteralPath $itemsToArchive -CompressionLevel Optimal -DestinationPath $backupPath -Force
        Write-Info "Backup ready"
        return $backupPath
    } finally {
        if ($databaseDumpLocalPath -and (Test-Path $databaseDumpLocalPath)) {
            Remove-Item -Path $databaseDumpLocalPath -Force
        }
    }
}

function Test-RebuildRequired {
    param([string[]]$Paths)

    if (-not $Paths -or $Paths.Count -eq 0) {
        return $false
    }

    $patterns = @(
        "^backend/",
        "^frontend/",
        "^docker/",
        "docker-compose\.ya?ml$",
        "Dockerfile",
        "package\.json$",
        "pnpm-lock\.yaml$",
        "package-lock\.json$",
        "yarn\.lock$",
        "\.env"
    )

    foreach ($path in $Paths) {
        $normalizedPath = $path -replace '\\', '/'
        foreach ($pattern in $patterns) {
            if ($normalizedPath -match $pattern) {
                return $true
            }
        }
    }

    return $false
}

function Stop-DockerContainers {
    Write-Info "Deteniendo contenedores Docker para evitar bloqueos..."
    try {
        & docker compose --profile dev down --remove-orphans 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Contenedores Docker detenidos exitosamente"
        } else {
            Write-Info "docker compose down completo con codigo $LASTEXITCODE"
        }
        Start-Sleep -Seconds 2
    } catch {
        Write-Info "No se pudieron detener todos los contenedores: $($_.Exception.Message)"
        Write-Info "Continuando con la instalacion de dependencias..."
    }
}

function Stop-PnpmProcesses {
    Write-Info "Verificando procesos de pnpm y node que puedan estar bloqueando archivos..."
    try {
        # Detener procesos de pnpm
        $pnpmProcesses = Get-Process -Name "pnpm" -ErrorAction SilentlyContinue
        if ($pnpmProcesses) {
            Write-Info "Detectados $($pnpmProcesses.Count) proceso(s) de pnpm. Intentando cerrarlos..."
            foreach ($proc in $pnpmProcesses) {
                try {
                    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                    Write-Info "Proceso pnpm (PID: $($proc.Id)) cerrado"
                } catch {
                    Write-Info "No se pudo cerrar el proceso pnpm (PID: $($proc.Id)): $($_.Exception.Message)"
                }
            }
        }
        
        # Detener procesos de node que puedan estar bloqueando archivos
        # Solo detener procesos de node que esten relacionados con pnpm o instalaciones
        $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
        if ($nodeProcesses) {
            Write-Info "Detectados $($nodeProcesses.Count) proceso(s) de node. Verificando si estan relacionados con pnpm..."
            foreach ($proc in $nodeProcesses) {
                try {
                    # Verificar si el proceso esta relacionado con pnpm o instalaciones
                    $commandLine = $null
                    try {
                        # Intentar usar CIM primero (compatible con PowerShell Core y Windows PowerShell)
                        $cimProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue
                        if ($cimProcess) {
                            $commandLine = $cimProcess.CommandLine
                        }
                    } catch {
                        # Si CIM falla, intentar con WMI (solo Windows PowerShell)
                        try {
                            if ($PSVersionTable.PSVersion.Major -le 5) {
                                $wmiProcess = Get-WmiObject Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue
                                if ($wmiProcess) {
                                    $commandLine = $wmiProcess.CommandLine
                                }
                            }
                        } catch {
                            # Si ambos fallan, asumir que es seguro cerrar procesos de node relacionados con instalaciones
                            $commandLine = ""
                        }
                    }
                    
                    # Si no podemos obtener la linea de comandos o contiene pnpm/install, cerrar el proceso
                    if (-not $commandLine -or $commandLine -like "*pnpm*" -or $commandLine -like "*install*" -or $commandLine -like "*node_modules*") {
                        Write-Info "Cerrando proceso node relacionado con pnpm (PID: $($proc.Id))..."
                        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                        Write-Info "Proceso node (PID: $($proc.Id)) cerrado"
                    }
                } catch {
                    Write-Info "No se pudo verificar/cerrar el proceso node (PID: $($proc.Id)): $($_.Exception.Message)"
                }
            }
        }
        
        if ($pnpmProcesses -or $nodeProcesses) {
            Write-Info "Esperando 3 segundos para que los procesos se liberen completamente..."
            Start-Sleep -Seconds 3
        }
    } catch {
        Write-Info "No se pudieron verificar procesos de pnpm/node: $($_.Exception.Message)"
    }
}

function Install-Dependencies {
    param(
        [string]$WorkingDirectory,
        [string]$Command,
        [string[]]$Arguments = @(),
        [int]$MaxRetries = 3,
        [switch]$PreStopProcesses
    )

    Write-Info "Installing dependencies in $WorkingDirectory"
    
    # Detener procesos antes del primer intento si se solicita
    if ($PreStopProcesses) {
        Write-Info "Deteniendo procesos y contenedores que puedan estar bloqueando archivos antes de instalar..."
        Stop-DockerContainers
        Stop-PnpmProcesses
        Start-Sleep -Seconds 2
    }
    
    Push-Location $WorkingDirectory
    try {
        $attempt = 0
        $success = $false
        
        while ($attempt -lt $MaxRetries -and -not $success) {
            $attempt++
            
            if ($attempt -gt 1) {
                Write-Info "Intento $attempt de $MaxRetries..."
                if ($attempt -eq 2) {
                    Write-Info "Deteniendo procesos y contenedores que puedan estar bloqueando archivos..."
                    Stop-DockerContainers
                    Stop-PnpmProcesses
                    Write-Info "Esperando 3 segundos antes de reintentar..."
                    Start-Sleep -Seconds 3
                } elseif ($attempt -eq 3) {
                    Write-Info "Limpiando node_modules antes del ultimo intento..."
                    Stop-DockerContainers
                    $nodeModulesPath = Join-Path $WorkingDirectory "node_modules"
                    if (Test-Path $nodeModulesPath) {
                        try {
                            Remove-Item -Path $nodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue
                            Write-Info "node_modules eliminado"
                        } catch {
                            Write-Info "No se pudo eliminar node_modules completamente: $($_.Exception.Message)"
                        }
                    }
                    Start-Sleep -Seconds 2
                }
            }
            
            try {
                Write-Info "$Command $($Arguments -join ' ')"
                $output = & $Command @Arguments 2>&1
                $exitCode = $LASTEXITCODE
                
                # Convertir codigo negativo a positivo si es necesario (Windows maneja codigos negativos como numeros grandes sin signo)
                $unsignedExitCode = $exitCode
                if ($exitCode -lt 0) {
                    $unsignedExitCode = [uint32]::MaxValue + $exitCode + 1
                }
                
                # Codigos de error comunes en Windows relacionados con permisos/bloqueos
                $isPermissionError = $false
                $errorCodeName = ""
                
                if ($LASTEXITCODE -eq 0 -or $unsignedExitCode -eq 0) {
                    $success = $true
                } elseif ($LASTEXITCODE -eq -4048 -or $unsignedExitCode -eq 4294967248) {
                    # EPERM (-4048 decimal = 4294967248 como uint32)
                    $isPermissionError = $true
                    $errorCodeName = "EPERM"
                } elseif ($LASTEXITCODE -eq -4082 -or $unsignedExitCode -eq 4294967214) {
                    # Error de acceso denegado/bloqueado (-4082 decimal = 4294967214 como uint32)
                    $isPermissionError = $true
                    $errorCodeName = "ACCESS_DENIED"
                } elseif ($output -like "*EPERM*" -or $output -like "*access denied*" -or $output -like "*permission denied*" -or $output -like "*bloqueado*") {
                    $isPermissionError = $true
                    $errorCodeName = "PERMISSION_ERROR"
                }
                
                if ($isPermissionError) {
                    if ($attempt -lt $MaxRetries) {
                        Write-Info "Error de permisos/bloqueo ($errorCodeName, codigo $LASTEXITCODE) detectado."
                        
                        # Para errores de acceso denegado, intentar limpiar procesos y archivos bloqueados
                        if ($errorCodeName -eq "ACCESS_DENIED" -or $errorCodeName -eq "EPERM") {
                            Write-Info "Deteniendo procesos y limpiando archivos bloqueados antes de reintentar..."
                            Stop-DockerContainers
                            Stop-PnpmProcesses
                            
                            # Intentar limpiar archivos temporales de pnpm que puedan estar bloqueados
                            Write-Info "Limpiando cache de pnpm..."
                            try {
                                & pnpm store prune 2>&1 | Out-Null
                            } catch {
                                Write-Info "No se pudo limpiar el cache de pnpm: $($_.Exception.Message)"
                            }
                            
                            # Esperar mas tiempo para errores de acceso denegado
                            Write-Info "Esperando 5 segundos para que los archivos se liberen..."
                            Start-Sleep -Seconds 5
                        }
                        
                        Write-Info "Reintentando..."
                        continue
                    } else {
                        Write-Error "Error de permisos/bloqueo persistente ($errorCodeName, codigo $LASTEXITCODE) despues de $MaxRetries intentos."
                        Write-Error "Posibles soluciones:"
                        Write-Error "  1. Cierra editores de texto o IDEs que puedan tener abiertos archivos en $WorkingDirectory"
                        Write-Error "  2. Ejecuta PowerShell como Administrador"
                        Write-Error "  3. Desactiva temporalmente el antivirus o agrega una exclusion para $WorkingDirectory"
                        Write-Error "  4. Cierra otros procesos de pnpm o node que puedan estar ejecutandose"
                        $nodeModulesPath = Join-Path $WorkingDirectory "node_modules"
                        Write-Error "  5. Intenta eliminar manualmente: Remove-Item -Path `"$nodeModulesPath`" -Recurse -Force"
                        throw "$Command failed with exit code $LASTEXITCODE ($errorCodeName)"
                    }
                } elseif ($LASTEXITCODE -ne 0) {
                    throw "$Command failed with exit code $LASTEXITCODE"
                }
            } catch {
                $errorMessage = $_.Exception.Message
                # Tambien verificar el mensaje de error por si contiene errores de permisos
                $isPermissionErrorInMessage = $errorMessage -like "*EPERM*" -or $errorMessage -like "*operation not permitted*" -or $errorMessage -like "*4048*" -or $errorMessage -like "*4082*" -or $errorMessage -like "*access denied*" -or $errorMessage -like "*permission denied*"
                
                if ($isPermissionErrorInMessage) {
                    if ($attempt -lt $MaxRetries) {
                        Write-Info "Error de permisos detectado en mensaje: $errorMessage"
                        Write-Info "Deteniendo procesos y limpiando archivos bloqueados antes de reintentar..."
                        Stop-DockerContainers
                        Stop-PnpmProcesses
                        
                        # Intentar limpiar archivos temporales de pnpm que puedan estar bloqueados
                        Write-Info "Limpiando cache de pnpm..."
                        try {
                            & pnpm store prune 2>&1 | Out-Null
                        } catch {
                            Write-Info "No se pudo limpiar el cache de pnpm: $($_.Exception.Message)"
                        }
                        
                        Write-Info "Esperando 5 segundos para que los archivos se liberen..."
                        Start-Sleep -Seconds 5
                        Write-Info "Reintentando..."
                        continue
                    } else {
                        Write-Error "Error de permisos persistente despues de $MaxRetries intentos."
                        Write-Error "Posibles soluciones:"
                        Write-Error "  1. Cierra editores de texto o IDEs que puedan tener abiertos archivos en $WorkingDirectory"
                        Write-Error "  2. Ejecuta PowerShell como Administrador"
                        Write-Error "  3. Desactiva temporalmente el antivirus o agrega una exclusion para $WorkingDirectory"
                        Write-Error "  4. Cierra otros procesos de pnpm o node que puedan estar ejecutandose"
                        $nodeModulesPath = Join-Path $WorkingDirectory "node_modules"
                        Write-Error "  5. Intenta eliminar manualmente: Remove-Item -Path `"$nodeModulesPath`" -Recurse -Force"
                        throw
                    }
                } else {
                    throw
                }
            }
        }
    } finally {
        Pop-Location
    }
}

function Invoke-AuditFix {
    param(
        [string]$WorkingDirectory,
        [string]$Command,
        [string[]]$Arguments = @()
    )

    Write-Info "Ejecutando $Command audit fix en $WorkingDirectory"
    Push-Location $WorkingDirectory
    try {
        Write-Info "$Command $($Arguments -join ' ')"
        & $Command @Arguments
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            Write-Info "audit fix completo con codigo de salida $exitCode. Algunas vulnerabilidades pueden requerir cambios breaking. El script continuara."
        } else {
            Write-Info "audit fix completado exitosamente"
        }
    } catch {
        Write-Info "Error al ejecutar audit fix: $($_.Exception.Message). El script continuara."
    } finally {
        Pop-Location
    }
}

try {
    Write-Info "Starting development setup"

    $pendingRemoteChanges = @()
    $localChangesRaw = @()

    if ($SkipGit) {
        Write-Info "Git operations skipped by request"
    } else {
        try {
            Invoke-Cli "git" @("fetch", "--all")
        } catch {
            Write-Error "git fetch failed: $($_.Exception.Message). Vuelve a intentarlo o ejecuta el script con -SkipGit para continuar sin operaciones remotas."
            throw
        }

        $upstreamRef = ""
        try {
            $upstreamRaw = Invoke-CliOutput "git" @("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
            if ($upstreamRaw) {
                $upstreamRef = $upstreamRaw.Trim()
            }
        } catch {
            Write-Info "No upstream reference detected"
        }

        if ($upstreamRef) {
            Write-Info "Detecting remote changes against $upstreamRef"
            try {
                $pendingRemoteChanges = Invoke-CliOutput "git" @("diff", "--name-only", "HEAD", $upstreamRef)
            } catch {
                Write-Info "No se pudieron obtener los cambios remotos: $($_.Exception.Message)"
            }
        }
    }

    if ($SkipBackup) {
        Write-Info "Backup skipped by request"
    } else {
        New-Backup | Out-Null
    }

    if (-not $SkipGit) {
        try {
            Invoke-Cli "git" @("pull")
        } catch {
            Write-Error "git pull failed: $($_.Exception.Message). Usa -SkipGit si deseas continuar sin sincronizar." 
            throw
        }
    }

    $envFilePath = Join-Path $scriptRoot ".env"
    $envValues = Get-EnvFileValues -FilePath $envFilePath

    $backendLockFile = Join-Path $scriptRoot "backend/pnpm-lock.yaml"
    $frontendLockFile = Join-Path $scriptRoot "frontend/pnpm-lock.yaml"

    if ($Fresh) {
        Write-Info "Fresh mode selected"
        
        Write-Info "Eliminando archivos lock para instalacion limpia"
        if (Test-Path $backendLockFile) {
            Remove-Item -Path $backendLockFile -Force
            Write-Info "Eliminado: $backendLockFile"
        }
        # Tambien eliminar package-lock.json si existe (legacy)
        $legacyBackendLockFile = Join-Path $scriptRoot "backend/package-lock.json"
        if (Test-Path $legacyBackendLockFile) {
            Remove-Item -Path $legacyBackendLockFile -Force
            Write-Info "Eliminado (legacy): $legacyBackendLockFile"
        }
        if (Test-Path $frontendLockFile) {
            Remove-Item -Path $frontendLockFile -Force
            Write-Info "Eliminado: $frontendLockFile"
        }
        
        if ($ResetDB) {
            Write-Info "ResetDB activado: se eliminara el volumen de la base de datos"
            Invoke-Cli "docker" @("compose", "--profile", "dev", "down", "--volumes", "--remove-orphans")
        } else {
            Write-Info "ResetDB no activado: se preserva el volumen de la base de datos"
            Invoke-Cli "docker" @("compose", "--profile", "dev", "down", "--remove-orphans")
            try {
                $dbVolumeName = "${projectName}_mysql_data"
                $dbVolumeExists = Test-DockerVolumeExists -VolumeName "mysql_data" -ProjectName $projectName
                if ($dbVolumeExists) {
                    Write-Info "Preservando volumen de base de datos: $dbVolumeName"
                }
            } catch {
                Write-Info "No se pudo verificar el volumen de la base de datos: $($_.Exception.Message)"
            }
        }
        
        Remove-ProjectDockerResources -ProjectName $projectName
        
        Write-Info "Instalando dependencias locales sin archivos lock"
        Install-Dependencies -WorkingDirectory (Join-Path $scriptRoot "backend") -Command "pnpm" -Arguments @("install") -PreStopProcesses
        Install-Dependencies -WorkingDirectory (Join-Path $scriptRoot "frontend") -Command "pnpm" -Arguments @("install") -PreStopProcesses
        
        # Construir imagenes primero antes de ejecutar comandos
        Write-Info "Construyendo imagenes Docker"
        Invoke-Cli "docker" @("compose", "--profile", "dev", "build", "backend", "frontend")
        
        Update-DockerDependencies -ServiceName "backend" -VolumeName "backend_node_modules" -LockFilePath $backendLockFile -HashFileName "backend-deps.hash" -InstallCommandArgs @("compose", "--profile", "dev", "run", "--build", "--rm", "backend", "pnpm", "install")
        Update-DockerDependencies -ServiceName "frontend" -VolumeName "frontend_node_modules" -LockFilePath $frontendLockFile -HashFileName "frontend-deps.hash" -InstallCommandArgs @("compose", "--profile", "dev", "run", "--build", "--rm", "frontend", "pnpm", "install")
        Invoke-Cli "docker" @("compose", "--profile", "dev", "up", "-d")
        
        if ($ResetDB) {
            Reset-Database -EnvValues $envValues
            Invoke-Migrations
            Invoke-SeedersIfPending -Force
        } else {
            Initialize-Database -EnvValues $envValues
            Invoke-Migrations
            Invoke-SeedersIfPending
        }
        
        Invoke-Cli "docker" @("compose", "--profile", "dev", "ps")
        Write-Info "Fresh setup completed"
        Write-EnvironmentSummary
        exit 0
    }

    # Detener contenedores Docker antes de instalar dependencias para evitar bloqueos EPERM
    Stop-DockerContainers

    Install-Dependencies -WorkingDirectory (Join-Path $scriptRoot "backend") -Command "pnpm" -Arguments @("install") -PreStopProcesses

    Invoke-AuditFix -WorkingDirectory (Join-Path $scriptRoot "backend") -Command "pnpm" -Arguments @("audit", "fix")

    Install-Dependencies -WorkingDirectory (Join-Path $scriptRoot "frontend") -Command "pnpm" -Arguments @("install") -PreStopProcesses

    Invoke-AuditFix -WorkingDirectory (Join-Path $scriptRoot "frontend") -Command "pnpm" -Arguments @("audit", "fix")

    if (-not $SkipGit) {
        try {
            $localChangesRaw = Invoke-CliOutput "git" @("status", "--porcelain")
        } catch {
            Write-Info "No se pudieron leer los cambios locales: $($_.Exception.Message)"
            $localChangesRaw = @()
        }
    }
    $localChanges = @()
    foreach ($line in $localChangesRaw) {
        if (-not $line) { continue }
        if ($line -like "R*->*") {
            $parts = $line.Substring(3).Split("->", [System.StringSplitOptions]::RemoveEmptyEntries)
            foreach ($part in $parts) {
                $localChanges += $part.Trim()
            }
        } elseif ($line.Length -gt 3) {
            $localChanges += $line.Substring(3).Trim()
        } else {
            $localChanges += $line.Trim()
        }
    }

    $allChanges = @()
    if ($pendingRemoteChanges) {
        $allChanges += $pendingRemoteChanges
    }
    if ($localChanges) {
        $allChanges += $localChanges
    }
    $allChanges = $allChanges | Where-Object { $_ } | Sort-Object -Unique

    Update-DockerDependencies -ServiceName "backend" -VolumeName "backend_node_modules" -LockFilePath $backendLockFile -HashFileName "backend-deps.hash" -InstallCommandArgs @("compose", "--profile", "dev", "run", "--build", "--rm", "backend", "pnpm", "install", "--frozen-lockfile")
    Update-DockerDependencies -ServiceName "frontend" -VolumeName "frontend_node_modules" -LockFilePath $frontendLockFile -HashFileName "frontend-deps.hash" -InstallCommandArgs @("compose", "--profile", "dev", "run", "--build", "--rm", "frontend", "pnpm", "install", "--frozen-lockfile")

    if ($ForceBuild -or (Test-RebuildRequired -Paths $allChanges)) {
        if ($ForceBuild) {
            Write-Info "ForceBuild activado: forzando rebuild de imagenes Docker"
        } else {
            Write-Info "Changes require rebuild"
        }
        Invoke-Cli "docker" @("compose", "--profile", "dev", "up", "--build", "-d")
    } else {
        Write-Info "No rebuild required, starting containers"
        Invoke-Cli "docker" @("compose", "--profile", "dev", "up", "-d")
    }

    if ($ResetDB) {
        Write-Info "ResetDB activado: reseteando base de datos"
        Reset-Database -EnvValues $envValues
        Invoke-Migrations
        Invoke-SeedersIfPending -Force
    } else {
        Initialize-Database -EnvValues $envValues
        Invoke-Migrations
        Invoke-SeedersIfPending
    }

    Invoke-Cli "docker" @("compose", "--profile", "dev", "ps")
    Write-Info "Setup completed"
    Write-EnvironmentSummary
} catch {
    Write-Error $_
    exit 1
}

