import re
import os

def refactor_file(path, data_keys, has_setters=False):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Remove useQuery imports
    content = re.sub(r"import\s*\{\s*useQuery[^}]*\}\s*from\s*'@tanstack/react-query'\n", "", content)

    # 2. Replaces useQuery calls with useData
    # Look for: const { data: alunos = [], isLoading } = useQuery...
    # We will just strip useQuery calls and leave them handling using useData.
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

refactor_file("app/(app)/crm/agendamentos/page.tsx", ["agendamentos", "leads"])
