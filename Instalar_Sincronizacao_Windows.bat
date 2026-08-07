@echo off
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

REM 2. Configurar caminhos e arquivos
set "SCRIPT_DIR=%~dp0"
set "VBS_FILE=%SCRIPT_DIR%Rodar_Catraca_Background.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_VBS=%STARTUP_FOLDER%\Sincronizacao_Catraca.vbs"

REM 3. Gerar o VBScript para rodar em segundo plano
echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_FILE%"
echo Set fso = CreateObject("Scripting.FileSystemObject") >> "%VBS_FILE%"
echo scriptDir = fso.GetParentFolderName(WScript.ScriptFullName) >> "%VBS_FILE%"
echo WshShell.CurrentDirectory = scriptDir >> "%VBS_FILE%"
echo WshShell.Run "python Sincronizar_Catraca.py --loop 30", 0, False >> "%VBS_FILE%"

REM 4. Copiar para a pasta de Inicializacao do Windows (Startup)
copy /y "%VBS_FILE%" "%SHORTCUT_VBS%" >nul

if %errorlevel% equ 0 (
    echo [SUCESSO] Instalacao concluida com sucesso!
    echo.
    echo A sincronizacao rodara AUTOMATICAMENTE toda vez que o Windows for iniciado.
    echo.
    echo Iniciando a sincronizacao em segundo plano agora mesmo...
    wscript "%VBS_FILE%"
    echo Sincronizacao em segundo plano iniciada com sucesso!
) else (
    echo [ERRO] Ocorreu um erro ao copiar para a pasta de Inicializacao do Windows.
)

echo.
echo =====================================================
echo Para desinstalar no futuro, apague o arquivo:
echo %SHORTCUT_VBS%
echo =====================================================
echo.
pause
