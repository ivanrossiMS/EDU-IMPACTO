#!/usr/bin/env python3
"""
diagnostico_catraca.py
─────────────────────────────────────────────────────────────────
Script de diagnóstico e inspeção da Catraca Principal Control iD.
Inspeciona os Portais (Entrada / Saída) e os últimos Access Logs
para comprovar o funcionamento do Mestre (.150) com o leitor Remoto (.154).

Uso:
  python3 diagnostico_catraca.py
  python diagnostico_catraca.py --ip=192.168.1.150
"""

import sys
import os
import json
import urllib.request
import urllib.error
import ssl
from datetime import datetime

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

IP_MESTRE = "192.168.1.150"
for arg in sys.argv:
    if arg.startswith("--ip="):
        IP_MESTRE = arg.split("=", 1)[1].strip()

SENHAS = ["Pass1081$", "Pass1081", "admin"]
LOGIN = "admin"

SSL_CTX = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

def post_json(url, body, cookie=None, timeout=6):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", f"session={cookie}")
    ctx = SSL_CTX if url.startswith("https") else None
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return json.loads(r.read())

def main():
    print()
    print("=" * 65)
    print(f"  🔍 DIAGNÓSTICO CONTROL ID — CATRACA PRINCIPAL ({IP_MESTRE})")
    print("=" * 65)

    base_url = None
    session = None
    senha_usada = None

    for proto in ["http", "https"]:
        for pwd in SENHAS:
            url = f"{proto}://{IP_MESTRE}:80" if proto == "http" else f"{proto}://{IP_MESTRE}:443"
            try:
                res = post_json(f"{url}/login.fcgi", {"login": LOGIN, "password": pwd})
                if res.get("session"):
                    base_url = url
                    session = res["session"]
                    senha_usada = pwd
                    break
            except Exception:
                pass
        if session:
            break

    if not session:
        print(f"❌ Não foi possível conectar ao IP {IP_MESTRE}.")
        print("   Verifique se este computador está conectado na mesma rede da escola.")
        sys.exit(1)

    print(f"✅ Conectado com sucesso via {base_url} (senha: {senha_usada})")

    # 1. Informações do Sistema
    try:
        sys_info = post_json(f"{base_url}/system_information.fcgi", {}, cookie=session)
        print(f"\n📌 DADOS DO EQUIPAMENTO:")
        print(f"   • Modelo:   {sys_info.get('model', 'iDFace')}")
        print(f"   • Serial:   {sys_info.get('serial', '?')}")
        print(f"   • Firmware: {sys_info.get('version', sys_info.get('firmware', '?'))}")
    except Exception as e:
        print(f"⚠️ Erro ao obter info do sistema: {e}")

    # 2. Portais Cadastrados
    print(f"\n🚪 PORTAIS DE ACESSO CONFIGURADOS (Entrada / Saída):")
    try:
        portais_res = post_json(f"{base_url}/load_objects.fcgi", {"object": "portals"}, cookie=session)
        portais = portais_res.get("portals", [])
        if portais:
            for p in portais:
                print(f"   • Portal ID {p.get('id')}: \"{p.get('name', 'Sem nome')}\"")
        else:
            print("   ℹ️ Tabela de portais retornou padrão (Portal 1 = Entrada / Portal 2 = Saída)")
    except Exception as e:
        print(f"   ⚠️ Não foi possível ler tabela portals ({e})")

    # 3. Terminais Remotos
    print(f"\n📡 TERMINAIS REMOTOS VINCULADOS A ESTE MESTRE:")
    try:
        remotos_res = post_json(f"{base_url}/load_objects.fcgi", {"object": "remote_terminals"}, cookie=session)
        remotos = remotos_res.get("remote_terminals", [])
        if remotos:
            for r in remotos:
                print(f"   • Terminal Remoto: IP {r.get('ip')} | ID: {r.get('id')} | Portal/Sentido: {r.get('portal_id', r.get('name', '?'))}")
        else:
            print("   ℹ️ Nenhum registro na tabela remote_terminals (o vínculo pode estar configurado diretamente na aba Terminais Remotos/Rede)")
    except Exception as e:
        print(f"   ℹ️ Consulta a remote_terminals: {e}")

    # 4. Últimos Logs de Acesso
    print(f"\n📋 ÚLTIMOS 10 REGISTROS DE ACESSO (access_logs):")
    print("-" * 65)
    print(f" {'ID Log':<8} | {'Aluno ID':<9} | {'Data e Hora':<19} | {'Portal':<8} | Sentido Detectado")
    print("-" * 65)

    try:
        logs_res = post_json(f"{base_url}/load_objects.fcgi", {
            "object": "access_logs",
            "limit": 10,
            "order": ["id", "descending"]
        }, cookie=session)
        logs = logs_res.get("access_logs", [])

        if not logs:
            print("   (Nenhum registro encontrado na memória recente da catraca)")
        else:
            for l in logs:
                lid = l.get("id", "?")
                uid = l.get("user_id", 0)
                ts = l.get("time", 0)
                dt = datetime.fromtimestamp(ts).strftime("%d/%m/%Y %H:%M:%S") if ts else "?"
                pid = l.get("portal_id", l.get("portal", 0))
                cid = l.get("component_id", 0)

                if pid in (2, 102) or cid == 810373890 or l.get("door_id") == 2:
                    sentido = "🚪 SAÍDA (Rua das Garças / .154)"
                elif pid in (1, 101) or cid == 810373889 or l.get("door_id") == 1 or pid == 0:
                    sentido = "🟢 ENTRADA (Portaria Principal / .150)"
                else:
                    sentido = f"ℹ️ Portal {pid}"

                print(f" {str(lid):<8} | {str(uid):<9} | {dt:<19} | {str(pid):<8} | {sentido}")

    except Exception as e:
        print(f"❌ Erro ao ler access_logs: {e}")

    print("-" * 65)
    print("✅ Diagnóstico concluído com sucesso!")
    print()

if __name__ == "__main__":
    main()
