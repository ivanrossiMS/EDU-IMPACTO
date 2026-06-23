import os
from supabase import create_client

def load_env():
    env = {}
    with open(".env.local") as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                env[k] = v.strip('"\'')
    return env

env = load_env()
url = env.get("NEXT_PUBLIC_SUPABASE_URL")
key = env.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table('portaria_dispositivos').update({'porta': 80}).eq('ip', '192.168.1.75').execute()
print(res.data)
