@echo off
chcp 65001 >nul
title Sincronizador de Catracas Control iD - EDU IMPACTO
cd /d "%~dp0"

:loop
echo ==============================================================
echo  INICIANDO SINCRONIZADOR DE CATRACAS (EDU IMPACTO)
echo ==============================================================
echo.

python Sincronizar_Catraca.py --from-bat

echo.
echo [AUTO-RESTART] O processo foi encerrado. Reiniciando automaticamente em 3 segundos...
timeout /t 3 /nobreak >nul
goto loop
