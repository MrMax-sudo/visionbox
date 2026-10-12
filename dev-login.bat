@echo off
REM ==========================================================================
REM  VisionBox - Servidor de desenvolvimento do frontend (tempo real / HMR)
REM
REM  Uso:   dev-login.bat          -> API da VPS (login funciona de verdade)
REM         dev-login.bat local    -> API local em http://localhost:8080
REM
REM  Abre http://localhost:5173/login automaticamente.
REM  Salvou o arquivo = tela atualiza sozinha. Ctrl+C para parar (libera 5173).
REM ==========================================================================
chcp 65001 >nul
title VisionBox - dev (localhost:5173)
cd /d "%~dp0apps\web"

if /i "%~1"=="local" (
  set "API_PROXY_TARGET=http://localhost:8080"
) else (
  set "API_PROXY_TARGET=http://169.148.137.35:8080"
)

if not exist node_modules (
  echo [VisionBox] Instalando dependencias...
  call npm install || goto :erro
)

echo.
echo [VisionBox] Tela de login: http://localhost:5173/login
echo [VisionBox] API (proxy /api): %API_PROXY_TARGET%
echo [VisionBox] Ctrl+C para encerrar.
echo.

call npm run dev -- --open /login --strictPort
goto :fim

:erro
echo.
echo [VisionBox] Falhou. Veja a mensagem acima.
pause

:fim
