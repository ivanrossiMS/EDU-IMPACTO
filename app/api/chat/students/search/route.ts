import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { checkIsAdmin } from '@/lib/chatPermissions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatParentesco(p?: string | null): string {
  if (!p) return 'Responsável'
  const lower = p.toLowerCase().trim()
  if (lower === 'mae' || lower === 'mãe') return 'Mãe'
  if (lower === 'pai') return 'Pai'
  if (lower === 'avo_m' || lower === 'avó') return 'Avó'
  if (lower === 'avo_p' || lower === 'avô') return 'Avô'
  if (lower === 'tio' || lower === 'tia') return 'Tio(a)'
  if (lower === 'outro') return 'Responsável'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ students: [] })
    }

    // 1. Obter usuário e verificar se é admin
    let dbUser: any = null
    const { data: foundUser } = await supabase
      .from('system_users')
      .select('id, auth_id, nome, email, cargo, perfil, dados')
      .or(`id.eq."${user.id}",auth_id.eq."${user.id}"${user.email ? `,email.ilike."${user.email}"` : ''}`)
      .maybeSingle()

    dbUser = foundUser

    const perfil = (dbUser?.perfil || user.user_metadata?.perfil || '').trim()
    const cargo = (dbUser?.cargo || user.user_metadata?.cargo || '').trim()
    const isAdmin = checkIsAdmin(perfil, cargo)

    // 2. Determinar escopo de turmas/alunos permitidos
    const effectiveUserId = dbUser?.id || user.id
    const effectiveAuthId = dbUser?.auth_id || user.id

    const { data: allGrupos } = await supabase
      .from('agenda_grupos')
      .select('id, dados')

    const turmaMap: Record<string, { nome: string; grupoId: string }> = {}
    const allowedAlunoIds = new Set<string>()

    const isTeacher = 
      perfil.toLowerCase().includes('professor') ||
      cargo.toLowerCase().includes('professor') ||
      perfil.toLowerCase().includes('educador') ||
      cargo.toLowerCase().includes('educador')

    let relevantGrupos = (allGrupos || []).filter(g => !g.dados?.isEquipeEscolar)
    if (isTeacher && !isAdmin) {
      const myGrupos = relevantGrupos.filter(g => {
        const colabs = Array.isArray(g.dados?.colaboradoresIds) ? g.dados.colaboradoresIds.map(String) : []
        return colabs.includes(String(effectiveUserId)) || colabs.includes(String(effectiveAuthId)) || !!g.dados?.isGlobalAccess
      })
      if (myGrupos.length > 0) {
        relevantGrupos = myGrupos
      }
    }

    relevantGrupos.forEach(g => {
      const gNome = g.dados?.nome || 'Turma Oficial'
      const syncId = g.dados?.syncId || g.dados?.turma_id || g.id
      turmaMap[g.id] = { nome: gNome, grupoId: g.id }
      turmaMap[syncId] = { nome: gNome, grupoId: g.id }
      turmaMap[`sync-${syncId}`] = { nome: gNome, grupoId: g.id }

      if (Array.isArray(g.dados?.alunosIds)) {
        g.dados.alunosIds.forEach((aId: any) => allowedAlunoIds.add(String(aId)))
      }
    })

    // Se for professor restrito a turmas específicas e nenhuma foi encontrada
    if (isTeacher && !isAdmin && allowedAlunoIds.size === 0) {
      return NextResponse.json({ students: [] })
    }

    // 3. Buscar alunos pelo nome com ilike
    let alunosQuery = supabase
      .from('alunos')
      .select('id, nome, foto, turma, serie')
      .ilike('nome', `%${q}%`)
      .limit(20)

    if (!isAdmin && allowedAlunoIds.size > 0) {
      alunosQuery = alunosQuery.in('id', Array.from(allowedAlunoIds))
    }

    const { data: matchedAlunos, error: errAlunos } = await alunosQuery
    if (errAlunos) throw errAlunos

    if (!matchedAlunos || matchedAlunos.length === 0) {
      return NextResponse.json({ students: [] })
    }

    const studentIds = matchedAlunos.map(a => String(a.id))

    // 4. Buscar vínculos com responsáveis em paralelo
    const { data: linksRows } = await supabase
      .from('aluno_responsavel')
      .select('aluno_id, responsavel_id, parentesco, tipo, resp_financeiro, resp_pedagogico')
      .in('aluno_id', studentIds)

    const respIds = Array.from(new Set((linksRows || []).map(l => String(l.responsavel_id))))

    // 5. Buscar dados dos responsáveis
    let respMap = new Map<string, any>()
    if (respIds.length > 0) {
      const { data: respsRows } = await supabase
        .from('responsaveis')
        .select('id, nome, email, telefone, celular')
        .in('id', respIds)

      ;(respsRows || []).forEach(r => {
        respMap.set(String(r.id), r)
      })
    }

    // 6. Montar retorno com ordenação de prioridade (Mãe, Pai, outros)
    const students = matchedAlunos.map(a => {
      const studentLinks = (linksRows || []).filter(l => String(l.aluno_id) === String(a.id))
      const responsaveis = studentLinks.map(link => {
        const r = respMap.get(String(link.responsavel_id))
        return {
          id: String(link.responsavel_id),
          nome: r?.nome || 'Responsável',
          parentesco: formatParentesco(link.parentesco || link.tipo),
          email: r?.email || null,
          respFinanceiro: !!link.resp_financeiro,
          respPedagogico: !!link.resp_pedagogico
        }
      })

      // Ordenar responsáveis: Mãe primeiro, Pai segundo
      responsaveis.sort((x, y) => {
        const getPriority = (p: string) => {
          if (p === 'Mãe') return 1
          if (p === 'Pai') return 2
          return 3
        }
        const prioX = getPriority(x.parentesco)
        const prioY = getPriority(y.parentesco)
        if (prioX !== prioY) return prioX - prioY
        return x.nome.localeCompare(y.nome)
      })

      const tInfo = turmaMap[a.turma] || turmaMap[`sync-${a.turma}`]

      return {
        id: String(a.id),
        nome: a.nome,
        turma: a.turma,
        turmaNome: tInfo?.nome || `Turma ${a.turma}`,
        grupoId: tInfo?.grupoId || (a.turma ? `sync-${a.turma}` : null),
        responsaveis
      }
    })

    return NextResponse.json({ students })

  } catch (err: any) {
    console.error('Erro ao buscar alunos para chat:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
