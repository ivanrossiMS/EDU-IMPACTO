#!/bin/bash
# ============================================================
#  INSTALAR SINCRONIZAÇÃO AUTOMÁTICA DA CATRACA
#  Roda o Sincronizar_Catraca.py automaticamente às:
#    • 07:00 — Entrada da manhã
#    • 12:30 — Entrada do turno da tarde  
#    • 18:00 — Fechamento do dia
# ============================================================

SCRIPT_PATH="/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/Sincronizar_Catraca.py"
PLIST_PATH="$HOME/Library/LaunchAgents/com.impacto.catraca.plist"
LOG_PATH="$HOME/Library/Logs/impacto-catraca.log"

echo ""
echo "  ====================================================="
echo "   🔧 Instalando Sincronização Automática da Catraca"
echo "  ====================================================="
echo ""

# Verificar se Python3 está disponível
if ! command -v python3 &> /dev/null; then
    echo "  ❌ Python3 não encontrado. Instale em: https://python.org"
    exit 1
fi

# Verificar se o script existe
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "  ❌ Script não encontrado em: $SCRIPT_PATH"
    exit 1
fi

# Desinstalar versão antiga se existir
if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null
    echo "  🔄 Versão anterior removida."
fi

# Criar o arquivo de agendamento (LaunchAgent)
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.impacto.catraca</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>${SCRIPT_PATH}</string>
        <string>--loop</string>
        <string>30</string>
    </array>

    <!-- Manter rodando continuamente em segundo plano (24/7) -->
    <key>KeepAlive</key>
    <true/>

    <!-- Iniciar automaticamente ao ligar o computador / fazer login -->
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

# Ativar o agendamento
launchctl load "$PLIST_PATH"

if [ $? -eq 0 ]; then
    echo "  ✅ Sincronização automática em segundo plano (24/7) instalada com sucesso!"
    echo ""
    echo "  🚀 O serviço agora roda continuamente em segundo plano a cada 30 segundos."
    echo "     Ele lê APENAS os novos acessos das catracas de forma incremental."
    echo ""
    echo "  📄 Logs em: $LOG_PATH"
    echo ""
    echo "  ─────────────────────────────────────────────────"
    echo "  Para DESINSTALAR no futuro:"
    echo "  launchctl unload $PLIST_PATH && rm $PLIST_PATH"
    echo "  ─────────────────────────────────────────────────"
    echo ""
    
    # Rodar uma vez agora para sincronizar o dia atual
    echo "  🔄 Rodando sincronização agora para recuperar presenças de hoje..."
    echo ""
    python3 "$SCRIPT_PATH"
else
    echo "  ❌ Erro ao instalar. Tente rodar com sudo."
fi
