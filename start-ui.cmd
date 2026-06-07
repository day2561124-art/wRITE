@echo off
title Armed Academy Workbench
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 18 or newer, then run this file again.
  pause
  exit /b 1
)
node server\src\ui-server.mjs --host 127.0.0.1 --port 4173 --open
pause
