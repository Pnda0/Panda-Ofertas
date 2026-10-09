@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ml-afiliados - 1 instalar
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] O Node.js nao esta instalado neste computador.
  echo Baixe a versao LTS em https://nodejs.org/pt  ^(instalador .msi^), instale
  echo e depois de dois cliques neste arquivo de novo.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Node.js %%v encontrado.
echo.
echo Instalando dependencias ^(1 a 3 minutos^)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo [ERRO] O "npm install" falhou. Copie as mensagens acima e mande para o Claude.
  pause
  exit /b 1
)
if not exist ".env" copy ".env.example" ".env" >nul
echo.
echo Rodando os testes...
call npm test --silent
if errorlevel 1 (
  echo.
  echo [ERRO] Algum teste falhou. Copie as mensagens acima e mande para o Claude.
  pause
  exit /b 1
)
echo.
echo ==============================================================
echo   Tudo instalado. Agora de dois cliques em "2-configurar.bat"
echo ==============================================================
echo.
pause
