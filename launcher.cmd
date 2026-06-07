@echo off
title Armed Academy Launcher
cd /d "%~dp0"
where powershell >nul 2>nul
if errorlevel 1 (
  echo PowerShell was not found on this system.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher.ps1"
if errorlevel 1 pause
