import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const authClient = await createProtectedClient();
    const supabase = supabaseServer;

    const body = await request.json()
    const { tipo, ids, alunoId } = body

    let isFamily = user.user_metadata?.perfil === 'Família' || user.user_metadata?.cargo === 'Aluno' || user.user_metadata?.cargo === 'Responsável'
    if (!isFamily) {
      const { data: dbUser } = await supabase.from('system_users').select('perfil, cargo').eq('id', user.id).maybeSingle();
      if (dbUser) {
        isFamily = dbUser.perfil === 'Família' || dbUser.perfil === 'Responsável' || dbUser.cargo === 'Aluno' || dbUser.cargo === 'Responsável'
      }
    }
    const readerId = isFamily ? alunoId : user.id

    if (!tipo || !ids || !readerId || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Parâmetros incompletos' }, { status: 400 })
    }

    // Determine the table name based on type
    const tableMap: Record<string, string> = {
      'comunicado': 'comunicados',
      'momento': 'momentos',
      'evento': 'eventos_agenda',
      'ocorrencia': 'ocorrencias',
      'nota': 'boletins',
      'frequencia': 'frequencias'
    }

    const table = tableMap[tipo]
    if (!table) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    // Fetch the target rows. Since some tables might not have the "leituras" column, we try with it first,
    // and if it fails due to column not existing (PostgreSQL code 42703), we fall back to just 'id, dados'.
    let selectRes: any = await supabase.from(table).select('id, dados, leituras').in('id', ids)
    if (selectRes.error && (selectRes.error.code === '42703' || selectRes.error.message?.includes('does not exist'))) {
      selectRes = await supabase.from(table).select('id, dados').in('id', ids)
      if (selectRes.error && (selectRes.error.code === '42703' || selectRes.error.message?.includes('does not exist'))) {
        selectRes = await supabase.from(table).select('id').in('id', ids)
      }
    }

    if (selectRes.error) {
      throw new Error(`Select error: ${selectRes.error.message}`)
    }
    const rows = selectRes.data || []

    const now = new Date().toISOString()
    const updates = []
    
    for (const row of rows) {
      const updateObj: any = { id: row.id }
      let needsUpdate = false
      
      if (row.dados !== undefined) {
        const dados = typeof row.dados === 'object' && row.dados !== null ? { ...row.dados } : {}
        const leiturasInDados = typeof dados.leituras === 'object' && dados.leituras !== null ? { ...dados.leituras } : {}
        leiturasInDados[readerId as string] = now
        dados.leituras = leiturasInDados
        updateObj.dados = dados
        needsUpdate = true
      }
      
      if (row.leituras !== undefined) {
         const rootLeituras = typeof row.leituras === 'object' && row.leituras !== null ? { ...row.leituras } : {}
         rootLeituras[readerId as string] = now
         updateObj.leituras = rootLeituras
         needsUpdate = true
      }
      
      if (needsUpdate) updates.push(updateObj)
    }

    if (updates.length > 0) {
      await Promise.all(updates.map(async (updateData) => {
        const { id, ...rest } = updateData
        const { error: updateError } = await supabase.from(table).update(rest).eq('id', id)
        if (updateError) {
          throw new Error(`Update error for id ${id}: ${updateError.message}`)
        }
      }))
    }

    // --- NOVA LÓGICA DE NOTIFICATIONS CENTER ---
    try {
      const readRecords = ids.map((id: string) => ({
        usuario_id: readerId, // Aqui na agenda readerId é usado como identificador
        perfil: isFamily ? 'aluno' : 'admin', 
        content_type: tipo,
        content_id: id,
        read_at: now
      }));
      // Ignora erros de unicidade
      await supabase.from('agenda_notification_reads').insert(readRecords);
    } catch (e) {
      console.warn("Erro ao inserir na nova tabela de reads (ignorado):", e);
    }

    return NextResponse.json({ ok: true, count: updates.length })
  } catch (err: any) {
    console.error("Erro em marcar-lido:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
