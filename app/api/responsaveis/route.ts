import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

// ─── GET: Listar responsáveis com alunos vinculados ──────────────────────────
export async function GET(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const limitParam = searchParams.get('limit')
    const all = searchParams.get('all') === 'true' || (!pageParam && !limitParam)

    const page = parseInt(pageParam || '1')
    const limit = parseInt(limitParam || '10')
    const search = searchParams.get('search') || ''
    const rfid = searchParams.get('rfid') || ''
    
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('responsaveis')
      .select('*', { count: 'exact' })

    if (search) {
      const searchClean = search.trim()
      query = query.or(`nome.ilike.%${searchClean}%,email.ilike.%${searchClean}%,telefone.ilike.%${searchClean}%,rfid.ilike.%${searchClean}%`)
    }

    if (rfid) {
      const cleanRfid = rfid.trim()
      const strippedRfid = cleanRfid.replace(/^0+/, '') || cleanRfid
      const paddedRfid = strippedRfid.padStart(10, '0')
      query = query.or(`rfid.eq.${cleanRfid},rfid.eq.${strippedRfid},rfid.eq.${paddedRfid}`)
    }

    let queryExec = query.order('nome')
    if (!all) {
      queryExec = queryExec.range(from, to)
    }

    const { data: responsaveisData, error: respError, count } = await queryExec

    if (respError) return NextResponse.json({ error: respError.message }, { status: 400 })
    
    if (!responsaveisData || responsaveisData.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, limit })
    }

    // Buscar vínculos em lotes para estes responsáveis
    const respIds = Array.from(new Set(responsaveisData.map((r: any) => String(r.id).trim()).filter(Boolean)))
    const links: any[] = []
    const chunkSize = 150

    if (respIds.length > 0) {
      for (let i = 0; i < respIds.length; i += chunkSize) {
        const chunk = respIds.slice(i, i + chunkSize)
        const { data: chunkLinks, error: linksError } = await supabase
          .from('aluno_responsavel')
          .select('*')
          .in('responsavel_id', chunk)
          .limit(10000)
            
        if (linksError) {
          console.error(`[${new Date().toISOString()}] Error Responsáveis GET (Links Chunk ${i}): ${linksError.message}\n`)
        } else if (chunkLinks) {
          links.push(...chunkLinks)
        }
      }
    }

    // Busca os dados dos alunos manualmente em lotes
    const studentIds = Array.from(new Set(links.map((l: any) => String(l.aluno_id).trim()).filter(Boolean)))
    let students: any[] = []
    
    if (studentIds.length > 0) {
      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize)
        const cleanChunk = chunk.map(c => String(c).trim()).filter(Boolean)
        if (cleanChunk.length > 0) {
          const formattedRefs = cleanChunk.map(r => /[ ,()\/]/.test(r) ? `"${r.replace(/"/g, '\\"')}"` : r).join(',')
          const { data: chunkStudents, error: studentError } = await supabase
            .from('alunos')
            .select('id, nome, matricula, codigo, dados')
            .or(`id.in.(${formattedRefs}),matricula.in.(${formattedRefs}),codigo.in.(${formattedRefs})`)
            .limit(10000)
            
          if (studentError) {
            console.error(`[${new Date().toISOString()}] Error Responsáveis GET (Alunos Chunk ${i}): ${studentError.message}\n`)
          } else if (chunkStudents) {
            students.push(...chunkStudents)
          }
        }
      }
    }

    // Formatar dados
    const formattedData = responsaveisData.map((resp: any) => ({
      ...resp,
      dataNasc: resp.data_nasc,
      diasAcesso: resp.dias_acesso,
      alunosVinculados: links
        .filter((l: any) => String(l.responsavel_id).trim() === String(resp.id).trim())
        .map((l: any) => {
          const targetRef = String(l.aluno_id).trim().toLowerCase()
          const aluno = students.find((s: any) =>
            String(s.id).trim().toLowerCase() === targetRef ||
            String(s.matricula || '').trim().toLowerCase() === targetRef ||
            String(s.codigo || '').trim().toLowerCase() === targetRef ||
            String(s.dados?.codigo || '').trim().toLowerCase() === targetRef
          ) || {}
          return {
            ...aluno,
            id: aluno.id || l.aluno_id,
            nome: aluno.nome || `Aluno (${l.aluno_id})`,
            parentesco: l.parentesco,
            isFinanceiro: l.resp_financeiro === true,
            isPedagogico: l.resp_pedagogico === true,
            isOutro: l.resp_outro === true
          }
        })
        .filter((a: any) => a.id || a.nome) || []
    }))

    return NextResponse.json({
      data: formattedData,
      total: count || 0,
      page,
      limit
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── POST: Criar ou atualizar responsável ─────────────────────────────────────
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()

    if (Array.isArray(body)) {
      return NextResponse.json({ error: 'Este endpoint aceita apenas um objeto, não um array.' }, { status: 400 })
    }

    const item = body
    
    // Remove campos calculados ou de relação antes de salvar
    const { aluno_responsavel, alunosVinculados, alunos_vinculados, dataNasc, isFinanceiro, isPedagogico, isOutro, diasAcesso, parentesco, cpf, rg, ...dataToSave } = item
    
    // Se tiver ID válido, mantém para o upsert atualizar, senão remove para o Supabase gerar um UUID
    if (item.id && item.id.trim() !== '' && !item.id.startsWith('TEMP-')) {
      dataToSave.id = item.id
    } else {
      delete dataToSave.id
    }
    
    // Mapeia camelCase para snake_case
    if (dataNasc) {
      dataToSave.data_nasc = dataNasc
    }
    
    // Salva os dias de acesso na nova coluna dedicada
    if (diasAcesso) {
      dataToSave.dias_acesso = diasAcesso
    }

    // Mapeia CPF e RG para dados JSONB
    const dados = { ...(item.dados || {}) }
    if (cpf) {
      dados.cpf = String(cpf).replace(/\D/g, '')
    }
    if (rg) {
      dados.rg = String(rg).trim()
    }
    dataToSave.dados = dados
    
    const { data: queryData, error } = await supabase
      .from('responsaveis')
      .insert(dataToSave) // Use insert for creation!
      .select()
    
    if (error) throw new Error(error.message)
    
    const data = queryData && queryData.length > 0 ? queryData[0] : null
    if (!data) throw new Error('Nenhum dado retornado após salvar')
    
    // Salvar vínculos se existirem
    let links: any[] = []
    if (alunos_vinculados && Array.isArray(alunos_vinculados)) {
      links = alunos_vinculados.map((v: any) => ({
        aluno_id: String(v.aluno_id || v.id).trim(),
        responsavel_id: String(data.id).trim(),
        parentesco: v.parentesco || 'mae',
        resp_pedagogico: v.resp_pedagogico ?? true,
        resp_financeiro: v.resp_financeiro ?? true,
        resp_outro: v.resp_outro ?? false
      }))
      
      if (links.length > 0) {
        const { error: linkError } = await supabase.from('aluno_responsavel').insert(links)
        if (linkError) throw new Error(linkError.message)
      }
    }

    return NextResponse.json({ ...data, insertedLinks: links }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── PUT: Atualizar responsável ──────────────────────────────────────────────
export async function PUT(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id') || body.id

    if (!id) return NextResponse.json({ error: 'ID é obrigatório para atualização' }, { status: 400 })

    const { aluno_responsavel, alunosVinculados, alunos_vinculados, dataNasc, isFinanceiro, isPedagogico, isOutro, diasAcesso, parentesco, cpf, rg, id: bodyId, ...dataToSave } = body
    
    if (dataNasc) {
      dataToSave.data_nasc = dataNasc
    }
    
    if (diasAcesso) {
      dataToSave.dias_acesso = diasAcesso
    }

    // Mapeia CPF e RG para dados JSONB preservando os existentes no banco
    const dados = { ...(body.dados || {}) }
    const { data: existingResp } = await supabase
      .from('responsaveis')
      .select('dados')
      .eq('id', id)
      .maybeSingle()
    if (existingResp?.dados) {
      Object.assign(dados, existingResp.dados)
    }
    if (cpf) {
      dados.cpf = String(cpf).replace(/\D/g, '')
    }
    if (rg) {
      dados.rg = String(rg).trim()
    }
    dataToSave.dados = dados
    
    const { data: queryData, error } = await supabase
      .from('responsaveis')
      .update(dataToSave)
      .eq('id', id)
      .select()
    
    if (error) throw new Error(error.message)
    
    const data = queryData && queryData.length > 0 ? queryData[0] : null
    if (!data) throw new Error('Responsável não encontrado ou não atualizado')
    
    // Atualizar vínculos
    let links: any[] = []
    if (alunos_vinculados && Array.isArray(alunos_vinculados)) {
      // Remove vínculos antigos primeiro
      await supabase.from('aluno_responsavel').delete().eq('responsavel_id', data.id)
      
      links = alunos_vinculados.map((v: any) => ({
        aluno_id: String(v.aluno_id || v.id).trim(),
        responsavel_id: String(data.id).trim(),
        parentesco: v.parentesco || 'mae',
        resp_pedagogico: v.resp_pedagogico ?? true,
        resp_financeiro: v.resp_financeiro ?? true,
        resp_outro: v.resp_outro ?? false
      }))
      
      if (links.length > 0) {
        const { error: linkError } = await supabase.from('aluno_responsavel').insert(links)
        if (linkError) throw new Error(linkError.message)
      }

      // Se o responsável editado tiver email, verifica se restou algum vínculo pedagógico ou financeiro
      if (data.email) {
        const hasActiveLink = links.some((l: any) => l.resp_financeiro === true || l.resp_pedagogico === true)
        
        if (!hasActiveLink) {
          const emailClean = data.email.trim().toLowerCase()
          const supabaseAdmin = getAdminClient()
          // Busca por email diretamente via system_users (evita listUsers)
          const { data: sysUser } = await supabaseAdmin
            .from('system_users')
            .select('id')
            .eq('email', emailClean)
            .maybeSingle()
          if (sysUser?.id) {
            await supabaseAdmin.auth.admin.deleteUser(sysUser.id).catch((e: any) => console.error('Erro ao revogar acesso de responsável desvinculado:', e))
          }
        }
      }
    }

    return NextResponse.json({ ...data, insertedLinks: links })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// ─── DELETE: Remover responsável ──────────────────────────────────────────────
export async function DELETE(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    // Busca o email do responsável antes de deletar
    const { data: resp } = await supabase.from('responsaveis').select('email').eq('id', id).maybeSingle()
    const email = resp?.email

    // Remove vínculos primeiro
    await supabase.from('aluno_responsavel').delete().eq('responsavel_id', id)
    
    // Remove o responsável
    const { error } = await supabase.from('responsaveis').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Se o responsável possuir email, localiza e remove sua credencial no Supabase Auth
    if (email) {
      const emailClean = email.trim().toLowerCase()
      const supabaseAdmin = getAdminClient()
      // Busca via system_users como índice (evita listUsers de 1000 usuários)
      const { data: sysUser } = await supabaseAdmin
        .from('system_users')
        .select('id')
        .eq('email', emailClean)
        .maybeSingle()
      if (sysUser?.id) {
        await supabaseAdmin.auth.admin.deleteUser(sysUser.id).catch((e: any) => console.error('Erro ao remover usuário de autenticação:', e))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
