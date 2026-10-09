@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ml-afiliados (Docker)
docker info >nul 2>nul
if errorlevel 1 (
  echo O Docker Desktop nao esta aberto. Abra o Docker Desktop, espere ele ficar pronto e rode de novo.
  pause
  exit /b 1
)
echo Construindo e ligando o bot ^(a primeira vez demora alguns minutos^)...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo [ERRO] O Docker nao conseguiu subir o bot. Copie as mensagens acima e mande para o Claude.
  pause
  exit /b 1
)
echo.
echo O bot esta rodando em segundo plano. Abaixo estao as mensagens dele
echo ^(na primeira vez aparece o QR code do WhatsApp para escanear^).
echo Fechar esta janela NAO desliga o bot. Para desligar: docker-parar.bat
echo.
docker compose logs -f --tail 80
