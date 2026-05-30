import { supabaseServer } from '@/lib/supabaseServer'

export async function getResponsavelIdsForTargets(dados: any): Promise<string[]> {
  try {
    const supabase = supabaseServer
    const turmas = dados.turmas || dados.targetClasses || []
    const alunosIds = dados.alunosIds || dados.targetStudents || []
    const isTodos = turmas.includes('Todos') || turmas.includes('Toda a Escola') || turmas.includes('TODOS') || dados.destino === 'todos'

    if (isTodos) {
      const { data } = await supabase.from('aluno_responsavel').select('responsavel_id')
      if (!data) return []
      const ids = Array.from(new Set(data.map(d => d.responsavel_id).filter(Boolean)))
      return ids as string[]
    }

    let targetAlunos = new Set<string>(alunosIds)

    if (turmas.length > 0) {
      // Tentar pegar os alunos que tem a turma (por ID, código ou Nome)
      // Primeiro resolvemos o nome/id das turmas
      const { data: resolvedTurmas } = await supabase
        .from('turmas')
        .select('id, nome, codigo')
      
      const matchedTurmaIds = resolvedTurmas
        ?.filter(t => turmas.includes(t.nome) || turmas.includes(t.id) || turmas.includes(t.codigo))
        .map(t => t.id) || []

      // Se não achou na tabela de turmas, usamos os próprios nomes/ids (backward compatibility)
      const turmasBusca = Array.from(new Set([...turmas, ...matchedTurmaIds]))

      if (turmasBusca.length > 0) {
        const { data: alunosTurma } = await supabase
          .from('alunos')
          .select('id')
          .in('turma', turmasBusca)

        alunosTurma?.forEach(a => targetAlunos.add(a.id))
      }
    }

    const finalAlunosIds = Array.from(targetAlunos).map(id => id.replace('a_', '').replace('_ALU', ''))

    if (finalAlunosIds.length === 0) return []

    // Obter todos os responsaveis ligados a esses alunos
    const { data: vinculados } = await supabase
      .from('aluno_responsavel')
      .select('responsavel_id')
      .in('aluno_id', finalAlunosIds)

    if (!vinculados) return []

    const uniqueResponsaveis = Array.from(new Set(vinculados.map(v => v.responsavel_id).filter(Boolean)))
    return uniqueResponsaveis as string[]
  } catch (err) {
    console.error('Erro ao resolver targets para Push Notification:', err)
    return []
  }
}
