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
    </array>

    <!-- Rodar às 07:00 (entrada manhã) -->
    <!-- Rodar às 12:30 (entrada tarde) -->
    <!-- Rodar às 18:00 (fechamento)    -->
    <key>StartCalendarInterval</key>
    <array>
        <dict>
            <key>Hour</key><integer>7</integer>
            <key>Minute</key><integer>0</integer>
        </dict>
        <dict>
            <key>Hour</key><integer>12</integer>
            <key>Minute</key><integer>30</integer>
        </dict>
        <dict>
            <key>Hour</key><integer>18</integer>
            <key>Minute</key><integer>0</integer>
        </dict>
    </array>

    <!-- Log de saída -->
    <key>StandardOutPath</key>
    <string>${LOG_PATH}</string>
    <key>StandardErrorPath</key>
    <string>${LOG_PATH}</string>

    <!-- Não rodar ao fazer login, só nos horários acima -->
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF

# Ativar o agendamento
launchctl load "$PLIST_PATH"

if [ $? -eq 0 ]; then
    echo "  ✅ Sincronização automática instalada com sucesso!"
    echo ""
    echo "  ⏰ Horários de execução automática:"
    echo "     • 07:00 — Entrada da manhã"
    echo "     • 12:30 — Entrada da tarde"
    echo "     • 18:00 — Fechamento"
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
