Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Starting AegisCode Frontend (Next.js) on port 3000..." -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$conns = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    if ($c.OwningProcess -gt 0) {
        Write-Host "Freeing occupied port 3000 (PID $($c.OwningProcess))..." -ForegroundColor Yellow
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Milliseconds 500

$webDir = Join-Path $PSScriptRoot "apps\web"

# Install dependencies if node_modules is missing
if (-not (Test-Path (Join-Path $webDir "node_modules"))) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location $webDir
    npm install
    Pop-Location
}

Push-Location $webDir
npm run dev
Pop-Location
