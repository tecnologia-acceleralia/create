Param(
    [switch]$Fresh,
    [switch]$SkipBackup,
    [switch]$SkipGit
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
        $envFile = Join-Path $scriptRoot ".env.dev"
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
        $envFile = Join-Path $scriptRoot ".env.dev"
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
        throw 'Falta MYSQL_ROOT_PASSWORD en .env.dev'
    }

    $dbName = $EnvValues['DB_NAME']
    if (-not $dbName) {
        $dbName = $EnvValues['MYSQL_DATABASE']
    }
    if (-not $dbName) {
        throw 'Falta DB_NAME o MYSQL_DATABASE en .env.dev'
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

function Invoke-Migrations {
    Write-Info "Ejecutando migraciones pendientes"
    Invoke-Cli "docker" @("compose", "exec", "-T", "backend", "npm", "run", "migrate:up")
}

function Invoke-Seeders {
    Write-Info "Ejecutando seeders master"
    Invoke-Cli "docker" @("compose", "exec", "-T", "backend", "npm", "run", "seed:master")

    Write-Info "Ejecutando seeders de prueba"
    Invoke-Cli "docker" @("compose", "exec", "-T", "backend", "npm", "run", "seed:test")
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
    } else {
        Write-Host "Credenciales de demo (tenant 'demo'):"
        Write-Host "  - Admin:      admin@demo.com      / k|Y]:Jl:k,9*"
        Write-Host "  - Evaluador:  evaluator@demo.com  / (u3I}ti1]V(r"
        Write-Host "  - Capitan:    captain@demo.com    / 0v3y!pFQZl.q"
        Write-Host "  - Participante: participant@demo.com / 0v3y!pFQZl.q"
        Write-Host "  - Usuarios de prueba (5 proyectos):"
        Write-Host "    - usuario1@demo.com (Capitan Proyecto 1) / dEm!pAsS1@demo"
        Write-Host "    - usuario2@demo.com (Participante Proyecto 1) / dEm!pAsS2@demo"
        Write-Host "    - usuario3@demo.com (Capitan Proyecto 2) / dEm!pAsS3@demo"
        Write-Host "    - usuario4@demo.com (Participante Proyecto 2) / dEm!pAsS4@demo"
        Write-Host "    - usuario5@demo.com (Capitan Proyecto 3) / dEm!pAsS5@demo"
        Write-Host "    - usuario6@demo.com (Participante Proyecto 3) / dEm!pAsS6@demo"
        Write-Host "    - usuario7@demo.com (Capitan Proyecto 4) / dEm!pAsS7@demo"
        Write-Host "    - usuario8@demo.com (Participante Proyecto 4) / dEm!pAsS8@demo"
        Write-Host "    - usuario9@demo.com (Capitan Proyecto 5) / dEm!pAsS9@demo"
        Write-Host "    - usuario10@demo.com (Participante Proyecto 5) / dEm!pAsS10@demo"
        Write-Host ""
        Write-Host "Superadmin global:"
        Write-Host "  - Acceso:     http://localhost:3100/superadmin"
        Write-Host "  - Email:      superadmin@create.dev"
        Write-Host "  - Password:   !CpUgGeV=50W"
        Write-Host ""
        Write-Host "Tenant UIC:"
        Write-Host "  - Frontend:   http://localhost:3100/uic"
        Write-Host "  - Admin:      admin@uic.es / UdS*r2ZD5?;O"
        Write-Host "  - Admin eval: mgraells@uic.es / Ll4=u2D$S0>s"
        Write-Host "  - Evaluadores:"
        Write-Host "    - agironza@uic.es / fJ(wvc7OrMOw99"
        Write-Host "    - marisam@uic.es / fJ(wvc7OrMOw5a"
        Write-Host "    - margemi@uic.es / fJ(wvc7OrMOw9r"
        Write-Host "    - fdyck@uic.es / fJ(wvc7OrMOw8f"
        Write-Host "    - nnogales@uic.es / fJ(wvc7OrMOw7o"
        Write-Host "  - Usuarios de prueba (5 proyectos):"
        Write-Host "    - usuario1@uic.es (Capitan Proyecto 1) / uIc!pAsS1@uic"
        Write-Host "    - usuario2@uic.es (Participante Proyecto 1) / uIc!pAsS2@uic"
        Write-Host "    - usuario3@uic.es (Capitan Proyecto 2) / uIc!pAsS3@uic"
        Write-Host "    - usuario4@uic.es (Participante Proyecto 2) / uIc!pAsS4@uic"
        Write-Host "    - usuario5@uic.es (Capitan Proyecto 3) / uIc!pAsS5@uic"
        Write-Host "    - usuario6@uic.es (Participante Proyecto 3) / uIc!pAsS6@uic"
        Write-Host "    - usuario7@uic.es (Capitan Proyecto 4) / uIc!pAsS7@uic"
        Write-Host "    - usuario8@uic.es (Participante Proyecto 4) / uIc!pAsS8@uic"
        Write-Host "    - usuario9@uic.es (Capitan Proyecto 5) / uIc!pAsS9@uic"
        Write-Host "    - usuario10@uic.es (Participante Proyecto 5) / uIc!pAsS10@uic"
        Write-Host ""
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
            $runningServices = Invoke-CliOutput "docker" @("compose", "ps", "--services", "--filter", "status=running")
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
            $envFilePath = Join-Path $scriptRoot ".env.dev"
            try {
                $envValues = Get-EnvFileValues -FilePath $envFilePath
            } catch {
                Write-Info "No se pudo leer .env.dev. Se omitira el backup de la base de datos. Detalle: $($_.Exception.Message)"
                $shouldDumpDatabase = $false
            }

            if ($shouldDumpDatabase) {
                $rootPassword = $envValues['MYSQL_ROOT_PASSWORD']
                if (-not $rootPassword) {
                    Write-Info "Falta MYSQL_ROOT_PASSWORD en .env.dev. Se omitira el backup de la base de datos."
                    $shouldDumpDatabase = $false
                }
            }

            if ($shouldDumpDatabase) {
                $dbName = $envValues['DB_NAME']
                if (-not $dbName) {
                    $dbName = $envValues['MYSQL_DATABASE']
                }

                if (-not $dbName) {
                    Write-Info "Falta DB_NAME o MYSQL_DATABASE en .env.dev. Se omitira el backup de la base de datos."
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
        "package-lock\.json$",
        "pnpm-lock\.yaml$",
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

function Install-Dependencies {
    param(
        [string]$WorkingDirectory,
        [string]$Command,
        [string[]]$Arguments = @()
    )

    Write-Info "Installing dependencies in $WorkingDirectory"
    Push-Location $WorkingDirectory
    try {
        Invoke-Cli $Command $Arguments
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

    $envFilePath = Join-Path $scriptRoot ".env.dev"
    $envValues = Get-EnvFileValues -FilePath $envFilePath

    Install-Dependencies -WorkingDirectory (Join-Path $scriptRoot "backend") -Command "npm" -Arguments @("install")

    Install-Dependencies -WorkingDirectory (Join-Path $scriptRoot "frontend") -Command "pnpm" -Arguments @("install")

    $backendLockFile = Join-Path $scriptRoot "backend/package-lock.json"
    $frontendLockFile = Join-Path $scriptRoot "frontend/pnpm-lock.yaml"

    if ($Fresh) {
        Write-Info "Fresh mode selected"
        Invoke-Cli "docker" @("compose", "down", "--volumes", "--remove-orphans")
        Remove-ProjectDockerResources -ProjectName $projectName
        Update-DockerDependencies -ServiceName "backend" -VolumeName "backend_node_modules" -LockFilePath $backendLockFile -HashFileName "backend-deps.hash" -InstallCommandArgs @("compose", "run", "--rm", "backend", "npm", "ci")
        Update-DockerDependencies -ServiceName "frontend" -VolumeName "frontend_node_modules" -LockFilePath $frontendLockFile -HashFileName "frontend-deps.hash" -InstallCommandArgs @("compose", "run", "--rm", "frontend", "pnpm", "install", "--frozen-lockfile")
        Invoke-Cli "docker" @("compose", "up", "--build", "-d")
        Initialize-Database -EnvValues $envValues
        Invoke-Migrations
        Invoke-SeedersIfPending -Force
        Invoke-Cli "docker" @("compose", "ps")
        Write-Info "Fresh setup completed"
        Write-EnvironmentSummary
        exit 0
    }

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

    Update-DockerDependencies -ServiceName "backend" -VolumeName "backend_node_modules" -LockFilePath $backendLockFile -HashFileName "backend-deps.hash" -InstallCommandArgs @("compose", "run", "--rm", "backend", "npm", "ci")
    Update-DockerDependencies -ServiceName "frontend" -VolumeName "frontend_node_modules" -LockFilePath $frontendLockFile -HashFileName "frontend-deps.hash" -InstallCommandArgs @("compose", "run", "--rm", "frontend", "pnpm", "install", "--frozen-lockfile")

    if (Test-RebuildRequired -Paths $allChanges) {
        Write-Info "Changes require rebuild"
        Invoke-Cli "docker" @("compose", "up", "--build", "-d")
    } else {
        Write-Info "No rebuild required, starting containers"
        Invoke-Cli "docker" @("compose", "up", "-d")
    }

    Initialize-Database -EnvValues $envValues
    Invoke-Migrations
    Invoke-SeedersIfPending

    Invoke-Cli "docker" @("compose", "ps")
    Write-Info "Setup completed"
    Write-EnvironmentSummary
} catch {
    Write-Error $_
    exit 1
}

