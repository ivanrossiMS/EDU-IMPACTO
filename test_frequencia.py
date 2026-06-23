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
supabase = create_client(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])
data_hoje = "2026-06-23"
res = supabase.table('frequencia').select('status, id').eq('data', data_hoje).execute()

status_count = {}
for r in res.data:
    status_count[r['status']] = status_count.get(r['status'], 0) + 1

print("Total frequencias hoje:", len(res.data))
print("Por status:", status_count)
