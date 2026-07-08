import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    // Usa admin client para leitura — evita problemas de RLS em tabela que não tem policy de SELECT
    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const q = searchParams.get('q')
    const lightweight = searchParams.get('lightweight') === 'true'

    // Lightweight: apenas campos essenciais para seleção de funcionários em dropdowns
    // NOTA: coluna 'foto' não existe na tabela funcionarios; usar dados->>'foto' como fallback
    const queryFields = lightweight ? 'id, nome, status, dados' : '*'
    let query = supabase.from('funcionarios').select(queryFields as any).order('nome')
    
    if (status && status !== 'Todos') query = query.eq('status', status)
    if (q) query = query.or(`nome.ilike.%${q}%`)

    const { data, error } = await query
    if (error) {
      console.error('[funcionarios GET]', error.message, error.details)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (lightweight) {
      return NextResponse.json(((data || []) as any[]).map(r => ({
        id: r.id,
        nome: r.nome,
        status: r.status,
        foto: r.dados?.foto || r.dados?.fotoUrl || r.dados?.avatarUrl || null
      })))
    }

    return NextResponse.json(((data || []) as any[]).map(({ dados, ...r }) => {
      const { data_nascimento, tipo_contrato, carga_horaria, perfil_sistema, ...rest } = r
      return {
        ...rest,
        dataNascimento: data_nascimento,
        tipoContrato: tipo_contrato,
        cargaHoraria: carga_horaria,
        perfilSistema: perfil_sistema,
        ...(dados || {})
      }
    }))
  } catch (e: any) {
    console.error('[funcionarios GET] unexpected:', e?.message)
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

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
           
           // Extrai campos conhecidos que agora são colunas
           const {
             codigo, cpf, rg, dataNascimento, telefone, celular,
             tipoContrato, escolaridade, cargaHoraria, bonus,
             pis, banco, agencia, conta, observacoes, perfilSistema, horario,
             ...outrosExtras
           } = rest as any

           return {
             id: id && typeof id === 'string' && !id.startsWith('TEMP-') ? id : `F${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
             nome: (nome || '').trim() || 'Sem Nome', cargo: cargo || '', departamento: departamento || '',
             salario: salario || 0, status: status || 'ativo',
             email: email || '', admissao: admissao || '',
             unidade: unidade || '',
             codigo: codigo || '',
             cpf: cpf || '',
             rg: rg || '',
             data_nascimento: dataNascimento || null,
             telefone: telefone || '',
             celular: celular || '',
             tipo_contrato: tipoContrato || '',
             escolaridade: escolaridade || '',
             carga_horaria: cargaHoraria || 0,
             bonus: bonus || 0,
             pis: pis || '',
             banco: banco || '',
             agencia: agencia || '',
             conta: conta || '',
             observacoes: observacoes || '',
             perfil_sistema: perfilSistema || '',
             horario: horario || null,
             dados: dados || outrosExtras,
           }
        })
        const { error } = await supabase.from('funcionarios').upsert(rowsToUpsert)
        if (error) throw new Error(error.message)

        // SYNC: Refletir o status e perfil na tabela do controle de acesso (system_users)
        const supabaseAdmin = require('@supabase/supabase-js').createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        for (const row of rowsToUpsert) {
          if (row.email) {
            // 1. Verificar se já existe em system_users
            const { data: existing } = await supabaseAdmin.from('system_users').select('id, auth_id').eq('email', row.email).maybeSingle();
            
            if (row.perfil_sistema) {
              if (existing) {
                // Update existing
                await supabaseAdmin.from('system_users').update({ 
                  status: row.status, 
                  perfil: row.perfil_sistema,
                  nome: row.nome,
                  cargo: row.cargo
                }).eq('email', row.email);
              } else {
                // Create new system_user + Auth provisioning
                const tempPass = `Impacto@${Math.random().toString(36).slice(-8)}`;
                const { data: authData } = await supabaseAdmin.auth.admin.createUser({
                  email: row.email,
                  password: tempPass,
                  email_confirm: true
                });
                
                if (authData?.user) {
                  await supabaseAdmin.from('system_users').insert({
                    id: authData.user.id,
                    auth_id: authData.user.id,
                    email: row.email,
                    nome: row.nome,
                    cargo: row.cargo,
                    perfil: row.perfil_sistema,
                    status: row.status
                  });
                }
              }
            } else if (existing) {
              // Just update status if no profile but user exists
              await supabaseAdmin.from('system_users').update({ status: row.status }).eq('email', row.email);
            }
          }
        }
      }
      return NextResponse.json(body, { status: 201 })
    }

    // Legacy Single Object Mode
    const { 
      id, nome, cargo, departamento, salario, status, email, admissao, unidade, dados, created_at,
      ...rest 
    } = body
    
    // Extrai campos conhecidos que agora são colunas
    const {
      codigo, cpf, rg, dataNascimento, telefone, celular,
      tipoContrato, escolaridade, cargaHoraria, bonus,
      pis, banco, agencia, conta, observacoes, perfilSistema, horario,
      ...outrosExtras
    } = rest as any

    const row = {
      id: id && typeof id === 'string' && !id.startsWith('TEMP-') ? id : `F${Date.now()}`,
      nome: (nome || '').trim() || 'Sem Nome', cargo: cargo || '', departamento: departamento || '',
      salario: salario || 0, status: status || 'ativo',
      email: email || '', admissao: admissao || '',
      unidade: unidade || '',
      codigo: codigo || '',
      cpf: cpf || '',
      rg: rg || '',
      data_nascimento: dataNascimento || null,
      telefone: telefone || '',
      celular: celular || '',
      tipo_contrato: tipoContrato || '',
      escolaridade: escolaridade || '',
      carga_horaria: cargaHoraria || 0,
      bonus: bonus || 0,
      pis: pis || '',
      banco: banco || '',
      agencia: agencia || '',
      conta: conta || '',
      observacoes: observacoes || '',
      perfil_sistema: perfilSistema || '',
      horario: horario || null,
      dados: dados || outrosExtras,
    }
    const { data, error } = await supabase.from('funcionarios').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (row.email) {
      const supabaseAdmin = require('@supabase/supabase-js').createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      const { data: existing } = await supabaseAdmin.from('system_users').select('id').eq('email', row.email).maybeSingle();
      
      if (row.perfil_sistema) {
        if (existing) {
          await supabaseAdmin.from('system_users').update({ 
            status: row.status, 
            perfil: row.perfil_sistema,
            nome: row.nome,
            cargo: row.cargo 
          }).eq('email', row.email);
        } else {
          // Provision new access
          const tempPass = `Impacto@${Math.random().toString(36).slice(-8)}`;
          const { data: authData } = await supabaseAdmin.auth.admin.createUser({
            email: row.email,
            password: tempPass,
            email_confirm: true
          });
          if (authData?.user) {
            await supabaseAdmin.from('system_users').insert({
              id: authData.user.id,
              auth_id: authData.user.id,
              email: row.email,
              nome: row.nome,
              cargo: row.cargo,
              perfil: row.perfil_sistema,
              status: row.status
            });
          }
        }
      } else if (existing) {
        await supabaseAdmin.from('system_users').update({ status: row.status }).eq('email', row.email);
      }
    }

    return NextResponse.json(data, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const supabase = await createProtectedClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const body = await request.json()
    const { 
      nome, cargo, departamento, salario, status, email, admissao, unidade, dados, created_at,
      ...rest 
    } = body
    
    // Extrai campos conhecidos que agora são colunas
    const {
      codigo, cpf, rg, dataNascimento, telefone, celular,
      tipoContrato, escolaridade, cargaHoraria, bonus,
      pis, banco, agencia, conta, observacoes, perfilSistema, horario,
      ...outrosExtras
    } = rest as any

    const { data, error } = await supabase.from('funcionarios').update({
      nome: (nome || '').trim(), cargo: cargo || '', departamento: departamento || '',
      salario: salario || 0, status: status || 'ativo',
      email: email || '', admissao: admissao || '',
      unidade: unidade || '',
      codigo: codigo || '',
      cpf: cpf || '',
      rg: rg || '',
      data_nascimento: dataNascimento || null,
      telefone: telefone || '',
      celular: celular || '',
      tipo_contrato: tipoContrato || '',
      escolaridade: escolaridade || '',
      carga_horaria: cargaHoraria || 0,
      bonus: bonus || 0,
      pis: pis || '',
      banco: banco || '',
      agencia: agencia || '',
      conta: conta || '',
      observacoes: observacoes || '',
      perfil_sistema: perfilSistema || '',
      horario: horario || null,
      dados: dados || outrosExtras,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (data.email) {
      const supabaseAdmin = require('@supabase/supabase-js').createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      // Sync update or create if perfil_sistema is present
      const { data: existing } = await supabaseAdmin.from('system_users').select('id').eq('email', data.email).maybeSingle();
      
      if (data.perfil_sistema) {
        if (existing) {
          await supabaseAdmin.from('system_users').update({ 
            status: data.status, 
            perfil: data.perfil_sistema,
            nome: data.nome,
            cargo: data.cargo 
          }).eq('email', data.email);
        } else {
          // Provision new access
          const tempPass = `Impacto@${Math.random().toString(36).slice(-8)}`;
          const { data: authData } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: tempPass,
            email_confirm: true
          });
          if (authData?.user) {
            await supabaseAdmin.from('system_users').insert({
              id: authData.user.id,
              auth_id: authData.user.id,
              email: data.email,
              nome: data.nome,
              cargo: data.cargo,
              perfil: data.perfil_sistema,
              status: data.status
            });
          }
        }
      } else if (existing) {
        await supabaseAdmin.from('system_users').update({ status: data.status }).eq('email', data.email);
      }
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

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
