import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.toLowerCase()
  const serie = searchParams.get('serie')
  const status = searchParams.get('status')

  let query = supabaseServer.from('alunos').select('*').order('nome')

  if (q) query = query.or(`nome.ilike.%${q}%,matricula.ilike.%${q}%,turma.ilike.%${q}%`)
  if (serie && serie !== 'Todos') query = query.eq('serie', serie)
  if (status && status !== 'Todos') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Merge dados JSONB back into the flat structure pages expect
  const result = (data || []).map(row => ({ ...row, ...(row.dados || {}) }))
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      if (body.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const rows = body.map(a => buildRow(a)).filter(Boolean)
      if (rows.length === 0) return NextResponse.json({ ok: true, count: 0 })
      const { error } = await supabaseServer.from('alunos').upsert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, count: rows.length })
    }

    const row = buildRow(body)
    if (!row) return NextResponse.json({ error: "O Aluno não pode ter nome vazio ou reservado." }, { status: 400 })
    
    const { data, error } = await supabaseServer
      .from('alunos').upsert(row).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ...data, ...(data.dados || {}) }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

function buildRow(body: any) {
  const { id, nome, matricula, turma, serie, turno, status,
    email, cpf, dataNascimento, responsavel, responsavelFinanceiro,
    responsavelPedagogico, telefone, inadimplente, risco_evasao,
    media, frequencia, obs, unidade, foto, ...rest } = body

  if (!nome || nome.trim().length === 0 || nome.trim().toLowerCase() === 'aluno teste' || nome === 'cec' || nome === 'Rascunho Incompleto') {
    return null
  }

  return {
    id: id || `A${Date.now()}`,
    nome, matricula: matricula || '', turma: turma || '',
    serie: serie || '', turno: turno || '',
    status: status || 'matriculado',
    email: email || '', cpf: cpf || '',
    data_nascimento: dataNascimento || '',
    responsavel: responsavel || '',
    responsavel_financeiro: responsavelFinanceiro || '',
    responsavel_pedagogico: responsavelPedagogico || '',
    telefone: telefone || '',
    inadimplente: inadimplente || false,
    risco_evasao: risco_evasao || 'baixo',
    media: media ?? null,
    frequencia: frequencia ?? 100,
    obs: obs || '', unidade: unidade || '', foto: foto || null,
    dados: rest, // store all extra fields (_responsaveis, _matriculas, etc.)
  }
}
