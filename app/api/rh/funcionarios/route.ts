import { NextResponse } from 'next/server'
import { requireStaff, resolveUserRole, clearAuthGuardCache } from '@/lib/server/authGuard'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'
import { getAdminClient, findAuthUserByEmail, invalidateAuthUsersCache } from '@/lib/server/supabaseAdminSingleton'
import { invalidateColaboradoresCache } from '@/lib/server/colaboradoresCache'

export const dynamic = 'force-dynamic'

const PRIVILEGED_HR_ROLES = new Set([
  'administrador',
  'administrador master',
  'diretor',
  'diretor geral',
  'master',
  'rh',
  'gestor rh',
  'recursos humanos',
  'financeiro',
  'gestor financeiro',
])

function isPrivilegedHrRole(perfil?: string | null, cargo?: string | null): boolean {
  const p = String(perfil || '').trim().toLowerCase()
  const c = String(cargo || '').trim().toLowerCase()
  return (
    PRIVILEGED_HR_ROLES.has(p) ||
    PRIVILEGED_HR_ROLES.has(c) ||
    p.includes('admin') ||
    p.includes('diret') ||
    p.includes('rh') ||
    p.includes('financ') ||
    c.includes('rh') ||
    c.includes('recursos humanos')
  )
}

function stripSensitiveFuncFields(obj: Record<string, any>) {
  const clone = { ...obj }
  delete clone.salario
  delete clone.bonus
  delete clone.pis
  delete clone.banco
  delete clone.agencia
  delete clone.conta
  delete clone.chavePix
  delete clone.cpf
  delete clone.rg
  delete clone.ctps
  return clone
}

function formatFuncionarioRow(r: any, canSeeSensitive = true) {
  if (!r) return r
  const { dados, data_nascimento, tipo_contrato, carga_horaria, perfil_sistema, ...rest } = r
  const cleanDados = { ...(dados && typeof dados === 'object' ? dados : {}) }
  delete cleanDados.updated_at
  delete cleanDados.created_at
  const item = {
    ...cleanDados,
    ...rest,
    dataNascimento: data_nascimento ?? cleanDados.dataNascimento ?? '',
    tipoContrato: tipo_contrato || cleanDados.tipoContrato || 'CLT',
    cargaHoraria: carga_horaria ?? cleanDados.cargaHoraria ?? 40,
    perfilSistema: perfil_sistema ?? cleanDados.perfilSistema ?? '',
  }
  return canSeeSensitive ? item : stripSensitiveFuncFields(item)
}

function normalizeDateOrNull(val: any): string | null {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split('/')
    return `${yyyy}-${mm}-${dd}`
  }
  return null
}

function buildFuncionarioDbRow(item: any, existingId?: string, existingDados?: any) {
  const {
    id, nome, cargo, departamento, salario, status, email, admissao, unidade,
    dados, created_at, updated_at,
    data_nascimento, tipo_contrato, carga_horaria, perfil_sistema,
    codigo, cpf, rg, dataNascimento, telefone, celular,
    tipoContrato, escolaridade, cargaHoraria, bonus,
    pis, banco, agencia, conta, observacoes, perfilSistema, horario,
    ...outrosExtras
  } = item || {}

  const resolvedId = existingId || (id && typeof id === 'string' && !id.startsWith('TEMP-')
    ? id
    : `F${Date.now()}-${Math.random().toString(36).slice(2, 11)}`)

  const rawDob = dataNascimento !== undefined ? dataNascimento : data_nascimento
  const mergedDados = {
    ...(existingDados && typeof existingDados === 'object' ? existingDados : {}),
    ...(dados && typeof dados === 'object' ? dados : {}),
    ...outrosExtras,
  }
  delete mergedDados.updated_at
  delete mergedDados.created_at

  return {
    id: resolvedId,
    nome: String(nome || '').trim() || 'Sem Nome',
    cargo: String(cargo || '').trim(),
    departamento: String(departamento || '').trim(),
    salario: Number(salario) || 0,
    status: String(status || 'ativo').trim() || 'ativo',
    email: String(email || '').trim(),
    admissao: String(admissao || '').trim(),
    unidade: String(unidade || '').trim(),
    codigo: String(codigo || '').trim(),
    cpf: String(cpf || '').trim(),
    rg: String(rg || '').trim(),
    data_nascimento: normalizeDateOrNull(rawDob),
    telefone: String(telefone || '').trim(),
    celular: String(celular || '').trim(),
    tipo_contrato: String(tipoContrato ?? tipo_contrato ?? '').trim(),
    escolaridade: String(escolaridade || '').trim(),
    carga_horaria: Math.round(Number(cargaHoraria ?? carga_horaria) || 0),
    bonus: Number(bonus) || 0,
    pis: String(pis || '').trim(),
    banco: String(banco || '').trim(),
    agencia: String(agencia || '').trim(),
    conta: String(conta || '').trim(),
    observacoes: String(observacoes || '').trim(),
    perfil_sistema: String(perfilSistema ?? perfil_sistema ?? '').trim(),
    horario: horario || null,
    dados: mergedDados,
    updated_at: new Date().toISOString(),
  }
}

function hasAccessFieldsChanged(oldFunc: any, row: any): boolean {
  if (!oldFunc) return Boolean(row.email && row.perfil_sistema)
  return (
    String(oldFunc.email || '').trim().toLowerCase() !== String(row.email || '').trim().toLowerCase() ||
    String(oldFunc.nome || '').trim() !== String(row.nome || '').trim() ||
    String(oldFunc.cargo || '').trim() !== String(row.cargo || '').trim() ||
    String(oldFunc.status || 'ativo').trim() !== String(row.status || 'ativo').trim() ||
    String(oldFunc.perfil_sistema || '').trim() !== String(row.perfil_sistema || '').trim() ||
    Boolean((row.dados as any)?.senha)
  )
}

export async function GET(request: Request) {
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  if (!roleCtx.isStaff) {
    return NextResponse.json({ error: 'Acesso restrito a colaboradores.' }, { status: 403 })
  }

  const canSeeSensitive = isPrivilegedHrRole(roleCtx.perfil, roleCtx.cargo)

  try {
    // Usa admin client para leitura — evita problemas de RLS em tabela que não tem policy de SELECT
    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const q = searchParams.get('q')
    const lightweight = searchParams.get('lightweight') === 'true'

    // Lightweight: campos essenciais para seleção de funcionários em dropdowns e envio de WhatsApp
    // NOTA: coluna 'foto' não existe na tabela funcionarios; usar dados->>'foto' como fallback
    const queryFields = lightweight ? 'id, nome, status, email, cpf, cargo, unidade, salario, telefone, celular, codigo, dados' : '*'
    let query = supabase.from('funcionarios').select(queryFields as any).order('nome')
    
    if (status && status !== 'Todos') query = query.eq('status', status)
    if (q) query = query.or(`nome.ilike.%${q}%`)

    const { data, error } = await query
    if (error) {
      console.error('[funcionarios GET]', error.message, error.details)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (lightweight) {
      return NextResponse.json(((data || []) as any[]).map(r => {
        const item = {
          id: r.id,
          nome: r.nome,
          status: r.status,
          email: r.email,
          cpf: r.cpf,
          cargo: r.cargo,
          unidade: r.unidade,
          codigo: r.codigo || r.dados?.codigo || r.dados?.matricula || '',
          matricula: r.codigo || r.dados?.matricula || r.dados?.codigo || '',
          telefone: r.celular || r.telefone || r.dados?.celular || r.dados?.telefone || '',
          celular: r.celular || r.dados?.celular || r.telefone || r.dados?.telefone || '',
          salario: r.salario ? Number(r.salario) : (r.dados?.salario ? Number(r.dados.salario) : undefined),
          foto: r.dados?.foto || r.dados?.fotoUrl || r.dados?.avatarUrl || null
        }
        return canSeeSensitive ? item : stripSensitiveFuncFields(item)
      }))
    }

    return NextResponse.json(((data || []) as any[]).map(r => formatFuncionarioRow(r, canSeeSensitive)))
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
    status?: string;
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
    const [{ data: existingOldUser }, { data: duplicateUser }] = await Promise.all([
      supabaseAdmin
        .from('system_users')
        .select('id, auth_id, email, perfil, nome, cargo, status')
        .ilike('email', oldEmail)
        .maybeSingle(),
      supabaseAdmin
        .from('system_users')
        .select('id, auth_id, email')
        .ilike('email', newEmail)
        .maybeSingle(),
    ]);

    if (existingOldUser) {
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
    const [{ data: existing }, { data: respMatch }] = await Promise.all([
      supabaseAdmin
        .from('system_users')
        .select('id, auth_id, email, nome, cargo, status, perfil, dados')
        .ilike('email', newEmail)
        .maybeSingle(),
      supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email')
        .ilike('email', newEmail)
        .maybeSingle(),
    ]);

    if (row.perfil_sistema) {
      if (existing) {
        const expectedStatus = row.status || 'ativo';
        const expectedRespId = respMatch?.id ? String(respMatch.id) : existing.dados?.responsavel_id;
        const alreadyInSync =
          existing.status === expectedStatus &&
          existing.perfil === row.perfil_sistema &&
          existing.nome === row.nome &&
          existing.cargo === row.cargo &&
          existing.dados?.funcionario_id === row.id &&
          (!expectedRespId || existing.dados?.responsavel_id === expectedRespId);

        if (!alreadyInSync) {
          const updatedDados = {
            ...(existing.dados || {}),
            ...(respMatch?.id ? { responsavel_id: String(respMatch.id) } : {}),
            funcionario_id: row.id,
          };

          await supabaseAdmin
            .from('system_users')
            .update({
              status: expectedStatus,
              perfil: row.perfil_sistema,
              nome: row.nome,
              cargo: row.cargo,
              dados: updatedDados
            })
            .eq('id', existing.id);

          const authId = existing.auth_id || existing.id;
          const isAuthUuid = authId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authId);
          if (isAuthUuid && (existing.nome !== row.nome || existing.cargo !== row.cargo || existing.perfil !== row.perfil_sistema)) {
            const { data: authUserRes } = await supabaseAdmin.auth.admin.getUserById(authId).catch(() => ({ data: { user: null } }));
            const existingMeta = authUserRes?.user?.user_metadata || {};
            const hasDual = Boolean(respMatch?.id || existingMeta.responsavel_id);

            await supabaseAdmin.auth.admin.updateUserById(authId, {
              user_metadata: {
                ...existingMeta,
                nome: row.nome,
                cargo: row.cargo,
                perfil: row.perfil_sistema,
                colaborador_id: authId,
                system_user_id: authId,
                ...(respMatch?.id ? { responsavel_id: String(respMatch.id) } : {}),
                hasDualRole: hasDual || Boolean(existingMeta.hasDualRole),
              }
            }).catch(() => {});
          }
        }
      } else {
        // Tenta localizar conta já existente no Supabase Auth (ex: era apenas Responsável)
        let foundAuthUser: any = await findAuthUserByEmail(newEmail);
        let authUserId = foundAuthUser?.id;

        if (!authUserId) {
          // Criar novo usuário no Auth
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

          if (authData?.user?.id) {
            authUserId = authData.user.id;
            foundAuthUser = authData.user;
          } else if (authErr?.message?.toLowerCase().includes('already')) {
            foundAuthUser = await findAuthUserByEmail(newEmail);
            if (foundAuthUser?.id) authUserId = foundAuthUser.id;
          }
        }

        const isAuthUuid = authUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId);
        const targetId = isAuthUuid ? authUserId : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `U${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
        const targetAuthId = isAuthUuid ? authUserId : null; // Nunca inserir string não-UUID no campo auth_id

        const hasDual = Boolean(respMatch?.id || foundAuthUser?.user_metadata?.responsavel_id);

        if (isAuthUuid) {
          const existingMeta = foundAuthUser?.user_metadata || {};
          await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            user_metadata: {
              ...existingMeta,
              nome: row.nome,
              cargo: row.cargo,
              perfil: row.perfil_sistema,
              colaborador_id: authUserId,
              system_user_id: authUserId,
              ...(respMatch?.id ? { responsavel_id: String(respMatch.id) } : {}),
              hasDualRole: hasDual,
            }
          }).catch((err: any) => console.warn('[syncFuncionarioAccess] Auth metadata update failed:', err?.message));
        }

        await supabaseAdmin.from('system_users').upsert({
          id: targetId,
          ...(targetAuthId ? { auth_id: targetAuthId } : {}),
          email: newEmail,
          nome: row.nome,
          cargo: row.cargo,
          perfil: row.perfil_sistema,
          status: row.status || 'ativo',
          dados: {
            ...(respMatch?.id ? { responsavel_id: String(respMatch.id) } : {}),
            funcionario_id: row.id,
          }
        });
      }

      // Limpar cache de colaboradores
      invalidateColaboradoresCache();
    } else if (existing) {
      if (oldFunc?.perfil_sistema) {
        // Perfil de sistema foi removido explicitamente ("Sem acesso ao sistema")
        await supabaseAdmin.from('system_users').delete().eq('id', existing.id);
      } else if (existing.status !== row.status) {
        await supabaseAdmin.from('system_users').update({ status: row.status }).eq('id', existing.id);
      }
      invalidateColaboradoresCache();
    }

    // 3. Auto-reconciliação: se existirem duplicatas com mesmo nome mas e-mail órfão
    const nameOrEmailChanged = !oldFunc || emailChanged || String(oldFunc.nome || '').trim() !== String(row.nome || '').trim();
    if (allValidFuncEmails && row.nome && nameOrEmailChanged) {
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
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  if (!roleCtx.isStaff || !isPrivilegedHrRole(roleCtx.perfil, roleCtx.cargo)) {
    return NextResponse.json({ error: 'Apenas Administradores, Diretores ou RH podem cadastrar/alterar funcionários.' }, { status: 403 })
  }

  const supabaseAdmin = getAdminClient();
  try {
    const body = await request.json()
    
    // Bulk Sync Mode (Driven by useSupabaseArray / Import)
    if (Array.isArray(body)) {
      // 1. Fetch current rows com todos os campos de acesso (incluindo status e dados!) para detectar apenas alterações reais
      const { data: current } = await supabaseAdmin
        .from('funcionarios')
        .select('id, email, perfil_sistema, nome, cargo, status, codigo, dados')
      const currentMap = new Map<string, any>((current || []).map(r => [r.id, r]))
      const currentByCodigo = new Map<string, any>((current || []).filter(r => r.codigo).map(r => [r.codigo, r]))
      const currentIds = (current || []).map(r => r.id)
      const incomingIds = body.map(r => r.id).filter(Boolean)
      
      // 2. Identify deletions
      const toDelete = currentIds.filter(id => !incomingIds.includes(id))
      if (toDelete.length > 0) {
        const deletedRows = (current || []).filter(r => toDelete.includes(r.id))
        const deletedEmails = deletedRows.map(r => (r.email || '').trim().toLowerCase()).filter(Boolean)
        
        await supabaseAdmin.from('funcionarios').delete().in('id', toDelete)

        // SYNC Delete to system_users and Auth
        if (deletedEmails.length > 0) {
          const { data: sysUsers } = await supabaseAdmin.from('system_users').select('id, email, auth_id')
          const matchedSysUsers = (sysUsers || []).filter(su => su.email && deletedEmails.includes(su.email.trim().toLowerCase()))
          if (matchedSysUsers.length > 0) {
            const idsToDelete = matchedSysUsers.map(su => su.id)
            await supabaseAdmin.from('system_users').delete().in('id', idsToDelete)
            await Promise.all(
              matchedSysUsers.map(su => {
                const aId = su.auth_id || su.id
                if (aId && aId.length > 10) {
                  return supabaseAdmin.auth.admin.deleteUser(aId).catch(console.error)
                }
                return Promise.resolve()
              })
            )
          }
        }
      }
      
      // 3. Upsert incoming
      if (body.length > 0) {
        const rowsToUpsert = body.map(item => {
          const oldFunc = (item?.id && currentMap.get(item.id)) || (item?.codigo ? currentByCodigo.get(item.codigo) : null)
          return buildFuncionarioDbRow(item, oldFunc?.id || item?.id, oldFunc?.dados)
        })

        const { error } = await supabaseAdmin.from('funcionarios').upsert(rowsToUpsert)
        if (error) throw new Error(error.message)

        // SYNC: Refletir o status e perfil APENAS para registros que realmente tiveram alteração de acesso
        const allValidFuncEmails = new Set(
          rowsToUpsert.map(r => (r.email || '').trim().toLowerCase()).filter(Boolean)
        )
        
        const rowsNeedingAccessSync = rowsToUpsert.filter(row => {
          const oldFunc = currentMap.get(row.id) || (row.codigo ? currentByCodigo.get(row.codigo) : null)
          return hasAccessFieldsChanged(oldFunc, row)
        })

        const BATCH_SIZE = 5
        for (let i = 0; i < rowsNeedingAccessSync.length; i += BATCH_SIZE) {
          const batch = rowsNeedingAccessSync.slice(i, i + BATCH_SIZE)
          await Promise.all(
            batch.map(row => {
              const oldFunc = currentMap.get(row.id) || (row.codigo ? currentByCodigo.get(row.codigo) : null)
              return syncFuncionarioAccess(supabaseAdmin, row, oldFunc, allValidFuncEmails)
            })
          )
        }
      }
      invalidateColaboradoresCache()
      clearAuthGuardCache()
      invalidateAuthUsersCache()
      return NextResponse.json(body, { status: 201 })
    }

    // Single Object Mode
    const candidateId = body?.id && typeof body.id === 'string' && !body.id.startsWith('TEMP-') ? body.id : undefined
    const { data: oldFunc } = candidateId
      ? await supabaseAdmin.from('funcionarios').select('id, email, perfil_sistema, nome, cargo, status, codigo, dados').eq('id', candidateId).maybeSingle()
      : { data: null };

    const row = buildFuncionarioDbRow(body, oldFunc?.id || candidateId, oldFunc?.dados)

    const { data, error } = await supabaseAdmin.from('funcionarios').upsert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (hasAccessFieldsChanged(oldFunc, data) || (data.email && data.perfil_sistema)) {
      await syncFuncionarioAccess(supabaseAdmin, {
        id: data.id,
        nome: data.nome,
        cargo: data.cargo,
        status: data.status,
        email: data.email,
        perfil_sistema: data.perfil_sistema,
        codigo: data.codigo
      }, oldFunc)
    }

    invalidateColaboradoresCache()
    clearAuthGuardCache()
    invalidateAuthUsersCache()

    return NextResponse.json(formatFuncionarioRow(data, true), { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  if (!roleCtx.isStaff || !isPrivilegedHrRole(roleCtx.perfil, roleCtx.cargo)) {
    return NextResponse.json({ error: 'Apenas Administradores, Diretores ou RH podem alterar funcionários.' }, { status: 403 })
  }

  const supabaseAdmin = getAdminClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const body = await request.json()

    // Buscar funcionário anterior para capturar oldEmail, status e dados
    const { data: oldFunc } = await supabaseAdmin
      .from('funcionarios')
      .select('id, email, perfil_sistema, nome, cargo, status, codigo, dados')
      .eq('id', id)
      .maybeSingle()

    const row = buildFuncionarioDbRow(body, id, oldFunc?.dados)
    const { id: _ignoreId, ...updateFields } = row

    const { data, error } = await supabaseAdmin
      .from('funcionarios')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (hasAccessFieldsChanged(oldFunc, data) || (data.email && data.perfil_sistema)) {
      await syncFuncionarioAccess(supabaseAdmin, {
        id: data.id,
        nome: data.nome,
        cargo: data.cargo,
        status: data.status,
        email: data.email,
        perfil_sistema: data.perfil_sistema,
        codigo: data.codigo
      }, oldFunc)
    }

    invalidateColaboradoresCache()
    clearAuthGuardCache()
    invalidateAuthUsersCache()

    return NextResponse.json(formatFuncionarioRow(data, true))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  const roleCtx = await resolveUserRole(request)
  if (roleCtx.errorResponse) return roleCtx.errorResponse
  if (!roleCtx.isStaff || !isPrivilegedHrRole(roleCtx.perfil, roleCtx.cargo)) {
    return NextResponse.json({ error: 'Apenas Administradores, Diretores ou RH podem remover funcionários.' }, { status: 403 })
  }

  const supabaseAdmin = getAdminClient();
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: funcRow } = await supabaseAdmin.from('funcionarios').select('email').eq('id', id).maybeSingle()

  const { error } = await supabaseAdmin.from('funcionarios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (funcRow?.email) {
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

  invalidateColaboradoresCache()
  clearAuthGuardCache()
  invalidateAuthUsersCache()

  return NextResponse.json({ ok: true })
}
