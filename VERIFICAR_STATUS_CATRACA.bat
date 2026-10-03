@echo off
chcp 65001 >nul
title Status do Sincronizador de Catracas - EDU IMPACTO
cd /d "%~dp0"

echo ==============================================================
echo  CONSULTANDO STATUS DO SINCRONIZADOR DE CATRACAS...
echo ==============================================================
echo.

python Sincronizar_Catraca.py --status

echo.
echo ==============================================================
echo  OPÇÕES DISPONÍVEIS:
echo   [1] Iniciar Sincronizador agora (Janela Visível)
echo   [2] Iniciar Sincronizador em Segundo Plano
echo   [3] Parar Sincronizador (Encerrar Processos)
echo   [4] Instalar Inicialização Automática no Windows
echo   [ENTER] Sair
echo ==============================================================
set /p OPT="Escolha uma opção: "

if "%OPT%"=="1" (
    start "Catraca Sync" cmd /k python Sincronizar_Catraca.py
    echo Sincronizador aberto em nova janela!
    timeout /t 3 >nul
)
if "%OPT%"=="2" (
    start pythonw Sincronizar_Catraca.py --intervalo=2
    echo Sincronizador iniciado em segundo plano!
    pause
)
if "%OPT%"=="3" (
    taskkill /F /IM python.exe >nul 2>&1
    taskkill /F /IM pythonw.exe >nul 2>&1
    echo Processos do Python finalizados com sucesso!
    pause
)
if "%OPT%"=="4" (
    python Sincronizar_Catraca.py --install
    pause
)
