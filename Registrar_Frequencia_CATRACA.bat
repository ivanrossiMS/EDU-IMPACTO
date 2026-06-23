@echo off
chcp 65001 >nul
title Sistema de Frequência — EDU IMPACTO

:: ============================================================
::  CONFIGURAÇÕES — edite apenas estas duas linhas
:: ============================================================
set URL=https://resilient-cuchufli-2b4125.netlify.app
set TOKEN=1081
:: ============================================================

:MENU
cls
echo.
echo  =====================================================
echo    SISTEMA DE FREQUENCIA — EDU IMPACTO
echo  =====================================================
echo.

:: Data padrão = hoje no formato YYYY-MM-DD
for /f "tokens=1-3 delims=/" %%a in ("%date%") do (
    set DIA=%%a
    set MES=%%b
    set ANO=%%c
)
:: Formato do Windows pode variar — garante YYYY-MM-DD
set DATA_HOJE=%ANO%-%MES%-%DIA%

echo  Data de hoje: %DIA%/%MES%/%ANO%
echo.
echo  [ENTER] = usar data de hoje
echo  Ou digite outra data no formato YYYY-MM-DD:
set /p DATA_INPUT="  Data: "

if "%DATA_INPUT%"=="" (
    set DATA=%DATA_HOJE%
) else (
    set DATA=%DATA_INPUT%
)

echo.
echo  Consultando registros para %DATA%...
echo.

:: Chama o GET para ver a situação do dia
curl -s -X GET "%URL%/api/academico/totem-frequencia?data=%DATA%" ^
     -H "Authorization: Bearer %TOKEN%" ^
     -H "Content-Type: application/json" ^
     -o temp_resposta.json 2>nul

if %errorlevel% neq 0 (
    echo  [ERRO] Nao foi possivel conectar ao servidor.
    echo         Verifique sua conexao com a internet.
    goto FIM
)

:: Lê os campos do JSON com findstr
for /f "tokens=2 delims=:," %%a in ('findstr /i "total_ativos" temp_resposta.json') do set TOTAL=%%a
for /f "tokens=2 delims=:," %%a in ('findstr /i "com_registro" temp_resposta.json') do set COM_REG=%%a
for /f "tokens=2 delims=:," %%a in ('findstr /i "sem_registro" temp_resposta.json') do set SEM_REG=%%a

:: Remove espaços
set TOTAL=%TOTAL: =%
set COM_REG=%COM_REG: =%
set SEM_REG=%SEM_REG: =%

:: Verifica se houve erro na resposta
findstr /i "error" temp_resposta.json >nul 2>&1
if %errorlevel% equ 0 (
    echo  [ERRO] O servidor retornou um erro:
    type temp_resposta.json
    goto FIM
)

echo  =====================================================
echo   Situacao do dia %DATA%:
echo.
echo   Total de alunos ativos:    %TOTAL%
echo   Com registro (P ou F):     %COM_REG%
echo   Sem registro (pendentes):  %SEM_REG%
echo  =====================================================
echo.

if "%SEM_REG%"=="0" (
    echo  Todos os alunos ja tem registro para este dia.
    echo  Nenhuma acao necessaria.
    goto FIM
)

echo  %SEM_REG% aluno(s) ainda nao tem registro.
echo  Eles serao marcados como FALTA.
echo.
echo  ATENCAO: Isso nao sobrescreve registros existentes.
echo  Alunos ja registrados (presente ou falta) nao serao alterados.
echo.
set /p CONFIRMA="  Confirmar registro de faltas? (S/N): "

if /i "%CONFIRMA%"=="S" goto REGISTRAR
if /i "%CONFIRMA%"=="s" goto REGISTRAR

echo.
echo  Operacao cancelada pelo usuario.
goto FIM

:REGISTRAR
echo.
echo  Registrando faltas...
echo.

curl -s -X POST "%URL%/api/academico/totem-frequencia" ^
     -H "Authorization: Bearer %TOKEN%" ^
     -H "Content-Type: application/json" ^
     -d "{\"data\":\"%DATA%\"}" ^
     -o temp_resultado.json 2>nul

if %errorlevel% neq 0 (
    echo  [ERRO] Falha ao enviar dados. Verifique sua conexao.
    goto FIM
)

:: Verifica se houve erro
findstr /i "\"ok\":true" temp_resultado.json >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=2 delims=:," %%a in ('findstr /i "registrados" temp_resultado.json') do set REG=%%a
    set REG=%REG: =%
    echo  =====================================================
    echo.
    echo   OK! %REG% falta(s) registrada(s) com sucesso!
    echo.
    echo   As notificacoes serao enviadas aos responsaveis.
    echo   Os registros ja aparecem no sistema em:
    echo   Academico ^> Frequencia
    echo.
    echo  =====================================================
) else (
    echo  [ERRO] Falha ao registrar:
    type temp_resultado.json
)

:FIM
:: Limpa arquivos temporários
if exist temp_resposta.json del temp_resposta.json >nul 2>&1
if exist temp_resultado.json del temp_resultado.json >nul 2>&1

echo.
echo.
set /p VOLTAR="  Pressione ENTER para consultar outro dia ou feche a janela..."
goto MENU
