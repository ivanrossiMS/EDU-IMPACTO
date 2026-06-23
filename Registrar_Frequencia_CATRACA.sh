#!/bin/bash

# ============================================================
#  CONFIGURAÇÕES — edite apenas estas duas linhas
# ============================================================
URL="https://SEU-SITE.netlify.app"
TOKEN="1081"
# ============================================================

mostrar_menu() {
  clear
  echo ""
  echo "  ====================================================="
  echo "    SISTEMA DE FREQUÊNCIA — EDU IMPACTO"
  echo "  ====================================================="
  echo ""
  DATA_HOJE=$(date +%Y-%m-%d)
  DIA_FORMATADO=$(date +%d/%m/%Y)
  echo "  Data de hoje: $DIA_FORMATADO"
  echo ""
  echo "  [ENTER] = usar data de hoje"
  echo "  Ou digite outra data no formato YYYY-MM-DD:"
  printf "  Data: "
  read DATA_INPUT
  if [ -z "$DATA_INPUT" ]; then
    DATA="$DATA_HOJE"
  else
    DATA="$DATA_INPUT"
  fi

  echo ""
  echo "  O que deseja fazer?"
  echo "  [1] Ver situação do dia"
  echo "  [2] Registrar FALTAS para quem não tem registro"
  echo "  [3] DESFAZER faltas criadas pelo totem neste dia"
  echo "  [4] Sair"
  echo ""
  printf "  Opção: "
  read OPCAO

  case "$OPCAO" in
    1) consultar_dia ;;
    2) registrar_faltas ;;
    3) desfazer_faltas ;;
    4) exit 0 ;;
    *) mostrar_menu ;;
  esac
}

consultar_dia() {
  echo ""
  echo "  Consultando registros para $DATA..."
  RESPOSTA=$(curl -s -X GET "$URL/api/academico/totem-frequencia?data=$DATA" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

  if [ $? -ne 0 ] || [ -z "$RESPOSTA" ]; then
    echo "  [ERRO] Não foi possível conectar ao servidor."
    printf "\n  Pressione ENTER para voltar..."; read; mostrar_menu; return
  fi

  if echo "$RESPOSTA" | grep -q '"error"'; then
    echo "  [ERRO] $RESPOSTA"
    printf "\n  Pressione ENTER para voltar..."; read; mostrar_menu; return
  fi

  TOTAL=$(echo "$RESPOSTA" | grep -o '"total_ativos":[0-9]*' | grep -o '[0-9]*')
  COM_REG=$(echo "$RESPOSTA" | grep -o '"com_registro":[0-9]*' | grep -o '[0-9]*')
  SEM_REG=$(echo "$RESPOSTA" | grep -o '"sem_registro":[0-9]*' | grep -o '[0-9]*')

  echo ""
  echo "  ====================================================="
  echo "   📋 Situação do dia $DATA:"
  echo ""
  echo "   Total de alunos ativos:    ${TOTAL:-?}"
  echo "   Com registro (P ou F):     ${COM_REG:-?}"
  echo "   Sem registro (pendentes):  ${SEM_REG:-?}"
  echo "  ====================================================="
  printf "\n  Pressione ENTER para voltar ao menu..."; read; mostrar_menu
}

registrar_faltas() {
  echo ""
  echo "  ⚠️  ATENÇÃO IMPORTANTE:"
  echo "  ====================================================="
  echo "  Esta ação marca como FALTA todos os alunos que"
  echo "  NÃO têm nenhum registro para $DATA."
  echo ""
  echo "  Use SOMENTE se as presenças do dia já tiverem sido"
  echo "  registradas pelas catracas ou manualmente no sistema."
  echo ""
  echo "  Alunos já registrados (P ou F) NÃO serão alterados."
  echo "  ====================================================="
  echo ""

  RESPOSTA=$(curl -s -X GET "$URL/api/academico/totem-frequencia?data=$DATA" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

  SEM_REG=$(echo "$RESPOSTA" | grep -o '"sem_registro":[0-9]*' | grep -o '[0-9]*')
  COM_REG=$(echo "$RESPOSTA" | grep -o '"com_registro":[0-9]*' | grep -o '[0-9]*')

  echo "  Com registro hoje: ${COM_REG:-0}"
  echo "  Sem registro hoje: ${SEM_REG:-0}"
  echo ""

  if [ "${COM_REG:-0}" = "0" ]; then
    echo "  ⛔  NENHUM aluno tem registro de presença ainda!"
    echo "  Registrar agora marcaria TODOS como falta."
    echo "  Certifique-se de que as presenças foram registradas"
    echo "  pelas catracas antes de continuar."
    echo ""
    printf "  Tem certeza que deseja continuar mesmo assim? (sim/N): "
    read FORCA
    if [ "$FORCA" != "sim" ]; then
      echo "  Operação cancelada."
      printf "\n  Pressione ENTER para voltar..."; read; mostrar_menu; return
    fi
  fi

  if [ "${SEM_REG:-0}" = "0" ]; then
    echo "  ✅ Todos os alunos já têm registro. Nada a fazer."
    printf "\n  Pressione ENTER para voltar..."; read; mostrar_menu; return
  fi

  printf "  Confirmar registro de ${SEM_REG} faltas? (s/N): "
  read CONFIRMA
  case "$CONFIRMA" in
    [sS])
      echo ""; echo "  Registrando faltas..."
      RESULTADO=$(curl -s -X POST "$URL/api/academico/totem-frequencia" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"data\":\"$DATA\"}")
      if echo "$RESULTADO" | grep -q '"ok":true'; then
        REGISTRADOS=$(echo "$RESULTADO" | grep -o '"registrados":[0-9]*' | grep -o '[0-9]*')
        echo ""
        echo "  ====================================================="
        echo "   ✅ ${REGISTRADOS:-0} falta(s) registrada(s)!"
        echo "   Acadêmico > Frequência para conferir."
        echo "  ====================================================="
      else
        echo "  [ERRO] $RESULTADO"
      fi ;;
    *) echo "  Cancelado." ;;
  esac
  printf "\n  Pressione ENTER para voltar..."; read; mostrar_menu
}

desfazer_faltas() {
  echo ""
  echo "  ====================================================="
  echo "  🗑️  DESFAZER faltas do totem em $DATA"
  echo ""
  echo "  Isso remove APENAS os registros criados por este"
  echo "  script. Registros manuais NÃO são afetados."
  echo "  ====================================================="
  echo ""
  printf "  Confirmar remoção? (s/N): "
  read CONFIRMA
  case "$CONFIRMA" in
    [sS])
      echo ""; echo "  Removendo registros..."
      RESULTADO=$(curl -s -X DELETE \
        "$URL/api/academico/totem-frequencia?data=$DATA" \
        -H "Authorization: Bearer $TOKEN")
      if echo "$RESULTADO" | grep -q '"ok":true'; then
        REMOVIDOS=$(echo "$RESULTADO" | grep -o '"removidos":[0-9]*' | grep -o '[0-9]*')
        echo ""
        echo "  ====================================================="
        echo "   ✅ ${REMOVIDOS:-0} registro(s) removidos com sucesso!"
        echo "  ====================================================="
      else
        echo "  [ERRO] $RESULTADO"
      fi ;;
    *) echo "  Cancelado." ;;
  esac
  printf "\n  Pressione ENTER para voltar..."; read; mostrar_menu
}

# Inicia
mostrar_menu
