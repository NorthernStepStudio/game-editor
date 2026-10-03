param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "Northern Step Studio\Matterhorn\runtime\agent-validation")
)

$ErrorActionPreference = "Stop"
$Version = "0.9.21"
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { throw "npm is required to install Matterhorn Agent Validation." }

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

$packagePath = Join-Path $InstallRoot "package.json"
if (-not (Test-Path $packagePath)) {
@'
{
  "name": "matterhorn-agent-validation-runtime",
  "private": true,
  "type": "module"
}
'@ | Set-Content -Path $packagePath -Encoding UTF8
}

& $npm.Source install --prefix $InstallRoot "deepeval@$Version" --save-exact --omit=dev --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw "Could not install the pinned Matterhorn Agent Validation runtime." }

$runnerSource = Join-Path $PSScriptRoot "runtime\deepeval-runner.mjs"
$runnerTarget = Join-Path $InstallRoot "runner.mjs"
Copy-Item -Force $runnerSource $runnerTarget

$health = & node $runnerTarget --health
if ($LASTEXITCODE -ne 0) { throw "Matterhorn Agent Validation runtime health check failed." }
Write-Host $health
Write-Host "Matterhorn Agent Validation installed."
Write-Host "Set MATTERHORN_AGENT_EVAL_RUNNER=$runnerTarget"
