import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { getLoggedUserAccessStartDate } from '@/lib/server/visibility'
import { resolveUserRole, requireStaff } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, dbUser, isFamilyOrStudent, errorResponse } = await resolveUserRole(request)
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  let query = supabase.from('comunicados').select('*')
  
  const accessStartDate = await getLoggedUserAccessStartDate();
  if (accessStartDate) {
    query = query.gte('data', accessStartDate.toISOString());
  }

  query = query.order('data', { ascending: false })
  if (q) query = query.or(`titulo.ilike.%${q}%,autor.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (data || []).map(r => ({ ...r, ...(r.dados || {}) }));

  if (isFamilyOrStudent && user) {
    const admin = getAdminClient()
    const allowedAlunoIds = new Set<string>()
    const allowedTurmas = new Set<string>()

    const addTurma = (t: unknown) => {
      if (t && typeof t === 'string' && t.trim()) {
        allowedTurmas.add(t.trim())
        allowedTurmas.add(t.trim().toLowerCase())
      }
    }

    if (user.user_metadata?.aluno_id) allowedAlunoIds.add(String(user.user_metadata.aluno_id))
    if (dbUser?.dados?.aluno_id) allowedAlunoIds.add(String(dbUser.dados.aluno_id))

    const userEmail = (user.email || dbUser?.email || '').trim().toLowerCase()
    const respOrFilters = [`id.eq.${user.id}`, `auth_id.eq.${user.id}`]
    if (userEmail) respOrFilters.push(`email.ilike.${userEmail}`)

    const [{ data: respRows }, { data: directAlunos }] = await Promise.all([
      admin.from('responsaveis').select('id, dados').or(respOrFilters.join(',')),
      admin.from('alunos').select('id, turma, dados').or(`id.eq.${user.id}${userEmail ? `,dados->>email.ilike.${userEmail}` : ''}`),
    ])

    const respIds = new Set<string>()
    if (user.user_metadata?.responsavel_id) respIds.add(String(user.user_metadata.responsavel_id))
    for (const r of respRows || []) {
      if (r.id) respIds.add(String(r.id))
      if (Array.isArray(r.dados?.alunosVinculados)) {
        r.dados.alunosVinculados.forEach((aid: unknown) => {
          if (aid) allowedAlunoIds.add(String(aid))
        })
      }
    }

    if (respIds.size > 0) {
      const { data: vincs } = await admin
        .from('aluno_responsavel')
        .select('aluno_id')
        .in('responsavel_id', Array.from(respIds))
      for (const v of vincs || []) {
        if (v.aluno_id) allowedAlunoIds.add(String(v.aluno_id))
      }
    }

    for (const a of directAlunos || []) {
      if (a.id) allowedAlunoIds.add(String(a.id))
      addTurma(a.turma || a.dados?.turma)
    }

    if (allowedAlunoIds.size > 0) {
      const { data: linkedAlunos } = await admin
        .from('alunos')
        .select('id, turma, dados')
        .in('id', Array.from(allowedAlunoIds))
      const rawTurmas = new Set<string>()
      for (const a of linkedAlunos || []) {
        const t = a.turma || a.dados?.turma
        if (t) {
          addTurma(t)
          rawTurmas.add(String(t))
        }
      }
      if (rawTurmas.size > 0) {
        const { data: turmaRows } = await admin
          .from('turmas')
          .select('id, codigo, nome')
        for (const tr of turmaRows || []) {
          if (rawTurmas.has(String(tr.id)) || rawTurmas.has(String(tr.codigo)) || rawTurmas.has(String(tr.nome))) {
            addTurma(tr.id)
            addTurma(tr.codigo)
            addTurma(tr.nome)
          }
        }
      }
    }

    const filteredFamily = mapped.filter((c: any) => {
      if (c.status && c.status !== 'enviado' && c.status !== 'publicado') return false
      const dest = String(c.destino || c.dados?.destino || '').toLowerCase().trim()
      if (dest === 'colaboradores' || dest === 'equipe' || dest === 'professores') return false

      const cAlunos: string[] = [
        ...(Array.isArray(c.alunosIds) ? c.alunosIds : []),
        ...(Array.isArray(c.targetStudents) ? c.targetStudents : []),
        ...(c.alunoId ? [c.alunoId] : []),
      ].map(String)

      if (cAlunos.some(id => allowedAlunoIds.has(id))) return true

      const cTurmas: string[] = [
        ...(Array.isArray(c.turmas) ? c.turmas : []),
        ...(Array.isArray(c.targetClasses) ? c.targetClasses : []),
        ...(Array.isArray(c.turmasIds) ? c.turmasIds : []),
      ].map(String)

      const isGlobal =
        (dest === 'todos' || dest === 'escola_toda' || dest === 'toda a escola') ||
        cTurmas.some(t => ['todos', 'toda a escola', 'todas'].includes(t.toLowerCase().trim()))

      if (isGlobal && cAlunos.length === 0) return true

      if (cTurmas.some(t => allowedTurmas.has(t.trim()) || allowedTurmas.has(t.trim().toLowerCase()))) {
        return true
      }

      return false
    })

    return NextResponse.json(filteredFamily)
  }

  const filtered = mapped.filter(
    (c: any) => !c.isSaudacao && !c.dados?.isSaudacao && c.titulo !== 'Mensagem de Boas-vindas'
  );

  return NextResponse.json(filtered)
}

export async function POST(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    const source = { ...body, ...(body.dados || {}) }
    delete source.dados
    const { id, titulo, texto, autor, data, destino, fixado, ...rest } = source
    const row = {
      id: id || `COM${Date.now()}`,
      titulo: titulo || '',
      texto: texto || '',
      autor: autor || '',
      data: data || new Date().toISOString().slice(0, 10),
      destino: destino || 'Todos',
      fixado: fixado || false,
      dados: rest,
    }
    const { data: saved, error } = await supabase.from('comunicados').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(saved, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { errorResponse } = await requireStaff(request)
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('comunicados').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
