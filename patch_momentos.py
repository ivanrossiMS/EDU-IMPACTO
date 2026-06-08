import re

file_path = '/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/app/agenda-digital/[slug]/momentos/page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add all student turmas collection logic before meusMomentos
turmas_logic = """  const todasTurmasDoAluno = useMemo(() => {
    const list = []
    if (aluno?.turma) list.push(String(aluno.turma).toLowerCase())
    if (nomeTurmaDoAluno) list.push(nomeTurmaDoAluno.toLowerCase())
    
    if (aluno?.dados?.historicoTurmas) {
      aluno.dados.historicoTurmas.forEach((ht: any) => {
        if (ht.serieTurma) {
          list.push(String(ht.serieTurma).toLowerCase())
          const tObj = turmas.find((t: any) => String(t.id) === String(ht.serieTurma) || String(t.codigo) === String(ht.serieTurma))
          if (tObj?.nome) list.push(String(tObj.nome).toLowerCase())
        }
      })
    }
    return list.filter(Boolean)
  }, [aluno, nomeTurmaDoAluno, turmas])

  // Filtrar momentos aprovados
"""

content = content.replace("  // Filtrar momentos aprovados e checar", turmas_logic + "  // Filtrar momentos aprovados e checar")

# Replace targetClasses checking logic
old_target_classes = """      // Se tiver targetClasses e a turma corresponder
      if (targetClasses.length > 0) {
        const rawTurma = String(aluno?.turma || '').toLowerCase()
        return targetClasses.some((tc: string) => {
          const tcl = tc.toLowerCase()
          if (tcl === 'todos' || tcl === 'toda a escola' || tcl === 'todas') return true
          
          // Match by class name (resolved)
          if (nomeTurmaDoAluno.toLowerCase().includes(tcl) || tcl.includes(nomeTurmaDoAluno.toLowerCase())) return true
          
          // Match by class ID
          if (rawTurma && (tcl === rawTurma || tcl.includes(rawTurma) || rawTurma.includes(tcl))) return true
          
          return false
        })
      }"""

new_target_classes = """      // Se tiver targetClasses e a turma corresponder
      if (targetClasses.length > 0) {
        return targetClasses.some((tc: string) => {
          const tcl = tc.toLowerCase()
          if (tcl === 'todos' || tcl === 'toda a escola' || tcl === 'todas') return true
          
          // Check if it matches any of the student's classes (current or historical)
          return todasTurmasDoAluno.some(minhaTurma => 
            minhaTurma.includes(tcl) || tcl.includes(minhaTurma)
          )
        })
      }"""

content = content.replace(old_target_classes, new_target_classes)

# Fix dependencies array of meusMomentos
content = content.replace(
    "}, [momentosFeed, aluno?.turma, aluno?.id, nomeTurmaDoAluno])",
    "}, [momentosFeed, aluno?.turma, aluno?.id, nomeTurmaDoAluno, todasTurmasDoAluno])"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Momentos page patched!")
