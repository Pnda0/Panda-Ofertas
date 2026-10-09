@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ml-afiliados - trocar numero do WhatsApp
docker info >nul 2>nul
if errorlevel 1 (
  echo O Docker Desktop nao esta aberto. Abra o Docker Desktop, espere ele ficar pronto e rode de novo.
  pause
  exit /b 1
)
echo.
echo Isso DESCONECTA o WhatsApp atual do bot e pede um QR code novo.
echo Antes: coloque o numero novo no grupo "Ofertas" e deixe ele como administrador.
echo.
choice /c SN /m "Trocar o numero agora"
if errorlevel 2 exit /b 0
docker compose down
for /f %%v in ('docker volume ls -q --filter "name=wwebjs_auth"') do docker volume rm %%v
for /f %%v in ('docker volume ls -q --filter "name=wwebjs_cache"') do docker volume rm %%v
echo.
echo Ligando o bot de novo...
docker compose up -d --build
if errorlevel 1 (
  echo [ERRO] O Docker nao conseguiu subir o bot. Copie as mensagens acima e mande para o Claude.
  pause
  exit /b 1
)
echo.
echo Daqui a pouco aparece o QR code abaixo. No celular do CHIP NOVO:
echo WhatsApp ^> Configuracoes ^> Aparelhos conectados ^> Conectar aparelho, e escaneie.
echo Fechar esta janela NAO desliga o bot.
echo.
docker compose logs -f --tail 80
