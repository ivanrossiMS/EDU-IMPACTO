import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { HorarioProjeto } from '@/lib/horario/types'

export const dynamic = 'force-dynamic'

const PROJECT_KEY_PREFIX = 'gerador_horario_projeto_v1_'
const PUBLIC_KEY_PREFIX = 'gerador_horario_publico_v1_'
const LATEST_PUBLIC_KEY = 'gerador_horario_publico_latest_v1'

export async function GET(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const ano = searchParams.get('ano') || String(new Date().getFullYear())
    const key = `${PROJECT_KEY_PREFIX}${ano}`

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor, updated_at')
      .eq('chave', key)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        projeto: data?.valor || null,
        updatedAt: data?.updated_at || null,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao carregar projeto de horário' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const action = body?.action || 'save'
    const supabase = getAdminClient()

    if (action === 'save') {
      const projeto = body?.projeto as HorarioProjeto | undefined
      if (!projeto || !projeto.anoLetivo) {
        return NextResponse.json({ error: 'Dados do projeto inválidos' }, { status: 400 })
      }
      const key = `${PROJECT_KEY_PREFIX}${projeto.anoLetivo}`
      const payload: HorarioProjeto = {
        ...projeto,
        atualizadoEm: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('configuracoes')
        .upsert({ chave: key, valor: payload, updated_at: new Date().toISOString() }, { onConflict: 'chave' })

      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, projeto: payload })
    }

    if (action === 'publish') {
      const projeto = body?.projeto as HorarioProjeto | undefined
      const cenarioId = String(body?.cenarioId || projeto?.cenarioAtivoId || '')
      const syncRotina = body?.syncRotina !== false

      if (!projeto || !cenarioId) {
        return NextResponse.json({ error: 'Projeto e cenário são obrigatórios para publicação' }, { status: 400 })
      }

      const cenario = (projeto.cenarios || []).find(c => c.id === cenarioId)
      if (!cenario) {
        return NextResponse.json({ error: 'Cenário não encontrado' }, { status: 404 })
      }

      const agora = new Date().toISOString()
      const updatedCenarios = projeto.cenarios.map(c => ({
        ...c,
        publicado: c.id === cenarioId,
        publicadoEm: c.id === cenarioId ? agora : c.publicadoEm,
      }))

      const updatedProjeto: HorarioProjeto = {
        ...projeto,
        publicadoCenarioId: cenarioId,
        publicadoEm: agora,
        atualizadoEm: agora,
        cenarios: updatedCenarios,
      }

      // 1. Salvar projeto atualizado
      const projKey = `${PROJECT_KEY_PREFIX}${projeto.anoLetivo}`
      const { error: saveErr } = await supabase
        .from('configuracoes')
        .upsert({ chave: projKey, valor: updatedProjeto, updated_at: agora }, { onConflict: 'chave' })
      if (saveErr) throw new Error(saveErr.message)

      // 2. Gerar snapshot público sanitizado (ZERO dados sensíveis / emails / telefones)
      const profMap = new Map(projeto.professores.map(p => [p.id, p]))
      const sedeMap = new Map(projeto.sedes.map(s => [s.id, s]))
      const modeloMap = new Map(projeto.modelosHorario.map(m => [m.id, m]))
      const ambMap = new Map(projeto.ambientes.map(a => [a.id, a]))

      const publicSnapshot = {
        projetoId: projeto.id,
        nomeProjeto: projeto.nome,
        anoLetivo: projeto.anoLetivo,
        cenarioNome: cenario.nome,
        publicadoEm: agora,
        publicadoPor: user?.user_metadata?.nome || user?.email || 'Coordenação',
        sedes: projeto.sedes.map(s => ({ id: s.id, nome: s.nome, cor: s.cor })),
        turmas: projeto.turmas
          .filter(t => t.ativa)
          .map(t => {
            const mod = modeloMap.get(t.modeloHorarioId)
            return {
              id: t.id,
              nome: t.nome,
              serie: t.serie || '',
              segmento: t.segmento || '',
              turno: t.turno,
              unidadeId: t.unidadeId,
              unidadeNome: sedeMap.get(t.unidadeId)?.nome || 'Sede Principal',
              diasAtivos: mod?.diasAtivos || [1, 2, 3, 4, 5],
              faixas: mod?.faixas || [],
            }
          }),
        professores: projeto.professores.map(p => ({
          id: p.id,
          nome: p.nome,
          apelido: p.apelido || p.nome.split(' ')[0],
          cor: p.cor,
        })),
        aulas: cenario.aulas.map(a => ({
          id: a.id,
          turmaId: a.turmaId,
          unidadeId: a.unidadeId,
          unidadeNome: sedeMap.get(a.unidadeId)?.nome || '',
          dia: a.dia,
          faixaId: a.faixaId,
          ordem: a.ordem,
          inicio: a.inicio,
          fim: a.fim,
          disciplinaId: a.disciplinaId,
          disciplinaNome: a.disciplinaNome,
          disciplinaSigla: a.disciplinaSigla,
          professoresIds: a.professoresIds,
          professoresNomes: a.professoresIds.map(id => profMap.get(id)?.nome || 'Professor'),
          ambienteNome: a.ambienteId ? ambMap.get(a.ambienteId)?.nome || a.ambienteNome || '' : a.ambienteNome || '',
          cor: a.cor,
        })),
      }

      const publicKeyByAno = `${PUBLIC_KEY_PREFIX}${projeto.anoLetivo}`
      await supabase.from('configuracoes').upsert(
        [
          { chave: publicKeyByAno, valor: publicSnapshot, updated_at: agora },
          { chave: LATEST_PUBLIC_KEY, valor: publicSnapshot, updated_at: agora },
        ],
        { onConflict: 'chave' }
      )

      // 3. Sincronizar opcionalmente com rotina_items e cfgHorariosGrade (Grade Oficial do ERP)
      let rotinaSynced = 0
      if (syncRotina) {
        const turmaIds = projeto.turmas.filter(t => t.ativa).map(t => t.id)
        if (turmaIds.length > 0) {
          // Limpar rotina anterior dessas turmas para evitar duplicatas antigas
          await supabase.from('rotina_items').delete().in('turma', turmaIds)

          const rotinaRows = cenario.aulas.map(a => ({
            id: a.id,
            turma: a.turmaId,
            dia_semana: a.dia,
            hora_inicio: a.inicio,
            hora_fim: a.fim,
            disciplina: a.disciplinaNome,
            professor: a.professoresIds.map(id => profMap.get(id)?.nome || '').filter(Boolean).join(' / '),
            sala: a.ambienteNome || '',
            tipo: 'aula',
            cor: a.cor || '#3b82f6',
          }))

          if (rotinaRows.length > 0) {
            const { error: rotErr } = await supabase.from('rotina_items').upsert(rotinaRows)
            if (!rotErr) rotinaSynced = rotinaRows.length
          }

          // Atualizar cfgHorariosGrade para refletir faixas de horário personalizadas por turma
          const { data: gradeCfgRow } = await supabase
            .from('configuracoes')
            .select('valor')
            .eq('chave', 'cfgHorariosGrade')
            .maybeSingle()

          const currentGradeCfg =
            gradeCfgRow?.valor && typeof gradeCfgRow.valor === 'object' ? { ...gradeCfgRow.valor } : {}

          for (const t of projeto.turmas.filter(tr => tr.ativa)) {
            const mod = modeloMap.get(t.modeloHorarioId)
            if (mod) {
              currentGradeCfg[t.id] = mod.faixas.map(f => ({
                id: f.id,
                inicio: f.inicio,
                fim: f.fim,
                tipo: f.tipo,
              }))
            }
          }

          await supabase
            .from('configuracoes')
            .upsert({ chave: 'cfgHorariosGrade', valor: currentGradeCfg, updated_at: agora }, { onConflict: 'chave' })
        }
      }

      return NextResponse.json({
        ok: true,
        projeto: updatedProjeto,
        rotinaSynced,
        publicoAno: projeto.anoLetivo,
      })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
