#requires -Version 5.1
<#
.SYNOPSIS
  Custom-format dump of schemas public and liara_archive.
.DESCRIPTION
  Reads DATABASE_URL from the local .env (or -EnvFile). The URL is never a
  script argument and is never written to the console or backup.log.
  -WhatIf prints paths only and does not connect.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$EnvFile = "",
  [string]$BackupDir = "C:\Users\mjh\BandoraBackups"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile = Join-Path $repoRoot ".env"
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

function Get-SslMode {
  param([string]$Query)
  if ([string]::IsNullOrEmpty($Query)) { return "require" }
  foreach ($part in $Query.TrimStart("?").Split("&")) {
    $kv = $part.Split("=")
    if ($kv.Length -eq 2 -and $kv[0] -eq "sslmode") {
      switch ($kv[1]) {
        "disable" { return "disable" }
        "allow" { return "allow" }
        "prefer" { return "prefer" }
        "verify-ca" { return "verify-ca" }
        "verify-full" { return "verify-full" }
        default { return "require" }
      }
    }
  }
  return "require"
}

function ConvertTo-PgTarget {
  param([string]$Url)
  if ([string]::IsNullOrWhiteSpace($Url)) { return $null }
  $uri = $null
  $ok = [System.Uri]::TryCreate($Url, [System.UriKind]::Absolute, [ref]$uri)
  if (-not $ok) { return $null }
  if ($uri.Scheme -ne "postgres" -and $uri.Scheme -ne "postgresql") { return $null }
  $info = $uri.UserInfo
  $colon = $info.IndexOf(":")
  if ($colon -lt 1) { return $null }
  $dbName = $uri.AbsolutePath.TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "postgres" }
  $port = $uri.Port
  if ($port -lt 1) { $port = 5432 }
  return @{
    User = [System.Uri]::UnescapeDataString($info.Substring(0, $colon))
    Password = [System.Uri]::UnescapeDataString($info.Substring($colon + 1))
    HostName = $uri.Host
    Port = "$port"
    Database = $dbName
    SslMode = (Get-SslMode $uri.Query)
  }
}

function Get-DumpFiles {
  param([string]$Dir)
  if (-not (Test-Path -LiteralPath $Dir)) { return @() }
  return @(Get-ChildItem -LiteralPath $Dir -Filter "db-*.dump" -File | Sort-Object LastWriteTime -Descending)
}

function Write-BackupLog {
  param([string]$Status, [string]$FileName, [long]$Bytes)
  $line = "{0} {1} file={2} bytes={3}" -f (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"), $Status, $FileName, $Bytes
  Add-Content -LiteralPath (Join-Path $BackupDir "backup.log") -Value $line -Encoding ascii
}

$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$dumpName = "db-$stamp.dump"
$dumpPath = Join-Path $BackupDir $dumpName
$pg = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgVersion = "not-found"
$pgPath = "not-found"
if ($pg) {
  $pgPath = $pg.Source
  $pgVersion = ((& $pg.Source --version) | Out-String).Trim()
}

$urlState = "missing"
$target = $null
if (Test-Path -LiteralPath $EnvFile) {
  $rawUrl = Read-EnvValue -Path $EnvFile -Name "DATABASE_URL"
  if (-not [string]::IsNullOrWhiteSpace($rawUrl)) {
    $target = ConvertTo-PgTarget $rawUrl
    if ($target) { $urlState = "present" } else { $urlState = "not-postgres" }
  }
}
$rawUrl = $null

$existing = Get-DumpFiles $BackupDir
$wouldDelete = @()
if ($existing.Count -gt 7) {
  $wouldDelete = @($existing | Select-Object -Skip 7)
}

Write-Output "backup-dir: $BackupDir"
Write-Output "dump-file: $dumpPath"
Write-Output "schemas: public, liara_archive"
Write-Output "retention: 8"
Write-Output "database-url: $urlState"
Write-Output "pg_dump: $pgPath"
Write-Output "pg_dump-version: $pgVersion"
if ($wouldDelete.Count -eq 0) {
  Write-Output "would-delete: none"
} else {
  foreach ($item in $wouldDelete) {
    Write-Output "would-delete: $($item.FullName)"
  }
}

if ($WhatIfPreference) { exit 0 }

if (-not (Test-Path -LiteralPath $EnvFile) -or $urlState -ne "present") {
  [Console]::Error.WriteLine("DATABASE_URL must be a postgres URL in the env file. pg_dump cannot use a local PGlite directory.")
  exit 4
}
if (-not $pg) {
  [Console]::Error.WriteLine("pg_dump was not found on PATH. Install PostgreSQL client tools.")
  exit 3
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$names = @("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE", "PGCONNECT_TIMEOUT")
$previous = @{}
foreach ($name in $names) {
  $previous[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}
[Environment]::SetEnvironmentVariable("PGHOST", $target.HostName, "Process")
[Environment]::SetEnvironmentVariable("PGPORT", $target.Port, "Process")
[Environment]::SetEnvironmentVariable("PGUSER", $target.User, "Process")
[Environment]::SetEnvironmentVariable("PGPASSWORD", $target.Password, "Process")
[Environment]::SetEnvironmentVariable("PGDATABASE", $target.Database, "Process")
[Environment]::SetEnvironmentVariable("PGSSLMODE", $target.SslMode, "Process")
[Environment]::SetEnvironmentVariable("PGCONNECT_TIMEOUT", "15", "Process")

$code = 1
try {
  & $pg.Source --format=custom --no-owner --no-privileges --schema=public --schema=liara_archive --file=$dumpPath
  if ($null -eq $LASTEXITCODE) { $code = 1 } else { $code = $LASTEXITCODE }
} finally {
  foreach ($name in $names) {
    [Environment]::SetEnvironmentVariable($name, $previous[$name], "Process")
  }
  $target = $null
}

if ($code -ne 0) {
  if (Test-Path -LiteralPath $dumpPath) { Remove-Item -LiteralPath $dumpPath -Force }
  Write-BackupLog -Status "fail" -FileName $dumpName -Bytes 0
  exit $code
}

$bytes = [long](Get-Item -LiteralPath $dumpPath).Length
$all = Get-DumpFiles $BackupDir
if ($all.Count -gt 8) {
  foreach ($item in @($all | Select-Object -Skip 8)) {
    Remove-Item -LiteralPath $item.FullName -Force
  }
}
Write-BackupLog -Status "ok" -FileName $dumpName -Bytes $bytes
Write-Output "backup-ok: $dumpName bytes=$bytes"
exit 0
