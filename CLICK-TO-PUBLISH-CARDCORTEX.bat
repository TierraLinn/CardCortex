@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0PUBLISH-WITH-GITHUB-TOKEN.ps1"
pause
