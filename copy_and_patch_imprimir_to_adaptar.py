import os
import re

imprimir_path = "app/(app)/provas/imprimir/[id]/page.tsx"
adaptar_path = "app/(app)/provas/adaptar/[id]/page.tsx"

with open(imprimir_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace Component Name
content = content.replace("export default function ImprimirProvaPage()", "export default function AdaptarProvaPage()")

# Replace Title
content = content.replace("<h1>Estúdio de Edição</h1>", "<h1>Estúdio de Adaptação</h1>")
content = content.replace(">Estúdio de Edição<", ">Estúdio de Adaptação<")

# Add the ' (Adaptado)' string to the titulo inside loadData
content = content.replace(
    "setProva({ ...simData, isProva: true })",
    "setProva({ ...simData, isProva: true, titulo: `${simData.titulo} (Adaptado)` })"
)

# Extract handleSaveAndPrint function
# We'll replace it entirely.
match = re.search(r"const handleSaveAndPrint = async \(\) => \{.*?\n  \}", content, re.DOTALL)
if match:
    old_func = match.group(0)
    
    new_func = """const handleSaveAndPrint = async () => {
    if (!confirm('Deseja salvar esta adaptação no banco e imprimir?')) return
    setSaving(true)

    try {
      // 1. Clone Prova
      const { data: newProva, error: simErr } = await supabase.from('provas').insert({
        titulo: prova.titulo, // This will have ' (Adaptado)' already
        data_aplicacao: prova.data_aplicacao,
        id_bimestre: prova.id_bimestre,
        status: 'rascunho',
        turmas: prova.turmas
      }).select().single()

      if (simErr) throw simErr

      // 2. Clone Requisições
      if (requisicoes.length > 0) {
        const newReqs = requisicoes.map(r => {
          const { id, created_at, updated_at, provas, simulados_disciplinas, ...restR } = r
          return {
            ...restR,
            id_prova: newProva.id
          }
        })
        const { error: rErr } = await supabase.from('provas_requisicoes').insert(newReqs)
        if (rErr) throw rErr
      }

      // 3. Clone selected Questoes and Alternativas
      const selectedList = questoes.filter(q => selectedIds.has(q.id))
      
      for (const q of selectedList) {
        const { id, created_at, updated_at, simulados_disciplinas, provas_alternativas, simulados_alternativas, ...restQ } = q
        const { data: newQ, error: qErr } = await supabase.from('provas_questoes').insert({
          ...restQ,
          id_prova: newProva.id,
          eh_adaptada: true
        }).select().single()

        if (qErr) throw qErr

        const altsToClone = q.provas_alternativas || q.simulados_alternativas || []
        if (altsToClone.length > 0) {
          const newAlts = altsToClone.map((a: any) => ({
            id_questao: newQ.id,
            letra: a.letra,
            texto: a.texto,
            eh_correta: a.eh_correta
          }))
          const { error: aErr } = await supabase.from('provas_alternativas').insert(newAlts)
          if (aErr) throw aErr
        }
      }

      // Automatically trigger print after slight delay
      setTimeout(() => {
        window.print()
        setSaving(false)
        router.push('/provas/lista')
      }, 500)

    } catch (e: any) {
      alert('Erro ao salvar adaptação: ' + e.message)
      setSaving(false)
    }
  }"""
    
    content = content.replace(old_func, new_func)

with open(adaptar_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Merged perfectly!")
