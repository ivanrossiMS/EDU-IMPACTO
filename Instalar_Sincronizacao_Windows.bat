@echo off
chcp 65001 >nul
title Instalador Sincronizacao Catraca - EDU IMPACTO

echo =====================================================
echo  Instalador Sincronizacao Automatica - EDU IMPACTO
echo =====================================================
echo.

REM 1. Verificar se o Python esta instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Python nao foi encontrado no sistema!
    echo.
    echo Baixe e instale o Python em: https://www.python.org/downloads/
    echo ATENCAO: Na instalacao do Python, marque a opcao "Add python.exe to PATH"!
    echo.
    pause
    exit /b 1
)

REM 2. Executar instalador do script Python
python "%~dp0Sincronizar_Catraca.py" --install

echo.
pause

