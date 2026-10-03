param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "Northern Step Studio\Matterhorn\runtime\local-browser"),
  [int]$Port = 9876
)

$ErrorActionPreference = "Stop"
$UpstreamRepo = "https://github.com/browser-use/browser-harness-js.git"
$UpstreamCommit = "2d9a5ed37ed11f31b2622cd69c4b55f979cb905f"

if ($Port -lt 1024 -or $Port -gt 65535) {
  throw "Choose a local browser bridge port between 1024 and 65535."
}

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  throw "Git is required to install the Matterhorn local browser runtime."
}
$bun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bun) {
  throw "Bun is required to run the Matterhorn local browser runtime. Install Bun, then run this script again."
}

$parent = Split-Path -Parent $InstallRoot
New-Item -ItemType Directory -Force -Path $parent | Out-Null

if (-not (Test-Path $InstallRoot)) {
  & $git.Source clone --no-checkout $UpstreamRepo $InstallRoot
  if ($LASTEXITCODE -ne 0) { throw "Could not clone the local browser runtime." }
} elseif (-not (Test-Path (Join-Path $InstallRoot ".git"))) {
  throw "Matterhorn local browser install path already exists but is not a Git checkout: $InstallRoot"
}

& $git.Source -C $InstallRoot fetch --depth 1 origin $UpstreamCommit
if ($LASTEXITCODE -ne 0) { throw "Could not fetch the pinned local browser runtime commit." }
& $git.Source -C $InstallRoot checkout --detach $UpstreamCommit
if ($LASTEXITCODE -ne 0) { throw "Could not checkout the pinned local browser runtime commit." }

$actual = (& $git.Source -C $InstallRoot rev-parse HEAD).Trim()
if ($actual -ne $UpstreamCommit) {
  throw "Pinned local browser runtime verification failed."
}

$runtimeDir = Join-Path $parent "state"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$stdout = Join-Path $runtimeDir "local-browser.log"
$stderr = Join-Path $runtimeDir "local-browser.error.log"
$healthUrl = "http://127.0.0.1:$Port/health"

try {
  $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 1
  if ($health.ok) {
    Write-Host "Matterhorn Local Browser is already running at http://127.0.0.1:$Port/"
    exit 0
  }
} catch {
  # Expected when the bridge has not started yet.
}

$env:CDP_REPL_PORT = "$Port"
$repl = Join-Path $InstallRoot "sdk\repl.ts"
$process = Start-Process -FilePath $bun.Source -ArgumentList @($repl) -WorkingDirectory $InstallRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru

$deadline = (Get-Date).AddSeconds(10)
do {
  Start-Sleep -Milliseconds 200
  if ($process.HasExited) {
    throw "Matterhorn Local Browser exited during startup. See $stderr"
  }
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 1
    if ($health.ok) {
      Write-Host "Matterhorn Local Browser ready at http://127.0.0.1:$Port/"
      Write-Host "Pinned engine commit: $UpstreamCommit"
      Write-Host "Set MATTERHORN_BROWSER_BRIDGE_URL=$("http://127.0.0.1:$Port/") only if you changed the default."
      exit 0
    }
  } catch {
    # Keep waiting until the bounded startup deadline.
  }
} while ((Get-Date) -lt $deadline)

throw "Matterhorn Local Browser did not become healthy. See $stderr"
