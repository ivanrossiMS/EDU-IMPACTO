import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseServerFactory'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient()

  try {
    const DIAS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
    const todayK = DIAS_LABEL[new Date().getDay()]

    // ── Executa as 2 queries principais em paralelo (reduz latência total) ─────
    // Função auxiliar para buscar todos os registros burlando o limite de 1000 do PostgREST
    const fetchAll = async (queryBuilder: any) => {
      let allData: any[] = []
      let from = 0
      const limit = 1000
      while (true) {
        const { data, error } = await queryBuilder.range(from, from + limit - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        allData = allData.concat(data)
        if (data.length < limit) break
        from += limit
      }
      return allData
    }

    const [responsaveis, alunos] = await Promise.all([
      // 1. Fetch responsáveis restritos — apenas os campos necessários
      fetchAll(
        supabase
          .from('responsaveis')
          .select('id, nome, proibido, dias_acesso')
          .or('proibido.eq.true,dias_acesso.neq.{}')
      ),

      // 2. Fetch alunos com projeção JSONB cirúrgica
      fetchAll(
        supabase
          .from('alunos')
          .select(
            'id, nome, turma,' +
            'autorizados:dados->saude->autorizados,' +
            'responsaveisJson:dados->responsaveis'
          )
          .or('status.eq.ativo,status.eq.matriculado,status.is.null')
      ),
    ])

    // ── Monta mapa de responsáveis restritos ──────────────────────────────────
    const restritosMap = new Map<string, { id: string; nome: string; motivo: string }>()
    for (const r of responsaveis) {
      let isRestrito = false
      let motivo = ''
      if (r.proibido === true) {
        isRestrito = true
        motivo = 'Proibido'
      } else if (r.dias_acesso && r.dias_acesso.length > 0) {
        if (!r.dias_acesso.includes(todayK)) {
          isRestrito = true
          motivo = 'Dia Restrito'
        }
      }
      if (isRestrito) {
        restritosMap.set(r.id, { id: r.id, nome: r.nome, motivo })
      }
    }

    // ── Fetch links apenas para os responsáveis restritos encontrados ─────────
    const restritosIds = Array.from(restritosMap.keys())
    let links: any[] = []
    if (restritosIds.length > 0) {
      // Dividir em chunks de 200 para evitar limite de URL muito grande no PostgREST
      const chunkSize = 200
      for (let i = 0; i < restritosIds.length; i += chunkSize) {
        const chunk = restritosIds.slice(i, i + chunkSize)
        const { data: lData } = await supabase
          .from('aluno_responsavel')
          .select('aluno_id, responsavel_id, parentesco')
          .in('responsavel_id', chunk)
          .limit(20000)
        
        if (lData) {
          links.push(...lData)
        }
      }
    }

    // ── Pré-indexa links por aluno_id para O(1) lookup (evita .filter() em loop) ──
    const linksByAluno = new Map<string, typeof links>()
    for (const link of links) {
      const arr = linksByAluno.get(link.aluno_id) || []
      arr.push(link)
      linksByAluno.set(link.aluno_id, arr)
    }

    // ── Combina dados ─────────────────────────────────────────────────────────
    const studentsResult: any[] = []

    for (const aluno of alunos) {
      const restritosDoAluno: { nome: string; parentesco: string; motivo: string }[] = []

      // Check linked responsaveis (tabela aluno_responsavel)
      const alunoLinks = linksByAluno.get(String(aluno.id)) || []
      for (const l of alunoLinks) {
        const rData = restritosMap.get(l.responsavel_id)
        if (rData) {
          restritosDoAluno.push({
            nome: rData.nome,
            parentesco: l.parentesco || 'Responsável',
            motivo: rData.motivo,
          })
        }
      }

      // Check JSON autorizados (dados->saude->autorizados) — agora projetado diretamente
      const autorizados: any[] = (aluno as any).autorizados || []
      for (const aut of autorizados) {
        let isRestrito = false
        let motivo = ''
        if (aut.proibido === true) {
          isRestrito = true
          motivo = 'Proibido'
        } else if (aut.diasSemana && aut.diasSemana.length > 0) {
          if (!aut.diasSemana.includes(todayK)) {
            isRestrito = true
            motivo = 'Dia Restrito'
          }
        }
        if (isRestrito) {
          restritosDoAluno.push({
            nome: aut.nome,
            parentesco: aut.parentesco || 'Autorizado',
            motivo,
          })
        }
      }

      // Check JSON responsaveis (dados->responsaveis) — legacy/fallback — projetado diretamente
      const resps: any[] = (aluno as any).responsaveisJson || []
      for (const r of resps) {
        let isRestrito = false
        let motivo = ''
        if (r.proibido === true) {
          isRestrito = true
          motivo = 'Proibido'
        } else if (r.diasAcesso && r.diasAcesso.length > 0) {
          if (!r.diasAcesso.includes(todayK)) {
            isRestrito = true
            motivo = 'Dia Restrito'
          }
        }
        if (isRestrito) {
          restritosDoAluno.push({
            nome: r.nome,
            parentesco: r.parentesco || 'Responsável',
            motivo,
          })
        }
      }

      if (restritosDoAluno.length > 0) {
        // Deduplica por nome usando Set (mais eficiente que findIndex)
        const seen = new Set<string>()
        const uniqueRestritos = restritosDoAluno.filter(v => {
          if (seen.has(v.nome)) return false
          seen.add(v.nome)
          return true
        })

        studentsResult.push({
          id: aluno.id,
          nome: aluno.nome,
          turma: aluno.turma,
          foto: aluno.foto,
          restritos: uniqueRestritos,
        })
      }
    }

    if (studentsResult.length > 0) {
      const studentIds = studentsResult.map(s => s.id)
      const { data: photosData } = await supabase
        .from('alunos')
        .select('id, foto')
        .in('id', studentIds)
      
      const photoMap = new Map(photosData?.map(p => [p.id, p.foto]) || [])
      for (const s of studentsResult) {
        s.foto = photoMap.get(s.id) || null
      }
    }

    return NextResponse.json(
      { data: studentsResult },
      {
        headers: {
          // Cache de 5 minutos — dados de restrição mudam com baixa frequência
          // stale-while-revalidate de 10 min garante resposta instantânea em refetches
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (err: any) {
    console.error('[API portaria/restritos-hoje] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
