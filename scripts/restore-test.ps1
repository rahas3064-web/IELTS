#requires -Version 5.1
<#
.SYNOPSIS
  Restore the newest local dump into a Postgres database on this PC only.
.DESCRIPTION
  Target host is fixed at 127.0.0.1 and the database name is bandora_restore_test.
  The production URL is never read and never printed. -WhatIf does not connect.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$BackupDir = "C:\Users\mjh\BandoraBackups",
  [string]$EnvFile = "",
  [int]$Port = 5432,
  [string]$User = "postgres"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$TargetHost = "127.0.0.1"
$TargetDb = "bandora_restore_test"
$MaintenanceDb = "postgres"

if ($User -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
  [Console]::Error.WriteLine("The local database user name is not allowed.")
  exit 2
}
if ($Port -lt 1 -or $Port -gt 65535) {
  [Console]::Error.WriteLine("The local port is not allowed.")
  exit 2
}

$clientBin = "C:\Users\mjh\AppData\Local\pgsql17\bin"
if (Test-Path -LiteralPath $clientBin) {
  $env:Path = "$clientBin;$env:Path"
}

function Read-EnvValue {
  param([string]$Path, [string]$Name)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $value = $null
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    $trim = $line.Trim()
    if ($trim.Length -eq 0 -or $trim.StartsWith("#")) { continue }
    $eq = $trim.IndexOf("=")
    if ($eq -lt 1) { continue }
    $key = $trim.Substring(0, $eq).Trim()
    if ($key -ne $Name) { continue }
    $raw = $trim.Substring($eq + 1).Trim()
    if ($raw.Length -ge 2) {
      $quote = $raw[0]
      if (($quote -eq '"' -or $quote -eq "'") -and $raw.EndsWith([string]$quote)) {
        $raw = $raw.Substring(1, $raw.Length - 2)
      }
    }
    $value = $raw
  }
  return $value
}

$latest = $null
if (Test-Path -LiteralPath $BackupDir) {
  $latest = Get-ChildItem -LiteralPath $BackupDir -Filter "db-*.dump" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
$psql = Get-Command psql -ErrorAction SilentlyContinue

Write-Output ("dump-file: " + $(if ($latest) { $latest.FullName } else { "missing" }))
Write-Output "target-host: $TargetHost"
Write-Output "target-port: $Port"
Write-Output "target-db: $TargetDb"
Write-Output ("pg_restore: " + $(if ($pgRestore) { $pgRestore.Source } else { "not-found" }))
Write-Output ("psql: " + $(if ($psql) { $psql.Source } else { "not-found" }))

if ($WhatIfPreference) { exit 0 }

if (-not $latest) {
  [Console]::Error.WriteLine("No dump file was found in the backup folder.")
  exit 2
}
if (-not $pgRestore -or -not $psql) {
  [Console]::Error.WriteLine("pg_restore or psql was not found. Install PostgreSQL client tools.")
  exit 3
}

$localPassword = ""
if (-not [string]::IsNullOrWhiteSpace($EnvFile) -and (Test-Path -LiteralPath $EnvFile)) {
  $read = Read-EnvValue -Path $EnvFile -Name "LOCAL_PG_PASSWORD"
  if (-not [string]::IsNullOrWhiteSpace($read)) { $localPassword = $read }
}

$saved = @{}
foreach ($name in @("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGCONNECT_TIMEOUT", "PGSSLMODE")) {
  $saved[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}
[Environment]::SetEnvironmentVariable("PGHOST", $TargetHost, "Process")
[Environment]::SetEnvironmentVariable("PGPORT", "$Port", "Process")
[Environment]::SetEnvironmentVariable("PGUSER", $User, "Process")
[Environment]::SetEnvironmentVariable("PGPASSWORD", $localPassword, "Process")
[Environment]::SetEnvironmentVariable("PGDATABASE", $null, "Process")
[Environment]::SetEnvironmentVariable("PGCONNECT_TIMEOUT", "5", "Process")
[Environment]::SetEnvironmentVariable("PGSSLMODE", "disable", "Process")
$localPassword = $null

function Invoke-LocalSql {
  param([string]$Database, [string]$Sql, [switch]$AllowEmpty)
  & $psql.Source -v ON_ERROR_STOP=1 -d $Database -tAc $Sql
  if ($LASTEXITCODE -ne 0) { return $false }
  return $true
}

function Restore-ProcessEnv {
  foreach ($name in $saved.Keys) {
    [Environment]::SetEnvironmentVariable($name, $saved[$name], "Process")
  }
}

$ready = Invoke-LocalSql -Database $MaintenanceDb -Sql "select 1"
if (-not $ready) {
  Restore-ProcessEnv
  [Console]::Error.WriteLine("Local Postgres refused the connection on 127.0.0.1. The only restore target is bandora_restore_test on this machine.")
  exit 3
}

$cleared = Invoke-LocalSql -Database $MaintenanceDb -Sql "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'bandora_restore_test' and pid <> pg_backend_pid()"
if (-not $cleared) {
  Restore-ProcessEnv
  [Console]::Error.WriteLine("Could not disconnect existing sessions from the local test database.")
  exit 3
}
& $psql.Source -v ON_ERROR_STOP=1 -d $MaintenanceDb -c "drop database if exists bandora_restore_test"
if ($LASTEXITCODE -ne 0) { Restore-ProcessEnv; exit $LASTEXITCODE }
& $psql.Source -v ON_ERROR_STOP=1 -d $MaintenanceDb -c "create database bandora_restore_test"
if ($LASTEXITCODE -ne 0) { Restore-ProcessEnv; exit $LASTEXITCODE }

& $pgRestore.Source --no-owner --no-privileges --clean --if-exists --dbname=$TargetDb $latest.FullName
# pg_restore often exits 1 on harmless warnings. The counts below decide success.

$counts = @(
  @{ Label = "public.users"; Sql = "select count(*) from public.users" },
  @{ Label = "public.subscriptions"; Sql = "select count(*) from public.subscriptions" },
  @{ Label = "public.payment_attempts"; Sql = "select count(*) from public.payment_attempts" },
  @{ Label = "public.content_items"; Sql = "select count(*) from public.content_items" },
  @{ Label = "public.schema_migrations"; Sql = "select count(*) from public.schema_migrations" },
  @{ Label = "liara_archive.users"; Sql = "select count(*) from liara_archive.users" }
)
$failed = $false
foreach ($item in $counts) {
  $value = (& $psql.Source -v ON_ERROR_STOP=1 -d $TargetDb -tAc $item.Sql | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $value -notmatch '^\d+$') {
    Write-Output ("count " + $item.Label + "=unavailable")
    $failed = $true
  } else {
    Write-Output ("count " + $item.Label + "=" + $value)
  }
}

Restore-ProcessEnv
if ($failed) { exit 4 }
exit 0
