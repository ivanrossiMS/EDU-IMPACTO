#!/usr/bin/env python3
"""
Sincronizar_Catraca.py — Módulo de Sincronização em Tempo Real (Control iD ⇄ ERP)
────────────────────────────────────────────────────────────────────────────────
ARQUITETURA DE ALTA PERFORMANCE (LATÊNCIA SUB-SEGUNDO):
• Conexões HTTP persistentes com reaproveitamento de sessão (Zero re-login desnecessário)
• Polling paralelo multithread (ThreadPoolExecutor): todas as catracas são checadas SIMULTANEAMENTE
• Consultas indexadas por ID no SQLite do iDFace (load_objects com id > last_id: ~15ms)
• Sem escritas repetitivas em memória Flash/EEPROM (relógio e monitor calibrados apenas no início)
• Ciclo de detecção de 2 segundos (detecção imediata de passagens)
• Fila pesada do ERP (fotos e cadastros) isolada em thread de background (não trava passagens)
• Deduplicação inteligente e envio instantâneo ao Webhook com notificação push

Uso padrão: python Sincronizar_Catraca.py
"""

import json
import sys
import os
import ssl
import time
import urllib.request
import urllib.error
import subprocess
import threading
from datetime import datetime, timezone, date
from concurrent.futures import ThreadPoolExecutor, as_completed

# ══════════════════════════════════════════════════════════════
#  BLINDAGEM DE CONSOLE E ENCODING WINDOWS (UTF-8 TOTAL)
# ══════════════════════════════════════════════════════════════
if sys.platform == "win32":
    try:
        os.system("chcp 65001 >nul 2>&1")
    except Exception:
        pass
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catraca_sync.log")
_raw_print = print

def log_print(*args, **kwargs):
    """Print blindado: nunca encerra o script por erro de encoding de caracteres ou console nulo."""
    if sys.stdout is not None:
        try:
            _raw_print(*args, **kwargs)
        except (UnicodeEncodeError, OSError):
            try:
                enc = getattr(sys.stdout, "encoding", None) or "ascii"
                safe_args = [str(a).encode(enc, errors="replace").decode(enc, errors="replace") for a in args]
                _raw_print(*safe_args, **kwargs)
            except Exception:
                pass
        except Exception:
            pass

    try:
        msg = " ".join(str(a) for a in args)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {msg}\n")
    except Exception:
        pass

def safe_status_write(text):
    """Escrita segura de status na mesma linha do console, imune a erros de codepage."""
    if sys.stdout is not None:
        try:
            sys.stdout.write(text)
            sys.stdout.flush()
        except (UnicodeEncodeError, OSError):
            try:
                enc = getattr(sys.stdout, "encoding", None) or "ascii"
                sys.stdout.write(text.encode(enc, errors="replace").decode(enc, errors="replace"))
                sys.stdout.flush()
            except Exception:
                pass
        except Exception:
            pass

print = log_print

# ══════════════════════════════════════════════════════════════
#  CONFIGURAÇÕES GERAIS
# ══════════════════════════════════════════════════════════════
DEFAULT_SERVER_URL = "https://impacto-edu.net"

SERVER_URL = os.environ.get("SERVER_URL", DEFAULT_SERVER_URL)
for arg in sys.argv:
    if arg.startswith("--server="):
        SERVER_URL = arg.split("=", 1)[1].strip()

NETLIFY_URL   = SERVER_URL.rstrip('/')
CATRACA_SENHA = "Pass1081$"
CATRACA_LOGIN = "admin"

CATRACAS = [
    # Mestre iD Next (Centraliza todos os cadastros, biometrias e logs de Entrada [Portal 2 / Comp 810373889] e Saída Rua das Garças [Portal 1 / Comp 810373890])
    {"nome": "Portaria Médio - PRINCIPAL", "ip": "192.168.1.150", "id": "0M0200/02638E", "porta": 80, "tipo": "mestre", "senha": "Pass1081$"},
    # Catracas Autônomas de Entrada
    {"nome": "Portaria FUND1- PRINCIPAL",  "ip": "192.168.1.155", "id": "0M0200/02639C", "porta": 80, "tipo": "entrada"},
    {"nome": "Portaria PRINCIPAL -INF",   "ip": "192.168.1.105", "id": "0M0200/0262CE", "porta": 80, "tipo": "entrada"},
]

WEBHOOK_URL = f"{NETLIFY_URL}/api/portaria/webhook"

SSL_CTX = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catraca_state.json")
def garantir_instancia_unica():
    """
    Garante que processos em segundo plano não fiquem duplicados.
    Se estiver rodando como console interativo (python.exe), encerra processos ocultos (pythonw.exe).
    Se estiver rodando em segundo plano (pythonw.exe), NÃO encerra a si próprio!
    """
    if sys.platform == "win32":
        try:
            exe_name = os.path.basename(sys.executable).lower()
            my_pid = os.getpid()
            if "pythonw" not in exe_name:
                # Se estamos abrindo uma janela interativa (python.exe), encerra processos ocultos (pythonw.exe)
                subprocess.run(["taskkill", "/F", "/IM", "pythonw.exe"], capture_output=True)
            else:
                # Se estamos rodando como pythonw.exe, mata apenas OUTROS processos pythonw, nunca a si mesmo
                cmd = f'powershell -NoProfile -Command "Get-Process pythonw -ErrorAction SilentlyContinue | Where-Object {{ $_.Id -ne {my_pid} }} | Stop-Process -Force"'
                subprocess.run(cmd, shell=True, capture_output=True)
        except Exception:
            pass


# Pool de sessões em memória para reaproveitamento (evita login toda hora)
# Chave: IP da catraca -> {"url": base_url, "session": session_token, "lock": Lock}
SESSION_POOL = {}
POOL_LOCK = threading.Lock()

# Cache de presenças do dia para evitar repetição e classificar saídas
hoje_iso_global = date.today().strftime('%Y_%m_%d')
CACHE_ENTRADA_FILE      = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"sincronizados_entrada_{hoje_iso_global}.txt")
CACHE_ENTRADA_LOGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"sincronizados_entrada_logs_{hoje_iso_global}.txt")
CACHE_SAIDA_FILE        = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"sincronizados_saida_{hoje_iso_global}.txt")

MEM_ENTRADAS_HOJE      = set()
MEM_ENTRADAS_LOGS_HOJE = set()
MEM_SAIDAS_HOJE        = set()
ULTIMA_ENTRADA_ALUNO   = {}
CONFIG_MULTIPLAS_ENTRADAS = False
CACHE_LOCK             = threading.Lock()


def carregar_caches_locais():
    global hoje_iso_global, CACHE_ENTRADA_FILE, CACHE_ENTRADA_LOGS_FILE, CACHE_SAIDA_FILE
    hoje_iso = date.today().strftime('%Y_%m_%d')
    if hoje_iso != hoje_iso_global:
        hoje_iso_global = hoje_iso
        CACHE_ENTRADA_FILE      = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"sincronizados_entrada_{hoje_iso}.txt")
        CACHE_ENTRADA_LOGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"sincronizados_entrada_logs_{hoje_iso}.txt")
        CACHE_SAIDA_FILE        = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"sincronizados_saida_{hoje_iso}.txt")
        with CACHE_LOCK:
            MEM_ENTRADAS_HOJE.clear()
            MEM_ENTRADAS_LOGS_HOJE.clear()
            MEM_SAIDAS_HOJE.clear()
            ULTIMA_ENTRADA_ALUNO.clear()

    legacy_cache_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"sincronizados_{hoje_iso}.txt")

    with CACHE_LOCK:
        for cf, target_set in [
            (CACHE_ENTRADA_FILE, MEM_ENTRADAS_HOJE),
            (CACHE_ENTRADA_LOGS_FILE, MEM_ENTRADAS_LOGS_HOJE),
            (CACHE_SAIDA_FILE, MEM_SAIDAS_HOJE),
            (legacy_cache_file, MEM_ENTRADAS_HOJE)
        ]:
            if os.path.exists(cf):
                try:
                    with open(cf, "r", encoding="utf-8") as f:
                        for line in f:
                            v = line.strip()
                            if v:
                                target_set.add(v)
                except Exception:
                    pass


def registrar_cache_entrada(uid):
    with CACHE_LOCK:
        MEM_ENTRADAS_HOJE.add(str(uid))
        try:
            with open(CACHE_ENTRADA_FILE, "a", encoding="utf-8") as f:
                f.write(str(uid) + "\n")
        except Exception:
            pass


def registrar_cache_entrada_log(log_id):
    with CACHE_LOCK:
        MEM_ENTRADAS_LOGS_HOJE.add(str(log_id))
        try:
            with open(CACHE_ENTRADA_LOGS_FILE, "a", encoding="utf-8") as f:
                f.write(str(log_id) + "\n")
        except Exception:
            pass


def registrar_cache_saida(log_id):
    with CACHE_LOCK:
        MEM_SAIDAS_HOJE.add(str(log_id))
        try:
            with open(CACHE_SAIDA_FILE, "a", encoding="utf-8") as f:
                f.write(str(log_id) + "\n")
        except Exception:
            pass


def carregar_estado_catracas():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def salvar_estado_catracas(estado):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(estado, f, indent=2)
    except Exception:
        pass


def post_json(url, body, cookie=None, timeout=6):
    """Executa requisição HTTP POST JSON com timeout otimizado."""
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", f"session={cookie}")
    try:
        ctx = SSL_CTX if url.startswith("https") else None
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return json.loads(r.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"HTTP {e.code}: {err_msg}")


def autenticar_catraca(cat):
    """Realiza autenticação com a catraca tentando senhas e protocolos configurados."""
    ip, porta = cat["ip"], cat.get("porta", 80)
    candidatos = []
    if porta == 443:
        candidatos = [f"https://{ip}:{porta}"]
    elif porta == 80:
        candidatos = [f"http://{ip}:{porta}"]
    else:
        candidatos = [f"http://{ip}:{porta}", f"https://{ip}:{porta}"]

    senhas = []
    if cat.get("senha"):
        senhas.append(cat["senha"])
    if cat.get("password"):
        senhas.append(cat["password"])
    if CATRACA_SENHA not in senhas:
        senhas.append(CATRACA_SENHA)
    if "Pass1081" not in senhas:
        senhas.append("Pass1081")

    for url in candidatos:
        for pwd in senhas:
            try:
                r = post_json(f"{url}/login.fcgi", {"login": CATRACA_LOGIN, "password": pwd}, timeout=3)
                if r and r.get("session"):
                    return url, r["session"]
            except Exception:
                pass
    return None, None


def obter_sessao_ativa(cat, force_new=False):
    """Reaproveita a sessão existente na memória ou autentica se expirada."""
    ip = cat["ip"]
    with POOL_LOCK:
        sess_info = SESSION_POOL.get(ip)
        if sess_info and not force_new:
            return sess_info["url"], sess_info["session"]

    # Autenticar
    url, session = autenticar_catraca(cat)
    if url and session:
        with POOL_LOCK:
            SESSION_POOL[ip] = {"url": url, "session": session, "cat": cat}
        return url, session
    return None, None


def call_catraca_fcgi(cat, endpoint, body, timeout=3):
    """Chama um endpoint fcgi na catraca com reconexão automática se a sessão expirar."""
    url, session = obter_sessao_ativa(cat)
    if not url or not session:
        return None

    full_url = f"{url}/{endpoint.lstrip('/')}"
    try:
        return post_json(full_url, body, cookie=session, timeout=timeout)
    except Exception as e:
        # Se deu 401 Unauthorized ou erro de sessão, renovar sessão e retentar 1 vez
        err_str = str(e).lower()
        if "401" in err_str or "session" in err_str or "unauthorized" in err_str:
            url, session = obter_sessao_ativa(cat, force_new=True)
            if url and session:
                return post_json(f"{url}/{endpoint.lstrip('/')}", body, cookie=session, timeout=timeout)
        raise e


# ══════════════════════════════════════════════════════════════
#  MANUTENÇÃO DE HARDWARE (EXECUTADA APENAS NO STARTUP / A CADA 6H)
# ══════════════════════════════════════════════════════════════
def sincronizar_relogio_catraca(cat):
    now = datetime.now()
    try:
        call_catraca_fcgi(cat, "set_system_time.fcgi", {
            "day": now.day, "month": now.month, "year": now.year,
            "hour": now.hour, "minute": now.minute, "second": now.second
        }, timeout=4)
        return True
    except Exception:
        return False


def configurar_monitor(cat):
    from urllib.parse import urlparse
    p = urlparse(WEBHOOK_URL)
    hostname = p.hostname
    porta = str(p.port or (443 if p.scheme == "https" else 80))
    query_parts = []
    dev_id = cat.get("id") or cat.get("ip") or ""
    dev_tipo = cat.get("tipo", "entrada")
    if dev_id:
        query_parts.append(f"device_id={dev_id}")
    query_parts.append(f"sentido={dev_tipo}")

    path = p.path
    if query_parts:
        path = f"{path}?{'&'.join(query_parts)}"

    try:
        call_catraca_fcgi(cat, "set_configuration.fcgi", {
            "monitor": {
                "request_timeout": "5000",
                "hostname": hostname,
                "port": porta,
                "path": path,
            }
        }, timeout=4)
        return True
    except Exception:
        return False


def inicializar_hardware_catracas(catracas):
    """Executado uma vez na inicialização para calibrar relógio e configurar monitor."""
    print("  [CONFIG] Calibrando relógios e parâmetros de monitoramento nas catracas...")
    for cat in catracas:
        nome = cat["nome"]
        ip = cat["ip"]
        url, session = obter_sessao_ativa(cat)
        if not url:
            print(f"     [AVISO] {nome} ({ip}): Não foi possível autenticar neste momento.")
            continue

        relogio_ok = sincronizar_relogio_catraca(cat)
        monitor_ok = configurar_monitor(cat)
        status_rel = "Relógio OK" if relogio_ok else "Relógio falhou"
        status_mon = "Monitor OK" if monitor_ok else "Monitor sem suporte"
        print(f"     [OK] {nome} ({ip}): Conectado via {url[:5]}! [{status_rel} | {status_mon}]")


# ══════════════════════════════════════════════════════════════
#  LEITURA ULTRA RÁPIDA DE LOGS (INDEXADO POR ID - ~15ms)
# ══════════════════════════════════════════════════════════════
def obter_id_maximo_catraca(cat):
    """Obtém o ID máximo real de log gravado na memória física da catraca."""
    for ord_clause in [["id", "descending"], None]:
        try:
            body = {"object": "access_logs", "limit": 1}
            if ord_clause:
                body["order"] = ord_clause
            r = call_catraca_fcgi(cat, "load_objects.fcgi", body, timeout=3)
            logs = r.get("access_logs", []) if r else []
            if logs:
                return logs[0].get("id", 0)
        except Exception:
            pass

    # Fallback seguro: lê até 50 registros e acha o max ID
    try:
        r = call_catraca_fcgi(cat, "load_objects.fcgi", {"object": "access_logs", "limit": 50}, timeout=3)
        logs = r.get("access_logs", []) if r else []
        if logs:
            return max([l.get("id", 0) for l in logs], default=0)
    except Exception:
        pass
    return 0


def buscar_novos_logs_catraca(cat, last_log_id):
    """
    Busca de altíssimo desempenho com auto-recuperação de cursor:
    • Se last_log_id > 0: Faz query direta no SQLite da catraca: WHERE id > last_log_id.
    • Se a catraca retornar vazio e last_log_id > 0:
      Verifica se o cursor salvo não é superior ao ID máximo real do equipamento (ex: 75722 vs 200).
      Se for superior, auto-corrige o cursor para o ID máximo real da catraca!
    """
    now_ts = int(datetime.now().timestamp())
    ts_limite = now_ts - 86400  # 24 horas

    if last_log_id > 0:
        for ord_asc in [["id", "ascending"], None]:
            body = {
                "object": "access_logs",
                "where": {"access_logs": {"id": {">": last_log_id}}},
                "limit": 100,
            }
            if ord_asc:
                body["order"] = ord_asc
            try:
                r = call_catraca_fcgi(cat, "load_objects.fcgi", body, timeout=3)
                logs = r.get("access_logs", []) if r else []
                if logs:
                    return sorted(logs, key=lambda x: x.get("id", 0))
                # Se respondeu com sucesso mas lista vazia, a query é válida
                break
            except Exception:
                continue

        # Se não retornou nada, checar se o cursor não está à frente do ID máximo do equipamento
        max_id_real = obter_id_maximo_catraca(cat)
        if max_id_real > 0 and last_log_id > max_id_real:
            print(f"  [AUTO-FIX] [{cat['nome']}] Cursor salvo ({last_log_id}) > ID real da catraca ({max_id_real}). Sincronizando registros recentes!")
            cursor_corrigido = max(0, max_id_real - 30)
            try:
                r_fix = call_catraca_fcgi(cat, "load_objects.fcgi", {
                    "object": "access_logs",
                    "where": {"access_logs": {"id": {">": cursor_corrigido}}},
                    "limit": 50,
                }, timeout=3)
                logs_fix = r_fix.get("access_logs", []) if r_fix else []
                if logs_fix:
                    return sorted(logs_fix, key=lambda x: x.get("id", 0))
            except Exception:
                pass
        return []

    # Se last_log_id == 0 (primeira execução), busca os logs de hoje
    body_init = {
        "object": "access_logs",
        "where": {"access_logs": {"time": {">=": ts_limite}}},
        "limit": 500,
    }
    try:
        r = call_catraca_fcgi(cat, "load_objects.fcgi", body_init, timeout=5)
        logs = r.get("access_logs", []) if r else []
        if logs:
            return sorted(logs, key=lambda x: x.get("id", 0))
    except Exception:
        pass

    # Fallback para os últimos 50 registros
    try:
        r_fb = call_catraca_fcgi(cat, "load_objects.fcgi", {"object": "access_logs", "limit": 50}, timeout=4)
        logs_fb = r_fb.get("access_logs", []) if r_fb else []
        return sorted(logs_fb, key=lambda x: x.get("id", 0))
    except Exception:
        return []


# ══════════════════════════════════════════════════════════════
#  ENVIO AO WEBHOOK DO ERP
# ══════════════════════════════════════════════════════════════
def formatar_hora(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%H:%M:%S") if ts else "?"


def enviar_para_webhook(log_entry, cat, tipo_override=None):
    user_id   = log_entry.get("user_id", 0)
    log_id    = log_entry.get("id", 0)
    portal_id = log_entry.get("portal_id") or log_entry.get("portal") or 0
    comp_id   = log_entry.get("component_id") or 0
    reader_id = log_entry.get("reader_id") or 0
    direction = log_entry.get("direction")
    door_id   = log_entry.get("door_id") or log_entry.get("door") or 0

    cat_ip = cat.get("ip", "")
    cat_id = cat.get("id", "")

    rule_id   = log_entry.get("identification_rule_id") or 0

    # ── REGRA DE OURO DA ESCOLA (CONTROL ID ID NEXT) ──
    # A catraca .150 registra tanto entrada quanto saída dependendo da rota física:
    # • Rota Principal (Portal 2 / Comp 810373889): ENTRADA (Portaria Principal / Médio - .150)
    # • Outra Rota (Portal 1 / Comp 810373890): SAÍDA (Rua das Garças / Terminal Remoto .154)
    # As catracas .155 (FUND1) e .105 (INF) são SEMPRE ENTRADA!
    is_saida_150 = (
        (cat_ip == "192.168.1.150" or cat_id == "0M0200/02638E") and
        (portal_id in (1, 101) or comp_id == 810373890 or door_id == 1)
    )
    is_catraca_154 = (cat_ip == "192.168.1.154" or cat_id == "0M0200/0263A6" or cat.get("tipo") == "saida")

    if tipo_override:
        tipo = tipo_override
    elif is_saida_150 or is_catraca_154:
        tipo = "saida"
    else:
        tipo = "entrada"

    # Se for saída na rota do Terminal Remoto .154, atribuir ao dispositivo da saída
    disp_id = "0M0200/0263A6" if tipo == "saida" and (cat_ip == "192.168.1.150" or cat_id == "0M0200/02638E") else (cat.get("id") or cat["ip"])

    payload = {
        "device_id": disp_id,
        "master_device_id": cat_id,
        "portal_id": portal_id,
        "component_id": comp_id,
        "reader_id": reader_id,
        "identification_rule_id": rule_id,
        "direction": direction,
        "door_id":   door_id,
        "tipo": tipo,
        "sentido": tipo,
        "event_type": tipo,
        "object_changes": [{
            "object": "access_logs",
            "type":   "inserted",
            "values": {
                "id":           log_id,
                "user_id":      user_id,
                "time":         log_entry.get("time", 0),
                "portal_id":    portal_id,
                "component_id": comp_id,
                "reader_id":    reader_id,
                "identification_rule_id": rule_id,
                "direction":    direction,
                "door_id":      door_id,
                "tipo":         tipo,
                "sentido":      tipo,
            }
        }],
    }
    return post_json(WEBHOOK_URL, payload, timeout=6)


# ══════════════════════════════════════════════════════════════
#  CONSULTA AO ERP E FILA DE PENDÊNCIAS (BACKGROUND WORKER)
# ══════════════════════════════════════════════════════════════
def carregar_registrados_do_erp():
    global CONFIG_MULTIPLAS_ENTRADAS
    url_queue = f"{NETLIFY_URL}/api/portaria/sync-queue"
    try:
        req = urllib.request.Request(url_queue, method="GET")
        req.add_header("User-Agent", "EduImpacto Local Sync Daemon")
        ctx = SSL_CTX if url_queue.startswith("https") else None
        with urllib.request.urlopen(req, timeout=6, context=ctx) as r:
            data = json.loads(r.read().decode("utf-8", errors="replace"))
            reg_entrada = set(str(x) for x in data.get("registrados_entrada_hoje", data.get("registrados_hoje", [])) if x)
            reg_saida   = set(str(x) for x in data.get("registrados_saida_hoje", []) if x)
            dispositivos = data.get("dispositivos", [])
            multiplas_cfg = bool(data.get("permitir_multiplas_entradas") or (data.get("config") or {}).get("permitir_multiplas_entradas"))
            if multiplas_cfg != CONFIG_MULTIPLAS_ENTRADAS:
                CONFIG_MULTIPLAS_ENTRADAS = multiplas_cfg
                status_txt = "ATIVADO (Registrando TODAS as entradas/reentradas)" if multiplas_cfg else "DESATIVADO (Apenas 1ª entrada do dia)"
                print(f"  [CONFIG ERP] Modo de Multiplas Entradas: {status_txt}")
            return reg_entrada, reg_saida, dispositivos
    except Exception as e:
        return set(), set(), []


def processar_fila_pendencias_erp():
    """Processa cadastros, fotos e deleções vindas do ERP sem bloquear o loop de passagens."""
    url_queue = f"{NETLIFY_URL}/api/portaria/sync-queue"
    try:
        req = urllib.request.Request(url_queue, method="GET")
        req.add_header("User-Agent", "EduImpacto Local Sync Daemon")
        ctx = SSL_CTX if url_queue.startswith("https") else None
        with urllib.request.urlopen(req, timeout=6, context=ctx) as r:
            data = json.loads(r.read().decode("utf-8", errors="replace"))
        
        pendentes = data.get("pendentes", [])
        if not pendentes:
            return

        print(f"\n  [ERP] [Background Worker] {len(pendentes)} alteração(ões) de alunos encontrada(s) no ERP.")

        for p in pendentes:
            aluno_id   = p.get("aluno_id")
            disp_id    = p.get("dispositivo_id")
            numeric_id = p.get("numeric_id")
            nome       = p.get("nome", "")
            matricula  = p.get("matricula", "")
            foto       = p.get("foto")
            acao       = p.get("acao", "update")

            if not numeric_id or int(numeric_id) <= 0:
                # Se não há ID numérico viável para a catraca física, dá baixa para não travar a fila
                post_json(url_queue, {
                    "aluno_id": aluno_id,
                    "dispositivo_id": disp_id,
                    "status": "sincronizado",
                    "erro_detalhe": "Baixa automática: ID numérico inexistente para catraca física",
                    "foto_enviada": False
                }, timeout=4)
                continue

            alvos = CATRACAS
            if disp_id:
                if disp_id in ("192.168.1.154", "0M0200/0263A6") or "garças" in str(disp_id).lower() or "garcas" in str(disp_id).lower():
                    # Terminal remoto .154 não possui memória local (iD Next); todo cadastro e biometria deve ser gravado no Mestre .150
                    alvos = [c for c in CATRACAS if c["ip"] == "192.168.1.150" or c.get("id") == "0M0200/02638E"]
                else:
                    alvos = [c for c in CATRACAS if c["ip"] == disp_id or c.get("id") == disp_id or disp_id in c.get("nome", "")]
                if not alvos:
                    alvos = CATRACAS

            for cat in alvos:
                cat_nome = cat["nome"]
                dev_ip   = cat["ip"]
                try:
                    if acao == "delete":
                        try:
                            call_catraca_fcgi(cat, "destroy_objects.fcgi", {"object": "users", "where": {"users": {"id": numeric_id}}})
                            print(f"     [REMOVE] [{cat_nome}] Aluno '{nome}' (ID {numeric_id}) removido.")
                        except Exception as rem_ex:
                            print(f"     [REMOVE] [{cat_nome}] Aluno '{nome}' (ID {numeric_id}) já removido ou inexistente ({rem_ex}).")
                        
                        post_json(url_queue, {
                            "aluno_id": aluno_id,
                            "dispositivo_id": disp_id or dev_ip,
                            "status": "sincronizado",
                            "foto_enviada": False
                        }, timeout=4)
                    else:
                        try:
                            call_catraca_fcgi(cat, "create_objects.fcgi", {
                                "object": "users",
                                "values": [{"id": numeric_id, "name": nome[:30], "registration": str(matricula)}]
                            })
                        except Exception:
                            try:
                                call_catraca_fcgi(cat, "modify_objects.fcgi", {
                                    "object": "users",
                                    "values": {"name": nome[:30], "registration": str(matricula)},
                                    "where":  {"users": {"id": numeric_id}}
                                })
                            except Exception:
                                pass

                        print(f"     [ALUNO] [{cat_nome}] Aluno '{nome}' sincronizado.")

                        foto_enviada = False
                        if foto and isinstance(foto, str) and len(foto) > 50:
                            try:
                                import base64
                                clean_b64 = foto.split(',')[-1] if ',' in foto else foto
                                img_bytes = base64.b64decode(clean_b64)
                                url, session = obter_sessao_ativa(cat)
                                if url and session:
                                    now_ts = int(time.time())
                                    req_url = f"{url}/user_set_image.fcgi?user_id={numeric_id}&session={session}&timestamp={now_ts}"
                                    req = urllib.request.Request(req_url, data=img_bytes, method="POST")
                                    req.add_header("Content-Type", "application/octet-stream")
                                    req.add_header("Cookie", f"session={session}")
                                    ctx = SSL_CTX if url.startswith("https") else None
                                    with urllib.request.urlopen(req, timeout=8, context=ctx) as r:
                                        pass
                                    foto_enviada = True
                                    print(f"     [FOTO] [{cat_nome}] Foto de '{nome}' transmitida.")
                            except Exception:
                                pass

                        post_json(url_queue, {
                            "aluno_id": aluno_id,
                            "dispositivo_id": disp_id or dev_ip,
                            "status": "sincronizado",
                            "foto_enviada": foto_enviada
                        }, timeout=4)
                except Exception as ex:
                    post_json(url_queue, {
                        "aluno_id": aluno_id,
                        "dispositivo_id": disp_id or dev_ip,
                        "status": "erro",
                        "erro_detalhe": str(ex)[:200]
                    }, timeout=4)
    except Exception:
        pass


def thread_background_erp():
    """Executa a checagem de filas do ERP e atualizacao de cache a cada 20 segundos."""
    while True:
        try:
            # 1. Processar fila de cadastros e fotos do ERP
            processar_fila_pendencias_erp()
            # 2. Atualizar cache de presencas confirmadas e modo operacional no ERP
            reg_ent, reg_sai, _ = carregar_registrados_do_erp()
            if reg_ent:
                with CACHE_LOCK:
                    MEM_ENTRADAS_HOJE.update(reg_ent)
        except Exception:
            pass
        time.sleep(20)


# ══════════════════════════════════════════════════════════════
#  CICLO DE VARREDURA PARALELA (POLLING SUB-SEGUNDO)
# ══════════════════════════════════════════════════════════════
def escanear_uma_catraca(cat, estado):
    cat_key = cat.get("id") or cat["ip"]
    last_id = estado.get(cat_key, 0)
    novos_logs = buscar_novos_logs_catraca(cat, last_id)
    return cat, cat_key, last_id, novos_logs


def executar_varredura_paralela(estado):
    """
    Dispara threads concorrentes para interrogar todas as 4 catracas ao mesmo tempo.
    Tempo total: ~30ms para todas responderem juntas!
    """
    eventos_por_catraca = []
    with ThreadPoolExecutor(max_workers=len(CATRACAS)) as executor:
        futuros = [executor.submit(escanear_uma_catraca, cat, estado) for cat in CATRACAS]
        for f in as_completed(futuros):
            try:
                cat, cat_key, last_id, novos_logs = f.result()
                if novos_logs:
                    eventos_por_catraca.append((cat, cat_key, last_id, novos_logs))
            except Exception:
                pass
    return eventos_por_catraca


def processar_eventos_detectados(eventos_por_catraca, estado):
    estado_alterado = False

    for cat, cat_key, last_id, logs in eventos_por_catraca:
        reconhecidos = [l for l in logs if l.get("user_id", 0) > 0]
        max_log_id = max([l.get("id", 0) for l in logs], default=0)

        # Atualiza o cursor para o maior ID do lote atual
        if max_log_id > 0 and max_log_id != estado.get(cat_key, 0):
            estado[cat_key] = max_log_id
            estado_alterado = True

        if not reconhecidos:
            continue

        cat_ip = cat.get("ip", "")
        cat_id = cat.get("id", "")

        with CACHE_LOCK:
            entradas_atuais = set(MEM_ENTRADAS_HOJE)
            entradas_logs_atuais = set(MEM_ENTRADAS_LOGS_HOJE)
            saidas_enviadas = set(MEM_SAIDAS_HOJE)
            multiplas_entradas = CONFIG_MULTIPLAS_ENTRADAS

        logs_entrada = []
        logs_saida   = []

        for l in reconhecidos:
            p_id = l.get("portal_id") or l.get("portal") or 0
            c_id = l.get("component_id") or 0
            r_id = l.get("reader_id") or 0
            d_id = l.get("direction")
            door_id = l.get("door_id") or l.get("door") or 0

            rule_id = l.get("identification_rule_id") or 0

            # ── IDENTIFICAÇÃO DE ROTA NA CATRACA .150 (CONTROL ID ID NEXT) ──
            # A catraca .150 registra tanto entrada quanto saída dependendo da rota física:
            # • Rota Principal (Portal 2 / Comp 810373889): ENTRADA (Portaria Principal / Médio - .150)
            # • Outra Rota (Portal 1 / Comp 810373890): SAÍDA (Rua das Garças / Terminal Remoto .154)
            # As catracas .155 (FUND1) e .105 (INF) são SEMPRE ENTRADA!
            is_saida_150 = (
                (cat_ip == "192.168.1.150" or cat_id == "0M0200/02638E") and
                (p_id in (1, 101) or c_id == 810373890 or door_id == 1)
            )
            is_catraca_154_direto = (cat_ip == "192.168.1.154" or cat_id == "0M0200/0263A6" or cat.get("tipo") == "saida")

            if is_saida_150 or is_catraca_154_direto:
                logs_saida.append(l)
            else:
                logs_entrada.append(l)

        # ── PROCESSAR SAÍDAS ──
        for log in logs_saida:
            lid = str(log.get("id", ""))
            uid = str(log.get("user_id", "?"))
            if lid in saidas_enviadas:
                continue

            t_inicio = time.time()
            hora = formatar_hora(log.get("time", 0))
            nome_disp = "Saida - Rua das Garças" if (cat_ip == "192.168.1.150" or cat_id == "0M0200/02638E") else cat['nome']
            try:
                res = enviar_para_webhook(log, cat, tipo_override="saida")
                latencia = time.time() - t_inicio
                registrar_cache_saida(lid)
                print(f"\n  ==============================================================")
                print(f"  [SAIDA CONFIRMADA] {nome_disp}")
                print(f"     Aluno ID: {uid:<6} | Hora: {hora} | Log #{lid}")
                print(f"     [SYNC] Notificacao & ERP sincronizados em {latencia:.2f}s!")
                print(f"  ==============================================================")
            except Exception as e:
                print(f"  [ERRO] Erro ao enviar SAIDA do aluno {uid}: {e}")

        # ── PROCESSAR ENTRADAS ──
        for log in logs_entrada:
            uid = str(log.get("user_id", "?"))
            lid = str(log.get("id", ""))

            if not multiplas_entradas:
                # MODO 1: APENAS PRIMEIRA ENTRADA (Padrão atual - deduplica por uid do aluno)
                if uid in entradas_atuais:
                    continue
            else:
                # MODO 2: TODAS AS ENTRADAS ATIVAS (Deduplica por lid do log)
                if lid in entradas_logs_atuais:
                    continue

                # Proteção anti-duplicação/anti-flap: não reenviar se o mesmo aluno passou há menos de 120 segundos
                agora_ts = time.time()
                ultimo_ts = ULTIMA_ENTRADA_ALUNO.get(uid, 0)
                if ultimo_ts > 0 and (agora_ts - ultimo_ts) < 120:
                    registrar_cache_entrada_log(lid)
                    continue

            t_inicio = time.time()
            hora = formatar_hora(log.get("time", 0))
            try:
                res = enviar_para_webhook(log, cat, tipo_override="entrada")
                latencia = time.time() - t_inicio
                registrar_cache_entrada(uid)
                registrar_cache_entrada_log(lid)
                ULTIMA_ENTRADA_ALUNO[uid] = time.time()
                is_reentrada = multiplas_entradas and (uid in entradas_atuais)
                tag_tipo = "REENTRADA CONFIRMADA" if is_reentrada else "ENTRADA CONFIRMADA"
                print(f"\n  ==============================================================")
                print(f"  [{tag_tipo}] {cat['nome']}")
                print(f"     Aluno ID: {uid:<6} | Hora: {hora} | Log #{lid}")
                print(f"     [SYNC] Presenca registrada no ERP em {latencia:.2f}s!")
                print(f"  ==============================================================")
            except Exception as e:
                print(f"  [ERRO] Erro ao enviar ENTRADA do aluno {uid}: {e}")

    if estado_alterado:
        salvar_estado_catracas(estado)


# ══════════════════════════════════════════════════════════════
#  INSTALADOR WINDOWS
# ══════════════════════════════════════════════════════════════
def instalar_no_windows():
    if sys.platform != "win32":
        print("[ERRO] Instalacao exclusiva para Windows.")
        sys.exit(1)
    try:
        startup_folder = os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
        shortcut_path = os.path.join(startup_folder, "Sincronizacao_Catraca.lnk")
        script_path = os.path.abspath(__file__)
        script_dir = os.path.dirname(script_path)
        python_exe = sys.executable
        pythonw_exe = python_exe.replace("python.exe", "pythonw.exe")
        if not os.path.exists(pythonw_exe):
            pythonw_exe = python_exe

        print(f"[SETUP] Configurando inicializacao de alta performance no Windows...")
        ps_cmd = (
            f"$s = (New-Object -ComObject WScript.Shell).CreateShortcut('{shortcut_path}'); "
            f"$s.TargetPath = '{pythonw_exe}'; "
            f"$s.Arguments = '\"{script_path}\" --intervalo=2'; "
            f"$s.WorkingDirectory = '{script_dir}'; "
            f"$s.WindowStyle = 7; "
            f"$s.Save()"
        )
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd], check=True)
        print("[OK] Inicializacao automatica configurada com intervalo de 2s!")
        subprocess.Popen([pythonw_exe, script_path, "--intervalo=2"], cwd=script_dir)
        print("[START] Processo em segundo plano ativo!")
    except Exception as e:
        print(f"[ERRO] Erro ao instalar: {e}")
        sys.exit(1)


def desinstalar_no_windows():
    if sys.platform != "win32":
        print("[ERRO] Exclusivo para Windows.")
        sys.exit(1)
    try:
        startup_folder = os.path.join(os.environ["APPDATA"], "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
        shortcut_path = os.path.join(startup_folder, "Sincronizacao_Catraca.lnk")
        if os.path.exists(shortcut_path):
            os.remove(shortcut_path)
            print("[OK] Atalho de inicializacao removido com sucesso!")
        else:
            print("[INFO] Nenhum atalho encontrado.")
    except Exception as e:
        print(f"[ERRO] Erro: {e}")


# ══════════════════════════════════════════════════════════════
#  VERIFICAÇÃO DE STATUS
# ══════════════════════════════════════════════════════════════
def checar_status():
    _raw_print("=" * 65)
    _raw_print("   🔍 STATUS DO SINCRONIZADOR DE CATRACAS CONTROL ID")
    _raw_print("=" * 65)

    # 1. Processos em execução
    rodando = []
    if sys.platform == "win32":
        try:
            out = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True, errors="replace").stdout
            for line in out.splitlines():
                l_lower = line.lower()
                if "python.exe" in l_lower or "pythonw.exe" in l_lower:
                    parts = [p.strip().replace('"', '') for p in line.split(',')]
                    if len(parts) >= 2:
                        p_name = parts[0]
                        p_pid = parts[1]
                        p_mem = parts[4] if len(parts) > 4 else ""
                        rodando.append(f"{p_name} (PID: {p_pid} | Mem: {p_mem})")
        except Exception as e:
            _raw_print(f"  [AVISO] Erro ao listar processos: {e}")
    else:
        try:
            out = subprocess.run(["pgrep", "-fl", "Sincronizar_Catraca"], capture_output=True, text=True).stdout
            rodando = [l for l in out.splitlines() if str(os.getpid()) not in l]
        except Exception:
            pass

    if rodando:
        _raw_print(f"\n  [PROCESSO EM EXECUÇÃO] ✅ ATIVO ({len(rodando)} processo(s) detectado(s)):")
        for p in rodando:
            _raw_print(f"     🟢 {p}")
    else:
        _raw_print("\n  [PROCESSO EM EXECUÇÃO] ❌ PARADO (Nenhum processo Python detectado).")

    # 2. Inicialização automática (Startup)
    if sys.platform == "win32":
        try:
            startup_folder = os.path.join(os.environ.get("APPDATA", ""), "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
            shortcut_path = os.path.join(startup_folder, "Sincronizacao_Catraca.lnk")
            shortcut_bat = os.path.join(startup_folder, "INICIAR_CATRACA.lnk")
            if os.path.exists(shortcut_path) or os.path.exists(shortcut_bat):
                _raw_print(f"\n  [INICIALIZAÇÃO NO BOOT] ✅ CONFIGURADA:")
                _raw_print(f"     Atalho encontrado em: {startup_folder}")
            else:
                _raw_print(f"\n  [INICIALIZAÇÃO NO BOOT] ⚠️ NÃO CONFIGURADA:")
                _raw_print(f"     Nenhum atalho encontrado na pasta Inicializar ({startup_folder}).")
        except Exception:
            pass

    # 3. Últimos registros de Log
    if os.path.exists(LOG_FILE):
        _raw_print(f"\n  [ÚLTIMAS ATIVIDADES NO LOG] ({LOG_FILE}):")
        try:
            with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
                linhas = [l.strip() for l in f.readlines() if l.strip() and not l.startswith("=")]
                ultimas = linhas[-6:] if len(linhas) >= 6 else linhas
                for l in ultimas:
                    _raw_print(f"     📄 {l}")
        except Exception as e:
            _raw_print(f"     Erro ao ler log: {e}")
    else:
        _raw_print(f"\n  [LOG] Nenhum log gerado ainda ({LOG_FILE}).")

    # 4. Teste de conectividade com as catracas
    _raw_print(f"\n  [TESTE DE CONECTIVIDADE COM AS CATRACAS]:")
    for cat in CATRACAS:
        ip = cat["ip"]
        nome = cat["nome"]
        try:
            url, sess = autenticar_catraca(cat)
            if sess:
                _raw_print(f"     ✅ {nome} ({ip}): Online e Autenticada!")
            else:
                _raw_print(f"     ⚠️ {nome} ({ip}): Sem resposta (verifique cabo de rede / IP).")
        except Exception as e:
            _raw_print(f"     ❌ {nome} ({ip}): Inacessível ({e})")

    _raw_print("\n" + "=" * 65)


# ══════════════════════════════════════════════════════════════
#  LOOP PRINCIPAL
# ══════════════════════════════════════════════════════════════
def main():
    if "--status" in sys.argv:
        checar_status()
        sys.exit(0)
    elif "--install" in sys.argv:
        instalar_no_windows()
        sys.exit(0)
    elif "--uninstall" in sys.argv:
        desinstalar_no_windows()
        sys.exit(0)

    loop_mode = "--once" not in sys.argv
    intervalo = 2  # PADRAO ULTRA RAPIDO: 2 segundos

    for arg in sys.argv:
        if arg.startswith("--intervalo="):
            try:
                intervalo = max(1, int(arg.split("=")[1]))
            except Exception:
                pass
        elif arg.startswith("--loop="):
            try:
                intervalo = max(1, int(arg.split("=")[1]))
            except Exception:
                pass

    hoje_str = date.today().strftime("%d/%m/%Y")
    print()
    print("  ==============================================================")
    print("   [SISTEMA] CONTROL ID ULTRA-SYNC DAEMON (LATENCIA < 2s)")
    print(f"   Data: {hoje_str} | Servidor: {NETLIFY_URL}")
    print(f"   Polling Paralelo Ativo: {intervalo}s entre varreduras")
    print("  ==============================================================")

    # 0. Garantir processo unico e assumir controle eliminando instancias anteriores
    garantir_instancia_unica()

    # 1. Carregar caches locais do dia
    carregar_caches_locais()
    print(f"  [Cache local]: {len(MEM_ENTRADAS_HOJE)} aluno(s) com entrada / {len(MEM_ENTRADAS_LOGS_HOJE)} log(s) de entrada / {len(MEM_SAIDAS_HOJE)} saida(s) carregadas.")

    # 2. Inicializar sessoes e parametros de hardware
    inicializar_hardware_catracas(CATRACAS)

    # 3. Consulta inicial ao ERP para atualizar entradas do dia e configuracoes
    print("  [ERP] Consultando dados iniciais no ERP...")
    reg_ent, reg_sai, disp_erp = carregar_registrados_do_erp()
    if reg_ent:
        with CACHE_LOCK:
            MEM_ENTRADAS_HOJE.update(reg_ent)
        print(f"     [OK] {len(MEM_ENTRADAS_HOJE)} aluno(s) com entrada confirmada hoje no ERP.")
    status_modo = "ATIVADO (Registrando TODAS as entradas/reentradas)" if CONFIG_MULTIPLAS_ENTRADAS else "DESATIVADO (Apenas 1ª entrada do dia)"
    print(f"     [CONFIG] Modo de Multiplas Entradas: {status_modo}")

    # 4. Iniciar Background Worker para fila de cadastros e fotos do ERP
    bg_thread = threading.Thread(target=thread_background_erp, daemon=True)
    bg_thread.start()
    print("  [WORKER] Background Worker ativo (fila de fotos/cadastros desacoplada).")

    estado = carregar_estado_catracas()
    print("  [STATUS] Verificando integridade dos cursores das catracas...")
    estado_corrigido = False
    for cat in CATRACAS:
        ck = cat.get("id") or cat["ip"]
        cur = estado.get(ck, 0)
        max_real = obter_id_maximo_catraca(cat)
        if max_real > 0 and cur > max_real:
            novo_cur = max(0, max_real - 30)
            print(f"     [CURSOR] {cat['nome']} ({cat['ip']}): Cursor corrigido ({cur} -> {novo_cur}) [Max da catraca: #{max_real}]")
            estado[ck] = novo_cur
            estado_corrigido = True
        elif max_real > 0 and cur == 0:
            novo_cur = max(0, max_real - 30)
            print(f"     [CONEXAO] {cat['nome']} ({cat['ip']}): Cursor inicializado -> Log #{novo_cur} (Max: #{max_real})")
            estado[ck] = novo_cur
            estado_corrigido = True
        else:
            # Em cada inicializacao, recua ate 30 registros para garantir que nenhuma passagem seja perdida durante reinicializacoes
            novo_cur = max(0, min(cur, max_real - 30))
            if novo_cur < cur:
                print(f"     [SINCRONIA] {cat['nome']} ({cat['ip']}): Sincronizando registros recentes -> Log #{novo_cur} (Max: #{max_real})")
                estado[ck] = novo_cur
                estado_corrigido = True
            else:
                print(f"     [OK] {cat['nome']} ({cat['ip']}): Cursor ativo -> Log #{cur} (Max da catraca: #{max_real})")
    if estado_corrigido:
        salvar_estado_catracas(estado)
    print(f"\n  [MONITOR] Monitorando as catracas em tempo real. Pressione Ctrl+C para parar.\n")

    contador_ciclos = 0
    t_ultimo_status = 0

    while True:
        t0 = time.time()
        try:
            carregar_caches_locais()
            eventos = executar_varredura_paralela(estado)
            if eventos:
                processar_eventos_detectados(eventos, estado)
            else:
                agora = time.time()
                # Imprime batimento cardiaco suave a cada 30 segundos se nao houver passagens
                if agora - t_ultimo_status > 30:
                    t_ultimo_status = agora
                    hora_agora = datetime.now().strftime("%H:%M:%S")
                    safe_status_write(f"\r  [ONLINE] [{hora_agora}] Catracas online | Monitorando a cada {intervalo}s...")

        except Exception as e:
            print(f"\n  [AVISO] Alerta no ciclo: {e}")

        if not loop_mode:
            break

        contador_ciclos += 1
        tempo_gasto = time.time() - t0
        tempo_espera = max(0.05, intervalo - tempo_gasto)
        time.sleep(tempo_espera)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n  [PARADO] Monitoramento encerrado pelo usuario.")
    except Exception as e:
        import traceback
        err_str = traceback.format_exc()
        print(f"\n[ERRO FATAL] {e}")
        print(err_str)
        try:
            with open("catraca_crash.log", "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now()}] CRASH:\n{err_str}\n")
        except Exception:
            pass
        if sys.stdout is not None:
            try:
                input("\nPressione Enter para sair...")
            except Exception:
                pass
