import os
import re

file_path = "app/(app)/provas/adaptar/[id]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# The original patch changed simulados_alternativas to provas_alternativas everywhere.
# We want to keep provas_alternativas ONLY in the select query and insert query table names.
# For object properties, we should keep it as simulados_alternativas.

# First, revert provas_alternativas back to simulados_alternativas everywhere
content = content.replace("provas_alternativas", "simulados_alternativas")

# Now selectively change back the table names for queries
content = content.replace("from('simulados_alternativas')", "from('provas_alternativas')")

# In the select query:
#         simulados_disciplinas(nome),
#         simulados_alternativas(*)
# We need to fetch from provas_alternativas(*) and then map it.
select_query = """        simulados_disciplinas(nome),
        simulados_alternativas(*)"""
new_select_query = """        simulados_disciplinas(nome),
        provas_alternativas(*)"""
content = content.replace(select_query, new_select_query)

# Map when iterating qData
mapping_code = """        qData.forEach((q: any) => {
          q.simulados_alternativas?.sort((a: any, b: any) => a.letra.localeCompare(b.letra))
        })"""
new_mapping_code = """        qData.forEach((q: any) => {
          if (q.provas_alternativas) {
            q.simulados_alternativas = q.provas_alternativas;
          }
          q.simulados_alternativas?.sort((a: any, b: any) => a.letra.localeCompare(b.letra))
        })"""
content = content.replace(mapping_code, new_mapping_code)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fix applied successfully.")
