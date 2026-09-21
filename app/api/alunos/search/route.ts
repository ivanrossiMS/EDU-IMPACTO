import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

interface CachedStudent {
  id: string
  nome: string
  matricula: string
  turma: string
  turma_id?: string
  turma_nome?: string
  serie: string
  turno: string
  status: string
  responsavel: string
  responsavel_financeiro: string
  responsavel_pedagogico: string
  responsavelFinanceiro: string
  responsavelPedagogico: string
  dados: Record<string, any>
  _normalized: string
}

interface ServerCache {
  students: CachedStudent[]
  timestamp: number
}

// Cache leve de alunos ativos em memória no servidor (renovação a cada 2 minutos)
let serverStudentsCache: ServerCache | null = null
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutos

function normalizeText(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

async function getOrRefreshStudents(): Promise<CachedStudent[]> {
  const now = Date.now()
  if (serverStudentsCache && now - serverStudentsCache.timestamp < CACHE_TTL_MS) {
    return serverStudentsCache.students
  }

  // Carrega turmas para mapear id/código para o nome legível oficial (ex: "4º ANO A - MATUTINO")
  const { data: turmasDb } = await supabase
    .from('turmas')
    .select('id, nome, codigo')

  const turmaMap = new Map<string, string>()
  ;(turmasDb || []).forEach((t: any) => {
    const nomeLimpo = String(t.nome || '').trim()
    if (t.id && nomeLimpo) turmaMap.set(String(t.id).trim(), nomeLimpo)
    if (t.codigo && nomeLimpo) turmaMap.set(String(t.codigo).trim(), nomeLimpo)
  })

  // Busca estritamente as colunas necessárias para autocomplete e exibição de signatários
  // NÃO busca fotos base64 nem históricos pesados
  const { data, error } = await supabase
    .from('alunos')
    .select(`
      id, nome, matricula, turma, serie, turno, status,
      responsavel, responsavel_financeiro, responsavel_pedagogico,
      dados
    `)
    .or('status.neq.inativo,status.is.null')
    .order('nome', { ascending: true })

  if (error) {
    console.error('[API alunos/search] Erro ao carregar alunos do banco:', error)
    // Se o cache anterior ainda existir, usa-o como fallback
    if (serverStudentsCache) {
      return serverStudentsCache.students
    }
    throw error
  }

  const students: CachedStudent[] = (data || []).map((s: any) => {
    // Higieniza dados para garantir que fotos em base64 ou históricos não pesem a memória
    let cleanDados: Record<string, any> = {}
    if (s.dados && typeof s.dados === 'object' && !Array.isArray(s.dados)) {
      const { foto, avatarUrl, fotoUrl, imagem1, historicoTurmas, ...rest } = s.dados
      cleanDados = rest
    }

    const idStr = String(s.id || '').trim()
    const matriculaStr = String(s.matricula || idStr).trim()
    const nomeStr = String(s.nome || '').trim()
    const turmaRaw = String(s.turma || '').trim()
    const turmaNomeResolvido = turmaMap.get(turmaRaw) || cleanDados.turmaNome || cleanDados.nomeTurma || turmaRaw
    const serieStr = String(s.serie || '').trim()
    const turnoStr = String(s.turno || '').trim()

    const respFin = String(s.responsavel_financeiro || cleanDados.responsavelFinanceiro || '').trim()
    const respPed = String(s.responsavel_pedagogico || cleanDados.responsavelPedagogico || '').trim()
    const respGeral = String(s.responsavel || cleanDados.responsavel || cleanDados.nomeResponsavel || '').trim()
    const maeNome = String(cleanDados.maeNome || cleanDados.nomeMae || '').trim()
    const paiNome = String(cleanDados.paiNome || cleanDados.nomePai || '').trim()
    const cpfMae = String(cleanDados.maeCpf || cleanDados.cpfMae || '').trim()
    const cpfPai = String(cleanDados.paiCpf || cleanDados.cpfPai || '').trim()
    const cpfResp = String(cleanDados.cpfResponsavel || cleanDados.responsavelCpf || '').trim()

    // Campo normalizado para pesquisa instantânea de alta performance
    const normalizedTokens = [
      nomeStr,
      matriculaStr,
      idStr,
      turmaRaw,
      turmaNomeResolvido,
      serieStr,
      respFin,
      respGeral,
      maeNome,
      paiNome,
      cpfMae.replace(/\D/g, ''),
      cpfPai.replace(/\D/g, ''),
      cpfResp.replace(/\D/g, ''),
    ]
      .filter(Boolean)
      .map(normalizeText)
      .join(' ')

    return {
      id: idStr,
      nome: nomeStr,
      matricula: matriculaStr,
      turma: turmaNomeResolvido || turmaRaw,
      turma_id: turmaRaw,
      turma_nome: turmaNomeResolvido,
      serie: serieStr,
      turno: turnoStr,
      status: s.status || 'ativo',
      responsavel: respGeral,
      responsavel_financeiro: respFin,
      responsavel_pedagogico: respPed,
      responsavelFinanceiro: respFin,
      responsavelPedagogico: respPed,
      dados: cleanDados,
      _normalized: normalizedTokens,
    }
  })

  serverStudentsCache = {
    students,
    timestamp: now,
  }

  return students
}

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') || url.searchParams.get('search') || '').trim()
    const limitParam = parseInt(url.searchParams.get('limit') || '8', 10)
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 8 : limitParam), 50)

    if (!q) {
      return NextResponse.json({
        data: [],
        total: 0,
      }, {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      })
    }

    const allStudents = await getOrRefreshStudents()

    const cleanDigits = q.replace(/\D/g, '')
    const isNumericOnly = /^\d+$/.test(q)

    const searchTokens = normalizeText(q).split(/\s+/).filter(Boolean)

    // Filtra instantaneamente em memória (< 0.1ms para ~600 alunos)
    const matched = allStudents.filter(student => {
      // 1. Se digitou apenas números (ex: matrícula, código ou CPF)
      if (isNumericOnly && cleanDigits.length >= 2) {
        if (student.matricula.includes(cleanDigits) || student.id.includes(cleanDigits)) {
          return true
        }
      }

      // 2. Busca por termos textuais (todas as palavras digitadas devem casar)
      return searchTokens.every(token => student._normalized.includes(token))
    })

    const results = matched.slice(0, limit)

    return NextResponse.json(
      {
        data: results,
        total: matched.length,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (error: any) {
    console.error('[API alunos/search] Erro inesperado:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro ao buscar alunos' },
      { status: 500 }
    )
  }
}
