$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$apiBaseUrl = $env:API_BASE_URL
if (-not $apiBaseUrl) {
  $apiBaseUrl = "http://localhost:3000"
}
$apiBaseUrl = $apiBaseUrl.TrimEnd("/")

function Test-ApiAvailable {
  try {
    $null = Invoke-RestMethod -Uri "$apiBaseUrl/rooms" -Method Get -TimeoutSec 2
    return $true
  } catch {
    return $false
  }
}

if (Test-ApiAvailable) {
  & (Join-Path $PSScriptRoot "curl-smoke-test.ps1")
  exit $LASTEXITCODE
}

if ($env:API_BASE_URL) {
  throw "No se pudo conectar con API_BASE_URL '$apiBaseUrl'. Inicia esa API y vuelve a ejecutar npm run test:api."
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand -or -not (Test-Path (Join-Path $projectRoot "node_modules\tsx\package.json"))) {
  throw "No se encontró Node.js o tsx. Ejecuta npm ci antes de npm run test:api."
}

$originalJwtSecret = $env:JWT_SECRET
if (-not $env:JWT_SECRET) {
  $randomBytes = New-Object byte[] 32
  $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomGenerator.GetBytes($randomBytes)
  } finally {
    $randomGenerator.Dispose()
  }
  $env:JWT_SECRET = [Convert]::ToBase64String($randomBytes)
}

$stdoutPath = [System.IO.Path]::GetTempFileName()
$stderrPath = [System.IO.Path]::GetTempFileName()
$serverProcess = $null
try {
  $serverProcess = Start-Process `
    -FilePath $nodeCommand.Source `
    -ArgumentList @("--import", "tsx", "src/server.ts") `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru `
    -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(30)
  $apiReady = $false
  while ((Get-Date) -lt $deadline) {
    if ($serverProcess.HasExited) {
      break
    }
    if (Test-ApiAvailable) {
      $apiReady = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $apiReady) {
    $serverOutput = @()
    if (Test-Path -LiteralPath $stdoutPath) {
      $serverOutput += [System.IO.File]::ReadAllText($stdoutPath)
    }
    if (Test-Path -LiteralPath $stderrPath) {
      $serverOutput += [System.IO.File]::ReadAllText($stderrPath)
    }
    throw "La API local no inició en $apiBaseUrl dentro de 30 segundos. $($serverOutput -join [Environment]::NewLine)"
  }

  & (Join-Path $PSScriptRoot "curl-smoke-test.ps1")
  if ($LASTEXITCODE -ne 0) {
    throw "El smoke test cURL terminó con código $LASTEXITCODE."
  }
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
  if ($null -eq $originalJwtSecret) {
    Remove-Item Env:JWT_SECRET
  } else {
    $env:JWT_SECRET = $originalJwtSecret
  }
  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force
}
