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

/**
 * Sincroniza o acesso do funcionário em system_users e Supabase Auth.
 * Se o e-mail foi alterado, atualiza o registro existente mantendo o mesmo usuário,
 * ID, senha e permissões (ao invés de criar um novo usuário).
 */
async function syncFuncionarioAccess(
  supabaseAdmin: any,
  row: {
    id: string;
    nome: string;
    cargo: string;
    status: string;
    email: string;
    perfil_sistema: string;
    codigo?: string;
  },
  oldFunc?: {
    id: string;
    email: string;
    nome?: string;
    cargo?: string;
    perfil_sistema?: string;
    codigo?: string;
  } | null,
  allValidFuncEmails?: Set<string>
) {
  const newEmail = (row.email || '').trim().toLowerCase();
  const oldEmail = (oldFunc?.email || '').trim().toLowerCase();
  const emailChanged = Boolean(oldEmail && newEmail && oldEmail !== newEmail);

  if (!newEmail && !oldEmail) {
    return;
  }

  // 1. Caso o e-mail tenha mudado, procurar o acesso existente pelo e-mail anterior
  if (emailChanged) {
    const { data: existingOldUser } = await supabaseAdmin
      .from('system_users')
      .select('id, auth_id, email, perfil, nome, cargo, status')
      .ilike('email', oldEmail)
      .maybeSingle();

    if (existingOldUser) {
      // Verificar se já existe um usuário duplicado/fantasma com o novo e-mail
      const { data: duplicateUser } = await supabaseAdmin
        .from('system_users')
        .select('id, auth_id, email')
        .ilike('email', newEmail)
        .maybeSingle();

      if (duplicateUser && duplicateUser.id !== existingOldUser.id) {
        // Remover duplicata do banco e do Auth para liberar o novo e-mail
        await supabaseAdmin.from('system_users').delete().eq('id', duplicateUser.id);
        const dupAuthId = duplicateUser.auth_id || duplicateUser.id;
        if (dupAuthId && dupAuthId.length > 10) {
          await supabaseAdmin.auth.admin.deleteUser(dupAuthId).catch(() => {});
        }
      }

      // Atualizar o usuário existente em system_users mantendo o MESMO ID e acesso
      await supabaseAdmin
        .from('system_users')
        .update({
          email: newEmail,
          nome: row.nome,
          cargo: row.cargo,
          perfil: row.perfil_sistema || existingOldUser.perfil,
          status: row.status
        })
        .eq('id', existingOldUser.id);

      // Atualizar o Supabase Auth com o novo e-mail mantendo a mesma conta
      const authId = existingOldUser.auth_id || existingOldUser.id;
      if (authId && authId.length > 10) {
        await supabaseAdmin.auth.admin.updateUserById(authId, {
          email: newEmail,
          email_confirm: true,
          user_metadata: {
            nome: row.nome,
            cargo: row.cargo,
            perfil: row.perfil_sistema || existingOldUser.perfil
          }
        }).catch((err: any) => {
          console.error('[syncFuncionarioAccess] Erro ao atualizar Auth email:', err?.message);
        });
      }

      return;
    }
  }

  // 2. Se o e-mail não mudou (ou oldEmail não possuía registro em system_users)
  if (newEmail) {
    const { data: existing } = await supabaseAdmin
      .from('system_users')
      .select('id, auth_id, email, perfil')
      .ilike('email', newEmail)
      .maybeSingle();

    if (row.perfil_sistema) {
      if (existing) {
        await supabaseAdmin
          .from('system_users')
          .update({
            status: row.status,
            perfil: row.perfil_sistema,
            nome: row.nome,
            cargo: row.cargo
          })
          .eq('id', existing.id);

        const authId = existing.auth_id || existing.id;
        if (authId && authId.length > 10) {
          await supabaseAdmin.auth.admin.updateUserById(authId, {
            user_metadata: {
              nome: row.nome,
              cargo: row.cargo,
              perfil: row.perfil_sistema
            }
          }).catch(() => {});
        }
      } else {
        // Criar novo usuário apenas se realmente não existia nenhum acesso
        const tempPass = `Impacto@${Math.random().toString(36).slice(-8)}`;
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: newEmail,
          password: tempPass,
          email_confirm: true,
          user_metadata: {
            nome: row.nome,
            cargo: row.cargo,
            perfil: row.perfil_sistema
          }
        });

        let authUserId = authData?.user?.id;
        if (!authUserId && authErr?.message?.toLowerCase().includes('already')) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 50 });
          const matched = listData?.users?.find((u: any) => u.email?.toLowerCase() === newEmail);
          if (matched) authUserId = matched.id;
        }

        const newUserId = authUserId || `U${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        await supabaseAdmin.from('system_users').upsert({
          id: newUserId,
          auth_id: authUserId || newUserId,
          email: newEmail,
          nome: row.nome,
          cargo: row.cargo,
          perfil: row.perfil_sistema,
          status: row.status
        });
      }
    } else if (existing) {
      await supabaseAdmin.from('system_users').update({ status: row.status }).eq('id', existing.id);
    }

    // 3. Auto-reconciliação: se existirem duplicatas com mesmo nome mas e-mail órfão
    if (allValidFuncEmails && row.nome) {
      const { data: sameNameUsers } = await supabaseAdmin
        .from('system_users')
        .select('id, auth_id, email')
        .ilike('nome', row.nome.trim());

      if (sameNameUsers && sameNameUsers.length > 1) {
        for (const snu of sameNameUsers) {
          const snuEmail = (snu.email || '').trim().toLowerCase();
          if (snuEmail && snuEmail !== newEmail && !allValidFuncEmails.has(snuEmail)) {
            console.log(`[Auto-heal] Removendo acesso órfão duplicado: ${snuEmail} (ID: ${snu.id}) para ${row.nome}`);
            await supabaseAdmin.from('system_users').delete().eq('id', snu.id);
            const snuAuthId = snu.auth_id || snu.id;
            if (snuAuthId && snuAuthId.length > 10) {
              await supabaseAdmin.auth.admin.deleteUser(snuAuthId).catch(() => {});
            }
          }
        }
      }
    }
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
      // 1. Fetch current rows com e-mails anteriores para detectar alterações
      const { data: current } = await supabase
        .from('funcionarios')
        .select('id, email, perfil_sistema, nome, cargo, codigo')
      const currentMap = new Map<string, any>((current || []).map(r => [r.id, r]))
      const currentByCodigo = new Map<string, any>((current || []).filter(r => r.codigo).map(r => [r.codigo, r]))
      const currentIds = (current || []).map(r => r.id)
      const incomingIds = body.map(r => r.id).filter(Boolean)
      
      // 2. Identify deletions
      const toDelete = currentIds.filter(id => !incomingIds.includes(id))
      if (toDelete.length > 0) {
        const { data: deletedRows } = await supabase.from('funcionarios').select('email').in('id', toDelete)
        const deletedEmails = (deletedRows || []).map(r => (r.email || '').trim().toLowerCase()).filter(Boolean)
        
        await supabase.from('funcionarios').delete().in('id', toDelete)

        // SYNC Delete to system_users and Auth
        if (deletedEmails.length > 0) {
          const supabaseAdmin = getAdminClient()
          const { data: sysUsers } = await supabaseAdmin.from('system_users').select('id, email, auth_id')
          const matchedSysUsers = (sysUsers || []).filter(su => su.email && deletedEmails.includes(su.email.trim().toLowerCase()))
          if (matchedSysUsers.length > 0) {
            const idsToDelete = matchedSysUsers.map(su => su.id)
            await supabaseAdmin.from('system_users').delete().in('id', idsToDelete)
            for (const su of matchedSysUsers) {
              const aId = su.auth_id || su.id
              if (aId && aId.length > 10) {
                await supabaseAdmin.auth.admin.deleteUser(aId).catch(console.error)
              }
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
             email: (email || '').trim(), admissao: admissao || '',
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

        // SYNC: Refletir o status e perfil mantendo o mesmo acesso se o e-mail foi alterado
        const supabaseAdmin = getAdminClient();
        const allValidFuncEmails = new Set(
          rowsToUpsert.map(r => (r.email || '').trim().toLowerCase()).filter(Boolean)
        )
        
        for (const row of rowsToUpsert) {
          const oldFunc = currentMap.get(row.id) || (row.codigo ? currentByCodigo.get(row.codigo) : null);
          await syncFuncionarioAccess(supabaseAdmin, row, oldFunc, allValidFuncEmails);
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
      email: (email || '').trim(), admissao: admissao || '',
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

    const { data: oldFunc } = row.id 
      ? await supabase.from('funcionarios').select('id, email, perfil_sistema, nome, cargo, codigo').eq('id', row.id).maybeSingle()
      : { data: null };

    const { data, error } = await supabase.from('funcionarios').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const supabaseAdmin = getAdminClient();
    await syncFuncionarioAccess(supabaseAdmin, {
      id: data.id,
      nome: data.nome,
      cargo: data.cargo,
      status: data.status,
      email: data.email,
      perfil_sistema: data.perfil_sistema,
      codigo: data.codigo
    }, oldFunc)

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

    // Buscar funcionário anterior para capturar oldEmail
    const { data: oldFunc } = await supabase.from('funcionarios').select('id, email, perfil_sistema, nome, cargo, codigo').eq('id', id).maybeSingle()

    const { data, error } = await supabase.from('funcionarios').update({
      nome: (nome || '').trim(), cargo: cargo || '', departamento: departamento || '',
      salario: salario || 0, status: status || 'ativo',
      email: (email || '').trim(), admissao: admissao || '',
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

    const supabaseAdmin = getAdminClient();
    await syncFuncionarioAccess(supabaseAdmin, {
      id: data.id,
      nome: data.nome,
      cargo: data.cargo,
      status: data.status,
      email: data.email,
      perfil_sistema: data.perfil_sistema,
      codigo: data.codigo
    }, oldFunc)

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
    const supabaseAdmin = getAdminClient()
    const emailNorm = funcRow.email.trim().toLowerCase()
    const { data: sysUser } = await supabaseAdmin.from('system_users').select('id, auth_id').ilike('email', emailNorm).maybeSingle()
    if (sysUser) {
      await supabaseAdmin.from('system_users').delete().eq('id', sysUser.id)
      const aId = sysUser.auth_id || sysUser.id
      if (aId && aId.length > 10) {
        await supabaseAdmin.auth.admin.deleteUser(aId).catch(console.error)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
