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


def processar_fila_pendencias_erp(cats_conectadas):
    """
    Busca alterações pendentes no ERP online (cadastros, fotos, deleções)
    e aplica diretamente nas catracas físicas na rede local.
    """
    url_queue = f"{NETLIFY_URL}/api/portaria/sync-queue"
    print(f"\n  📥  VERIFICANDO FILA DE ALTERAÇÕES DO ERP ({url_queue})…")

    try:
        req = urllib.request.Request(url_queue, method="GET")
        req.add_header("User-Agent", "Mozilla/5.0 (EduImpacto Local Sync Daemon)")
        ctx = SSL_CTX if url_queue.startswith("https") else None
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            data = json.loads(r.read())
        
        pendentes = data.get("pendentes", [])
        if not pendentes:
            print("     ✅ Nenhuma alteração pendente vinda do ERP.")
            return

        print(f"     📦 {len(pendentes)} alteração(ões) pendente(s) encontrada(s) no ERP online!")

        for p in pendentes:
            aluno_id = p.get("aluno_id")
            disp_id  = p.get("dispositivo_id")
            numeric_id = p.get("numeric_id")
            nome = p.get("nome", "")
            matricula = p.get("matricula", "")
            foto = p.get("foto")
            acao = p.get("acao", "update")

            if not numeric_id:
                print(f"     ⚠️ Pulo do aluno {nome}: Sem ID numérico de matrícula.")
                continue

            # Determinar quais catracas devem receber essa atualização
            alvos = cats_conectadas
            if disp_id:
                alvos = [c for c in cats_conectadas if c["cat"]["ip"] == disp_id or c["cat"].get("id") == disp_id or disp_id in c["cat"].get("nome", "")]
                if not alvos:
                    alvos = cats_conectadas

            for alvo in alvos:
                cat_nome = alvo["cat"]["nome"]
                base_url = alvo["base_url"]
                session  = alvo["session"]
                dev_ip   = alvo["cat"]["ip"]

                try:
                    if acao == "delete":
                        # Deletar usuário da catraca
                        post_json(f"{base_url}/destroy_objects.fcgi",
                                  {"object": "users", "where": {"users": {"id": numeric_id}}},
                                  cookie=session)
                        print(f"     🗑️  [Catraca {cat_nome}] Aluno '{nome}' (ID {numeric_id}) removido da memória flash.")
                    else:
                        # Criar / Atualizar usuário
                        post_json(f"{base_url}/modify_objects.fcgi",
                                  {
                                      "object": "users",
                                      "values": {"name": nome, "registration": matricula},
                                      "where":  {"users": {"id": numeric_id}}
                                  },
                                  cookie=session)
                        
                        # Tentar criar se não existia
                        post_json(f"{base_url}/add_objects.fcgi",
                                  {"object": "users", "values": [{"id": numeric_id, "name": nome, "registration": matricula}]},
                                  cookie=session)

                        print(f"     👤 [Catraca {cat_nome}] Dados de '{nome}' (ID {numeric_id}) atualizados.")

                        # Enviar foto se presente
                        foto_enviada = False
                        if foto and isinstance(foto, str) and len(foto) > 50:
                            try:
                                # Trata base64
                                clean_b64 = foto.split(',')[-1] if ',' in foto else foto
                                post_json(f"{base_url}/set_user_image.fcgi",
                                          {"user_id": numeric_id, "image": clean_b64},
                                          cookie=session)
                                foto_enviada = True
                                print(f"     📸 [Catraca {cat_nome}] Foto de '{nome}' transmitida com sucesso.")
                            except Exception as fe:
                                print(f"     ⚠️  [Catraca {cat_nome}] Foto falhou para '{nome}': {fe}")

                    # Notificar o servidor online que o item foi sincronizado com sucesso nesta catraca
                    post_json(url_queue, {
                        "aluno_id": aluno_id,
                        "dispositivo_id": disp_id or dev_ip,
                        "status": "sincronizado",
                        "foto_enviada": foto_enviada if acao != "delete" else False
                    })
                except Exception as ex:
                    print(f"     ❌ [Catraca {cat_nome}] Falha ao processar {nome}: {ex}")
                    post_json(url_queue, {
                        "aluno_id": aluno_id,
                        "dispositivo_id": disp_id or dev_ip,
                        "status": "erro",
                        "erro_detalhe": str(ex)[:200]
                    })
    except Exception as e:
        print(f"     ⚠️ Falha ao verificar fila de pendências no ERP: {e}")


def main():
    hoje_str = date.today().strftime("%d/%m/%Y")
    print()
    print("  ══════════════════════════════════════════════════")
    print("   🔄  SINCRONIZAÇÃO BIDIRECIONAL (CATRACA ⇄ ERP)")
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
    cats_conectadas = []

    for cat in CATRACAS:
        print(f"\n  📡 {cat['nome']} ({cat['ip']}:{cat['porta']})")

        base_url, session = detectar_base_url(cat)
        if not base_url:
            print(f"     ❌ Sem conexão. Verifique se está na mesma rede.")
            total_erros += 1
            continue

        proto = "HTTPS" if base_url.startswith("https") else "HTTP"
        print(f"     ✅ Conectado via {proto} (sessão: {session[:12]}…)")
        cats_conectadas.append({"cat": cat, "base_url": base_url, "session": session})

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

        cache_f = None
        try:
            cache_f = open(cache_file, "a")
        except Exception as e:
            print(f"     ⚠️  Aviso: Não foi possível abrir cache ({e}).")

        ok = 0
        falhas = 0
        for log in novos_para_enviar:
            uid  = str(log.get("user_id", "?"))
            hora = formatar_hora(log.get("time", 0))
            try:
                result = enviar_para_webhook(log, cat["ip"])
                status = result.get("evento", result.get("status", "?"))
                if status in ("sucesso", "ok", "ignorado (já registrado)", "inconsistencia", "?") or "actions" in result:
                    print(f"     ✅ Aluno {uid:<6} às {hora}  [sucesso]")
                    ok += 1
                    if cache_f:
                        try:
                            cache_f.write(uid + "\n")
                            cache_f.flush()
                        except Exception:
                            pass
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

    # 📥 SEGUNDA ETAPA: PROCESSAR ALTERAÇÕES PENDENTES DO ERP → CATRACAS
    if cats_conectadas:
        processar_fila_pendencias_erp(cats_conectadas)

    print()
    print("  ══════════════════════════════════════════════════")
    print(f"   ✅ Presenças enviadas ao ERP: {total_enviados}")
    if total_erros:
        print(f"   ⚠️  Erros de conexão:          {total_erros}")
    print("  ══════════════════════════════════════════════════")
    print()


if __name__ == "__main__":
    main()

