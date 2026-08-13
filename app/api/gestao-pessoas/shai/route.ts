import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    
    // Fetch colaboradores
    const { data: colabs, error: colabErr } = await supabase
      .from('shai_colaboradores')
      .select('*')
      .order('nome', { ascending: true })

    // Fetch config template
    const { data: config } = await supabase
      .from('shai_configuracoes')
      .select('*')
      .eq('id', 'default')
      .single()

    if (colabErr && colabErr.code === 'PGRST205') {
      // Table doesn't exist yet in Supabase
      return NextResponse.json({ colaboradores: [], template: null, tableExists: false })
    }

    const mappedColabs = (colabs || []).map((d: any) => ({
      id: d.id,
      unidade: d.unidade || '',
      nome: d.nome || '',
      cpf: d.cpf || '',
      dataNascimento: d.data_nascimento || '',
      whatsapp: d.whatsapp || '',
      codigo: d.codigo || '',
      status: d.status || 'pendente',
      enviadoEm: d.enviado_em || null
    }))

    return NextResponse.json({
      colaboradores: mappedColabs,
      template: config?.mensagem_template || null,
      tableExists: true
    })
  } catch (err: any) {
    return NextResponse.json({ colaboradores: [], template: null, error: err?.message }, { status: 200 })
  }
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const supabase = await createProtectedClient()
    const body = await request.json()

    // Action: save template
    if (body.action === 'save_template') {
      const { error } = await supabase
        .from('shai_configuracoes')
        .upsert({
          id: 'default',
          mensagem_template: body.template,
          updated_at: new Date().toISOString()
        })
      if (error && error.code !== 'PGRST205') throw error
      return NextResponse.json({ success: true })
    }

    // Action: clear all
    if (body.action === 'clear_all') {
      const { error } = await supabase
        .from('shai_colaboradores')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      if (error && error.code !== 'PGRST205') throw error
      return NextResponse.json({ success: true })
    }

    // Action: save colaboradores list (bulk upsert)
    if (Array.isArray(body.colaboradores)) {
      const rowsToUpsert = body.colaboradores.map((c: any) => ({
        id: c.id,
        unidade: c.unidade,
        nome: c.nome,
        cpf: c.cpf,
        data_nascimento: c.dataNascimento,
        whatsapp: c.whatsapp,
        codigo: c.codigo,
        status: c.status,
        enviado_em: c.enviadoEm,
        updated_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('shai_colaboradores')
        .upsert(rowsToUpsert, { onConflict: 'id' })

      if (error && error.code !== 'PGRST205') throw error
      return NextResponse.json({ success: true, count: rowsToUpsert.length })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao salvar no banco' }, { status: 400 })
  }
}
