import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')

  let query = supabase.from('funcionarios').select('*').order('nome')
  if (status && status !== 'Todos') query = query.eq('status', status)
  if (q) query = query.or(`nome.ilike.%${q}%,cargo.ilike.%${q}%,departamento.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data || []).map(r => ({ ...r, ...(r.dados || {}) })))
}

export async function POST(request: Request) {
  const supabase = await createProtectedClient();
  try {
    const body = await request.json()
    
    // Bulk Sync Mode (Driven by useSupabaseArray)
    if (Array.isArray(body)) {
      // 1. Fetch current IDs
      const { data: current } = await supabase.from('funcionarios').select('id')
      const currentIds = (current || []).map(r => r.id)
      const incomingIds = body.map(r => r.id).filter(Boolean)
      
      // 2. Identify deletions
      const toDelete = currentIds.filter(id => !incomingIds.includes(id))
      if (toDelete.length > 0) {
        const { data: deletedRows } = await supabase.from('funcionarios').select('email').in('id', toDelete)
        const deletedEmails = (deletedRows || []).map(r => r.email).filter(Boolean)
        
        await supabase.from('funcionarios').delete().in('id', toDelete)

        // SYNC Delete to system_users and Auth
        if (deletedEmails.length > 0) {
          const supabaseAdmin = require('@supabase/supabase-js').createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const { data: sysUsers } = await supabaseAdmin.from('system_users').select('id, email').in('email', deletedEmails)
          await supabaseAdmin.from('system_users').delete().in('email', deletedEmails)
          if (sysUsers) {
            for (const su of sysUsers) {
              if (su.id && su.id.length > 10) await supabaseAdmin.auth.admin.deleteUser(su.id).catch(console.error)
            }
          }
        }
      }
      
      // 3. Upsert incoming
      if (body.length > 0) {
        const rowsToUpsert = body.map(item => {
           const { id, nome, cargo, departamento, salario, status, email, admissao, unidade, dados, created_at, ...rest } = item
           return {
             id: id || `F${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
             nome: nome || 'Sem Nome', cargo: cargo || '', departamento: departamento || '',
             salario: salario || 0, status: status || 'ativo',
             email: email || '', admissao: admissao || '',
             unidade: unidade || '', dados: dados || rest,
           }
        })
        const { error } = await supabase.from('funcionarios').upsert(rowsToUpsert)
        if (error) throw new Error(error.message)

        // SYNC: Refletir o status na tabela do controle de acesso (system_users)
        const supabaseAdmin = require('@supabase/supabase-js').createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        for (const row of rowsToUpsert) {
          if (row.email) {
            await supabaseAdmin.from('system_users').update({ status: row.status }).eq('email', row.email);
          }
        }
      }
      return NextResponse.json(body, { status: 201 })
    }

    // Legacy Single Object Mode
    const { id, nome, cargo, departamento, salario, status, email, admissao, unidade, ...rest } = body
    const row = {
      id: id || `F${Date.now()}`,
      nome, cargo: cargo || '', departamento: departamento || '',
      salario: salario || 0, status: status || 'ativo',
      email: email || '', admissao: admissao || '',
      unidade: unidade || '', dados: rest,
    }
    const { data, error } = await supabase.from('funcionarios').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (row.email) {
      const supabaseAdmin = require('@supabase/supabase-js').createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await supabaseAdmin.from('system_users').update({ status: row.status }).eq('email', row.email);
    }

    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const body = await request.json()
    const { nome, cargo, departamento, salario, status, email, admissao, unidade, ...rest } = body
    const { data, error } = await supabase.from('funcionarios').update({
      nome, cargo: cargo || '', departamento: departamento || '',
      salario: salario || 0, status: status || 'ativo',
      email: email || '', admissao: admissao || '',
      unidade: unidade || '', dados: rest,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (data.email) {
      const supabaseAdmin = require('@supabase/supabase-js').createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await supabaseAdmin.from('system_users').update({ status: data.status }).eq('email', data.email);
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: funcRow } = await supabase.from('funcionarios').select('email').eq('id', id).maybeSingle()

  const { error } = await supabase.from('funcionarios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (funcRow?.email) {
    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: sysUser } = await supabaseAdmin.from('system_users').select('id').eq('email', funcRow.email).maybeSingle()
    await supabaseAdmin.from('system_users').delete().eq('email', funcRow.email)
    if (sysUser?.id && sysUser.id.length > 10) {
      await supabaseAdmin.auth.admin.deleteUser(sysUser.id).catch(console.error)
    }
  }

  return NextResponse.json({ ok: true })
}
