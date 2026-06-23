#!/bin/bash

# ============================================================
#  CONFIGURAÇÕES — edite apenas estas duas linhas
# ============================================================
URL="https://SEU-SITE.netlify.app"
TOKEN="1081"
# ============================================================

while true; do
  clear
  echo ""
  echo "  ====================================================="
  echo "    SISTEMA DE FREQUÊNCIA — EDU IMPACTO"
  echo "  ====================================================="
  echo ""

  # Data de hoje no formato YYYY-MM-DD
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
  echo "  Consultando registros para $DATA..."
  echo ""

  # Chama o GET para ver a situação do dia
  RESPOSTA=$(curl -s -X GET "$URL/api/academico/totem-frequencia?data=$DATA" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")

  if [ $? -ne 0 ] || [ -z "$RESPOSTA" ]; then
    echo "  [ERRO] Não foi possível conectar ao servidor."
    echo "         Verifique sua conexão com a internet."
    echo ""
    printf "  Pressione ENTER para tentar novamente..."
    read
    continue
  fi

  # Verifica erro na resposta
  if echo "$RESPOSTA" | grep -q '"error"'; then
    echo "  [ERRO] O servidor retornou um erro:"
    echo "  $RESPOSTA"
    echo ""
    printf "  Pressione ENTER para continuar..."
    read
    continue
  fi

  # Extrai valores do JSON
  TOTAL=$(echo "$RESPOSTA" | grep -o '"total_ativos":[0-9]*' | grep -o '[0-9]*')
  COM_REG=$(echo "$RESPOSTA" | grep -o '"com_registro":[0-9]*' | grep -o '[0-9]*')
  SEM_REG=$(echo "$RESPOSTA" | grep -o '"sem_registro":[0-9]*' | grep -o '[0-9]*')

  echo "  ====================================================="
  echo "   Situação do dia $DATA:"
  echo ""
  echo "   Total de alunos ativos:    ${TOTAL:-?}"
  echo "   Com registro (P ou F):     ${COM_REG:-?}"
  echo "   Sem registro (pendentes):  ${SEM_REG:-?}"
  echo "  ====================================================="
  echo ""

  if [ "${SEM_REG:-0}" = "0" ]; then
    echo "  ✅ Todos os alunos já têm registro para este dia."
    echo "  Nenhuma ação necessária."
    echo ""
    printf "  Pressione ENTER para consultar outro dia ou Ctrl+C para sair..."
    read
    continue
  fi

  echo "  ${SEM_REG} aluno(s) ainda não têm registro."
  echo "  Eles serão marcados como FALTA."
  echo ""
  echo "  ATENÇÃO: Alunos já registrados (presente ou falta)"
  echo "  NÃO serão alterados."
  echo ""
  printf "  Confirmar registro de faltas? (s/N): "
  read CONFIRMA

  case "$CONFIRMA" in
    [sS])
      echo ""
      echo "  Registrando faltas..."
      echo ""

      RESULTADO=$(curl -s -X POST "$URL/api/academico/totem-frequencia" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"data\":\"$DATA\"}")

      if echo "$RESULTADO" | grep -q '"ok":true'; then
        REGISTRADOS=$(echo "$RESULTADO" | grep -o '"registrados":[0-9]*' | grep -o '[0-9]*')
        echo "  ====================================================="
        echo ""
        echo "   ✅ ${REGISTRADOS:-0} falta(s) registrada(s) com sucesso!"
        echo ""
        echo "   Notificações serão enviadas aos responsáveis."
        echo "   Os registros já aparecem em:"
        echo "   Acadêmico > Frequência"
        echo ""
        echo "  ====================================================="
      else
        echo "  [ERRO] Falha ao registrar:"
        echo "  $RESULTADO"
      fi
      ;;
    *)
      echo ""
      echo "  Operação cancelada."
      ;;
  esac

  echo ""
  printf "  Pressione ENTER para consultar outro dia ou Ctrl+C para sair..."
  read
done
