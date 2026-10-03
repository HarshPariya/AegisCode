$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "==================================================="
Write-Host "  Starting AegisCode Engine Backend on port 8000..."
Write-Host "==================================================="

# ── 1. Load .env into process environment ───────────────────
$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $idx   = $line.IndexOf("=")
            $key   = $line.Substring(0, $idx).Trim()
            $value = $line.Substring($idx + 1).Trim()
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "  [OK] Loaded environment from .env"
} else {
    Write-Warning "  .env file not found at $envFile"
}

# ── 2. Set PYTHONPATH to project root ───────────────────────
$env:PYTHONPATH = $Root
Write-Host "  [OK] PYTHONPATH = $Root"

# ── 3. Launch Uvicorn ────────────────────────────────────────
Set-Location $Root
Write-Host ""
python -m uvicorn services.api.main:app --reload --host 0.0.0.0 --port 8000
