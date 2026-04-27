@echo off
setlocal
chcp 65001 >nul
title Desinstalador - Arbol de Decision

set "ADDIN_DIR=%USERPROFILE%\AppData\Roaming\Microsoft\AddIns"
set "MANIFEST=%ADDIN_DIR%\manifest.prod.xml"

echo.
echo ============================================================
echo   Arbol de Decision - Desinstalador
echo ============================================================
echo.

echo [1/2] Quitando registro de Excel...
reg delete "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "ArbolDecision" /f >nul 2>&1

echo [2/2] Eliminando archivo de configuracion...
if exist "%MANIFEST%" del "%MANIFEST%"

echo.
echo ============================================================
echo   LISTO - Complemento desinstalado
echo ============================================================
echo.
echo Cerra y volve a abrir Excel para que tome efecto.
echo.
pause
