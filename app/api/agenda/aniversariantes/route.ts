import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { 
  getAlunoTodasTurmasEGrupos, 
  getAlunoNomesTurmasEGrupos,
  getAlunoTurnosAtivos, 
  normalizeTurmaText 
} from '@/lib/studentTurmaUtils'

export const dynamic = 'force-dynamic'

interface CacheEntry {
  data: any[]
  timestamp: number
}

// Cache em memória no processo com TTL curto (2 minutos)
const serverNiversCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 2 * 60 * 1000

const NO_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
  'Vary': 'Accept-Encoding, Cookie'
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')
    const turmaQuery = (searchParams.get('turma') || '').trim()
    const turmasParam = (searchParams.get('turmas') || '').trim()
    const alunoId = (searchParams.get('aluno_id') || '').trim()

    if (!mes || isNaN(Number(mes))) {
      return NextResponse.json({ error: 'Mês inválido ou não informado' }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    const mesNum = parseInt(mes, 10)
    if (mesNum < 1 || mesNum > 12) {
      return NextResponse.json({ error: 'Mês fora do intervalo (1 a 12)' }, { status: 400, headers: NO_CACHE_HEADERS })
    }

    const mesStr = String(mesNum).padStart(2, '0')
    const cacheKey = `${mesStr}_${alunoId || 'no_aluno'}_${turmaQuery ? turmaQuery.toLowerCase() : 'all'}_${turmasParam ? turmasParam.toLowerCase() : 'none'}`

    // Verificar cache em memória do processo
    const cached = serverNiversCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: NO_CACHE_HEADERS
      })
    }

    const supabase = await getAdminClient()

    // Consultas paralelas:
    // 1. Alunos com filtro de mês direto no banco + status ativo
    // 2. Funcionários (colaboradores e professores da escola)
    // 3. Tabela de turmas para resolver nomes e turnos
    // 4. Se alunoId informado, buscar dados do aluno solicitante
    // 5. Grupos da agenda
    const [alunosRes, profsRes, turmasRes, targetAlunoRes, gruposRes] = await Promise.all([
      supabase
        .from('alunos')
        .select('id, nome, turma, data_nascimento, foto, dados')
        .or(`data_nascimento.ilike.%-${mesStr}-%,data_nascimento.ilike.%/${mesStr}/%`)
        .or('status.neq.inativo,status.is.null'),
      supabase
        .from('funcionarios')
        .select('id, nome, cargo, data_nascimento, dados')
        .not('data_nascimento', 'is', null)
        .or('status.neq.inativo,status.is.null'),
      supabase
        .from('turmas')
        .select('*'),
      alunoId
        ? supabase.from('alunos').select('*').eq('id', alunoId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('agenda_grupos')
        .select('*')
    ])

    if (alunosRes.error) throw alunosRes.error
    if (turmasRes.error) console.warn('[API /api/agenda/aniversariantes] Aviso ao consultar turmas:', turmasRes.error)
    if (gruposRes.error) console.warn('[API /api/agenda/aniversariantes] Aviso ao consultar agenda_grupos:', gruposRes.error)

    const allTurmas = turmasRes.data || []
    const allGrupos = gruposRes.data || []
    const targetAluno = targetAlunoRes.data

    // Mapeamento abrangente de Turmas (ID, Código, dados.codigo -> Nome legível e Turno)
    const turmaMap = new Map<string, string>()
    const turmaTurnoMap = new Map<string, string>()

    for (const t of allTurmas) {
      if (!t) continue
      const tNome = String(t.nome || t.dados?.nome || '').trim()
      const tTurno = String(t.turno || t.dados?.turno || '').trim()
      if (!tNome) continue

      const addTurmaKey = (key: any) => {
        if (key == null) return
        const strKey = String(key).trim()
        if (!strKey) return
        turmaMap.set(strKey, tNome)
        turmaMap.set(strKey.toLowerCase(), tNome)
        if (tTurno) {
          turmaTurnoMap.set(strKey, tTurno)
          turmaTurnoMap.set(strKey.toLowerCase(), tTurno)
        }
      }

      addTurmaKey(t.id)
      addTurmaKey(t.codigo)
      addTurmaKey(t.dados?.codigo)
      addTurmaKey(t.dados?.id)
      addTurmaKey(t.dados?.turma_id)
      addTurmaKey(tNome)
    }

    // Mapeamento de Grupos da Agenda (ID, syncId -> Nome legível)
    for (const g of allGrupos) {
      if (!g) continue
      const gNome = String(g.nome || g.dados?.nome || '').trim()
      if (!gNome) continue

      if (g.id != null) {
        turmaMap.set(String(g.id).trim(), gNome)
        turmaMap.set(String(g.id).trim().toLowerCase(), gNome)
      }
      const syncId = g.syncId || g.dados?.syncId || (String(g.id).startsWith('sync-') ? g.id : null)
      if (syncId) {
        turmaMap.set(String(syncId).trim(), gNome)
        turmaMap.set(String(syncId).trim().toLowerCase(), gNome)
      }
    }

    // Identificação de turmas e grupos alvo
    const targetTurmaKeys = new Set<string>()
    const targetTurnos = new Set<string>()

    // 1. Se aluno_id informado, obter todas as turmas e grupos ativos do aluno
    if (targetAluno) {
      const studentKeys = getAlunoTodasTurmasEGrupos(targetAluno, allTurmas, allGrupos)
      studentKeys.forEach(k => targetTurmaKeys.add(String(k).trim().toLowerCase()))
      
      const studentTurnos = getAlunoTurnosAtivos(targetAluno, allTurmas, allGrupos)
      studentTurnos.forEach(tu => targetTurnos.add(tu.toLowerCase()))
    }

    // 2. Se turmaQuery informada
    if (turmaQuery) {
      const parts = turmaQuery.split(',').map(s => s.trim()).filter(Boolean)
      for (const p of parts) {
        const pLower = p.toLowerCase()
        targetTurmaKeys.add(pLower)
        if (turmaMap.has(p)) {
          const mappedName = (turmaMap.get(p) || '').toLowerCase().trim()
          if (mappedName) targetTurmaKeys.add(mappedName)
        }
        // Identificar turno da query
        const pNorm = normalizeTurmaText(p)
        if (pNorm.includes('matutino') || pNorm.includes('manha')) targetTurnos.add('matutino')
        if (pNorm.includes('vespertino') || pNorm.includes('tarde')) targetTurnos.add('vespertino')
        if (pNorm.includes('noturno') || pNorm.includes('noite')) targetTurnos.add('noturno')
        if (pNorm.includes('integral')) targetTurnos.add('integral')
        if (pNorm.includes('intermediario')) targetTurnos.add('intermediario')
      }
    }

    // 3. Se turmasParam informadas
    if (turmasParam) {
      const parts = turmasParam.split(',').map(s => s.trim()).filter(Boolean)
      for (const p of parts) {
        const pLower = p.toLowerCase()
        targetTurmaKeys.add(pLower)
        if (turmaMap.has(p)) {
          const mappedName = (turmaMap.get(p) || '').toLowerCase().trim()
          if (mappedName) targetTurmaKeys.add(mappedName)
        }
        const pNorm = normalizeTurmaText(p)
        if (pNorm.includes('matutino') || pNorm.includes('manha')) targetTurnos.add('matutino')
        if (pNorm.includes('vespertino') || pNorm.includes('tarde')) targetTurnos.add('vespertino')
        if (pNorm.includes('noturno') || pNorm.includes('noite')) targetTurnos.add('noturno')
        if (pNorm.includes('integral')) targetTurnos.add('integral')
        if (pNorm.includes('intermediario')) targetTurnos.add('intermediario')
      }
    }

    const hasFilter = targetTurmaKeys.size > 0

    // Validação estrita de mês no JavaScript para garantir precisão
    const isMonthMatch = (dateStr?: string | null) => {
      if (!dateStr) return false
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-')
        return parts[1] === mesStr
      }
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/')
        return parts[1] === mesStr
      }
      return false
    }

    // Helper para verificar se um aluno candidato pertence a alguma das turmas/grupos alvo
    const candidateMatchesTarget = (a: any) => {
      if (!hasFilter) return true

      const rawTurma = String(a.turma || '').trim()
      const rawTurmaLower = rawTurma.toLowerCase()
      const nomeTurma = String(turmaMap.get(rawTurma) || a.dados?.turma_nome || '').trim()
      const nomeTurmaNorm = normalizeTurmaText(nomeTurma)

      // Identificar turnos deste aluno candidato
      const candTurnoDirect = String(a.dados?.turno || a.dados?.turno_nome || turmaTurnoMap.get(rawTurma) || '').toLowerCase()
      const candIsVespertino = nomeTurmaNorm.includes('vespertino') || nomeTurmaNorm.includes('tarde') || candTurnoDirect.includes('vespertino')
      const candIsMatutino = nomeTurmaNorm.includes('matutino') || nomeTurmaNorm.includes('manha') || candTurnoDirect.includes('matutino')
      const candIsNoturno = nomeTurmaNorm.includes('noturno') || nomeTurmaNorm.includes('noite') || candTurnoDirect.includes('noturno')

      // Bloqueio estrito de turnos conflitantes
      if (targetTurnos.size > 0) {
        if (candIsVespertino && !targetTurnos.has('vespertino')) return false
        if (candIsMatutino && !targetTurnos.has('matutino')) return false
        if (candIsNoturno && !targetTurnos.has('noturno')) return false
      }

      // 1. Match direto por ID ou código
      if (rawTurmaLower && targetTurmaKeys.has(rawTurmaLower)) return true
      if (nomeTurma && targetTurmaKeys.has(nomeTurma.toLowerCase())) return true

      // 2. Match normalizado de nome
      for (const key of targetTurmaKeys) {
        if (key && normalizeTurmaText(key) === nomeTurmaNorm) return true
      }

      // 3. Match em historicoTurmas & turmasAdicionais do candidato
      const hist = a.historicoTurmas || a.dados?.historicoTurmas
      if (Array.isArray(hist)) {
        for (const ht of hist) {
          if (!ht || ht.status === 'Inativo') continue
          const htTurma = String(ht.serieTurma || ht.turma || '').trim().toLowerCase()
          if (htTurma && targetTurmaKeys.has(htTurma)) return true
          if (normalizeTurmaText(htTurma) && targetTurmaKeys.has(normalizeTurmaText(htTurma))) return true

          if (Array.isArray(ht.turmasAdicionais)) {
            for (const sub of ht.turmasAdicionais) {
              if (!sub || sub.status === 'Inativo') continue
              const subTurma = String(sub.serieTurma || sub.turma || sub.nome || '').trim().toLowerCase()
              if (subTurma && targetTurmaKeys.has(subTurma)) return true
              if (normalizeTurmaText(subTurma) && targetTurmaKeys.has(normalizeTurmaText(subTurma))) return true
            }
          }
        }
      }

      // 4. Match em agenda_grupos onde o candidato é membro
      const cleanCandId = String(a.id || '').replace(/^(a_|_ALU)/, '')
      for (const g of allGrupos) {
        if (!g) continue
        let aIds = g.alunosIds || g.dados?.alunosIds || []
        if (typeof aIds === 'string') {
          try { aIds = JSON.parse(aIds) } catch { aIds = [] }
        }
        const isMember = (Array.isArray(aIds) ? aIds : []).some(
          (id: any) => String(id).replace(/^(a_|_ALU)/, '') === cleanCandId
        )
        if (isMember) {
          const gId = String(g.id || '').toLowerCase()
          const gNome = String(g.nome || g.dados?.nome || '').toLowerCase()
          if (gId && targetTurmaKeys.has(gId)) return true
          if (gNome && targetTurmaKeys.has(gNome)) return true
          if (normalizeTurmaText(gNome) && targetTurmaKeys.has(normalizeTurmaText(gNome))) return true
        }
      }

      return false
    }

    const niversAlunos = (alunosRes.data || [])
      .filter(a => isMonthMatch(a.data_nascimento))
      .filter(candidateMatchesTarget)
      .map(a => {
        const rawTurma = String(a.turma || '').trim()

        // 1. Tentar mapear via turmaMap (ID ou código -> Nome legível)
        let resolvedTurmaNome = turmaMap.get(rawTurma) || turmaMap.get(rawTurma.toLowerCase()) || ''

        // 2. Se não encontrou, verificar se a.dados.turma_nome é texto legível (não numérico nem UUID)
        if (!resolvedTurmaNome && a.dados?.turma_nome && isNaN(Number(a.dados.turma_nome)) && !/^[0-9a-fA-F-]{10,}$/.test(String(a.dados.turma_nome))) {
          resolvedTurmaNome = String(a.dados.turma_nome).trim()
        }

        // 3. Verificar se há histórico de turmas com nome legível
        if (!resolvedTurmaNome) {
          const hist = (a as any).historicoTurmas || a.dados?.historicoTurmas
          if (Array.isArray(hist)) {
            for (const ht of hist) {
              if (!ht || ht.status === 'Inativo') continue
              const candNome = ht.serieTurma || ht.turma || ht.nome
              if (candNome && isNaN(Number(candNome)) && !/^[0-9a-fA-F-]{10,}$/.test(String(candNome))) {
                resolvedTurmaNome = String(candNome).trim()
                break
              }
            }
          }
        }

        // 4. Usar helper de nomes legíveis do próprio aluno
        if (!resolvedTurmaNome) {
          const candNames = getAlunoNomesTurmasEGrupos(a, allTurmas, allGrupos)
          if (candNames.length > 0) {
            resolvedTurmaNome = candNames[0]
          }
        }

        // 5. Se for colega de sala do aluno visualizador (mesmo rawTurma)
        if (!resolvedTurmaNome && targetAluno) {
          const targetRaw = String(targetAluno.turma || '').trim()
          if (rawTurma && targetRaw && rawTurma === targetRaw) {
            const targetNames = getAlunoNomesTurmasEGrupos(targetAluno, allTurmas, allGrupos)
            if (targetNames.length > 0) {
              resolvedTurmaNome = targetNames[0]
            }
          }
        }

        // 6. Se ainda for código numérico ou UUID ou vazio, buscar turma correspondente em allTurmas
        if (!resolvedTurmaNome || /^\d+$/.test(resolvedTurmaNome) || /^[0-9a-fA-F-]{10,}$/.test(resolvedTurmaNome)) {
          const matchedT = allTurmas.find((t: any) => t && (
            String(t.id).trim() === rawTurma ||
            String(t.codigo || '').trim() === rawTurma ||
            String(t.dados?.codigo || '').trim() === rawTurma
          ))
          if (matchedT?.nome) {
            resolvedTurmaNome = String(matchedT.nome).trim()
          } else {
            resolvedTurmaNome = 'Aluno'
          }
        }

        return {
          id: a.id,
          nome: a.nome,
          turma: rawTurma,
          turma_nome: resolvedTurmaNome,
          turmaNome: resolvedTurmaNome,
          data_nascimento: a.data_nascimento,
          foto: a.foto || (a as any).foto_url || null,
          tipo: 'Aluno'
        }
      })

    const niversProfs = (profsRes.data || [])
      .filter((p: any) => isMonthMatch(p.data_nascimento))
      .map((p: any) => ({
        id: p.id,
        nome: p.nome,
        cargo: p.cargo || 'Colaborador',
        data_nascimento: p.data_nascimento,
        foto: p.dados?.foto || p.dados?.avatarUrl || null,
        tipo: 'Colaborador'
      }))

    const result = [
      ...niversAlunos,
      ...niversProfs
    ]

    // Salvar no cache em memória
    serverNiversCache.set(cacheKey, { data: result, timestamp: Date.now() })

    return NextResponse.json(result, {
      headers: NO_CACHE_HEADERS
    })
  } catch (err: any) {
    console.error('[API /api/agenda/aniversariantes] Erro:', err)
    return NextResponse.json({ error: err.message }, { status: 400, headers: NO_CACHE_HEADERS })
  }
}
