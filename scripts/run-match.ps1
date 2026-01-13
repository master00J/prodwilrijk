# PowerShell script to run the matching script
Set-Location $PSScriptRoot\..
npx tsx scripts/match-stock-erp-link.js
Read-Host "Press Enter to continue"


