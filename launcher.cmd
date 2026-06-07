@echo off
title Armed Academy Launcher
cd /d "%~dp0"
where powershell >nul 2>nul
if errorlevel 1 (
  echo PowerShell was not found on this system.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher.ps1" %*
set "exitCode=%errorlevel%"
if not "%exitCode%"=="0" if "%~1"=="" pause
exit /b %exitCode%
