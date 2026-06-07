@echo off
cd /d "%~dp0"
node server\src\ui-server.mjs --open
pause
