$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "CardCortex GitHub publisher" -ForegroundColor Cyan
Write-Host "This publishes the prepared production app to TierraLinn/CardCortex on the main branch."
Write-Host "The token is used only inside this PowerShell window and is not written to a file."
Write-Host ""

if (-not (Test-Path -LiteralPath ".\package.json")) {
  Write-Host "Please run this from the CardCortex folder." -ForegroundColor Red
  exit 1
}

if (-not $env:GITHUB_TOKEN -and -not $env:GH_TOKEN) {
  $secureToken = Read-Host "Paste GitHub token with repo contents write access" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  try {
    $env:GITHUB_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

Write-Host ""
Write-Host "Checking app syntax and Supabase backend..." -ForegroundColor Cyan
npm run check:all
npm run supabase:admin-check

Write-Host ""
Write-Host "Checking GitHub token permissions..." -ForegroundColor Cyan
npm run github:check

Write-Host ""
Write-Host "Publishing to GitHub..." -ForegroundColor Cyan
npm run github:publish

Write-Host ""
Write-Host "Waiting for GitHub Pages to rebuild and become current..." -ForegroundColor Cyan
npm run wait:live

Write-Host ""
Write-Host "Done. CardCortex is published and the live GitHub Pages site is current." -ForegroundColor Green
