import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { syncStudentToDevices } from '@/lib/portariaSync'
import {
  getAdminClient,
  findAuthUserByEmail,
  invalidateAuthUsersCache,
  syncResponsavelAuthOnEmailChange,
  syncAlunoAuthOnEmailChange,
} from '@/lib/server/supabaseAdminSingleton'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import {
  requireAuth,
  requireProfile,
  requireStaff,
  resolveUserRole,
  getAuthorizedAlunoIdsForUser,
  clearAuthGuardCache,
} from '@/lib/server/authGuard'
import { isValidStudentPhoto } from '@/lib/utils'
import { isAlunoCursandoTurma, isAlunoIntegralIntermediario } from '@/lib/studentTurmaUtils'
import { invalidateAlunosCache, invalidateGruposCache, getCachedTurmasAndGrupos } from '@/lib/server/turmasGruposCache'

export const dynamic = 'force-dynamic'

function cleanNameString(str: any): string {
  if (!str) return ''
  const s = typeof str === 'object' ? (str.nome || str.name || str.nomeCompleto || str.nome_completo || '') : String(str)
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function isSamePerson(r1: any, r2: any): boolean {
  if (!r1 || !r2) return false
  
  const id1 = String(r1.id || r1.codigo || '').trim()
  const id2 = String(r2.id || r2.codigo || '').trim()
  if (id1 && id2 && id1 === id2) return true

  const e1 = (r1.email || '').trim().toLowerCase()
  const e2 = (r2.email || '').trim().toLowerCase()
  if (e1 && e2 && e1.includes('@') && e1 === e2) return true

  const t1 = (r1.telefone || r1.celular || '').replace(/\D/g, '')
  const t2 = (r2.telefone || r2.celular || '').replace(/\D/g, '')
  if (t1 && t2 && t1.length >= 8 && t1 === t2) return true

  const n1 = cleanNameString(r1)
  const n2 = cleanNameString(r2)

  if (!n1 || !n2) return false
  if (n1 === n2) return true

  const w1 = n1.replace(/[^a-z0-9\s]/g, ' ').split(' ').filter(Boolean)
  const w2 = n2.replace(/[^a-z0-9\s]/g, ' ').split(' ').filter(Boolean)

  if (w1.length < 2 || w2.length < 2) return false
  if (w1[0] !== w2[0] || w1[w1.length - 1] !== w2[w2.length - 1]) return false

  const mid1 = w1.slice(1, -1)
  const mid2 = w2.slice(1, -1)
  if (mid1.length === 0 || mid2.length === 0) return true

  const [shorter, longer] = mid1.length <= mid2.length ? [mid1, mid2] : [mid2, mid1]
  return shorter.every(sWord => {
    return longer.some(lWord => lWord === sWord || (sWord.length === 1 && lWord.startsWith(sWord)))
  })
}

// ─── GET: Listar alunos ──────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { user, isStaff, errorResponse } = await resolveUserRole(request)
  if (errorResponse || !user) return errorResponse!

  try {
    const url = new URL(request.url)
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    // Removemos fallback oculto; agora sempre paginado a menos que force explicitamente, mas limitado.
    const all = url.searchParams.get('all') === 'true'

    const page = parseInt(pageParam || '1')
    const lightweight = url.searchParams.get('lightweight') === 'true'
    const requestedLimit = parseInt(limitParam || (all || !pageParam ? '10000' : '25'))
    // Aumentamos o limite para permitir 'Todos', já que o usuário possui a opção no frontend
    const limit = lightweight ? Math.min(requestedLimit, 10000) : Math.min(requestedLimit, 10000)
    const search = url.searchParams.get('search') || ''
    const status = (url.searchParams.get('status') || 'todos').toLowerCase()
    const turma = url.searchParams.get('turma') || ''
    const sortField = url.searchParams.get('sortField') || 'nome'
    const sortOrder = url.searchParams.get('sortOrder') || 'asc'

    // Filtros Avançados
    const dataCadastroInicio = url.searchParams.get('dataCadastroInicio') || ''
    const dataCadastroFim = url.searchParams.get('dataCadastroFim') || ''
    const inadimplente = url.searchParams.get('inadimplente') // 'true' | 'false' | null
    const riscoEvasao = url.searchParams.get('riscoEvasao') || ''
    const turno = url.searchParams.get('turno') || ''
    const autorizadoSairSozinho = url.searchParams.get('autorizadoSairSozinho') // 'true' | 'false' | null
    const foto = url.searchParams.get('foto') || 'todos'
    const withPhoto = url.searchParams.get('withPhoto') === 'true'
    const observacoesParam = url.searchParams.get('observacoes') || 'todos'
    let integralIntermediario = url.searchParams.get('integralIntermediario') || ''
    const anoParam = url.searchParams.get('ano') || url.searchParams.get('anoLetivo') || ''

    const from = (page - 1) * limit
    const to = from + limit - 1

    const isBulk = lightweight && !withPhoto

    const queryFields = (lightweight && !withPhoto)
      ? 'id, nome, matricula, turma, status, email, telefone, responsavel, responsavel_financeiro, responsavel_pedagogico, dados'
      : 'id, nome, matricula, turma, serie, turno, status, email, data_nascimento, responsavel, responsavel_financeiro, responsavel_pedagogico, telefone, inadimplente, risco_evasao, media, frequencia, obs, unidade, foto, foto_url, dados, updated_at, created_at'

    let query = supabase
      .from('alunos')
      .select(queryFields as any, { count: 'exact' })

    if (!isStaff) {
      const allowedAlunoIds = await getAuthorizedAlunoIdsForUser(user)
      if (!allowedAlunoIds || allowedAlunoIds.size === 0) {
        return NextResponse.json({ data: [], total: 0, page, limit })
      }
      query = query.in('id', Array.from(allowedAlunoIds))
    }

    if (search) {
      // Busca por nome, ID, matricula, e-mail, CPF ou RGA
      const cleanDigits = search.replace(/\D/g, '')
      if (cleanDigits.length >= 3) {
        query = query.or(`nome.ilike.%${search}%,id.ilike.%${search}%,matricula.ilike.%${search}%,email.ilike.%${search}%,dados->>cpf.ilike.%${cleanDigits}%,dados->>rga.ilike.%${search}%,dados->>idCenso.ilike.%${search}%,dados->>id_censo.ilike.%${search}%`)
      } else {
        query = query.or(`nome.ilike.%${search}%,id.ilike.%${search}%,matricula.ilike.%${search}%,email.ilike.%${search}%,dados->>rga.ilike.%${search}%,dados->>idCenso.ilike.%${search}%,dados->>id_censo.ilike.%${search}%`)
      }
    }

    if (status === 'ativo') {
      // Se selecionou Apenas Ativos, pega matriculados/nulos
      query = query.or('status.neq.inativo,status.is.null')
    } else if (status === 'inativo') {
      // Se selecionou Apenas Inativos
      query = query.eq('status', 'inativo')
    } else if (status === 'todos') {
      // Regra de Negócio: Se for todos (Ativos) e NÃO tiver busca, esconde inativos
      if (!search) {
        query = query.or('status.neq.inativo,status.is.null')
      }
      // Se tiver busca, 'todos' significa buscar também nos inativos para que a busca encontre o aluno
    } else if (status === 'com_observacoes') {
      if (!search) {
        query = query.or('status.neq.inativo,status.is.null')
      }
      query = query.or('obs.neq."",dados->observacoes.neq.[]')
    } else if (status === 'sem_observacoes') {
      if (!search) {
        query = query.or('status.neq.inativo,status.is.null')
      }
      query = query.or('obs.is.null,obs.eq.""').or('dados->observacoes.is.null,dados->observacoes.eq.[]')
    } else if (status === 'matriculado_vazio') {
      query = query.or('status.eq.MATRICULADO,status.eq.matriculado,status.is.null')
    } else if (status === 'pode_sair_sim') {
      query = query.filter('dados->autorizadoSairSozinho', 'eq', 'true')
    } else if (status === 'pode_sair_nao') {
      query = query.or('dados->autorizadoSairSozinho.eq.false,dados->autorizadoSairSozinho.is.null')
    } else if (status === 'integral_sim') {
      if (!search) {
        query = query.or('status.neq.inativo,status.is.null')
      }
      integralIntermediario = 'sim'
    } else if (status === 'integral_nao') {
      if (!search) {
        query = query.or('status.neq.inativo,status.is.null')
      }
      integralIntermediario = 'nao'
    } else if (status === 'com_responsaveis' || status === 'sem_responsaveis') {
      // Como os responsáveis estão em uma tabela de relacionamento (aluno_responsavel) e também em campos de texto,
      // buscamos os alunos que possuem vínculo ativo na tabela para cruzar com a query principal.
      const { data: ar } = await supabase.from('aluno_responsavel').select('aluno_id');
      const alunosComResponsaveisIds = ar ? [...new Set(ar.map((x: any) => x.aluno_id))] : [];
      
      if (status === 'com_responsaveis') {
        // Alunos que têm vínculo na tabela OU possuem os campos de texto preenchidos
        if (alunosComResponsaveisIds.length > 0) {
          query = query.or(`id.in.(${alunosComResponsaveisIds.join(',')}),responsavel.neq."",responsavel_financeiro.neq."",responsavel_pedagogico.neq.""`)
        } else {
          query = query.or('responsavel.neq."",responsavel_financeiro.neq."",responsavel_pedagogico.neq.""')
        }
      } else if (status === 'sem_responsaveis') {
        // Alunos que NÃO têm vínculo na tabela E possuem os campos de texto vazios
        if (alunosComResponsaveisIds.length > 0) {
          query = query.not('id', 'in', `(${alunosComResponsaveisIds.join(',')})`)
                       .or('responsavel.is.null,responsavel.eq.""')
                       .or('responsavel_financeiro.is.null,responsavel_financeiro.eq.""')
                       .or('responsavel_pedagogico.is.null,responsavel_pedagogico.eq.""')
        } else {
          query = query.or('responsavel.is.null,responsavel.eq.""')
                       .or('responsavel_financeiro.is.null,responsavel_financeiro.eq.""')
                       .or('responsavel_pedagogico.is.null,responsavel_pedagogico.eq.""')
        }
      }
    } else if (status === 'com_turma') {
      query = query.not('turma', 'is', null).neq('turma', '')
    } else if (status === 'sem_turma') {
      query = query.or('turma.is.null,turma.eq.')
    }
    // se for todos_com_inativos, não aplica filtro de status

    let targetTurma: any = null
    if (turma) {
      const { data: tRes1 } = await supabase.from('turmas').select('*').eq('id', turma).maybeSingle()
      if (tRes1) {
        targetTurma = tRes1
      } else {
        const { data: tRes2 } = await supabase.from('turmas').select('*').eq('nome', turma).maybeSingle()
        targetTurma = tRes2
      }

      const turmaTokens = Array.from(new Set([
        turma,
        targetTurma?.id ? String(targetTurma.id) : null,
        targetTurma?.codigo ? String(targetTurma.codigo) : null,
        targetTurma?.nome ? String(targetTurma.nome) : null,
      ].filter(Boolean))) as string[]

      const orClauses: string[] = []
      turmaTokens.forEach(tok => {
        const safe = /[ ,()\/]/.test(tok) ? `"${tok.replace(/"/g, '\\"')}"` : tok
        orClauses.push(`turma.eq.${safe}`)
        orClauses.push(`dados->>turma.eq.${safe}`)
        orClauses.push(`dados->historicoTurmas.cs.[{"serieTurma":"${tok}"}]`)
        orClauses.push(`dados->historicoTurmas.cs.[{"turma":"${tok}"}]`)
      })
      if (orClauses.length > 0) {
        query = query.or(orClauses.join(','))
      }
    }

    let effectiveTurno = turno
    if (effectiveTurno && (effectiveTurno.toLowerCase().includes('integral') || effectiveTurno.toLowerCase().includes('intermedi'))) {
      if (!integralIntermediario || integralIntermediario === 'todos') {
        integralIntermediario = 'sim'
      }
      effectiveTurno = ''
    }

    let cachedAllTurmas: any[] | null = null
    const ensureCachedTurmas = async () => {
      if (!cachedAllTurmas) {
        const { allTurmas } = await getCachedTurmasAndGrupos()
        cachedAllTurmas = allTurmas || []
      }
      return cachedAllTurmas
    }

    // Aplicação de Filtros Avançados
    if (integralIntermediario === 'sim' || integralIntermediario === 'true' || integralIntermediario === 'nao' || integralIntermediario === 'false') {
      const allTurmas = await ensureCachedTurmas()
      const integralTurmas = allTurmas.filter((t: any) => {
        const tNome = String(t.nome || t.dados?.nome || '').toLowerCase()
        const tTurno = String(t.turno || t.dados?.turno || '').toLowerCase()
        const tMod = String(t.modalidade || t.dados?.modalidade || '').toLowerCase()
        return (
          tTurno.includes('integral') || tTurno.includes('intermediario') || tTurno.includes('intermediário') ||
          tMod.includes('integral/intermediário') ||
          ((tNome.includes('integral') || tNome.includes('intermediario') || tNome.includes('intermediário')) && !tNome.includes('matutino') && !tNome.includes('vespertino'))
        )
      })
      const integralRefs = Array.from(new Set(
        integralTurmas.flatMap((t: any) => [t.id, t.codigo, t.nome]).filter(Boolean).map((r: any) => String(r).trim())
      ))
      const safeIntegralRefs = integralRefs
        .map(r => /[ ,()\/]/.test(r) ? `"${r.replace(/"/g, '\\"')}"` : r)
        .join(',')

      if (integralIntermediario === 'sim' || integralIntermediario === 'true') {
        if (status !== 'inativo') {
          query = query.or('status.neq.inativo,status.is.null')
        }
        const simOrClauses = [
          'dados->isIntegralIntermediario.eq.true',
          'dados->>isIntegralIntermediario.eq.true',
          'dados->>modalidade.ilike.%integral%',
          'dados->>modalidade.ilike.%intermedi%',
          'turno.ilike.%integral%',
          'turno.ilike.%intermedi%',
          'dados->>turno.ilike.%integral%',
          'dados->>turno.ilike.%intermedi%'
        ]
        if (safeIntegralRefs) {
          simOrClauses.push(`turma.in.(${safeIntegralRefs})`)
        }
        query = query.or(simOrClauses.join(','))
      } else {
        if (status !== 'inativo' && status !== 'todos_com_inativos') {
          query = query.or('status.neq.inativo,status.is.null')
        }
        query = query
          .or('dados->isIntegralIntermediario.eq.false,dados->isIntegralIntermediario.is.null')
          .or('dados->>modalidade.is.null,dados->>modalidade.eq.,dados->>modalidade.not.ilike.%integral%')
        if (safeIntegralRefs) {
          query = query.or(`turma.is.null,turma.not.in.(${safeIntegralRefs})`)
        }
      }
    }
    if (dataCadastroInicio) {
      query = query.gte('created_at', dataCadastroInicio + 'T00:00:00.000Z')
    }
    if (dataCadastroFim) {
      query = query.lte('created_at', dataCadastroFim + 'T23:59:59.999Z')
    }
    if (inadimplente === 'true') {
      query = query.eq('inadimplente', true)
    } else if (inadimplente === 'false') {
      query = query.eq('inadimplente', false)
    }
    if (riscoEvasao && riscoEvasao !== 'todos') {
      query = query.eq('risco_evasao', riscoEvasao)
    }
    if (effectiveTurno && effectiveTurno !== 'todos') {
      const allTurmas = await ensureCachedTurmas()
      const shiftLower = effectiveTurno.toLowerCase()
      const matchingShiftTurmas = allTurmas.filter((t: any) => {
        const tTurno = String(t.turno || t.dados?.turno || t.nome || '').toLowerCase()
        return tTurno.includes(shiftLower)
      })
      const shiftRefs = Array.from(new Set(
        matchingShiftTurmas.flatMap((t: any) => [t.id, t.codigo, t.nome]).filter(Boolean).map((r: any) => String(r).trim())
      ))
      const safeShiftRefs = shiftRefs
        .map(r => /[ ,()\/]/.test(r) ? `"${r.replace(/"/g, '\\"')}"` : r)
        .join(',')
      const turnoOrClauses = [
        `turno.ilike.%${effectiveTurno}%`,
        `dados->>turno.ilike.%${effectiveTurno}%`
      ]
      if (safeShiftRefs) {
        turnoOrClauses.push(`turma.in.(${safeShiftRefs})`)
      }
      query = query.or(turnoOrClauses.join(','))
    }
    if (autorizadoSairSozinho === 'true') {
      query = query.filter('dados->autorizadoSairSozinho', 'eq', 'true')
    } else if (autorizadoSairSozinho === 'false') {
      // Filtrar quando for explicitamente falso, nulo ou ausente
      query = query.or('dados->autorizadoSairSozinho.eq.false,dados->autorizadoSairSozinho.is.null')
    }

    if (foto === 'com_foto') {
      query = query
        .or('foto.not.is.null,dados->>foto.not.is.null,dados->>avatarUrl.not.is.null,dados->>fotoUrl.not.is.null')
    } else if (foto === 'sem_foto') {
      query = query
        .or('foto.is.null,foto.eq.null,foto.eq.undefined,foto.ilike.%svg%')
    }


    if (observacoesParam === 'com_observacoes') {
      query = query.or('obs.neq."",dados->observacoes.neq.[]')
    } else if (observacoesParam === 'sem_observacoes') {
      query = query.or('obs.is.null,obs.eq.""').or('dados->observacoes.is.null,dados->observacoes.eq.[]')
    }

    // Determine ordering column
    let dbSortField = 'nome'
    if (sortField === 'id') {
      dbSortField = 'matricula'
    } else if (sortField === 'nome') {
      dbSortField = 'nome'
    } else if (sortField === 'responsavel') {
      dbSortField = 'responsavel'
    } else if (sortField === 'turma') {
      dbSortField = 'turma'
    } else if (sortField === 'status') {
      dbSortField = 'status'
    } else if (sortField === 'sairSozinho' || sortField === 'autorizadoSairSozinho') {
      dbSortField = 'dados->autorizadoSairSozinho'
    } else if (sortField === 'foto') {
      dbSortField = 'foto'
    } else if (sortField === 'created_at' || sortField === 'data_cadastro' || sortField === 'dataCadastro') {
      dbSortField = 'created_at'
    }

    let queryExec;
    if (dbSortField === 'dados->autorizadoSairSozinho') {
      const isAsc = sortOrder === 'asc';
      // Para booleans com null, queremos agrupar null e false juntos
      queryExec = query.order(dbSortField, { ascending: isAsc, nullsFirst: isAsc });
    } else {
      queryExec = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    }
    if (!all) {
      queryExec = queryExec.range(from, from + limit - 1)
    } else {
      queryExec = queryExec.limit(limit)
    }

    const { data: students, error: studentsError, count } = await queryExec

    if (studentsError) {
      // PGRST103: Requested range not satisfiable (ocorre quando pede uma página maior que o total de resultados)
      if (studentsError.code === 'PGRST103') {
        return NextResponse.json({ data: [], total: count || 0, page, limit })
      }
      console.error(`\n[${new Date().toISOString()}] Error Alunos GET (Students): ${studentsError.message}\n`)
      return NextResponse.json({ error: studentsError.message }, { status: 400 })
    }

    if (!students || students.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, limit })
    }

    if (lightweight) {
      let turmasData: any[] = []
      const uniqueTurmaRefs = Array.from(new Set(students.map((s: any) => s.turma).filter(Boolean)))
      
      if (uniqueTurmaRefs.length > 0) {
        const cleanRefs = uniqueTurmaRefs.map(r => String(r).trim()).filter(Boolean)
        if (cleanRefs.length > 0) {
          const safeRefs = cleanRefs.map(r => /[ ,()\/]/.test(r) ? `"${r.replace(/"/g, '\\"')}"` : r).join(',')

          const orClauses: string[] = [
            `id.in.(${safeRefs})`,
            `codigo.in.(${safeRefs})`,
            `nome.in.(${safeRefs})`
          ]

          const { data: tData, error: turmasError } = await supabase
            .from('turmas')
            .select('id, codigo, nome, ano, dados')
            .or(orClauses.join(','))

          if (turmasError) {
            console.error(`\n[${new Date().toISOString()}] Error Alunos GET (Turmas): ${turmasError.message}\n`)
          } else {
            turmasData = tData || []
          }
        }
      }

      // Buscar vínculos da tabela aluno_responsavel para todos os identificadores possíveis dos alunos
      const studentRefsAll = Array.from(new Set(students.flatMap((s: any) => [
        s.id,
        s.matricula,
        s.codigo,
        s.dados?.codigo,
        s.dados?.id,
        s.dados?.matricula,
        s.matricula ? String(s.matricula) : null,
        s.codigo ? String(s.codigo) : null,
        s.dados?.codigo ? String(s.dados?.codigo) : null
      ]).filter(Boolean).map(r => String(r).trim())))

      let links: any[] = []
      let responsaveisTable: any[] = []

      if (studentRefsAll.length > 0) {
        const chunkSize = 150
        const linkChunks: string[][] = []
        for (let i = 0; i < studentRefsAll.length; i += chunkSize) {
          linkChunks.push(studentRefsAll.slice(i, i + chunkSize))
        }

        const linkResponses = await Promise.all(
          linkChunks.map(chunk =>
            supabase
              .from('aluno_responsavel')
              .select('aluno_id, responsavel_id, parentesco, resp_financeiro, resp_pedagogico, resp_outro, tipo')
              .in('aluno_id', chunk)
          )
        )
        links = linkResponses.flatMap(r => r.data || [])
        const respIds = Array.from(new Set(links.map((l: any) => String(l.responsavel_id).trim()).filter(Boolean)))

        if (respIds.length > 0) {
          const respChunks: string[][] = []
          for (let i = 0; i < respIds.length; i += chunkSize) {
            respChunks.push(respIds.slice(i, i + chunkSize))
          }

          const respResponses = await Promise.all(
            respChunks.map(chunk =>
              supabase
                .from('responsaveis')
                .select('id, nome, telefone, email, rfid, proibido, dias_acesso, obs')
                .in('id', chunk)
            )
          )
          responsaveisTable = respResponses.flatMap(r => r.data || [])
        }
      }

      const formatted = (students || []).map((student: any) => {
        const d = student.dados || {}
        
        const studentTurma = student.turma
        const tObj = turmasData?.find((t: any) =>
          String(t.id) === String(studentTurma) ||
          String(t.codigo) === String(studentTurma) ||
          String(t.nome).toLowerCase() === String(studentTurma).toLowerCase()
        )

        const rawFoto = student.foto || student.imagem1 || student.foto_url || d.foto || d.avatarUrl || d.fotoUrl || null
        let resolvedFoto = isValidStudentPhoto(rawFoto) ? rawFoto : null
        if (isBulk && resolvedFoto && resolvedFoto.startsWith('data:image/')) {
          resolvedFoto = null
        }

        const thisStudentRefs = [
          student.id,
          student.matricula,
          student.codigo,
          student.dados?.codigo,
          student.dados?.id,
          student.dados?.matricula,
          student.matricula ? String(student.matricula) : null,
          student.codigo ? String(student.codigo) : null,
          student.dados?.codigo ? String(student.dados?.codigo) : null
        ].filter(Boolean).map(r => String(r).trim())

        // Mesclar e consolidar responsáveis da tabela aluno_responsavel
        const rawLinked = links.filter((l: any) => thisStudentRefs.includes(String(l.aluno_id).trim()))
          .map((l: any) => {
            const r = responsaveisTable.find((rObj: any) => String(rObj.id).trim() === String(l.responsavel_id).trim()) || {}
            const isPed = l.resp_pedagogico === true || l.tipo === 'pedagogico' || r.isPedagogico === true
            const isFin = l.resp_financeiro === true || l.tipo === 'financeiro' || r.isFinanceiro === true
            const isOut = l.resp_outro === true || l.tipo === 'outro' || l.tipo === 'outros' || r.isOutro === true
            const parentesco = l.parentesco || r.parentesco || (isPed ? 'Resp. Pedagógico' : (isFin ? 'Resp. Financeiro' : (isOut ? 'Outros' : 'Responsável')))
            return {
              id: r.id || l.responsavel_id,
              nome: r.nome || '',
              parentesco: parentesco,
              telefone: r.telefone,
              email: r.email,
              rfid: r.rfid,
              proibido: r.proibido === true,
              diasAcesso: r.dias_acesso,
              isFinanceiro: isFin,
              isPedagogico: isPed,
              isOutro: isOut
            }
          }).filter((r: any) => r.nome && r.nome.trim())

        const mergedResponsaveis: any[] = []
        rawLinked.forEach((r: any) => {
          const existing = mergedResponsaveis.find(m => isSamePerson(m, r))
          if (existing) {
            if (!existing.id && r.id) existing.id = r.id
            if (r.isFinanceiro) existing.isFinanceiro = true
            if (r.isPedagogico) existing.isPedagogico = true
            if (r.isOutro) existing.isOutro = true
            if (r.email && !existing.email) existing.email = r.email
            if (r.telefone && !existing.telefone) existing.telefone = r.telefone
            if (r.rfid && !existing.rfid) existing.rfid = r.rfid
            if (r.parentesco && ['pai', 'mae', 'Pai', 'Mãe'].includes(r.parentesco)) {
              existing.parentesco = r.parentesco
            }
            if (r.nome && r.nome.length > existing.nome.length) {
              existing.nome = r.nome
            }
          } else {
            mergedResponsaveis.push({ ...r })
          }
        })

        const jsonResps = [
          ...(Array.isArray(student.responsaveis) ? student.responsaveis : []),
          ...(Array.isArray(d.responsaveis) ? d.responsaveis : []),
          ...(Array.isArray(student.outrosResponsaveis) ? student.outrosResponsaveis : []),
          ...(Array.isArray(d.outrosResponsaveis) ? d.outrosResponsaveis : []),
          ...(Array.isArray(student.responsaveisOutros) ? student.responsaveisOutros : []),
          ...(Array.isArray(d.responsaveisOutros) ? d.responsaveisOutros : []),
        ]
        jsonResps.forEach((j: any) => {
          const jObj = typeof j === 'string' ? { nome: j.trim(), parentesco: 'Responsável' } : j
          if (!jObj || !jObj.nome) return
          const existing = mergedResponsaveis.find(m => isSamePerson(m, jObj))
          if (existing) {
            if (jObj.id && !existing.id) existing.id = jObj.id
            if (jObj.isPedagogico || jObj.respPedagogico) existing.isPedagogico = true
            if (jObj.isFinanceiro || jObj.respFinanceiro) existing.isFinanceiro = true
            if (jObj.isOutro || jObj.respOutro) existing.isOutro = true
            if (jObj.nome && jObj.nome.length > existing.nome.length) existing.nome = jObj.nome
          } else {
            mergedResponsaveis.push({ ...jObj })
          }
        })

        const checkDirectField = (val: any, defaultRole: string, isPed = false, isFin = false, isOut = false) => {
          if (!val) return
          const origName = typeof val === 'string' ? val.trim() : (val.nome || val.name || val.nomeCompleto || '')
          if (!origName || ['none', 'nenhum', 'n/a', 'null', 'undefined', '-'].includes(origName.toLowerCase())) return
          
          const tempObj = typeof val === 'object' ? val : { nome: origName }
          const existing = mergedResponsaveis.find(m => isSamePerson(m, tempObj))
          if (existing) {
            if (isPed) existing.isPedagogico = true
            if (isFin) existing.isFinanceiro = true
            if (isOut) existing.isOutro = true
          } else {
            // Se o aluno já possui responsáveis reais vinculados em aluno_responsavel,
            // NÃO adicionamos novos registros duplicados derivados de strings de colunas legadas!
            if (rawLinked.length > 0) return

            const foundInTable = responsaveisTable.find((rObj: any) => isSamePerson(rObj, tempObj))
            mergedResponsaveis.push({
              id: foundInTable?.id || '',
              nome: foundInTable?.nome || origName,
              parentesco: defaultRole,
              telefone: foundInTable?.telefone || null,
              email: foundInTable?.email || null,
              rfid: foundInTable?.rfid || null,
              proibido: foundInTable?.proibido === true,
              diasAcesso: foundInTable?.dias_acesso || [],
              isPedagogico: isPed,
              isFinanceiro: isFin,
              isOutro: isOut
            })
          }
        }

        checkDirectField(student.responsavelPedagogico || student.responsavel_pedagogico || d.responsavelPedagogico || d.responsavel_pedagogico || d.resp_pedagogico, 'Resp. Pedagógico', true, false, false)
        checkDirectField(student.responsavelFinanceiro || student.responsavel_financeiro || d.responsavelFinanceiro || d.responsavel_financeiro || d.resp_financeiro, 'Resp. Financeiro', false, true, false)
        checkDirectField(student.responsavelOutro || student.responsavel_outro || d.responsavelOutro || d.responsavel_outro || d.resp_outro, 'Outros', false, false, true)
        checkDirectField(d.nome_mae || d.mae || d.nomeMae || d.filiacao?.mae || d.filiacao_mae || student.mae || student.nomeMae, 'Mãe')
        checkDirectField(d.nome_pai || d.pai || d.nomePai || d.filiacao?.pai || d.filiacao_pai || student.pai || student.nomePai, 'Pai')
        checkDirectField(d.nome_responsavel || d.responsavel || d.nomeResponsavel || d.resp_nome || student.responsavel || student.nomeResponsavel, 'Responsável')

        // Passagem final de garantia absoluta de deduplicação por pessoa única
        const finalUniqueResps: any[] = []
        mergedResponsaveis.forEach((r: any) => {
          if (!r.nome) return
          const existing = finalUniqueResps.find(u => isSamePerson(u, r))
          if (existing) {
            if (!existing.id && r.id) existing.id = r.id
            if (r.isFinanceiro) existing.isFinanceiro = true
            if (r.isPedagogico) existing.isPedagogico = true
            if (r.isOutro) existing.isOutro = true
            if (r.email && !existing.email) existing.email = r.email
            if (r.telefone && !existing.telefone) existing.telefone = r.telefone
            if (r.rfid && !existing.rfid) existing.rfid = r.rfid
            if (r.parentesco && ['pai', 'mae', 'Pai', 'Mãe'].includes(r.parentesco)) {
              existing.parentesco = r.parentesco
            }
            if (r.nome && r.nome.length > existing.nome.length) {
              existing.nome = r.nome
            }
          } else {
            finalUniqueResps.push({ ...r })
          }
        })

        const studentEmail = (student.email || d.email || d.emailAluno || d.email_aluno || '').trim()
        const studentTelefone = (student.telefone || d.telefone || d.celular || '').trim()
        const studentMatricula = (student.matricula || d.matricula || d.codigo || student.id || '').trim()

        return {
          ...student,
          email: studentEmail,
          telefone: studentTelefone,
          matricula: studentMatricula,
          codigo: studentMatricula,
          isIntegralIntermediario: student.isIntegralIntermediario ?? d.isIntegralIntermediario,
          integral_tipo: student.integral_tipo || d.integral_tipo,
          modalidade: student.modalidade || d.modalidade,
          turno: student.turno || d.turno,
          historicoTurmas: Array.isArray(student.historicoTurmas) ? student.historicoTurmas : (Array.isArray(d.historicoTurmas) ? d.historicoTurmas : []),
          foto: resolvedFoto,
          responsaveis: finalUniqueResps,
          _responsaveis: student._responsaveis || d._responsaveis,
          responsavel: student.responsavel || d.responsavel,
          responsavelPedagogico: student.responsavel_pedagogico || student.responsavelPedagogico || d.responsavelPedagogico,
          responsavelFinanceiro: student.responsavel_financeiro || student.responsavelFinanceiro || d.responsavelFinanceiro,
          mae: d.mae || d.nomeMae || d.filiacao?.mae || null,
          pai: d.pai || d.nomePai || d.filiacao?.pai || null,
          saude: student.saude || d.saude,
          autorizados: student.autorizados || d.autorizados,
          cpf_responsavel: student.cpf_responsavel || d.cpf_responsavel || d.cpfResponsavel,
          email_responsavel: student.email_responsavel || d.email_responsavel || d.emailResponsavel,
          celular_responsavel: student.celular_responsavel || d.celular_responsavel || d.telResponsavel,
          turma_nome: tObj?.nome || student.turma || '',
          turma_anoLetivo: tObj?.ano !== undefined ? String(tObj.ano) : (student.anoLetivo || student.ano_letivo || d.anoLetivo || ''),
          dados: {
            ...(d || {}),
            historicoTurmas: Array.isArray(d.historicoTurmas) ? d.historicoTurmas : (Array.isArray(student.historicoTurmas) ? student.historicoTurmas : []),
            celular_responsavel: d.celular_responsavel,
            cpfResponsavel: d.cpfResponsavel,
            emailResponsavel: d.emailResponsavel,
            telResponsavel: d.telResponsavel,
            codigo: studentMatricula,
            matricula: studentMatricula,
            email: studentEmail,
            telefone: studentTelefone
          }
        }
      })

      let finalLightweight = formatted
      if (foto === 'com_foto') {
        finalLightweight = formatted.filter((s: any) => isValidStudentPhoto(s.foto))
      } else if (foto === 'sem_foto') {
        finalLightweight = formatted.filter((s: any) => !isValidStudentPhoto(s.foto))
      }

      const effectiveAno = targetTurma?.ano ? String(targetTurma.ano) : (anoParam || undefined)

      if (turma) {
        finalLightweight = finalLightweight.filter((student: any) =>
          isAlunoCursandoTurma(student, targetTurma || turma, effectiveAno, turmasData)
        );
      }

      if (integralIntermediario === 'sim' || integralIntermediario === 'true') {
        finalLightweight = finalLightweight.filter((student: any) =>
          isAlunoIntegralIntermediario(student, turmasData, [], effectiveAno)
        );
      } else if (integralIntermediario === 'nao' || integralIntermediario === 'false') {
        finalLightweight = finalLightweight.filter((student: any) =>
          !isAlunoIntegralIntermediario(student, turmasData, [], effectiveAno)
        );
      }

      if (anoParam && !turma) {
        finalLightweight = finalLightweight.filter((student: any) => {
          const hist = student.historicoTurmas || student.dados?.historicoTurmas
          if (Array.isArray(hist) && hist.length > 0) {
            return hist.some((h: any) => String(h.anoLetivo || h.ano || '').trim() === String(anoParam).trim())
          }
          const sAno = String(student.anoLetivo || student.ano_letivo || student.dados?.anoLetivo || student.dados?.ano_letivo || '').trim()
          return sAno === String(anoParam).trim()
        });
      }

      return NextResponse.json({
        data: finalLightweight,
        total: (turma || (anoParam && !turma)) ? finalLightweight.length : (count || 0),
        page,
        limit
      }, {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
        }
      })
    }

    const allStudentRefs = Array.from(new Set(students.flatMap((s: any) => [
      s.id, 
      s.matricula, 
      s.codigo,
      s.dados?.codigo, 
      s.dados?.id,
      s.dados?.matricula,
      s.matricula ? String(s.matricula) : null, 
      s.codigo ? String(s.codigo) : null,
      s.dados?.codigo ? String(s.dados?.codigo) : null
    ]).filter(Boolean).map(r => String(r).trim())))

    // 2. Busca os vínculos em lotes paralelos (chunked + Promise.all)
    const chunkSize = 150
    const linkChunks: string[][] = []
    for (let i = 0; i < allStudentRefs.length; i += chunkSize) {
      linkChunks.push(allStudentRefs.slice(i, i + chunkSize))
    }

    const linkResponses = await Promise.all(
      linkChunks.map(chunk =>
        supabase
          .from('aluno_responsavel')
          .select('*')
          .in('aluno_id', chunk)
          .limit(10000)
      )
    )
    const links: any[] = linkResponses.flatMap(r => r.data || [])

    // 2.5 Busca os dados dos responsáveis manualmente em lotes paralelos
    const respIds = Array.from(new Set((links || []).map((l: any) => String(l.responsavel_id).trim()).filter(Boolean)))
    let responsaveis: any[] = []
    
    if (respIds.length > 0) {
      const respChunks: string[][] = []
      for (let i = 0; i < respIds.length; i += chunkSize) {
        respChunks.push(respIds.slice(i, i + chunkSize))
      }

      const respResponses = await Promise.all(
        respChunks.map(chunk =>
          supabase
            .from('responsaveis')
            .select('*')
            .in('id', chunk)
            .limit(10000)
        )
      )
      responsaveis = respResponses.flatMap(r => r.data || [])
    }

    // 2.7 Busca apenas as turmas associadas aos alunos retornados para resolver nomes e segmentos no servidor de forma otimizada
    let turmasData: any[] = []
    const uniqueTurmaRefs = Array.from(new Set(students.map((s: any) => s.turma).filter(Boolean)))
    
    if (uniqueTurmaRefs.length > 0) {
      // Formata referências limpando caracteres especiais que quebram cláusula PostgREST IN
      const cleanRefs = uniqueTurmaRefs.map(r => String(r).trim()).filter(Boolean)
      if (cleanRefs.length > 0) {
        const safeRefs = cleanRefs.map(r => /[ ,()\/]/.test(r) ? `"${r.replace(/"/g, '\\"')}"` : r).join(',')

        const orClauses: string[] = [
          `id.in.(${safeRefs})`,
          `codigo.in.(${safeRefs})`,
          `nome.in.(${safeRefs})`
        ]

        const { data: tData, error: turmasError } = await supabase
          .from('turmas')
          .select('id, codigo, nome, ano, dados')
          .or(orClauses.join(','))

        if (turmasError) {
          console.error(`\n[${new Date().toISOString()}] Error Alunos GET (Turmas): ${turmasError.message}\n`)
        } else {
          turmasData = tData || []
        }
      }
    }

    // 3. Monta o resultado final
    const formattedData = students.map((student: any) => {
      const studentRefs = [
        student.id, 
        student.matricula, 
        student.codigo,
        student.dados?.codigo, 
        student.dados?.id,
        student.dados?.matricula,
        student.matricula ? String(student.matricula) : null, 
        student.codigo ? String(student.codigo) : null,
        student.dados?.codigo ? String(student.dados?.codigo) : null
      ].filter(Boolean).map(r => String(r).trim())
      
      const linkedResponsaveis = links?.filter((l: any) => studentRefs.includes(String(l.aluno_id).trim()))
        .map((l: any) => {
          const resp = responsaveis.find((r: any) => String(r.id).trim() === String(l.responsavel_id).trim()) || {}
          const isPed = l.resp_pedagogico === true || l.tipo === 'pedagogico' || resp.isPedagogico === true
          const isFin = l.resp_financeiro === true || l.tipo === 'financeiro' || resp.isFinanceiro === true
          const isOut = l.resp_outro === true || l.tipo === 'outro' || l.tipo === 'outros' || resp.isOutro === true
          const parentesco = l.parentesco || resp.parentesco || (isPed ? 'Resp. Pedagógico' : (isFin ? 'Resp. Financeiro' : (isOut ? 'Outros' : 'Responsável')))
          const d = resp.dados || {}
          return {
            ...resp,
            cpf: d.cpf || resp.cpf || '',
            rg: d.rg || resp.rg || '',
            rgOrgaoEmissor: d.rgOrgaoEmissor || d.orgEmissor || '',
            sexo: d.sexo || resp.sexo || '',
            estadoCivil: d.estadoCivil || resp.estado_civil || '',
            profissao: d.profissao || resp.profissao || '',
            nacionalidade: d.nacionalidade || 'Brasileira',
            naturalidade: d.naturalidade || '',
            naturalidadeUf: d.naturalidadeUf || '',
            cep: d.cep || '',
            endereco: d.endereco || d.logradouro || '',
            numero: d.numero || '',
            complemento: d.complemento || '',
            bairro: d.bairro || '',
            cidade: d.cidade || '',
            uf: d.uf || d.ufEnd || '',
            comercialEmpresa: d.comercialEmpresa || '',
            comercialTelefone: d.comercialTelefone || '',
            comercialCep: d.comercialCep || '',
            comercialEndereco: d.comercialEndereco || '',
            comercialNumero: d.comercialNumero || '',
            comercialComplemento: d.comercialComplemento || '',
            comercialBairro: d.comercialBairro || '',
            comercialCidade: d.comercialCidade || '',
            comercialUf: d.comercialUf || '',
            parentesco,
            isFinanceiro: isFin,
            isPedagogico: isPed,
            isOutro: isOut,
            dataNasc: resp.data_nasc,
            diasAcesso: resp.dias_acesso
          }
        }).filter((r: any) => r.id || r.nome) || []

      const jsonResps = [
        ...(Array.isArray(student.responsaveis) ? student.responsaveis : []),
        ...(Array.isArray(student.dados?.responsaveis) ? student.dados.responsaveis : []),
        ...(Array.isArray(student.outrosResponsaveis) ? student.outrosResponsaveis : []),
        ...(Array.isArray(student.dados?.outrosResponsaveis) ? student.dados.outrosResponsaveis : []),
        ...(Array.isArray(student.responsaveisOutros) ? student.responsaveisOutros : []),
        ...(Array.isArray(student.dados?.responsaveisOutros) ? student.dados.responsaveisOutros : []),
      ]

      let finalResponsaveis = [...linkedResponsaveis]
      jsonResps.forEach((j: any) => {
        const jName = (typeof j === 'string' ? j : (j.nome || j.name || j.nomeCompleto || '')).trim()
        if (jName && !finalResponsaveis.some(m => m.nome && m.nome.toLowerCase() === jName.toLowerCase())) {
          finalResponsaveis.push(typeof j === 'string' ? { nome: jName, parentesco: 'Responsável' } : j)
        }
      })

      const d = student.dados || {}
      const checkDirectField = (val: any, defaultRole: string, isPed = false, isFin = false, isOut = false) => {
        if (!val) return
        let name = ''
        if (typeof val === 'string') name = val.trim()
        else if (typeof val === 'object') name = (val.nome || val.name || val.nomeCompleto || val.nome_completo || '').trim()
        
        if (!name) return
        const lower = name.toLowerCase()
        if (['none', 'nenhum', 'n/a', 'null', 'undefined', '-'].includes(lower)) return
        
        if (!finalResponsaveis.some(m => m.nome && m.nome.toLowerCase() === lower)) {
          finalResponsaveis.push({
            id: '',
            nome: name,
            parentesco: defaultRole,
            isPedagogico: isPed,
            isFinanceiro: isFin,
            isOutro: isOut
          })
        }
      }

      checkDirectField(student.responsavelPedagogico || student.responsavel_pedagogico || d.responsavelPedagogico || d.responsavel_pedagogico || d.resp_pedagogico, 'Resp. Pedagógico', true, false, false)
      checkDirectField(student.responsavelFinanceiro || student.responsavel_financeiro || d.responsavelFinanceiro || d.responsavel_financeiro || d.resp_financeiro, 'Resp. Financeiro', false, true, false)
      checkDirectField(student.responsavelOutro || student.responsavel_outro || d.responsavelOutro || d.responsavel_outro || d.resp_outro, 'Outros', false, false, true)
      checkDirectField(d.nome_mae || d.mae || d.nomeMae || d.filiacao?.mae || d.filiacao_mae || student.mae || student.nomeMae, 'Mãe')
      checkDirectField(d.nome_pai || d.pai || d.nomePai || d.filiacao?.pai || d.filiacao_pai || student.pai || student.nomePai, 'Pai')
      checkDirectField(d.nome_responsavel || d.responsavel || d.nomeResponsavel || d.resp_nome || student.responsavel || student.nomeResponsavel, 'Responsável')

      const studentTurma = student.turma
      const tObj = turmasData?.find((t: any) =>
        String(t.id) === String(studentTurma) ||
        String(t.codigo) === String(studentTurma) ||
        String(t.nome).toLowerCase() === String(studentTurma).toLowerCase()
      )

      const rawFoto = student.foto || student.imagem1 || student.foto_url || student.dados?.foto || student.dados?.avatarUrl || student.dados?.fotoUrl || null
      let resolvedFoto = isValidStudentPhoto(rawFoto) ? rawFoto : null
      if (isBulk && resolvedFoto && resolvedFoto.startsWith('data:image/')) {
        resolvedFoto = null
      }

      const studentEmail = (student.email || d.email || d.emailAluno || d.email_aluno || '').trim()
      const studentTelefone = (student.telefone || d.telefone || d.celular || '').trim()
      const studentMatricula = (student.matricula || d.matricula || d.codigo || student.id || '').trim()

      return {
        ...student,
        ...(student.dados || {}), // Spread JSONB data
        email: studentEmail,
        telefone: studentTelefone,
        matricula: studentMatricula,
        codigo: studentMatricula,
        foto: resolvedFoto, // Garantir que foto resolvida estritamente sobrescreva qualquer dado inconsistente
        created_at: student.created_at, // Restore to ensure it's not overwritten
        responsaveis: finalResponsaveis,
        turma_nome: tObj?.nome || student.turma || '',
        turma_segmento: tObj?.dados?.segmento || student.segmento || student.dados?.segmento || '',
        turma_anoLetivo: tObj?.ano !== undefined ? String(tObj.ano) : (student.anoLetivo || student.ano_letivo || student.dados?.anoLetivo || '')
      }
    })

    let finalFormattedData = formattedData
    if (foto === 'com_foto') {
      finalFormattedData = formattedData.filter((s: any) => isValidStudentPhoto(s.foto) || (isBulk && Boolean(s.dados?.foto || s.dados?.avatarUrl || s.dados?.fotoUrl)))
    } else if (foto === 'sem_foto') {
      finalFormattedData = formattedData.filter((s: any) => !isValidStudentPhoto(s.foto) && !(isBulk && Boolean(s.dados?.foto || s.dados?.avatarUrl || s.dados?.fotoUrl)))
    }

    const effectiveAno = targetTurma?.ano ? String(targetTurma.ano) : (anoParam || undefined)

    if (turma) {
      finalFormattedData = finalFormattedData.filter((student: any) =>
        isAlunoCursandoTurma(student, targetTurma || turma, effectiveAno, turmasData)
      );
    }

    if (integralIntermediario === 'sim' || integralIntermediario === 'true') {
      finalFormattedData = finalFormattedData.filter((student: any) =>
        isAlunoIntegralIntermediario(student, turmasData, [], effectiveAno)
      );
    } else if (integralIntermediario === 'nao' || integralIntermediario === 'false') {
      finalFormattedData = finalFormattedData.filter((student: any) =>
        !isAlunoIntegralIntermediario(student, turmasData, [], effectiveAno)
      );
    }

    if (anoParam && !turma) {
      finalFormattedData = finalFormattedData.filter((student: any) => {
        const hist = student.historicoTurmas || student.dados?.historicoTurmas
        if (Array.isArray(hist) && hist.length > 0) {
          return hist.some((h: any) => String(h.anoLetivo || h.ano || '').trim() === String(anoParam).trim())
        }
        const sAno = String(student.anoLetivo || student.ano_letivo || student.dados?.anoLetivo || student.dados?.ano_letivo || '').trim()
        return sAno === String(anoParam).trim()
      });
    }

    return NextResponse.json({
      data: finalFormattedData,
      total: (turma || (anoParam && !turma)) ? finalFormattedData.length : (count || 0),
      page,
      limit
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── POST: Criar ou atualizar aluno e seus responsáveis ──────────────────────────
export async function POST(request: Request) {
  const { user, errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    
    if (Array.isArray(body)) {
      return NextResponse.json({ ok: true, count: body.length })
    }

    const item = body
    const row = buildRow(item)
    
    console.info(`[${new Date().toISOString()}] POST Aluno Individual: ${row.nome}\n`)

    // 0. Verifica duplicidade de ID do Aluno
    if (row.id && !row.id.startsWith('TEMP-')) {
      const { data: existingStudent } = await supabase.from('alunos').select('id, nome').eq('id', row.id).maybeSingle()
      if (existingStudent) {
        return NextResponse.json({ error: `O ID "${row.id}" já está em uso pelo aluno "${existingStudent.nome}". Por favor, escolha um ID diferente.` }, { status: 400 })
      }
    }

    // 0.1 Verifica duplicidade de E-mail do Aluno
    if (row.email && row.email.trim()) {
      const emailLower = row.email.trim().toLowerCase()
      const { data: existingStudentEmail } = await supabase.from('alunos').select('id, nome').eq('email', emailLower).maybeSingle()
      if (existingStudentEmail) {
        return NextResponse.json({ error: `Este e-mail já está sendo utilizado por outro aluno (${existingStudentEmail.nome})!` }, { status: 400 })
      }
    }

    // 1. Salvar o aluno (Insert para criação)
    const { data: studentData, error: studentError } = await supabase
      .from('alunos')
      .insert(row)
      .select()
      
    if (studentError) throw new Error(studentError.message)
    
    const savedStudent = studentData?.[0]
    if (!savedStudent) throw new Error('Falha ao salvar aluno')
    
    // 2. Salvar responsáveis e vínculos
    // Filtra responsáveis vazios (sem nome) para permitir salvar aluno sem responsável
    const responsaveis = (item.responsaveis || item._responsaveis || []).filter((r: any) => r.nome && r.nome.trim() !== '')
    const validColumns = ['id', 'nome', 'data_nasc', 'email', 'telefone', 'celular', 'profissao', 'estado_civil', 'rfid', 'codigo', 'dias_acesso', 'proibido', 'dados']

    for (const resp of responsaveis) {
      const parentesco = resp.parentesco || resp.tipo || ''
      const isFinanceiro = resp.isFinanceiro === true || resp.respFinanceiro === true
      const isPedagogico = resp.isPedagogico === true || resp.respPedagogico === true
      const isOutro = resp.isOutro === true || (!isFinanceiro && !isPedagogico)
      const respDataToSave: any = {}
      
      const isNewResp = !resp.id || (typeof resp.id === 'string' && resp.id.startsWith('TEMP-')) || resp.id === ''
      
      // Verifica se o responsável é NOVO (adicionado na interface) e o ID digitado já existe
      if (resp.isNewAdded && resp.id && !resp.id.startsWith('TEMP-')) {
        const { data: existing } = await supabase.from('responsaveis').select('id, nome').eq('id', resp.id).maybeSingle()
        if (existing) {
          throw new Error(`O ID "${resp.id}" já pertence ao responsável "${existing.nome}". Por favor, escolha outro ID para este novo responsável.`)
        }
      }
      
      // Preservar e mesclar com dados existentes no banco
      const dados = { ...(resp.dados || {}) }
      let prevRespRecord: any = null
      if (!isNewResp) {
        const { data: existingResp } = await supabase
          .from('responsaveis')
          .select('id, nome, email, auth_id, dados')
          .eq('id', resp.id)
          .maybeSingle()
        prevRespRecord = existingResp
        if (existingResp?.dados) {
          Object.assign(dados, existingResp.dados)
        }
      }
      if (resp.cpf) {
        dados.cpf = String(resp.cpf).replace(/\D/g, '')
      }
      if (resp.rg) {
        dados.rg = String(resp.rg).trim()
      }
      if (resp.rgOrgaoEmissor || resp.orgEmissor) {
        dados.rgOrgaoEmissor = resp.rgOrgaoEmissor || resp.orgEmissor
        dados.orgEmissor = dados.rgOrgaoEmissor
      }
      if (resp.nacionalidade) dados.nacionalidade = resp.nacionalidade
      if (resp.naturalidade) dados.naturalidade = resp.naturalidade
      if (resp.naturalidadeUf) dados.naturalidadeUf = resp.naturalidadeUf
      if (resp.sexo) dados.sexo = resp.sexo
      if (resp.estadoCivil || resp.estado_civil) {
        dados.estadoCivil = resp.estadoCivil || resp.estado_civil
        respDataToSave.estado_civil = dados.estadoCivil
      }
      if (resp.profissao) {
        dados.profissao = resp.profissao
        respDataToSave.profissao = resp.profissao
      }

      // Endereço Residencial
      if (resp.cep) dados.cep = resp.cep
      if (resp.endereco || resp.logradouro) {
        dados.endereco = resp.endereco || resp.logradouro
        dados.logradouro = dados.endereco
      }
      if (resp.numero) dados.numero = resp.numero
      if (resp.complemento) dados.complemento = resp.complemento
      if (resp.bairro) dados.bairro = resp.bairro
      if (resp.cidade) dados.cidade = resp.cidade
      if (resp.uf || resp.ufEnd) {
        dados.uf = resp.uf || resp.ufEnd
        dados.ufEnd = dados.uf
      }

      // Endereço Comercial
      if (resp.comercialEmpresa) dados.comercialEmpresa = resp.comercialEmpresa
      if (resp.comercialTelefone) dados.comercialTelefone = resp.comercialTelefone
      if (resp.comercialCep) dados.comercialCep = resp.comercialCep
      if (resp.comercialEndereco) dados.comercialEndereco = resp.comercialEndereco
      if (resp.comercialNumero) dados.comercialNumero = resp.comercialNumero
      if (resp.comercialComplemento) dados.comercialComplemento = resp.comercialComplemento
      if (resp.comercialBairro) dados.comercialBairro = resp.comercialBairro
      if (resp.comercialCidade) dados.comercialCidade = resp.comercialCidade
      if (resp.comercialUf) dados.comercialUf = resp.comercialUf

      respDataToSave.dados = dados
      
      const dataNasc = resp.dataNasc || resp.data_nasc
      if (dataNasc) respDataToSave.data_nasc = dataNasc
      
      const diasAcesso = resp.diasAcesso || resp.dias_acesso
      if (diasAcesso) respDataToSave.dias_acesso = diasAcesso
      
      const estadoCivil = resp.estadoCivil || resp.estado_civil
      if (estadoCivil) respDataToSave.estado_civil = estadoCivil
      
      const codigo = resp.codigoAluno || resp.codigo
      if (codigo) respDataToSave.codigo = codigo

      const telefone = resp.celular || resp.telefone
      if (telefone) respDataToSave.telefone = telefone
      
      for (const col of validColumns) {
        if (respDataToSave[col] === undefined && resp[col] !== undefined) {
          if (col === 'codigo' && !resp[col]) {
            respDataToSave[col] = null
          } else {
            respDataToSave[col] = resp[col]
          }
        }
      }
      
      // Verifica duplicidade de E-mail do Responsável
      if (respDataToSave.email && respDataToSave.email.trim()) {
        const emailLower = respDataToSave.email.trim().toLowerCase()
        let query = supabase.from('responsaveis').select('id, nome, email, auth_id, dados').eq('email', emailLower)
        if (!isNewResp && respDataToSave.id) {
          query = query.neq('id', respDataToSave.id)
        }
        const { data: existingRespEmail } = await query.maybeSingle()
        if (existingRespEmail) {
          // Em vez de dar erro, vamos usar o responsável existente e atualizar os dados dele
          respDataToSave.id = existingRespEmail.id
          prevRespRecord = existingRespEmail
        }
      }

      // Verifica duplicidade por Nome se o ID ainda não tiver sido localizado
      if (!respDataToSave.id && respDataToSave.nome && respDataToSave.nome.trim()) {
        const nameClean = respDataToSave.nome.trim().replace(/\s+/g, ' ')
        const { data: existingRespName } = await supabase
          .from('responsaveis')
          .select('id, nome, email, auth_id, dados')
          .ilike('nome', nameClean)
          .maybeSingle()
        if (existingRespName) {
          respDataToSave.id = existingRespName.id
          prevRespRecord = existingRespName
        }
      }
      
      if (isNewResp && !prevRespRecord?.id) {
        delete respDataToSave.id
      }
      
      let queryData: any[] | null = null
      let respError: any = null
      
      if (isNewResp && !prevRespRecord?.id) {
        const res = await supabase.from('responsaveis').insert(respDataToSave).select()
        queryData = res.data
        respError = res.error
      } else {
        const res = await supabase.from('responsaveis').update(respDataToSave).eq('id', respDataToSave.id).select()
        queryData = res.data
        respError = res.error
        
        // Se não encontrou o registro para atualizar, tenta inserir
        if (!respError && (!queryData || queryData.length === 0)) {
          const resInsert = await supabase.from('responsaveis').insert(respDataToSave).select()
          queryData = resInsert.data
          respError = resInsert.error
        }
      }
        
      if (respError) throw new Error(`Erro ao salvar responsável ${resp.nome}: ${respError.message}`)
      
      const savedResp = queryData && queryData.length > 0 ? queryData[0] : null
      if (!savedResp) throw new Error(`Nenhum dado retornado para o responsável ${resp.nome}`)

      if (prevRespRecord) {
        await syncResponsavelAuthOnEmailChange({
          responsavelId: String(savedResp.id),
          oldEmail: prevRespRecord.email || prevRespRecord.dados?.email || null,
          newEmail: savedResp.email || savedResp.dados?.email || null,
          authId: prevRespRecord.auth_id || savedResp.auth_id || null,
          nome: savedResp.nome || prevRespRecord.nome || '',
        })
      }
      
      // Remove vínculo antigo se existir para evitar duplicidade
      await supabase.from('aluno_responsavel').delete().eq('aluno_id', savedStudent.id).eq('responsavel_id', savedResp.id)
      
      const { error: linkError } = await supabase
        .from('aluno_responsavel')
        .insert({
          aluno_id: savedStudent.id,
          responsavel_id: savedResp.id,
          parentesco: parentesco || '',
          resp_financeiro: isFinanceiro || false,
          resp_pedagogico: isPedagogico || false,
          resp_outro: isOutro || false
        })
        
      if (linkError) throw new Error(`Erro ao vincular responsável ${resp.nome} ao aluno: ${linkError.message}`)
    }

    // Dispara Saudação Automática se estiver configurada e ativa
    try {
      const { data: configData } = await supabase.from('configuracoes').select('valor').eq('chave', 'ad_config').maybeSingle()
      if (configData && configData.valor?.saudacao?.ativa) {
        const saudacao = configData.valor.saudacao;
        const msg = (saudacao.mensagem || '')
          .replace(/{nome_aluno}/g, savedStudent.nome)
          .replace(/{nome_responsavel}/g, responsaveis[0]?.nome || 'Família')
        
        const anexos = saudacao.imagemUrl ? [{ type: 'image', url: saudacao.imagemUrl, nome: 'boas-vindas.jpg' }] : [];
        const novoId = `COM-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
        
        let autorNome = 'Ivan Rossi'
        let autorCargo = 'Diretor Geral'
        let autorFoto = 'https://github.com/ivanrossi.png'
        
        try {
          const supabaseAdmin = getAdminClient()
          const { data: masterData } = await supabaseAdmin.from('system_users').select('nome, cargo, dados').eq('email', 'direcao@colegioimpacto.net').maybeSingle()
          if (masterData) {
            if (masterData.nome) autorNome = masterData.nome
            if (masterData.cargo) autorCargo = masterData.cargo
            if (masterData.dados?.foto) autorFoto = masterData.dados.foto
          }
        } catch(e) {
          console.error('[Saudacao] Erro ao buscar foto do master', e)
        }

        await supabase.from('comunicados').insert({
          id: novoId,
          titulo: saudacao.titulo || 'Mensagem de Boas-vindas',
          texto: msg,
          autor: autorNome,
          data: new Date().toISOString(),
          destino: 'selecionados',
          fixado: true,
          dados: {
            autorFoto: autorFoto,
            autorCargo: autorCargo,
            tipo: saudacao.imagemUrl ? 'arquivo' : 'texto',
            status: 'enviado',
            prioridade: 'normal',
            permiteResposta: true,
            exigeCiencia: false,
            alunosIds: [savedStudent.id],
            turmas: [],
            leituras: {},
            ciencias: {},
            anexos: anexos,
            conteudo: msg,
            dataEnvio: new Date().toISOString(),
            isSaudacao: true
          }
        })
      }
    } catch(err: any) {
      console.error('[Saudacao Error]', err.message)
    }

    // Sincroniza em segundo plano com a portaria
    syncStudentToDevices(savedStudent.id, 'create').catch(err => 
      console.error('[Portaria Sync Error]', err.message)
    )

    invalidateAlunosCache()
    return NextResponse.json(savedStudent, { status: 201 })
  } catch (e: any) {
    console.error(`[${new Date().toISOString()}] Error Alunos POST: ${e.message}\n`)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── PUT: Atualizar aluno ───────────────────────────────────────────────────
export async function PUT(request: Request) {
  const { user, isStaff, isFamilyOrStudent, errorResponse } = await resolveUserRole(request)
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id') || body.id

    if (!id) return NextResponse.json({ error: 'ID é obrigatório para atualização' }, { status: 400 })

    const row = buildRow(body)
    delete row.id // Não atualiza o ID!

    console.info(`[${new Date().toISOString()}] PUT Aluno: ${row.nome} (ID: ${id})\n`)

    // 0. Verifica duplicidade de E-mail do Aluno
    if (row.email && row.email.trim()) {
      const emailLower = row.email.trim().toLowerCase()
      const { data: existingStudentEmail } = await supabase.from('alunos').select('id, nome').eq('email', emailLower).neq('id', id).maybeSingle()
      if (existingStudentEmail) {
        return NextResponse.json({ error: `Este e-mail já está sendo utilizado por outro aluno (${existingStudentEmail.nome})!` }, { status: 400 })
      }
    }

    // 0.1 Buscar dados prévios do aluno para garantir preservação do histórico de turmas e campos existentes
    const { data: existingStudent } = await supabase
      .from('alunos')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!isStaff || isFamilyOrStudent) {
      if (!existingStudent) {
        return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
      }
      const userEmail = String(user?.email || '').trim().toLowerCase()
      const metaAlunoId = String(user?.user_metadata?.aluno_id || user?.user_metadata?.uid_legacy || '').trim()
      const metaRespId = String(user?.user_metadata?.responsavel_id || '').trim()
      let isOwner = false
      if (metaAlunoId && (metaAlunoId === String(id) || metaAlunoId === String(existingStudent.matricula))) {
        isOwner = true
      }
      if (!isOwner && userEmail && (
        userEmail === String(existingStudent.email || '').trim().toLowerCase() ||
        userEmail === String(existingStudent.dados?.email || '').trim().toLowerCase()
      )) {
        isOwner = true
      }
      if (!isOwner) {
        const { data: links } = await supabase
          .from('aluno_responsavel')
          .select('responsavel_id, responsaveis(email)')
          .eq('aluno_id', id)
        if (links && links.some((l: any) =>
          (metaRespId && String(l.responsavel_id) === metaRespId) ||
          (userEmail && String(l.responsaveis?.email || '').trim().toLowerCase() === userEmail)
        )) {
          isOwner = true
        }
      }
      if (!isOwner) {
        return NextResponse.json({ error: 'Acesso negado. Você só pode atualizar dados de alunos vinculados à sua conta.' }, { status: 403 })
      }
      // Nunca permitir que um aluno/responsável altere status, turma, matrícula, financeiro ou indicadores acadêmicos
      row.status = existingStudent.status
      row.turma = existingStudent.turma
      row.serie = existingStudent.serie
      row.turno = existingStudent.turno
      row.matricula = existingStudent.matricula
      row.inadimplente = existingStudent.inadimplente
      row.risco_evasao = existingStudent.risco_evasao
      row.media = existingStudent.media
      row.frequencia = existingStudent.frequencia
      row.obs = existingStudent.obs
      if (row.dados) {
        delete row.dados.status
        delete row.dados.turma
        delete row.dados.historicoTurmas
        delete row.dados.bolsa
        delete row.dados.desconto
        delete row.dados.parcelas
        delete row.dados.autorizadoSairSozinho
        delete row.dados.inadimplente
        delete row.dados.risco_evasao
        delete row.dados.media
        delete row.dados.frequencia
        delete row.dados.obs
        delete row.dados.codigo
        delete row.dados.matricula
      }
    }

    const isExplicitPhotoRemoval = body.removerFoto === true || body.foto === '' || body.deleteFoto === true

    if (existingStudent) {
      if (isExplicitPhotoRemoval) {
        row.foto = null
        ;(row as any).foto_url = null
      } else {
        if (!row.foto && existingStudent.foto) row.foto = existingStudent.foto
        if (!(row as any).foto_url && (existingStudent as any).foto_url) (row as any).foto_url = (existingStudent as any).foto_url
      }
      if (!row.data_nascimento && existingStudent.data_nascimento) row.data_nascimento = existingStudent.data_nascimento
      if (!row.serie && existingStudent.serie) row.serie = existingStudent.serie
      if (!row.turno && existingStudent.turno) row.turno = existingStudent.turno
      if (!row.obs && existingStudent.obs) row.obs = existingStudent.obs
      if ((!row.unidade || row.unidade === 'Unidade Centro') && existingStudent.unidade) row.unidade = existingStudent.unidade
      if (!('email' in body) && existingStudent.email) row.email = existingStudent.email
      if (!('telefone' in body || 'celular' in body) && existingStudent.telefone) row.telefone = existingStudent.telefone
      row.dados = { ...(existingStudent.dados || {}), ...(row.dados || {}) }
      delete row.dados.removerFoto
      if (row.dados && Array.isArray(row.dados.historicoTurmas) && row.dados.historicoTurmas.length > 0) {
        const lastHist = row.dados.historicoTurmas[row.dados.historicoTurmas.length - 1];
        const isLastIntegral = Boolean(
          lastHist && (
            lastHist.isIntegralIntermediario === true || 
            String(lastHist.modalidade || '').toUpperCase().includes('INTEGRAL') || 
            String(lastHist.modalidade || '').toUpperCase().includes('INTERMEDI') ||
            String(lastHist.turno || '').toUpperCase().includes('INTEGRAL') ||
            String(lastHist.turno || '').toUpperCase().includes('INTERMEDI')
          )
        );
        row.dados.isIntegralIntermediario = isLastIntegral;
        if (isLastIntegral) {
          row.dados.modalidade = 'INTEGRAL/INTERMEDIÁRIO';
        } else if (!isLastIntegral && (row.dados.modalidade === 'INTEGRAL/INTERMEDIÁRIO' || row.dados.modalidade === 'INTEGRAL')) {
          row.dados.modalidade = '';
        }
      }
      if (isExplicitPhotoRemoval && row.dados) {
        row.dados.foto = null
        row.dados.foto_url = null
        row.dados.fotoUrl = null
        row.dados.avatarUrl = null
      } else if (row.dados) {
        if (!row.dados.foto && existingStudent.dados?.foto) row.dados.foto = existingStudent.dados.foto
        if (!row.dados.foto_url && existingStudent.dados?.foto_url) row.dados.foto_url = existingStudent.dados.foto_url
        if (!row.dados.fotoUrl && existingStudent.dados?.fotoUrl) row.dados.fotoUrl = existingStudent.dados.fotoUrl
        if (!row.dados.avatarUrl && existingStudent.dados?.avatarUrl) row.dados.avatarUrl = existingStudent.dados.avatarUrl
      }
    }

    if ('email' in body || row.email) {
      if (!row.dados) row.dados = {}
      row.dados.email = row.email || ''
      if ('emailAluno' in row.dados) row.dados.emailAluno = row.email || ''
      if ('email_aluno' in row.dados) row.dados.email_aluno = row.email || ''
    }
    if ('telefone' in body || 'celular' in body || row.telefone) {
      if (!row.dados) row.dados = {}
      row.dados.telefone = row.telefone || ''
      if ('celular' in row.dados) row.dados.celular = row.telefone || ''
    }

    const prevTurma = existingStudent?.turma || existingStudent?.dados?.turma
    const newTurma = row.turma
    let currentHist: any[] = Array.isArray(row.dados?.historicoTurmas)
      ? [...row.dados.historicoTurmas]
      : (Array.isArray(existingStudent?.dados?.historicoTurmas) ? [...existingStudent.dados.historicoTurmas] : [])

    const nowIso = new Date().toISOString()

    if (prevTurma && newTurma && String(prevTurma).trim() !== String(newTurma).trim()) {
      // Verificar se a turma anterior já está no histórico
      const hasPrevInHist = currentHist.some((h: any) => 
        String(h.serieTurma || h.turma || h.turmaId || '').trim() === String(prevTurma).trim()
      )

      if (!hasPrevInHist) {
        // Preserva a turma anterior com status Anterior e dataSaida
        const prevVinculo = {
          id: `HIST-${Date.now() - 1000}`,
          serieTurma: String(prevTurma).trim(),
          turmaId: String(prevTurma).trim(),
          serie: existingStudent?.serie || existingStudent?.dados?.serie || '',
          segmento: existingStudent?.dados?.segmento || '',
          anoLetivo: existingStudent?.dados?.anoLetivo || row.dados?.anoLetivo || new Date().getFullYear().toString(),
          status: 'Anterior',
          dataInicio: existingStudent?.dados?.data_matricula || existingStudent?.created_at || nowIso,
          dataSaida: nowIso,
          dataFim: nowIso,
          isIntegralIntermediario: Boolean(existingStudent?.dados?.isIntegralIntermediario)
        }
        currentHist = [prevVinculo, ...currentHist]
      } else {
        // Garante que a turma anterior tenha dataSaida e status Anterior
        currentHist = currentHist.map((h: any) => {
          const isPrev = String(h.serieTurma || h.turma || '').trim() === String(prevTurma).trim()
          if (isPrev) {
            return {
              ...h,
              status: 'Anterior',
              dataSaida: h.dataSaida || h.dataFim || nowIso,
              dataFim: h.dataFim || h.dataSaida || nowIso
            }
          }
          return h
        })
      }

      // Garante que a nova turma está no histórico como Cursando
      const lastEntry = currentHist[currentHist.length - 1]
      if (!lastEntry || String(lastEntry.serieTurma || lastEntry.turma || '').trim() !== String(newTurma).trim()) {
        currentHist.push({
          id: `HIST-${Date.now()}`,
          serieTurma: String(newTurma).trim(),
          turmaId: String(newTurma).trim(),
          serie: row.serie || row.dados?.serie || '',
          segmento: row.dados?.segmento || '',
          anoLetivo: row.dados?.anoLetivo || new Date().getFullYear().toString(),
          status: 'Cursando',
          dataInicio: nowIso,
          dataEntrada: nowIso,
          dataFim: null,
          dataSaida: null,
          isIntegralIntermediario: Boolean(row.dados?.isIntegralIntermediario)
        })
      } else {
        currentHist[currentHist.length - 1] = {
          ...lastEntry,
          status: 'Cursando',
          dataInicio: lastEntry.dataInicio || nowIso,
          dataFim: null,
          dataSaida: null
        }
      }
    } else if (currentHist.length > 0) {
      // Normaliza histórico garantindo status Cursando para o último e Anterior para os demais
      currentHist = currentHist.map((h: any, idx: number) => {
        const isLast = idx === currentHist.length - 1
        if (isLast) {
          return {
            ...h,
            status: 'Cursando',
            dataFim: null,
            dataSaida: null
          }
        } else {
          return {
            ...h,
            status: 'Anterior',
            dataSaida: h.dataSaida || h.dataFim || (currentHist[idx + 1]?.dataInicio || nowIso),
            dataFim: h.dataFim || h.dataSaida || (currentHist[idx + 1]?.dataInicio || nowIso)
          }
        }
      })
    }

    if (!row.dados) row.dados = {}
    row.dados.historicoTurmas = currentHist

    // 1. Atualizar o aluno
    const { data: studentData, error: studentError } = await supabase
      .from('alunos')
      .update(row)
      .eq('id', id)
      .select()

    if (studentError) throw new Error(studentError.message)
    
    const savedStudent = studentData?.[0]
    if (!savedStudent) throw new Error('Aluno não encontrado ou não atualizado')

    const oldStudentEmail =
      existingStudent?.email ||
      existingStudent?.dados?.email ||
      existingStudent?.dados?.emailAluno ||
      existingStudent?.dados?.email_aluno ||
      null
    const newStudentEmail = savedStudent.email || savedStudent.dados?.email || null

    await syncAlunoAuthOnEmailChange({
      alunoId: String(savedStudent.id),
      matricula:
        savedStudent.matricula ||
        savedStudent.dados?.codigo ||
        existingStudent?.matricula ||
        existingStudent?.dados?.codigo ||
        null,
      oldEmail: oldStudentEmail,
      newEmail: newStudentEmail,
      authId: existingStudent?.auth_id || savedStudent.auth_id || null,
      nome: savedStudent.nome || existingStudent?.nome || '',
    })

    // 2. Salvar responsáveis e vínculos (mesma lógica do POST, restrito a colaboradores)
    const responsaveis = (isStaff && !isFamilyOrStudent)
      ? (body.responsaveis || body._responsaveis || []).filter((r: any) => r.nome && r.nome.trim() !== '')
      : []
    const validColumns = ['id', 'nome', 'data_nasc', 'email', 'telefone', 'celular', 'profissao', 'estado_civil', 'rfid', 'codigo', 'dias_acesso', 'proibido', 'dados']
    const savedRespIds: string[] = []

    for (const resp of responsaveis) {
      const parentesco = resp.parentesco || resp.tipo || ''
      const isFinanceiro = resp.isFinanceiro === true || resp.respFinanceiro === true
      const isPedagogico = resp.isPedagogico === true || resp.respPedagogico === true
      const isOutro = resp.isOutro === true || (!isFinanceiro && !isPedagogico)
      const respDataToSave: any = {}

      const isNewResp = !resp.id || (typeof resp.id === 'string' && resp.id.startsWith('TEMP-')) || resp.id === ''
      
      // Verifica se o responsável é NOVO (adicionado na interface) e o ID digitado já existe
      if (resp.isNewAdded && resp.id && !resp.id.startsWith('TEMP-')) {
        const { data: existing } = await supabase.from('responsaveis').select('id, nome').eq('id', resp.id).maybeSingle()
        if (existing) {
          throw new Error(`O ID "${resp.id}" já pertence ao responsável "${existing.nome}". Por favor, escolha outro ID para este novo responsável.`)
        }
      }
      
      // Preservar e mesclar com dados existentes no banco
      const dados = { ...(resp.dados || {}) }
      let prevRespRecord: any = null
      if (!isNewResp) {
        const { data: existingResp } = await supabase
          .from('responsaveis')
          .select('id, nome, email, auth_id, dados')
          .eq('id', resp.id)
          .maybeSingle()
        prevRespRecord = existingResp
        if (existingResp?.dados) {
          Object.assign(dados, existingResp.dados)
        }
      }
      if (resp.cpf) {
        dados.cpf = String(resp.cpf).replace(/\D/g, '')
      }
      if (resp.rg) {
        dados.rg = String(resp.rg).trim()
      }
      if (resp.rgOrgaoEmissor || resp.orgEmissor) {
        dados.rgOrgaoEmissor = resp.rgOrgaoEmissor || resp.orgEmissor
        dados.orgEmissor = dados.rgOrgaoEmissor
      }
      if (resp.nacionalidade) dados.nacionalidade = resp.nacionalidade
      if (resp.naturalidade) dados.naturalidade = resp.naturalidade
      if (resp.naturalidadeUf) dados.naturalidadeUf = resp.naturalidadeUf
      if (resp.sexo) dados.sexo = resp.sexo
      if (resp.estadoCivil || resp.estado_civil) {
        dados.estadoCivil = resp.estadoCivil || resp.estado_civil
        respDataToSave.estado_civil = dados.estadoCivil
      }
      if (resp.profissao) {
        dados.profissao = resp.profissao
        respDataToSave.profissao = resp.profissao
      }

      // Endereço Residencial
      if (resp.cep) dados.cep = resp.cep
      if (resp.endereco || resp.logradouro) {
        dados.endereco = resp.endereco || resp.logradouro
        dados.logradouro = dados.endereco
      }
      if (resp.numero) dados.numero = resp.numero
      if (resp.complemento) dados.complemento = resp.complemento
      if (resp.bairro) dados.bairro = resp.bairro
      if (resp.cidade) dados.cidade = resp.cidade
      if (resp.uf || resp.ufEnd) {
        dados.uf = resp.uf || resp.ufEnd
        dados.ufEnd = dados.uf
      }

      // Endereço Comercial
      if (resp.comercialEmpresa) dados.comercialEmpresa = resp.comercialEmpresa
      if (resp.comercialTelefone) dados.comercialTelefone = resp.comercialTelefone
      if (resp.comercialCep) dados.comercialCep = resp.comercialCep
      if (resp.comercialEndereco) dados.comercialEndereco = resp.comercialEndereco
      if (resp.comercialNumero) dados.comercialNumero = resp.comercialNumero
      if (resp.comercialComplemento) dados.comercialComplemento = resp.comercialComplemento
      if (resp.comercialBairro) dados.comercialBairro = resp.comercialBairro
      if (resp.comercialCidade) dados.comercialCidade = resp.comercialCidade
      if (resp.comercialUf) dados.comercialUf = resp.comercialUf

      respDataToSave.dados = dados
      
      const dataNasc = resp.dataNasc || resp.data_nasc
      if (dataNasc) respDataToSave.data_nasc = dataNasc
      
      const diasAcesso = resp.diasAcesso || resp.dias_acesso
      if (diasAcesso) respDataToSave.dias_acesso = diasAcesso
      
      const estadoCivil = resp.estadoCivil || resp.estado_civil
      if (estadoCivil) respDataToSave.estado_civil = estadoCivil
      
      const codigo = resp.codigoAluno || resp.codigo
      if (codigo) respDataToSave.codigo = codigo

      const telefone = resp.celular || resp.telefone
      if (telefone) respDataToSave.telefone = telefone
      
      for (const col of validColumns) {
        if (respDataToSave[col] === undefined && resp[col] !== undefined) {
          if (col === 'codigo' && !resp[col]) {
            respDataToSave[col] = null
          } else {
            respDataToSave[col] = resp[col]
          }
        }
      }
      
      // Verifica duplicidade de E-mail do Responsável
      if (respDataToSave.email && respDataToSave.email.trim()) {
        const emailLower = respDataToSave.email.trim().toLowerCase()
        let query = supabase.from('responsaveis').select('id, nome, email, auth_id, dados').eq('email', emailLower)
        if (!isNewResp && respDataToSave.id) {
          query = query.neq('id', respDataToSave.id)
        }
        const { data: existingRespEmail } = await query.maybeSingle()
        if (existingRespEmail) {
          // Em vez de dar erro, vamos usar o responsável existente e atualizar os dados dele
          respDataToSave.id = existingRespEmail.id
          prevRespRecord = existingRespEmail
        }
      }

      // Verifica duplicidade por Nome se o ID ainda não tiver sido localizado
      if (!respDataToSave.id && respDataToSave.nome && respDataToSave.nome.trim()) {
        const nameClean = respDataToSave.nome.trim().replace(/\s+/g, ' ')
        const { data: existingRespName } = await supabase
          .from('responsaveis')
          .select('id, nome, email, auth_id, dados')
          .ilike('nome', nameClean)
          .maybeSingle()
        if (existingRespName) {
          respDataToSave.id = existingRespName.id
          prevRespRecord = existingRespName
        }
      }
      
      if (!respDataToSave.id || (typeof respDataToSave.id === 'string' && respDataToSave.id.startsWith('TEMP-')) || respDataToSave.id === '') {
        delete respDataToSave.id
      }
      
      const { data: queryData, error: respError } = await supabase
        .from('responsaveis')
        .upsert(respDataToSave)
        .select()
        
      if (respError) throw new Error(`Erro ao salvar responsável ${resp.nome}: ${respError.message}`)
      
      const savedResp = queryData && queryData.length > 0 ? queryData[0] : null
      if (!savedResp) throw new Error(`Nenhum dado retornado para o responsável ${resp.nome}`)

      if (prevRespRecord) {
        await syncResponsavelAuthOnEmailChange({
          responsavelId: String(savedResp.id),
          oldEmail: prevRespRecord.email || prevRespRecord.dados?.email || null,
          newEmail: savedResp.email || savedResp.dados?.email || null,
          authId: prevRespRecord.auth_id || savedResp.auth_id || null,
          nome: savedResp.nome || prevRespRecord.nome || '',
        })
      }
      
      savedRespIds.push(savedResp.id)

      const { error: linkError } = await supabase
        .from('aluno_responsavel')
        .upsert({
          aluno_id: savedStudent.id,
          responsavel_id: savedResp.id,
          parentesco: parentesco || '',
          resp_financeiro: isFinanceiro || false,
          resp_pedagogico: isPedagogico || false,
          resp_outro: isOutro || false
        })
        
      if (linkError) throw new Error(`Erro ao vincular responsável ${resp.nome} ao aluno: ${linkError.message}`)
    }

    // 3. Desvincular responsáveis que foram removidos (apenas quando editado por colaboradores)
    if (isStaff && !isFamilyOrStudent && (Array.isArray(body.responsaveis) || Array.isArray(body._responsaveis))) {
      const studentRefs = [
        savedStudent.id,
        savedStudent.matricula,
        savedStudent.codigo,
        savedStudent.dados?.codigo,
        savedStudent.dados?.id,
        savedStudent.dados?.matricula,
        savedStudent.matricula ? String(savedStudent.matricula) : null,
        savedStudent.codigo ? String(savedStudent.codigo) : null,
        savedStudent.dados?.codigo ? String(savedStudent.dados?.codigo) : null,
        body.aluno?.codigo ? String(body.aluno.codigo) : null,
        body.codigo ? String(body.codigo) : null
      ].filter(Boolean).map(r => String(r).trim())

      const { data: currentLinks, error: fetchLinksError } = await supabase
        .from('aluno_responsavel')
        .select('responsavel_id')
        .in('aluno_id', studentRefs)

      if (!fetchLinksError && currentLinks) {
        const savedRespIdsClean = savedRespIds.map(s => String(s).trim())
        const linksToDelete = currentLinks
          .map((l: any) => String(l.responsavel_id).trim())
          .filter((id: string) => !savedRespIdsClean.includes(id))

        if (linksToDelete.length > 0) {
          // Deleta os vínculos na tabela aluno_responsavel
          const { error: unlinkError } = await supabase
            .from('aluno_responsavel')
            .delete()
            .in('aluno_id', studentRefs)
            .in('responsavel_id', linksToDelete)
          
          if (unlinkError) console.error('[Unlink Error]', unlinkError.message)

          // Remove os registros órfãos da tabela de responsáveis para manter a integridade dos dados
          for (const respId of linksToDelete) {
            const { data: otherLinks } = await supabase
              .from('aluno_responsavel')
              .select('aluno_id')
              .eq('responsavel_id', respId)

            if (!otherLinks || otherLinks.length === 0) {
              const { data: guardian } = await supabase
                .from('responsaveis')
                .select('*')
                .eq('id', respId)
                .maybeSingle()

              if (guardian) {
                const guardianEmail = (guardian.email || '').trim().toLowerCase()
                
                // Delete from public.responsaveis
                await supabase.from('responsaveis').delete().eq('id', respId)

                // Delete from public.system_users
                if (guardianEmail) {
                  await supabase.from('system_users').delete().eq('email', guardianEmail)
                }
                await supabase.from('system_users').delete().filter('dados->>responsavel_id', 'eq', respId)

                await syncResponsavelAuthOnEmailChange({
                  responsavelId: String(respId),
                  oldEmail: guardianEmail || guardian.dados?.email || null,
                  newEmail: null,
                  authId: guardian.auth_id || null,
                  nome: guardian.nome || '',
                })
              }
            }
          }
        }
      }
    }

    // Sincroniza em segundo plano com a portaria
    syncStudentToDevices(savedStudent.id, 'update').catch(err => 
      console.error('[Portaria Sync Error]', err.message)
    )

    // Sincronizar grupos da Agenda Digital para garantir que o aluno esteja APENAS na turma CURSANDO
    if (savedStudent && savedStudent.id && savedStudent.turma) {
      try {
        const { data: groups } = await supabase.from('agenda_grupos').select('*')
        if (groups && Array.isArray(groups)) {
          const studentId = String(savedStudent.id)
          const activeTurma = String(savedStudent.turma || '').trim()
          const hist = savedStudent.dados?.historicoTurmas || savedStudent.historicoTurmas || []
          
          for (const group of groups) {
            const gDados = group.dados || {}
            const gAlunosIds: string[] = Array.isArray(gDados.alunosIds) ? gDados.alunosIds : []
            const gSyncId = String(gDados.syncId || '').replace('sync-', '')
            const gNome = String(gDados.nome || '').trim()
            const gAno = String(gDados.ano || '').trim()

            let isCursando = false
            if (activeTurma) {
              let cursandoNome = activeTurma
              if (Array.isArray(hist) && hist.length > 0) {
                if (gAno) {
                  const matchingYear = hist.filter((h: any) => String(h.anoLetivo || '').trim() === gAno)
                  if (matchingYear.length > 0) {
                    cursandoNome = String(matchingYear[matchingYear.length - 1].serieTurma || '').trim()
                  }
                } else {
                  cursandoNome = String(hist[hist.length - 1].serieTurma || '').trim()
                }
              }

              const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').toLowerCase()
              const cNorm = norm(cursandoNome)
              const gNomeNorm = norm(gNome)
              const gSyncNorm = norm(gSyncId)
              
              if (cNorm !== '' && (cNorm === gNomeNorm || cNorm === gSyncNorm)) {
                isCursando = true
              }
            }

            let updatedIds = [...gAlunosIds]
            let changed = false

            if (isCursando) {
              if (!updatedIds.includes(studentId)) {
                updatedIds.push(studentId)
                changed = true
              }
            } else if (gSyncId || gNome) {
              // Se o grupo é de uma turma específica e o aluno NÃO é cursando nela (ex: histórico anterior)
              if (updatedIds.includes(studentId)) {
                updatedIds = updatedIds.filter(id => id !== studentId)
                changed = true

                // Registrar left_at na conversa de grupo da turma anterior para os participantes da família/aluno
                try {
                  const nowLeftIso = new Date().toISOString()
                  const { data: convGroup } = await supabase
                    .from('chat_conversations')
                    .select('id')
                    .eq('type', 'group')
                    .or(`grupo_id.eq."${group.id}",turma_id.eq."sync-${gSyncId}",turma_id.eq."${gSyncId}"`)
                    .maybeSingle()

                  if (convGroup?.id) {
                    const candidateFamilyIds = Array.from(new Set([
                      studentId,
                      savedStudent.responsavel_id,
                      savedStudent.responsavel,
                      ...(savedRespIds || [])
                    ].filter(Boolean))).map(String)

                    await supabase
                      .from('chat_participants')
                      .update({ left_at: nowLeftIso })
                      .eq('conversation_id', convGroup.id)
                      .in('user_id', candidateFamilyIds)
                      .is('left_at', null)
                  }
                } catch (errLeft) {
                  console.error('[Chat Part Sync Left Error]', errLeft)
                }
              }
            }

            if (changed) {
              await supabase.from('agenda_grupos').update({ dados: { ...gDados, alunosIds: updatedIds } }).eq('id', group.id)
            }
          }
        }
      } catch (errSync) {
        console.error('[Agenda Digital Sync Error]', errSync)
      }
    }

    invalidateAlunosCache()
    invalidateGruposCache()
    clearAuthGuardCache()
    return NextResponse.json(savedStudent)
  } catch (e: any) {
    console.error(`[${new Date().toISOString()}] Error Alunos PUT: ${e.message}\n`)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── DELETE: Remover aluno ou todos os alunos ─────────────────────────────────
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireProfile(['Master', 'Diretor Geral', 'Secretária', 'Secretaria'])
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const all = searchParams.get('all') === 'true'
    
    if (!id && !all) {
      return NextResponse.json({ error: 'ID ou parâmetro all=true é obrigatório' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    const isFamilyOnlySystemUser = (sysRow: any): boolean => {
      if (!sysRow) return true
      const rawRole = String(sysRow.perfil || sysRow.cargo || sysRow.dados?.perfil || sysRow.dados?.cargo || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      if (!rawRole) return true
      return ['responsavel', 'aluno', 'pai', 'mae', 'familia'].includes(rawRole)
    }

    // Helper to delete an auth user safely — usa findAuthUserByEmail e protege contas de colaboradores
    const deleteAuthUserByEmailOrMeta = async (email: string, metadataKey: string, metadataValue: string) => {
      try {
        if (email) {
          const cleanEmail = email.trim().toLowerCase()
          const { data: sysRows } = await supabaseAdmin
            .from('system_users')
            .select('id, auth_id, perfil, cargo, dados')
            .ilike('email', cleanEmail)
          const hasStaffAccount = (sysRows || []).some(r => !isFamilyOnlySystemUser(r))
          if (hasStaffAccount) {
            return
          }
          const foundUser = await findAuthUserByEmail(cleanEmail)
          if (foundUser?.id) {
            await supabaseAdmin.auth.admin.deleteUser(foundUser.id).catch(() => {})
          }
        }
        // Fallback: busca por metadata (ex: aluno_id, responsavel_id)
        if (metadataKey && metadataValue) {
          const { data: sysUser } = await supabaseAdmin
            .from('system_users')
            .select('id, auth_id, perfil, cargo, dados')
            .or(`dados->>${metadataKey}.eq.${metadataValue},${metadataKey}.eq.${metadataValue}`)
            .limit(1)
            .maybeSingle()
          if (sysUser && isFamilyOnlySystemUser(sysUser)) {
            const targetAuthId = sysUser.auth_id || sysUser.id
            if (targetAuthId) {
              await supabaseAdmin.auth.admin.deleteUser(targetAuthId).catch(() => {})
            }
          }
        }
      } catch (err: any) {
        console.error('Error deleting auth user:', err.message)
      }
    }

    const deleteSingleStudent = async (studentId: string) => {
      // 1. Fetch student information before deletion
      const { data: student, error: fetchError } = await supabaseAdmin
        .from('alunos')
        .select('*')
        .eq('id', studentId)
        .maybeSingle()

      if (!student) return

      const matricula = student.matricula || student.dados?.codigo || student.id
      const studentEmail = (student.email || student.dados?.email || '').trim().toLowerCase()

      // 2. Siblingless Guardian Deletion Cascade & Auth Account Revocation
      const { data: linkedResps } = await supabaseAdmin
        .from('aluno_responsavel')
        .select('responsavel_id')
        .eq('aluno_id', studentId)

      const respIds = (linkedResps || []).map(r => r.responsavel_id).filter(Boolean)

      for (const respId of respIds) {
        const { data: otherLinks } = await supabaseAdmin
          .from('aluno_responsavel')
          .select('aluno_id, resp_financeiro, resp_pedagogico')
          .eq('responsavel_id', respId)
          .neq('aluno_id', studentId)

        const hasOtherActiveLink = (otherLinks || []).some(
          (l: any) => l.resp_financeiro === true || l.resp_pedagogico === true
        )

        const { data: guardian } = await supabaseAdmin
          .from('responsaveis')
          .select('*')
          .eq('id', respId)
          .maybeSingle()

        if (guardian) {
          const guardianEmail = (guardian.email || '').trim().toLowerCase()

          if (!otherLinks || otherLinks.length === 0) {
            // Delete from public.responsaveis if no links left at all
            await supabaseAdmin.from('responsaveis').delete().eq('id', respId)

            // Delete from public.system_users SOMENTE se não for colaborador da escola
            if (guardianEmail) {
              const { data: sysRows } = await supabaseAdmin
                .from('system_users')
                .select('id, perfil, cargo, dados')
                .ilike('email', guardianEmail)
              const familySysIds = (sysRows || []).filter(isFamilyOnlySystemUser).map(r => r.id)
              if (familySysIds.length > 0) {
                await supabaseAdmin.from('system_users').delete().in('id', familySysIds)
              }
            }
            const { data: byRespIdRows } = await supabaseAdmin
              .from('system_users')
              .select('id, perfil, cargo, dados')
              .filter('dados->>responsavel_id', 'eq', respId)
            const familyRespSysIds = (byRespIdRows || []).filter(isFamilyOnlySystemUser).map(r => r.id)
            if (familyRespSysIds.length > 0) {
              await supabaseAdmin.from('system_users').delete().in('id', familyRespSysIds)
            }
          }

          // If no links left at all, OR remaining links are NOT financial or pedagogical (e.g. only 'Outro')
          if (!otherLinks || otherLinks.length === 0 || !hasOtherActiveLink) {
            await deleteAuthUserByEmailOrMeta(guardianEmail, 'responsavel_id', respId)
            await syncResponsavelAuthOnEmailChange({
              responsavelId: String(respId),
              oldEmail: guardianEmail || guardian.dados?.email || null,
              newEmail: null,
              authId: guardian.auth_id || null,
              nome: guardian.nome || '',
            })
          }
        }
      }

      // 3. Remove relational links and direct academic dependencies
      await supabaseAdmin.from('aluno_responsavel').delete().eq('aluno_id', studentId)
      await supabaseAdmin.from('ocorrencias').delete().eq('aluno_id', studentId)
      await supabaseAdmin.from('boletins').delete().eq('aluno_id', studentId)
      await supabaseAdmin.from('documentos_emitidos').delete().eq('aluno_id', studentId)
      await supabaseAdmin.from('academico_notas_aluno').delete().eq('aluno_id', studentId)

      // 4. Remover registros do aluno de frequencias e lancamentos_nota
      // Usa filtro por aluno_id nas linhas JSONB para evitar full table scan
      const { data: freqs } = await supabaseAdmin
        .from('frequencias')
        .select('id, registros')
        .or(`dados->>turmaId.eq.${student?.turma ?? ''},id.neq.NONE`)
        .limit(500)
      if (freqs) {
        const updates = freqs
          .filter(freq => {
            const registros = Array.isArray(freq.registros) ? freq.registros : []
            return registros.some((r: any) => String(r.alunoId) === String(studentId) || String(r.aluno_id) === String(studentId))
          })
          .map(freq => ({
            id: freq.id,
            registros: (freq.registros as any[]).filter((r: any) =>
              String(r.alunoId) !== String(studentId) && String(r.aluno_id) !== String(studentId)
            )
          }))
        for (const u of updates) {
          await supabaseAdmin.from('frequencias').update({ registros: u.registros }).eq('id', u.id)
        }
      }

      const { data: gradebooks } = await supabaseAdmin
        .from('lancamentos_nota')
        .select('id, notas')
        .or(`dados->>turmaId.eq.${student?.turma ?? ''},id.neq.NONE`)
        .limit(500)
      if (gradebooks) {
        const updates = gradebooks
          .filter(book => {
            const notas = Array.isArray(book.notas) ? book.notas : []
            return notas.some((n: any) => String(n.alunoId) === String(studentId) || String(n.aluno_id) === String(studentId))
          })
          .map(book => ({
            id: book.id,
            notas: (book.notas as any[]).filter((n: any) =>
              String(n.alunoId) !== String(studentId) && String(n.aluno_id) !== String(studentId)
            )
          }))
        for (const u of updates) {
          await supabaseAdmin.from('lancamentos_nota').update({ notas: u.notas }).eq('id', u.id)
        }
      }

      // 5. Delete Exit Module entries
      await supabaseAdmin.from('saida_calls').delete().filter('dados->>alunoId', 'eq', studentId)
      await supabaseAdmin.from('saida_rfid').delete().filter('dados->>alunoId', 'eq', studentId)
      await supabaseAdmin.from('saida_rfid').delete().ilike('id', `${studentId}%`)
      await supabaseAdmin.from('saida_student_guardians').delete().filter('dados->>alunoId', 'eq', studentId)
      await supabaseAdmin.from('saida_student_guardians').delete().ilike('id', `${studentId}%`)



      // 7. Remove student from Digital Agenda Groups
      const { data: groups } = await supabaseAdmin.from('agenda_grupos').select('*')
      if (groups) {
        for (const group of groups) {
          const dados = group.dados || {}
          const alunosIds = Array.isArray(dados.alunosIds) ? dados.alunosIds : []
          if (alunosIds.some((a: any) => String(a) === String(studentId))) {
            const updatedAlunosIds = alunosIds.filter((a: any) => String(a) !== String(studentId))
            await supabaseAdmin.from('agenda_grupos').update({ dados: { ...dados, alunosIds: updatedAlunosIds } }).eq('id', group.id)
          }
        }
      }

      // 8. Clean up Digital Agenda Communications target lists, reads, and sign-offs
      const { data: announcements } = await supabaseAdmin.from('comunicados').select('*')
      if (announcements) {
        for (const comm of announcements) {
          const dados = comm.dados || {}
          let changed = false

          const alunosIds = Array.isArray(dados.alunosIds) ? dados.alunosIds : []
          let updatedAlunosIds = alunosIds
          if (alunosIds.some((a: any) => String(a) === String(studentId))) {
            updatedAlunosIds = alunosIds.filter((a: any) => String(a) !== String(studentId))
            changed = true
          }

          const leituras = dados.leituras ? { ...dados.leituras } : {}
          if (leituras[studentId]) {
            delete leituras[studentId]
            changed = true
          }
          for (const rId of respIds) {
            if (leituras[rId]) {
              delete leituras[rId]
              changed = true
            }
          }

          const ciencias = dados.ciencias ? { ...dados.ciencias } : {}
          if (ciencias[studentId]) {
            delete ciencias[studentId]
            changed = true
          }
          for (const rId of respIds) {
            if (ciencias[rId]) {
              delete ciencias[rId]
              changed = true
            }
          }

          if (changed) {
            const destino = String(comm.destino || '').toLowerCase()
            const turmas = Array.isArray(dados.turmas) ? dados.turmas : []
            
            if (updatedAlunosIds.length === 0 && destino !== 'todos' && turmas.length === 0) {
              await supabaseAdmin.from('comunicados').delete().eq('id', comm.id)
            } else {
              await supabaseAdmin
                .from('comunicados')
                .update({
                  dados: {
                    ...dados,
                    alunosIds: updatedAlunosIds,
                    leituras,
                    ciencias
                  }
                })
                .eq('id', comm.id)
            }
          }
        }
      }

      // 9. Clean up student credentials (somente registros de perfil Aluno/Família)
      if (studentEmail) {
        const { data: sysRows } = await supabaseAdmin
          .from('system_users')
          .select('id, perfil, cargo, dados')
          .ilike('email', studentEmail)
        const familySysIds = (sysRows || []).filter(isFamilyOnlySystemUser).map(r => r.id)
        if (familySysIds.length > 0) {
          await supabaseAdmin.from('system_users').delete().in('id', familySysIds)
        }
      }
      await supabaseAdmin.from('system_users').delete().filter('dados->>aluno_id', 'eq', studentId)

      const virtualEmail = `aluno.${matricula}@impactoedu.local`
      await deleteAuthUserByEmailOrMeta(studentEmail, 'aluno_id', studentId)
      await deleteAuthUserByEmailOrMeta(virtualEmail, 'aluno_id', studentId)

      // 10. Delete the student's record
      const { error } = await supabaseAdmin.from('alunos').delete().eq('id', studentId)
      if (error) throw error

      await syncAlunoAuthOnEmailChange({
        alunoId: String(studentId),
        matricula: String(matricula || ''),
        oldEmail: studentEmail || null,
        newEmail: null,
        authId: student.auth_id || null,
        nome: student.nome || '',
      })

      // Remove do leitor iDFace em segundo plano
      syncStudentToDevices(studentId, 'delete').catch(err => 
        console.error('[Portaria Sync Error]', err.message)
      )
    }

    if (all) {
      // Get all student IDs in the database
      const { data: allStudents, error: fetchAllError } = await supabaseAdmin
        .from('alunos')
        .select('id')
      
      if (fetchAllError) throw fetchAllError
      
      const studentIds = (allStudents || []).map(s => s.id)
      
      // Delete in parallel chunks of 10 to keep system responsive but fast
      const chunkSize = 10
      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize)
        await Promise.all(chunk.map(studentId => deleteSingleStudent(studentId)))
      }
      
      invalidateAlunosCache()
      invalidateGruposCache()
      clearAuthGuardCache()
      invalidateAuthUsersCache()
      return NextResponse.json({ ok: true, count: studentIds.length })
    } else if (id) {
      await deleteSingleStudent(id)
      invalidateAlunosCache()
      invalidateGruposCache()
      clearAuthGuardCache()
      invalidateAuthUsersCache()
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Nenhuma ação executada' }, { status: 400 })
  } catch (e: any) {
    console.error(`[${new Date().toISOString()}] Error Alunos DELETE: ${e.message}\n`)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRow(a: any) {
  const { 
    id, nome, matricula, turma, serie, turno, status, email, 
    data_nascimento, responsavel, responsavel_financeiro, responsavel_pedagogico, 
    telefone, inadimplente, risco_evasao, media, frequencia, obs, unidade, foto,
    responsaveis, _responsaveis, historicoTurmas,
    ...rest 
  } = a

  // Map fields from the UI form if they are different
  const mappedNome = nome || a.nomeCompleto || ''
  const mappedMatricula = matricula?.trim() || a.codigo?.trim() || a.dados?.codigo?.trim() || a.dados?.matricula?.trim() || null
  const mappedEmail = ('email' in a && a.email !== undefined)
    ? String(a.email || '').trim()
    : (email || a.dados?.email || a.dados?.emailAluno || a.dados?.email_aluno || '').trim()
  const mappedTelefone = ('telefone' in a && a.telefone !== undefined)
    ? String(a.telefone || '').trim()
    : ('celular' in a && a.celular !== undefined)
      ? String(a.celular || '').trim()
      : (telefone || a.dados?.telefone || a.celular || a.dados?.celular || '').trim()
  const mappedDataNasc = data_nascimento || a.dataNasc || a.dados?.dataNasc || ''
  
  // Handle status: if 'ativo' boolean is passed, map to 'matriculado' or 'inativo'
  let mappedStatus = status
  if (a.ativo !== undefined) {
    mappedStatus = a.ativo ? 'matriculado' : 'inativo'
  }

  // Usa o código manual (a.codigo) como ID se disponível, senão usa o ID atual ou gera um novo
  let finalId = a.codigo || id
  if (!finalId || finalId.startsWith('TEMP-') || finalId === '') {
    finalId = `AL-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
  }

  // Encontra o responsável financeiro e pedagógico para preencher os campos legados
  const listResps = responsaveis || a._responsaveis || []
  const firstResp = listResps?.[0]?.nome || ''
  const finResp = listResps?.find((r: any) => r.isFinanceiro || r.respFinanceiro)?.nome || firstResp
  const pedResp = listResps?.find((r: any) => r.isPedagogico || r.respPedagogico)?.nome || firstResp

  const hasProvidedResps = Array.isArray(responsaveis) || Array.isArray(a._responsaveis)

  if (hasProvidedResps) {
    delete rest.responsaveis
    delete rest._responsaveis
    delete rest.outrosResponsaveis
    delete rest.responsaveisOutros
    delete rest.responsavelPedagogico
    delete rest.responsavel_pedagogico
    delete rest.responsavelFinanceiro
    delete rest.responsavel_financeiro
    delete rest.responsavelOutro
    delete rest.responsavel_outro
    delete rest.resp_pedagogico
    delete rest.resp_financeiro
    delete rest.resp_outro
    delete rest.mae
    delete rest.nomeMae
    delete rest.pai
    delete rest.nomePai
    delete rest.nome_mae
    delete rest.nome_pai
    delete rest.responsavel
    delete rest.nomeResponsavel
  }

  const extractName = (val: any) => {
    if (!val) return ''
    if (typeof val === 'object') return val.nome || ''
    if (typeof val === 'string' && val.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(val)
        return parsed.nome || val
      } catch (e) {
        return val
      }
    }
    return val
  }

  let activeTurma = turma || '';
  let activeSerie = serie || '';
  
  if (historicoTurmas && Array.isArray(historicoTurmas) && historicoTurmas.length > 0) {
    rest.historicoTurmas = historicoTurmas;
    // A última turma adicionada é sempre considerada a turma atual (matriculado)
    const mainTurma = historicoTurmas[historicoTurmas.length - 1];
      
    activeTurma = mainTurma.serieTurma || activeTurma;
    activeSerie = mainTurma.serie || activeSerie;
    rest.anoLetivo = mainTurma.anoLetivo;

    const isMainIntegral = Boolean(
      mainTurma.isIntegralIntermediario === true || 
      String(mainTurma.modalidade || '').toUpperCase().includes('INTEGRAL') ||
      String(mainTurma.modalidade || '').toUpperCase().includes('INTERMEDI') ||
      String(mainTurma.turno || '').toUpperCase().includes('INTEGRAL') ||
      String(mainTurma.turno || '').toUpperCase().includes('INTERMEDI')
    );
    rest.isIntegralIntermediario = isMainIntegral;
    if (isMainIntegral) {
      rest.modalidade = 'INTEGRAL/INTERMEDIÁRIO';
    } else {
      if (rest.modalidade === 'INTEGRAL/INTERMEDIÁRIO' || rest.modalidade === 'INTEGRAL') {
        rest.modalidade = '';
      }
    }
  }

  return {
    id: finalId,
    nome: mappedNome,
    matricula: mappedMatricula,
    turma: activeTurma,
    serie: activeSerie || serie || '',
    turno: turno || '',
    status: mappedStatus || 'matriculado',
    email: mappedEmail,
    data_nascimento: mappedDataNasc,
    responsavel: hasProvidedResps ? (firstResp || null) : (extractName(responsavel) || firstResp || null),
    responsavel_financeiro: hasProvidedResps ? (finResp || null) : (extractName(responsavel_financeiro) || finResp || null),
    responsavel_pedagogico: hasProvidedResps ? (pedResp || null) : (extractName(responsavel_pedagogico) || pedResp || null),
    telefone: mappedTelefone,
    inadimplente: inadimplente || false,
    risco_evasao: risco_evasao || 'baixo',
    media: media || null,
    frequencia: frequencia || 100,
    obs: obs || '',
    unidade: unidade || 'Unidade Centro',
    foto: foto || null,
    dados: {
      ...rest,
      email: mappedEmail,
      telefone: mappedTelefone,
      codigo: mappedMatricula
    }, // Guarda outros campos no JSONB
    updated_at: new Date().toISOString(),
  }
}
