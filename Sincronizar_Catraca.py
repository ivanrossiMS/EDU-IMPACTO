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
import subprocess
from datetime import datetime, timezone, date

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catraca_sync.log")
_raw_print = print

def log_print(*args, **kwargs):
    _raw_print(*args, **kwargs)
    try:
        msg = " ".join(str(a) for a in args)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {msg}\n")
    except Exception:
        pass

print = log_print

# ══════════════════════════════════════════════════════════════
#  CONFIGURAÇÕES
# ══════════════════════════════════════════════════════════════
DEFAULT_SERVER_URL = "https://impacto-edu.net"

# Permite sobrescrever o servidor via argumento --server=http://localhost:3000 ou variável SERVER_URL
SERVER_URL = os.environ.get("SERVER_URL", DEFAULT_SERVER_URL)
for arg in sys.argv:
    if arg.startswith("--server="):
        SERVER_URL = arg.split("=", 1)[1].strip()

NETLIFY_URL   = SERVER_URL.rstrip('/')
CATRACA_SENHA = "Pass1081$"
CATRACA_LOGIN = "admin"

# Cada catraca: nome, ip, porta, id (serial do equipamento)
# Porta 80  → HTTP
# Porta 443 → HTTPS
# Porta 88  → tenta HTTP primeiro, depois HTTPS
CATRACAS = [
    {"nome": "Portaria Médio - PRINCIPAL", "ip": "192.168.1.150", "id": "0M0200/02638E", "porta": 80},
    {"nome": "Portaria FUND1- PRINCIPAL",  "ip": "192.168.1.155", "id": "0M0200/02639C", "porta": 80},
    {"nome": "Portaria PRINCIPAL -INF",   "ip": "192.168.1.105", "id": "0M0200/0262CE", "porta": 80},
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


STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catraca_state.json")

def carregar_estado_catracas():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def salvar_estado_catracas(estado):
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(estado, f, indent=2)
    except Exception:
        pass


def get_access_logs_hoje(base_url, session, last_log_id=0):
    """
    Busca logs de hoje de forma incremental:
    Se last_log_id > 0, busca APENAS registros com id > last_log_id.
    Isso torna a leitura instantânea (0.05s) e lê unicamente novos acessos.
    """
    hoje = date.today()
    inicio_ts = int(datetime(hoje.year, hoje.month, hoje.day, tzinfo=timezone.utc).timestamp())
    fim_ts = inicio_ts + 86400

    time_filter = {">=": inicio_ts - 10800, "<=": fim_ts + 10800}

    if last_log_id > 0:
        where_cond = {"access_logs": {"time": time_filter, "id": {">": last_log_id}}}
    else:
        where_cond = {"access_logs": {"time": time_filter}}

    logs_hoje = []
    batch = 500
    off = 0

    while True:
        try:
            r = post_json(f"{base_url}/load_objects.fcgi",
                          {"object": "access_logs", "where": where_cond, "limit": batch, "offset": off},
                          cookie=session)
            chunk = r.get("access_logs", [])
        except Exception as e:
            print(f"     ⚠️  Erro no offset {off}: {e}")
            break

        if not chunk:
            break

        de_hoje = [l for l in chunk if inicio_ts <= l.get("time", 0) <= fim_ts]
        logs_hoje.extend(de_hoje)

        if len(chunk) < batch:
            break  # Fim do buffer de novos registros
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


def enviar_para_webhook(log_entry, cat):
    """
    Envia o evento de acesso ao webhook do ERP.
    Inclui o device_id (serial da catraca) e o user_id numérico para que o servidor
    consiga identificar corretamente o dispositivo e o aluno.
    """
    user_id = log_entry.get("user_id", 0)
    log_id  = log_entry.get("id", 0)
    payload = {
        # device_id = serial ou IP da catraca (o webhook tenta as duas formas)
        "device_id": cat.get("id") or cat["ip"],
        "object_changes": [{
            "object": "access_logs",
            "type":   "inserted",
            "values": {
                "id":      log_id,
                "user_id": user_id,
                "time":    log_entry.get("time", 0),
            }
        }],
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
                        # Criar ou Atualizar usuário
                        # 1. Tentar criar o usuário no equipamento (create_objects.fcgi)
                        criado = False
                        try:
                            post_json(f"{base_url}/create_objects.fcgi",
                                      {"object": "users", "values": [{"id": numeric_id, "name": nome[:30], "registration": str(matricula)}]},
                                      cookie=session)
                            criado = True
                        except Exception:
                            # Se já existir, atualizar com modify_objects.fcgi
                            try:
                                post_json(f"{base_url}/modify_objects.fcgi",
                                          {
                                              "object": "users",
                                              "values": {"name": nome[:30], "registration": str(matricula)},
                                              "where":  {"users": {"id": numeric_id}}
                                          },
                                          cookie=session)
                            except Exception as me:
                                pass

                        print(f"     👤 [Catraca {cat_nome}] Dados de '{nome}' (ID {numeric_id}) sincronizados.")

                        # Enviar foto se presente
                        foto_enviada = False
                        if foto and isinstance(foto, str) and len(foto) > 50:
                            try:
                                import base64, time
                                clean_b64 = foto.split(',')[-1] if ',' in foto else foto
                                img_bytes = base64.b64decode(clean_b64)
                                now_ts = int(time.time())
                                req_url = f"{base_url}/user_set_image.fcgi?user_id={numeric_id}&session={session}&timestamp={now_ts}"
                                req = urllib.request.Request(req_url, data=img_bytes, method="POST")
                                req.add_header("Content-Type", "application/octet-stream")
                                if session:
                                    req.add_header("Cookie", f"session={session}")
                                ctx = SSL_CTX if base_url.startswith("https") else None
                                with urllib.request.urlopen(req, timeout=12, context=ctx) as r:
                                    res = json.loads(r.read())
                                foto_enviada = True
                                print(f"     📸 [Catraca {cat_nome}] Foto de '{nome}' transmitida com sucesso.")
                            except Exception as fe:
                                # Tenta fallback JSON
                                try:
                                    import time
                                    now_ts = int(time.time())
                                    clean_b64 = foto.split(',')[-1] if ',' in foto else foto
                                    post_json(f"{base_url}/set_user_image.fcgi?session={session}&timestamp={now_ts}",
                                              {"user_id": numeric_id, "image": clean_b64},
                                              cookie=session)
                                    foto_enviada = True
                                    print(f"     📸 [Catraca {cat_nome}] Foto de '{nome}' transmitida com sucesso (JSON).")
                                except Exception as fe2:
                                    print(f"     ⚠️  [Catraca {cat_nome}] Foto falhou para '{nome}' (Erro Binário: {fe} | Erro JSON: {fe2})")

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


def carregar_registrados_do_erp():
    """Consulta o ERP online para obter a lista de alunos que já possuem presença/evento registrado HOJE."""
    url_queue = f"{NETLIFY_URL}/api/portaria/sync-queue"
    try:
        req = urllib.request.Request(url_queue, method="GET")
        req.add_header("User-Agent", "EduImpacto Local Sync Daemon")
        ctx = SSL_CTX if url_queue.startswith("https") else None
        with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
            data = json.loads(r.read())
            registrados = data.get("registrados_hoje", [])
            return set(str(x) for x in registrados if x)
    except Exception as e:
        print(f"     ⚠️ Não foi possível consultar registros prévios do ERP: {e}")
        return set()


def rodar_um_ciclo():
    hoje_str = date.today().strftime("%d/%m/%Y")
    print()
    print("  ══════════════════════════════════════════════════")
    print("   🔄  SINCRONIZAÇÃO BIDIRECIONAL (CATRACA ⇄ ERP)")
    print(f"   {hoje_str}")
    print("  ══════════════════════════════════════════════════")

    estado = carregar_estado_catracas()
    cache_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"sincronizados_{date.today().strftime('%Y_%m_%d')}.txt")
    ja_sincronizados = set()
    if os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            for line in f:
                if line.strip():
                    ja_sincronizados.add(line.strip())

    # 🌐 Consulta o ERP online para carregar alunos que já possuem presença registrada hoje
    print("\n  🌐 Consultando registros já salvos no ERP online para hoje…")
    registrados_erp = carregar_registrados_do_erp()
    if registrados_erp:
        ja_sincronizados.update(registrados_erp)
        print(f"     ✅ {len(registrados_erp)} aluno(s) já possuem presença registrada no ERP (serão pulados).")
        try:
            with open(cache_file, "a") as f:
                for uid in registrados_erp:
                    f.write(uid + "\n")
        except Exception:
            pass

    total_enviados = 0
    total_erros    = 0
    cats_conectadas = []

    for cat in CATRACAS:
        cat_key = cat.get("id") or cat["ip"]
        last_id = estado.get(cat_key, 0)
        print(f"\n  📡 {cat['nome']} ({cat['ip']}:{cat['porta']}) [Último Log ID lido: {last_id}]")

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

        # Busca logs de hoje de forma incremental
        print(f"     🔍 Buscando novos logs da catraca...")
        logs_hoje = get_access_logs_hoje(base_url, session, last_log_id=last_id)
        
        # Atualizar last_id se novos logs forem lidos
        if logs_hoje:
            max_log_id = max([l.get("id", 0) for l in logs_hoje], default=last_id)
            if max_log_id > last_id:
                estado[cat_key] = max_log_id
                salvar_estado_catracas(estado)

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
        
        pulados = len(reconhecidos_unicos) - len(novos_para_enviar)
        print(f"     📋 {len(logs_hoje)} novos eventos lidos / {len(reconhecidos_unicos)} alunos únicos / {len(novos_para_enviar)} para enviar ({pulados} pulados por duplicidade)")

        if not novos_para_enviar:
            print(f"     ℹ️  Nenhum novo registro pendente para esta catraca.")
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
                result = enviar_para_webhook(log, cat)
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


def instalar_no_windows():
    """Cria um atalho (.lnk) na pasta Inicializar do Windows para rodar em segundo plano."""
    if sys.platform != "win32":
        print("❌ Esta instalação automática em segundo plano é exclusiva para sistemas Windows.")
        sys.exit(1)
        
    try:
        startup_folder = os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
        shortcut_path = os.path.join(startup_folder, "Sincronizacao_Catraca.lnk")
        script_path = os.path.abspath(__file__)
        script_dir = os.path.dirname(script_path)
        
        # Encontra o pythonw.exe
        python_exe = sys.executable
        pythonw_exe = python_exe.replace("python.exe", "pythonw.exe")
        if not os.path.exists(pythonw_exe):
            pythonw_exe = python_exe
            
        print(f"🔧 Configurando inicialização automática no Windows...")
        print(f"   • Pasta do projeto: {script_dir}")
        print(f"   • Script: {script_path}")
        print(f"   • Executável Python: {pythonw_exe}")
        print(f"   • Atalho de inicialização: {shortcut_path}")
        
        # Comando PowerShell para criar o atalho .lnk de forma robusta
        ps_cmd = (
            f"$s = (New-Object -ComObject WScript.Shell).CreateShortcut('{shortcut_path}'); "
            f"$s.TargetPath = '{pythonw_exe}'; "
            f"$s.Arguments = '\"{script_path}\" --loop 30'; "
            f"$s.WorkingDirectory = '{script_dir}'; "
            f"$s.WindowStyle = 7; "
            f"$s.Save()"
        )
        
        # Executa o PowerShell usando a API Unicode
        subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            check=True
        )
        
        print("✅ [SUCESSO] Inicialização automática configurada com sucesso!")
        print("   O script rodará AUTOMATICAMENTE toda vez que o Windows for iniciado.")
        print("\n🚀 Iniciando a sincronização em segundo plano agora...")
        
        # Inicia o processo em segundo plano agora mesmo usando pythonw
        subprocess.Popen([pythonw_exe, script_path, "--loop", "30"], cwd=script_dir)
        print("✅ Sincronização em segundo plano iniciada com sucesso!")
        print(f"   Você pode conferir os logs em: {os.path.join(script_dir, 'catraca_sync.log')}")
        
    except Exception as e:
        print(f"❌ Erro ao configurar a sincronização automática: {e}")
        sys.exit(1)


def desinstalar_no_windows():
    """Remove o atalho da pasta Inicializar do Windows."""
    if sys.platform != "win32":
        print("❌ Esta desinstalação é exclusiva para sistemas Windows.")
        sys.exit(1)
        
    try:
        startup_folder = os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
        shortcut_path = os.path.join(startup_folder, "Sincronizacao_Catraca.lnk")
        vbs_shortcut_path = os.path.join(startup_folder, "Sincronizacao_Catraca.vbs") # Caso exista o antigo
        
        removed = False
        if os.path.exists(shortcut_path):
            os.remove(shortcut_path)
            print(f"🗑️ Atalho '{shortcut_path}' removido.")
            removed = True
        if os.path.exists(vbs_shortcut_path):
            os.remove(vbs_shortcut_path)
            print(f"🗑️ Script antigo '{vbs_shortcut_path}' removido.")
            removed = True
            
        if removed:
            print("✅ Desinstalação concluída com sucesso! A sincronização não iniciará mais com o Windows.")
        else:
            print("ℹ️ Nenhuma configuração de sincronização automática encontrada para remover.")
            
    except Exception as e:
        print(f"❌ Erro ao desinstalar: {e}")
        sys.exit(1)


def main():
    import sys
    import time
    
    if "--install" in sys.argv:
        instalar_no_windows()
        sys.exit(0)
    elif "--uninstall" in sys.argv:
        desinstalar_no_windows()
        sys.exit(0)
        
    loop_mode = "--loop" in sys.argv or "--daemon" in sys.argv or "-d" in sys.argv
    intervalo = 30
    
    for arg in sys.argv:
        if arg.startswith("--intervalo="):
            try:
                intervalo = int(arg.split("=")[1])
            except:
                pass

    if loop_mode:
        print(f"\n  🚀 MODO AUTOMÁTICO CONTINUO ATIVO!")
        print(f"  O script rodará continuamente em segundo plano a cada {intervalo}s.")
        print("  Leitura incremental ativa: apenas novos registros serão lidos e gravados.")
        print("  Pressione Ctrl+C para parar.\n")
        while True:
            try:
                rodar_um_ciclo()
            except Exception as e:
                print(f"  ⚠️ Erro no ciclo automático: {e}")
            time.sleep(intervalo)
    else:
        rodar_um_ciclo()


if __name__ == "__main__":
    main()

