@echo off
chcp 65001 >nul
title Sincronizador de Catracas Control iD - EDU IMPACTO
cd /d "%~dp0"

echo ==============================================================
echo  INICIANDO SINCRONIZADOR DE CATRACAS (EDU IMPACTO)
echo ==============================================================
echo.

python Sincronizar_Catraca.py

echo.
echo [AVISO] O processo foi finalizado.
pause
