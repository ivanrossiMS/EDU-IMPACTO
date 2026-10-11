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
      const cleanDigits = searchClean.replace(/\D/g, '')
      if (cleanDigits.length >= 3) {
        query = query.or(`nome.ilike.%${searchClean}%,email.ilike.%${searchClean}%,telefone.ilike.%${searchClean}%,rfid.ilike.%${searchClean}%,dados->>cpf.ilike.%${cleanDigits}%`)
      } else {
        query = query.or(`nome.ilike.%${searchClean}%,email.ilike.%${searchClean}%,telefone.ilike.%${searchClean}%,rfid.ilike.%${searchClean}%`)
      }
    }

    if (rfid) {
      const cleanRfid = rfid.trim()
      const strippedRfid = cleanRfid.replace(/^0+/, '') || cleanRfid
      const paddedRfid = strippedRfid.padStart(10, '0')
      query = query.or(`rfid.eq.${cleanRfid},rfid.eq.${strippedRfid},rfid.eq.${paddedRfid}`)
    }

    let queryExec = query.order('nome')
    let responsaveisData: any[] = []
    let respError: any = null
    let count: number | null = null

    if (!all) {
      const { data, error, count: c } = await queryExec.range(from, to)
      responsaveisData = data || []
      respError = error
      count = c
    } else {
      let hasMore = true
      let offset = 0
      const limitVal = 1000
      while (hasMore) {
        const { data: chunk, error } = await query
          .order('nome')
          .range(offset, offset + limitVal - 1)
        
        if (error) {
          respError = error
          break
        }
        
        if (chunk && chunk.length > 0) {
          responsaveisData.push(...chunk)
          offset += limitVal
          if (chunk.length < limitVal) {
            hasMore = false
          }
        } else {
          hasMore = false
        }
      }
      count = responsaveisData.length
    }

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
          const formatRef = (r: string) => /[ ,()\/]/.test(r) ? `"${r.replace(/"/g, '\\"')}"` : r
          const formattedAll = cleanChunk.map(formatRef).join(',')

          const { data: chunkStudents, error: studentError } = await supabase
            .from('alunos')
            .select('id, nome, matricula, status, foto, foto_url, turma, dados')
            .or(`id.in.(${formattedAll}),matricula.in.(${formattedAll})`)
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
    const formattedData = responsaveisData.map((resp: any) => {
      const d = resp.dados || {}
      return {
        ...resp,
        dataNasc: resp.data_nasc || d.dataNasc || d.data_nasc || '',
        diasAcesso: resp.dias_acesso || d.diasAcesso || d.dias_acesso || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
        cpf: d.cpf || resp.cpf || '',
        rg: d.rg || resp.rg || '',
        rgOrgaoEmissor: d.rgOrgaoEmissor || d.orgEmissor || '',
        sexo: d.sexo || resp.sexo || '',
        estadoCivil: d.estadoCivil || resp.estado_civil || '',
        profissao: d.profissao || resp.profissao || '',
        nacionalidade: d.nacionalidade || 'Brasileira',
        naturalidade: d.naturalidade || '',
        naturalidadeUf: d.naturalidadeUf || '',
        cep: d.cep || '',
        endereco: d.endereco || d.logradouro || '',
        numero: d.numero || '',
        complemento: d.complemento || '',
        bairro: d.bairro || '',
        cidade: d.cidade || '',
        uf: d.uf || d.ufEnd || '',
        comercialEmpresa: d.comercialEmpresa || '',
        comercialTelefone: d.comercialTelefone || '',
        comercialCep: d.comercialCep || '',
        comercialEndereco: d.comercialEndereco || '',
        comercialNumero: d.comercialNumero || '',
        comercialComplemento: d.comercialComplemento || '',
        comercialBairro: d.comercialBairro || '',
        comercialCidade: d.comercialCidade || '',
        comercialUf: d.comercialUf || '',
        alunosVinculados: links
          .filter((l: any) => String(l.responsavel_id).trim() === String(resp.id).trim())
          .map((l: any) => {
            const targetRef = String(l.aluno_id).trim().toLowerCase()
            const targetUnpadded = targetRef.replace(/^0+/, '')
            const aluno = students.find((s: any) => {
              const sId = String(s.id || '').trim().toLowerCase()
              const sMat = String(s.matricula || '').trim().toLowerCase()
              const sCod = String(s.codigo || '').trim().toLowerCase()
              const sDCod = String(s.dados?.codigo || '').trim().toLowerCase()
              const sDCodAlu = String(s.dados?.codigoAluno || '').trim().toLowerCase()
              const sDId = String(s.dados?.id || '').trim().toLowerCase()
              return (
                sId === targetRef || (targetUnpadded && sId.replace(/^0+/, '') === targetUnpadded) ||
                sMat === targetRef || (targetUnpadded && sMat.replace(/^0+/, '') === targetUnpadded) ||
                sCod === targetRef || (targetUnpadded && sCod.replace(/^0+/, '') === targetUnpadded) ||
                sDCod === targetRef || (targetUnpadded && sDCod.replace(/^0+/, '') === targetUnpadded) ||
                sDCodAlu === targetRef || (targetUnpadded && sDCodAlu.replace(/^0+/, '') === targetUnpadded) ||
                sDId === targetRef || (targetUnpadded && sDId.replace(/^0+/, '') === targetUnpadded)
              )
            }) || {}
            return {
              ...aluno,
              id: aluno.id || l.aluno_id,
              nome: aluno.nome || `Aluno (${l.aluno_id})`,
              status: aluno.status || aluno.dados?.status || 'ativo',
              foto: aluno.foto || aluno.foto_url || aluno.dados?.foto || null,
              parentesco: l.parentesco,
              isFinanceiro: l.resp_financeiro === true,
              isPedagogico: l.resp_pedagogico === true,
              isOutro: l.resp_outro === true
            }
          })
          .filter((a: any) => a.id || a.nome) || []
      }
    })

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

// ─── Helper: Preparar dados do responsável para salvar em colunas válidas e dados JSONB ─
function prepareResponsavelData(item: any, existingDados: any = {}) {
  const dados = { ...(existingDados || {}), ...(item.dados || {}) }

  if (item.cpf !== undefined) dados.cpf = String(item.cpf).replace(/\D/g, '')
  if (item.rg !== undefined) dados.rg = String(item.rg).trim()
  if (item.rgOrgaoEmissor !== undefined || item.orgEmissor !== undefined) {
    dados.rgOrgaoEmissor = item.rgOrgaoEmissor || item.orgEmissor || ''
    dados.orgEmissor = dados.rgOrgaoEmissor
  }
  if (item.sexo !== undefined) dados.sexo = item.sexo
  if (item.estadoCivil !== undefined || item.estado_civil !== undefined) {
    dados.estadoCivil = item.estadoCivil || item.estado_civil
  }
  if (item.nacionalidade !== undefined) dados.nacionalidade = item.nacionalidade || 'Brasileira'
  if (item.naturalidade !== undefined) dados.naturalidade = item.naturalidade
  if (item.naturalidadeUf !== undefined) dados.naturalidadeUf = item.naturalidadeUf
  if (item.profissao !== undefined) dados.profissao = item.profissao

  // Endereço Residencial
  if (item.cep !== undefined) dados.cep = item.cep
  if (item.endereco !== undefined || item.logradouro !== undefined) {
    dados.endereco = item.endereco || item.logradouro
    dados.logradouro = dados.endereco
  }
  if (item.numero !== undefined) dados.numero = item.numero
  if (item.complemento !== undefined) dados.complemento = item.complemento
  if (item.bairro !== undefined) dados.bairro = item.bairro
  if (item.cidade !== undefined) dados.cidade = item.cidade
  if (item.uf !== undefined || item.ufEnd !== undefined) {
    dados.uf = item.uf || item.ufEnd
    dados.ufEnd = dados.uf
  }

  // Endereço Comercial
  if (item.comercialEmpresa !== undefined) dados.comercialEmpresa = item.comercialEmpresa
  if (item.comercialTelefone !== undefined) dados.comercialTelefone = item.comercialTelefone
  if (item.comercialCep !== undefined) dados.comercialCep = item.comercialCep
  if (item.comercialEndereco !== undefined) dados.comercialEndereco = item.comercialEndereco
  if (item.comercialNumero !== undefined) dados.comercialNumero = item.comercialNumero
  if (item.comercialComplemento !== undefined) dados.comercialComplemento = item.comercialComplemento
  if (item.comercialBairro !== undefined) dados.comercialBairro = item.comercialBairro
  if (item.comercialCidade !== undefined) dados.comercialCidade = item.comercialCidade
  if (item.comercialUf !== undefined) dados.comercialUf = item.comercialUf

  // Construir dataToSave APENAS com colunas válidas da tabela responsaveis
  const dataToSave: Record<string, any> = { dados }

  if (item.id && String(item.id).trim() !== '' && !String(item.id).startsWith('TEMP-')) {
    dataToSave.id = String(item.id).trim()
  }
  if (item.nome !== undefined) dataToSave.nome = item.nome
  if (item.email !== undefined) dataToSave.email = item.email ? String(item.email).trim().toLowerCase() : null
  if (item.telefone !== undefined) dataToSave.telefone = item.telefone
  if (item.celular !== undefined) dataToSave.celular = item.celular
  if (item.rfid !== undefined) dataToSave.rfid = item.rfid
  if (item.codigo !== undefined) dataToSave.codigo = item.codigo
  if (item.proibido !== undefined) dataToSave.proibido = item.proibido === true
  
  const dataNasc = item.dataNasc || item.data_nasc
  if (dataNasc !== undefined) dataToSave.data_nasc = dataNasc || null
  
  const diasAcesso = item.diasAcesso || item.dias_acesso
  if (diasAcesso !== undefined) dataToSave.dias_acesso = diasAcesso
  
  const estadoCivil = item.estadoCivil || item.estado_civil
  if (estadoCivil !== undefined) dataToSave.estado_civil = estadoCivil
  
  if (item.profissao !== undefined) dataToSave.profissao = item.profissao

  return dataToSave
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
    const dataToSave = prepareResponsavelData(item)
    
    const { data: queryData, error } = await supabase
      .from('responsaveis')
      .insert(dataToSave)
      .select()
    
    if (error) throw new Error(error.message)
    
    const data = queryData && queryData.length > 0 ? queryData[0] : null
    if (!data) throw new Error('Nenhum dado retornado após salvar')
    
    // Salvar vínculos se existirem
    let links: any[] = []
    const alunosVinculados = item.alunos_vinculados || item.alunosVinculados
    if (alunosVinculados && Array.isArray(alunosVinculados)) {
      links = alunosVinculados.map((v: any) => ({
        aluno_id: String(v.aluno_id || v.id).trim(),
        responsavel_id: String(data.id).trim(),
        parentesco: v.parentesco || item.parentesco || 'mae',
        resp_pedagogico: v.resp_pedagogico ?? item.isPedagogico ?? true,
        resp_financeiro: v.resp_financeiro ?? item.isFinanceiro ?? true,
        resp_outro: v.resp_outro ?? item.isOutro ?? false
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

    const alunos_vinculados = body.alunos_vinculados || body.alunosVinculados

    const { data: existingResp } = await supabase
      .from('responsaveis')
      .select('dados')
      .eq('id', id)
      .maybeSingle()

    const dataToSave = prepareResponsavelData(body, existingResp?.dados)
    delete dataToSave.id // id é usado na cláusula .eq('id', id)
    
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
