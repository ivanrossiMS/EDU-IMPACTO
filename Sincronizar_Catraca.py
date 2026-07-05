#!/usr/bin/env python3
"""
Sincronizar_Catraca.py
─────────────────────────────────────────────────────────────────
• Faz login nas catracas ControlID iDFace pelo IP local (HTTP/HTTPS)
• Busca os logs de acesso do dia de forma eficiente (scan final do buffer)
• Envia cada evento ao webhook do Netlify → registra PRESENTE no sistema
• Idempotente: pode rodar quantas vezes quiser no dia sem duplicar registros
• Também configura o Monitor nas catracas para envio automático futuro

Uso: python3 Sincronizar_Catraca.py
"""

import json
import sys
import os
import ssl
import urllib.request
import urllib.error
from datetime import datetime, timezone, date

# ══════════════════════════════════════════════════════════════
#  CONFIGURAÇÕES
# ══════════════════════════════════════════════════════════════
NETLIFY_URL   = "https://impacto-edu.net"
CATRACA_SENHA = "Pass1081$"
CATRACA_LOGIN = "admin"

# Cada catraca: nome, ip, porta
# Porta 80  → HTTP
# Porta 443 → HTTPS
# Porta 88  → tenta HTTP primeiro, depois HTTPS
CATRACAS = [
    {"nome": "Portaria Média",  "ip": "192.168.1.75", "porta": 80},
    {"nome": "Portaria Fund1",  "ip": "192.168.1.85", "porta": 80},
    {"nome": "Portaria INF",    "ip": "192.168.1.98", "porta": 80},
]
# ══════════════════════════════════════════════════════════════

WEBHOOK_URL = f"{NETLIFY_URL}/api/portaria/webhook"

# Contexto SSL que não valida certificado (catracas self-signed)
SSL_CTX = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def post_json(url, body, cookie=None, timeout=8):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", f"session={cookie}")
    try:
        ctx = SSL_CTX if url.startswith("https") else None
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:300]}")


def detectar_base_url(cat):
    """Tenta HTTP e HTTPS para descobrir qual funciona."""
    ip, porta = cat["ip"], cat["porta"]
    candidatos = []
    if porta == 443:
        candidatos = [f"https://{ip}:{porta}"]
    elif porta == 80:
        candidatos = [f"http://{ip}:{porta}"]
    else:  # porta não padrão: tenta HTTP e HTTPS
        candidatos = [f"http://{ip}:{porta}", f"https://{ip}:{porta}"]

    for url in candidatos:
        try:
            r = post_json(f"{url}/login.fcgi",
                          {"login": CATRACA_LOGIN, "password": CATRACA_SENHA},
                          timeout=5)
            if r.get("session"):
                return url, r["session"]
        except Exception as e:
            print(f"     [DEBUG] Falha ao tentar {url}: {e}")
            pass
    return None, None


def get_access_logs_hoje(base_url, session):
    """
    Busca logs de hoje de forma eficiente: scan a partir de um offset próximo
    ao final do buffer, aumentando gradualmente.
    """
    hoje = date.today()
    inicio_ts = int(datetime(hoje.year, hoje.month, hoje.day, tzinfo=timezone.utc).timestamp())
    fim_ts = inicio_ts + 86400

    # 1. Descobrir total aproximado de logs (verificando offsets)
    total_estimado = 0
    for off in [5000, 10000, 20000, 30000, 35000, 50000, 75000, 100000]:
        try:
            r = post_json(f"{base_url}/load_objects.fcgi",
                          {"object": "access_logs", "limit": 1, "offset": off},
                          cookie=session)
            if r.get("access_logs"):
                total_estimado = off
            else:
                break
        except Exception:
            break

    # Começa scan ~2000 entradas antes do final estimado
    offset_inicio = max(0, total_estimado - 2000)
    logs_hoje = []
    batch = 500

    off = offset_inicio
    while True:
        try:
            r = post_json(f"{base_url}/load_objects.fcgi",
                          {"object": "access_logs", "limit": batch, "offset": off},
                          cookie=session)
            chunk = r.get("access_logs", [])
        except Exception as e:
            print(f"     ⚠️  Erro no offset {off}: {e}")
            break

        if not chunk:
            break

        de_hoje = [l for l in chunk if inicio_ts <= l.get("time", 0) < fim_ts]
        logs_hoje.extend(de_hoje)

        if len(chunk) < batch:
            break  # fim do buffer
        off += batch

    return logs_hoje


def configurar_monitor(base_url, session):
    """Configura o Monitor do iDFace para enviar eventos ao webhook Netlify."""
    from urllib.parse import urlparse
    p = urlparse(WEBHOOK_URL)
    hostname = p.hostname
    porta = str(p.port or (443 if p.scheme == "https" else 80))
    path = p.path

    try:
        post_json(f"{base_url}/set_configuration.fcgi",
                  {"monitor": {
                      "request_timeout": "5000",
                      "hostname": hostname,
                      "port": porta,
                      "path": path,
                  }},
                  cookie=session)
        return True
    except Exception as e:
        return False


def enviar_para_webhook(log_entry, device_ip):
    payload = {
        "object_changes": [{
            "object": "access_logs",
            "type":   "inserted",
            "values": {
                "id":      log_entry.get("id", 0),
                "user_id": str(log_entry.get("user_id", "")),
                "time":    log_entry.get("time", 0),
            }
        }],
        "device_id": device_ip,
    }
    return post_json(WEBHOOK_URL, payload, timeout=12)


def formatar_hora(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%H:%M:%S") if ts else "?"


def main():
    hoje_str = date.today().strftime("%d/%m/%Y")
    print()
    print("  ══════════════════════════════════════════════════")
    print("   🔄  SINCRONIZAÇÃO CATRACA → SISTEMA")
    print(f"   {hoje_str}")
    print("  ══════════════════════════════════════════════════")

    cache_file = f"sincronizados_{date.today().strftime('%Y_%m_%d')}.txt"
    ja_sincronizados = set()
    if os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            for line in f:
                if line.strip():
                    ja_sincronizados.add(line.strip())

    total_enviados = 0
    total_erros    = 0

    for cat in CATRACAS:
        print(f"\n  📡 {cat['nome']} ({cat['ip']}:{cat['porta']})")

        base_url, session = detectar_base_url(cat)
        if not base_url:
            print(f"     ❌ Sem conexão. Verifique se está na mesma rede.")
            total_erros += 1
            continue

        proto = "HTTPS" if base_url.startswith("https") else "HTTP"
        print(f"     ✅ Conectado via {proto} (sessão: {session[:12]}…)")

        # Configura o monitor automaticamente
        ok_monitor = configurar_monitor(base_url, session)
        if ok_monitor:
            print(f"     🔧 Monitor configurado → {WEBHOOK_URL}")
        else:
            print(f"     ⚠️  Monitor não configurado (pode não suportar)")

        # Busca logs de hoje
        print(f"     🔍 Buscando logs de hoje...")
        logs_hoje = get_access_logs_hoje(base_url, session)
        reconhecidos = [l for l in logs_hoje if l.get("user_id", 0) > 0]

        # Filtra para enviar apenas 1 registro por aluno (o primeiro do dia)
        unicos = {}
        for l in reconhecidos:
            uid = str(l.get("user_id", ""))
            # Se não tá no dicionário, adiciona. Se tiver, substitui apenas se o tempo for MENOR (mais cedo)
            if uid not in unicos or l.get("time", 0) < unicos[uid].get("time", 0):
                unicos[uid] = l
        
        reconhecidos_unicos = list(unicos.values())
        
        novos_para_enviar = []
        for log in reconhecidos_unicos:
            if str(log.get("user_id", "")) not in ja_sincronizados:
                novos_para_enviar.append(log)
        
        print(f"     📋 {len(logs_hoje)} eventos hoje / {len(reconhecidos_unicos)} alunos únicos / {len(novos_para_enviar)} novos para envio")

        if not novos_para_enviar:
            print(f"     ℹ️  Todos os alunos de hoje já foram sincronizados anteriormente.")
            continue

        # Abre o arquivo de cache uma vez para evitar PermissionError do Windows (Antivírus/Defender)
        cache_f = None
        try:
            cache_f = open(cache_file, "a")
        except Exception as e:
            print(f"     ⚠️  Aviso: Não foi possível abrir o arquivo de cache '{cache_file}' ({e}). O script continuará sem salvar cache em disco.")

        # Envia cada reconhecimento para o webhook
        ok = 0
        falhas = 0
        for log in novos_para_enviar:
            uid  = str(log.get("user_id", "?"))
            hora = formatar_hora(log.get("time", 0))
            try:
                result = enviar_para_webhook(log, cat["ip"])
                status = result.get("evento", result.get("status", "?"))
                if status in ("sucesso", "ok", "ignorado (já registrado)", "inconsistencia"):
                    print(f"     ✅ Aluno {uid:<6} às {hora}  [{status}]")
                    ok += 1
                    if cache_f:
                        try:
                            cache_f.write(uid + "\n")
                            cache_f.flush()
                        except Exception as write_err:
                            pass # Ignora erro de escrita se o arquivo for bloqueado durante a execução
                    ja_sincronizados.add(uid)
                else:
                    print(f"     ⚠️  Aluno {uid:<6} às {hora}  [{status}]")
                    ok += 1
            except Exception as e:
                print(f"     ❌ Aluno {uid:<6} às {hora}: {e}")
                falhas += 1

        if cache_f:
            try:
                cache_f.close()
            except:
                pass

        total_enviados += ok
        total_erros    += falhas
        print(f"     ─── {ok} enviados, {falhas} erros ───")

    print()
    print("  ══════════════════════════════════════════════════")
    print(f"   ✅ Presenças enviadas: {total_enviados}")
    if total_erros:
        print(f"   ⚠️  Erros:            {total_erros}")
    print("  ══════════════════════════════════════════════════")

    if total_enviados > 0:
        print()
        print("  Verifique em: Acadêmico > Frequência")
    elif total_erros == 0:
        print()
        print("  Nenhum aluno identificado ainda.")
        print("  Rode novamente quando os alunos começarem a chegar.")
    print()


if __name__ == "__main__":
    main()
