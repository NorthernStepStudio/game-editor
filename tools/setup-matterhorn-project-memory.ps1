param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "Northern Step Studio\Matterhorn\runtime\project-memory"),
  [string]$LlmBaseUrl = "http://127.0.0.1:1234/v1",
  [Parameter(Mandatory=$true)][string]$LlmModel,
  [string]$EmbeddingBaseUrl = "http://127.0.0.1:1234/v1",
  [Parameter(Mandatory=$true)][string]$EmbeddingModel,
  [int]$EmbeddingDim = 1024,
  [int]$Port = 8000,
  [string]$PythonCommand = "python"
)

$ErrorActionPreference = "Stop"
if ($Port -lt 1024 -or $Port -gt 65535) { throw "Choose a Project Memory port between 1024 and 65535." }
if ($EmbeddingDim -lt 64 -or $EmbeddingDim -gt 8192) { throw "EmbeddingDim must be between 64 and 8192." }

$python = Get-Command $PythonCommand -ErrorAction SilentlyContinue
if (-not $python) { throw "Python 3.12+ is required for embedded Matterhorn Project Memory." }

$versionOutput = & $python.Source -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
$parts = $versionOutput.Trim().Split('.')
if ([int]$parts[0] -lt 3 -or ([int]$parts[0] -eq 3 -and [int]$parts[1] -lt 12)) {
  throw "Matterhorn Project Memory requires Python 3.12+ for embedded FalkorDB Lite."
}

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
$venv = Join-Path $InstallRoot ".venv"
if (-not (Test-Path $venv)) {
  & $python.Source -m venv $venv
  if ($LASTEXITCODE -ne 0) { throw "Could not create the Project Memory virtual environment." }
}

$venvPython = Join-Path $venv "Scripts\python.exe"
$venvPip = Join-Path $venv "Scripts\pip.exe"
$packages = @(
  "graphiti-core[falkordblite,sentence-transformers]==0.30.2",
  "fastapi>=0.115,<1",
  "uvicorn[standard]>=0.34,<1"
)
& $venvPip install --disable-pip-version-check --no-input @packages
if ($LASTEXITCODE -ne 0) { throw "Could not install the pinned Project Memory runtime." }

$serviceSource = Join-Path $PSScriptRoot "runtime\matterhorn-project-memory.py"
$serviceTarget = Join-Path $InstallRoot "matterhorn-project-memory.py"
Copy-Item -Force $serviceSource $serviceTarget

$stateDir = Join-Path $InstallRoot "state"
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$dbPath = Join-Path $stateDir "project-memory.db"
$stdout = Join-Path $stateDir "project-memory.log"
$stderr = Join-Path $stateDir "project-memory.error.log"

$env:MATTERHORN_MEMORY_LLM_BASE_URL = $LlmBaseUrl
$env:MATTERHORN_MEMORY_LLM_MODEL = $LlmModel
$env:MATTERHORN_MEMORY_EMBEDDING_BASE_URL = $EmbeddingBaseUrl
$env:MATTERHORN_MEMORY_EMBEDDING_MODEL = $EmbeddingModel
$env:MATTERHORN_MEMORY_EMBEDDING_DIM = "$EmbeddingDim"
$env:MATTERHORN_MEMORY_DB_PATH = $dbPath
$env:GRAPHITI_TELEMETRY_ENABLED = "false"

$healthUrl = "http://127.0.0.1:$Port/healthcheck"
try {
  $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 1
  if ($health.status -eq "healthy") {
    Write-Host "Matterhorn Project Memory is already running at http://127.0.0.1:$Port/"
    exit 0
  }
} catch {}

$process = Start-Process -FilePath $venvPython -ArgumentList @(
  "-m", "uvicorn",
  "matterhorn-project-memory:app",
  "--app-dir", $InstallRoot,
  "--host", "127.0.0.1",
  "--port", "$Port",
  "--no-access-log"
) -WorkingDirectory $InstallRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru

$deadline = (Get-Date).AddMinutes(3)
do {
  Start-Sleep -Milliseconds 500
  if ($process.HasExited) {
    throw "Matterhorn Project Memory exited during startup. See $stderr"
  }
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
    if ($health.status -eq "healthy") {
      Write-Host "Matterhorn Project Memory ready at http://127.0.0.1:$Port/"
      Write-Host "Graph engine: Graphiti 0.30.2 + embedded FalkorDB Lite"
      Write-Host "Set MATTERHORN_PROJECT_MEMORY_URL=http://127.0.0.1:$Port/"
      exit 0
    }
  } catch {}
} while ((Get-Date) -lt $deadline)

throw "Matterhorn Project Memory did not become healthy. The first BGE reranker download can be large; inspect $stderr and retry once prerequisites are available."
