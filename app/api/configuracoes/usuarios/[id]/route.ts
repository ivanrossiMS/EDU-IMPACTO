import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createProtectedClient()
  const body = await req.json()
  const { id } = await context.params
  
  const prepare = (b: any) => { 
     const out = { ...b }; 
     if ('ultimoAcesso' in out) { out.ultimoacesso = out.ultimoAcesso; delete out.ultimoAcesso; }
     return out;
  }
  
  const fixedBody = prepare(body)
  const { data, error } = await supabase.from('system_users').update(fixedBody).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (data?.email && fixedBody.status !== undefined) {
    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await supabaseAdmin.from('funcionarios').update({ status: fixedBody.status }).eq('email', data.email)
  }

  return NextResponse.json(data)
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createProtectedClient()
  const { id } = await context.params
  
  const { data: userRow } = await supabase.from('system_users').select('email').eq('id', id).maybeSingle()

  const { error } = await supabase.from('system_users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const supabaseAdmin = require('@supabase/supabase-js').createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  if (id.length > 10) {
    await supabaseAdmin.auth.admin.deleteUser(id).catch((e: any) => console.error(e))
  }

  if (userRow?.email) {
    await supabaseAdmin.from('funcionarios').delete().eq('email', userRow.email)
  }

  return NextResponse.json({ success: true })
}
