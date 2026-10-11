<#
  Starts the full Matterhorn stack on this PC:
    1. Flyrail daemon (live Godot runtime) unless it is already running
    2. Matterhorn server (built first if needed), then opens the browser

  Configuration comes from the repository .env (never printed):
    FLYRAIL_REPO_ROOT   Flyrail checkout (required for Godot execution)
    FLYRAIL_CODE_AGENT  "claude" or "codex" (default codex)
    FLYRAIL_GODOT_BIN   optional; defaults to the Godot binary Flyrail installed
    PORT                optional Matterhorn port (default 3001)

  Usage:  npm run studio            (or)  powershell -File tools/start-matterhorn.ps1 [-NoBrowser]
#>
param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Read-DotEnv([string]$path) {
  $values = @{}
  if (-not (Test-Path $path)) { return $values }
  foreach ($line in Get-Content -LiteralPath $path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $eq = $trimmed.IndexOf('=')
    if ($eq -le 0) { continue }
    $key = $trimmed.Substring(0, $eq).Trim()
    $value = $trimmed.Substring($eq + 1).Trim().Trim('"').Trim("'")
    if ($value) { $values[$key] = $value }
  }
  return $values
}

function Test-Http([string]$url) {
  try { Invoke-RestMethod -Uri $url -TimeoutSec 3 | Out-Null; return $true } catch { return $false }
}

$envFile = Read-DotEnv (Join-Path $repo '.env')
$logs = Join-Path $repo '.matterhorn\logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null

# --- Ollama (local AI) ---------------------------------------------------
if (-not (Test-Http 'http://127.0.0.1:11434/api/version')) {
  $ollama = Get-Command ollama -ErrorAction SilentlyContinue
  if ($ollama) {
    Write-Host 'Starting Ollama...'
    Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden
  } else {
    Write-Host 'Ollama is not running and was not found; local AI features will be unavailable.' -ForegroundColor Yellow
  }
}

# --- Flyrail daemon ------------------------------------------------------
$flyrailRoot = $envFile['FLYRAIL_REPO_ROOT']
if (Test-Http 'http://127.0.0.1:7520/health') {
  Write-Host 'Flyrail daemon already running.'
} elseif (-not $flyrailRoot -or -not (Test-Path (Join-Path $flyrailRoot 'packages\daemon\dist\main.js'))) {
  Write-Host 'Flyrail is not configured (set FLYRAIL_REPO_ROOT in .env and build Flyrail); Godot execution will show as offline.' -ForegroundColor Yellow
} else {
  $godot = $envFile['FLYRAIL_GODOT_BIN']
  if (-not $godot) {
    $godot = Get-ChildItem -Path (Join-Path $flyrailRoot 'tools\godot\bin') -Filter 'Godot_v*_win64.exe' -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -notlike '*console*' } | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
  }
  $env:FLYRAIL_DAEMON_META = Join-Path $flyrailRoot '.flyrail-daemon.json'
  $env:FLYRAIL_LIVE_GODOT = '1'
  if ($godot) { $env:FLYRAIL_GODOT_BIN = $godot }
  if ($envFile['FLYRAIL_CODE_AGENT']) { $env:FLYRAIL_CODE_AGENT = $envFile['FLYRAIL_CODE_AGENT'] }
  Write-Host "Starting Flyrail daemon (live Godot, code agent: $(if ($env:FLYRAIL_CODE_AGENT) { $env:FLYRAIL_CODE_AGENT } else { 'codex' }))..."
  Start-Process -FilePath (Get-Command node).Source `
    -ArgumentList @('packages/daemon/dist/main.js', '--live') `
    -WorkingDirectory $flyrailRoot -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'flyrail-daemon.log') `
    -RedirectStandardError (Join-Path $logs 'flyrail-daemon.err.log')
  for ($i = 0; $i -lt 30 -and -not (Test-Http 'http://127.0.0.1:7520/health'); $i++) { Start-Sleep -Milliseconds 500 }
  if (Test-Http 'http://127.0.0.1:7520/health') { Write-Host 'Flyrail daemon ready.' }
  else { Write-Host "Flyrail daemon did not answer; see $logs\flyrail-daemon.err.log" -ForegroundColor Yellow }
}

# --- Matterhorn ------------------------------------------------------------
if (-not (Test-Path (Join-Path $repo 'server\out\index.js'))) {
  Write-Host 'Building Matterhorn...'
  npm run compile
  if ($LASTEXITCODE -ne 0) { throw 'Matterhorn build failed.' }
}

$port = if ($envFile['PORT']) { $envFile['PORT'] } else { '3001' }
if (-not $NoBrowser) {
  Start-Job -ScriptBlock {
    param($url)
    for ($i = 0; $i -lt 40; $i++) {
      try { Invoke-RestMethod -Uri "$url/health" -TimeoutSec 2 | Out-Null; Start-Process $url; return } catch { Start-Sleep -Milliseconds 500 }
    }
  } -ArgumentList "http://127.0.0.1:$port" | Out-Null
}

Write-Host "Starting Matterhorn on http://127.0.0.1:$port (Ctrl+C to stop)..."
node server/out/index.js
