@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ml-afiliados - rodando (feche esta janela para parar)
if not exist "node_modules" (
  echo Rode primeiro o "1-instalar.bat" e depois o "2-configurar.bat".
  pause
  exit /b 1
)
echo O bot fica rodando enquanto esta janela estiver aberta.
echo Para parar: feche a janela ou aperte Ctrl+C.
echo.
call npm start --silent
echo.
echo O bot parou. Veja a mensagem acima.
pause
