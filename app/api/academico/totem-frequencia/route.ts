/**
 * totem-frequencia/route.ts
 *
 * Endpoint público (sem sessão Supabase) para integração com catracas e totens.
 * Autenticado por token fixo: Authorization: Bearer {API_TOTEM_SECRET}
 *
 * GET  ?data=YYYY-MM-DD  → Retorna alunos ativos SEM registro no dia (pendentes)
 * POST { data }          → Insere FALTA para os alunos sem registro no dia
 *                          Idempotente: nunca sobrescreve registros existentes
 */

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { sendAgendaPushNotification } from '@/lib/server/agendaNotifications'
import { getResponsavelIdsForTargets } from '@/lib/server/notificationHelper'

export const dynamic = 'force-dynamic'

// ── Auth por token ────────────────────────────────────────────────────────────
function validarToken(request: Request): boolean {
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const secret = process.env.API_TOTEM_SECRET || '1081'
  return token === secret
}

// ── Normaliza data para YYYY-MM-DD ────────────────────────────────────────────
function normalizarData(raw: string | null): string | null {
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

// ── Lógica compartilhada: busca pendentes ─────────────────────────────────────
async function buscarPendentes(data: string) {
  const admin = getAdminClient()

  // 1. Todos os alunos ativos com turma vinculada
  const { data: todosAlunos, error: errAlunos } = await admin
    .from('alunos')
    .select('id, nome, matricula, turma')
    .neq('status', 'inativo')
    .not('turma', 'is', null)

  if (errAlunos) throw new Error(`Erro ao buscar alunos: ${errAlunos.message}`)

  const alunos = todosAlunos || []

  // 2. IDs dos alunos que JÁ têm registro no dia (qualquer status: presente ou falta)
  const { data: registrosExistentes, error: errFreq } = await admin
    .from('frequencias')
    .select('aluno_id')
    .eq('data', data)

  if (errFreq) throw new Error(`Erro ao buscar frequências: ${errFreq.message}`)

  const idsComRegistro = new Set((registrosExistentes || []).map((r: any) => String(r.aluno_id)))

  // 3. Alunos SEM nenhum registro no dia
  const pendentes = alunos.filter((a: any) => !idsComRegistro.has(String(a.id)))

  return { alunos, pendentes, idsComRegistro }
}

// ── GET — consulta quem está sem registro ─────────────────────────────────────
export async function GET(request: Request) {
  if (!validarToken(request)) {
    return NextResponse.json(
      { error: 'Não autorizado. Token inválido.' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const data = normalizarData(searchParams.get('data')) || new Date().toISOString().split('T')[0]

  try {
    const { alunos, pendentes, idsComRegistro } = await buscarPendentes(data)

    return NextResponse.json({
      data,
      total_ativos: alunos.length,
      com_registro: idsComRegistro.size,
      sem_registro: pendentes.length,
      pendentes: pendentes.map((a: any) => ({
        id: a.id,
        nome: a.nome,
        matricula: a.matricula || '',
        turma: a.turma || '',
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── POST — insere FALTA apenas para os pendentes (sem registro) ───────────────
export async function POST(request: Request) {
  if (!validarToken(request)) {
    return NextResponse.json(
      { error: 'Não autorizado. Token inválido.' },
      { status: 401 }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  const data = normalizarData(body?.data) || new Date().toISOString().split('T')[0]
  const anoLetivo = data.split('-')[0]
  const admin = getAdminClient()

  try {
    const { pendentes } = await buscarPendentes(data)

    if (pendentes.length === 0) {
      return NextResponse.json({
        ok: true,
        data,
        registrados: 0,
        mensagem: 'Nenhum pendente. Todos os alunos já têm registro para este dia.',
      })
    }

    // Monta registros de FALTA seguindo o mesmo padrão do buildRow() da rota principal
    const rows = pendentes.map((a: any) => {
      const turmaId = a.turma || ''
      const diarioId = `DIARIO-${turmaId}-${anoLetivo}`
      return {
        id: `FREQ-${a.id}-${data}`,
        aluno_id: String(a.id),
        turma_id: turmaId,
        data,
        presente: false,
        justificativa: '',
        dados: {
          diarioId,
          anoLetivo,
          origem: 'totem', // identifica que o registro veio do BAT/catraca
        },
      }
    })

    // INSERT com ignoreDuplicates: se entre o GET e o POST algum registro
    // foi criado por outra fonte, simplesmente ignora — nunca sobrescreve.
    const { error: insertError } = await admin
      .from('frequencias')
      .insert(rows)

    if (insertError) {
      // Código 23505 = violação de chave única (registro já existe) → não é erro fatal
      if (insertError.code === '23505') {
        return NextResponse.json({
          ok: true,
          data,
          registrados: 0,
          mensagem: 'Registros já existiam. Nenhum dado foi sobrescrito.',
        })
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Push de notificação para os responsáveis (fire-and-forget)
    for (const aluno of pendentes) {
      getResponsavelIdsForTargets({ targetStudents: [String(aluno.id)] })
        .then(targetIds => {
          if (targetIds.length === 0) return
          sendAgendaPushNotification({
            type: 'frequencia',
            itemId: `FREQ-${aluno.id}-${data}`,
            title: '❌ Falta Registrada',
            message: `Foi registrada uma falta para ${aluno.nome || 'o aluno'} no dia ${data}.`,
            targetUserIds: targetIds,
            targetUrl: '/agenda-digital/frequencia',
          })
        })
        .catch(err => console.error('[Totem Push Error]', err))
    }

    return NextResponse.json({
      ok: true,
      data,
      registrados: rows.length,
      mensagem: `${rows.length} falta(s) registrada(s) com sucesso.`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── DELETE — desfaz registros criados pelo totem num determinado dia ──────────
// Só apaga registros com dados->>'origem' = 'totem', nunca os manuais ou da catraca
export async function DELETE(request: Request) {
  if (!validarToken(request)) {
    return NextResponse.json(
      { error: 'Não autorizado. Token inválido.' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const data = normalizarData(searchParams.get('data')) || new Date().toISOString().split('T')[0]
  const admin = getAdminClient()

  try {
    // Busca apenas os registros criados pelo totem (tag origem='totem')
    const { data: registros, error: errBusca } = await admin
      .from('frequencias')
      .select('id')
      .eq('data', data)
      .eq('dados->>origem', 'totem')

    if (errBusca) throw new Error(errBusca.message)

    const ids = (registros || []).map((r: any) => r.id)

    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        data,
        removidos: 0,
        mensagem: 'Nenhum registro do totem encontrado para esta data.',
      })
    }

    const { error: errDel } = await admin
      .from('frequencias')
      .delete()
      .in('id', ids)

    if (errDel) throw new Error(errDel.message)

    return NextResponse.json({
      ok: true,
      data,
      removidos: ids.length,
      mensagem: `${ids.length} registro(s) do totem removidos com sucesso.`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
