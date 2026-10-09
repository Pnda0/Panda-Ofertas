@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ml-afiliados - 2 configurar
if not exist "node_modules" (
  echo Rode primeiro o "1-instalar.bat".
  pause
  exit /b 1
)
call npm run configurar --silent
echo.
pause
