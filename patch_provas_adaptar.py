import os

file_path = "app/(app)/provas/adaptar/[id]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replacements
content = content.replace("from('simulados')", "from('provas')")
content = content.replace("from('simulados_requisicoes')", "from('provas_requisicoes')")
content = content.replace("from('simulados_questoes')", "from('provas_questoes')")
content = content.replace("from('simulados_alternativas')", "from('provas_alternativas')")

content = content.replace("id_simulado", "id_prova")

# Object properties for related data
content = content.replace("simulados_alternativas", "provas_alternativas")

# Routing
content = content.replace("router.push('/simulados/lista')", "router.push('/provas/lista')")

# Component name
content = content.replace("AdaptarSimuladoPage", "AdaptarProvaPage")

# Add isProva flag to the state payload so the PageContent knows it's a prova
content = content.replace("setSimulado({ ...simData, titulo: `${simData.titulo} (Adaptado)` })", "setSimulado({ ...simData, isProva: true, titulo: `${simData.titulo} (Adaptado)` })")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied successfully.")
