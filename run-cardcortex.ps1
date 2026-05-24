$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here
Write-Host "Starting CardCortex at http://localhost:4192"
node ".\static-server.cjs"
