# run-packed-import.ps1
# Voer het import-packed-consumption.js script uit met de ingebouwde Node.js van Cursor.
#
# Gebruik: powershell -ExecutionPolicy Bypass -File scripts\run-packed-import.ps1

$NodeExe = "C:\Users\j.ploegaerts\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
$Script  = Join-Path $PSScriptRoot "import-packed-consumption.js"
$Project = Split-Path $PSScriptRoot -Parent

if (-not (Test-Path $NodeExe)) {
    Write-Error "Node.exe niet gevonden op: $NodeExe`nPas het pad aan in dit script."
    exit 1
}

if (-not (Test-Path (Join-Path $Project ".env.local"))) {
    Write-Host ""
    Write-Host "⚠️  .env.local niet gevonden!" -ForegroundColor Yellow
    Write-Host "Maak het bestand '$Project\.env.local' aan met de volgende inhoud:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  NEXT_PUBLIC_SUPABASE_URL=https://jouw-project.supabase.co" -ForegroundColor Cyan
    Write-Host "  SUPABASE_SERVICE_ROLE_KEY=eyJ..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Je vindt deze waarden in je Supabase dashboard onder Project Settings > API." -ForegroundColor Gray
    exit 1
}

Set-Location $Project
Write-Host "🚀 Import starten..." -ForegroundColor Cyan
& $NodeExe $Script
