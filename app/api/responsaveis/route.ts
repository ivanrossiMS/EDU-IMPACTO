import { NextResponse } from 'next/server'
import { supabaseServer as supabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

// ─── GET: Listar responsáveis com alunos vinculados ──────────────────────────
export async function GET(request: Request) {
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

    // Buscar vínculos para estes responsáveis
    const respIds = responsaveisData.map((r: any) => r.id)
    
    const { data: linksData, error: linksError } = await supabase
      .from('aluno_responsavel')
      .select('*')
      .in('responsavel_id', respIds)
        
    if (linksError) {
      const fs = require('fs')
      const path = require('path')
      fs.appendFileSync(path.join(process.cwd(), 'api_error_log.txt'), `[${new Date().toISOString()}] Error Responsáveis GET (Links): ${linksError.message}\n`)
    }
    const links = linksError ? [] : (linksData || [])

    // Busca os dados dos alunos manualmente para evitar erro de ambiguidade no join
    const studentIds = links.map((l: any) => l.aluno_id).filter(Boolean)
    let students: any[] = []
    
    if (studentIds.length > 0) {
      const { data: studentData, error: studentError } = await supabase
        .from('alunos')
        .select('*')
        .in('id', studentIds)
        
      if (studentError) {
        const fs = require('fs')
        const path = require('path')
        fs.appendFileSync(path.join(process.cwd(), 'api_error_log.txt'), `[${new Date().toISOString()}] Error Responsáveis GET (Alunos): ${studentError.message}\n`)
      } else {
        students = studentData || []
      }
    }

    // Formatar dados
    const formattedData = responsaveisData.map((resp: any) => ({
      ...resp,
      dataNasc: resp.data_nasc,
      diasAcesso: resp.dias_acesso,
      alunosVinculados: links
        .filter((l: any) => l.responsavel_id === resp.id)
        .map((l: any) => {
          const aluno = students.find((s: any) => s.id === l.aluno_id || s.matricula === l.aluno_id) || {}
          return {
            ...aluno,
            parentesco: l.parentesco,
            isFinanceiro: l.resp_financeiro,
            isPedagogico: l.resp_pedagogico,
            isOutro: l.resp_outro
          }
        })
        .filter((a: any) => a.id) || []
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
        aluno_id: v.id || v.aluno_id,
        responsavel_id: data.id,
        parentesco: v.parentesco,
        resp_pedagogico: v.resp_pedagogico,
        resp_financeiro: v.resp_financeiro,
        resp_outro: v.resp_outro
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
  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id') || body.id

    if (!id) return NextResponse.json({ error: 'ID é obrigatório para atualização' }, { status: 400 })

    const fs = require('fs')
    fs.appendFileSync('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/api_error_log.txt', `\n[${new Date().toISOString()}] API Responsaveis PUT Body: ${JSON.stringify(body, null, 2)}\n`)
    const { aluno_responsavel, alunosVinculados, alunos_vinculados, dataNasc, isFinanceiro, isPedagogico, isOutro, diasAcesso, parentesco, cpf, rg, id: bodyId, ...dataToSave } = body
    fs.appendFileSync('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/api_error_log.txt', `\n[${new Date().toISOString()}] API Responsaveis PUT dataToSave: ${JSON.stringify(dataToSave, null, 2)}\n`)
    
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
        aluno_id: v.id || v.aluno_id,
        responsavel_id: data.id,
        parentesco: v.parentesco,
        resp_pedagogico: v.resp_pedagogico,
        resp_financeiro: v.resp_financeiro,
        resp_outro: v.resp_outro
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
          const supabaseAdmin = require('@supabase/supabase-js').createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: { users: [] } }))
          const authUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === emailClean)
          if (authUser) {
            await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch((e: any) => console.error('Erro ao revogar acesso de responsável desvinculado:', e))
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
      const supabaseAdmin = require('@supabase/supabase-js').createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: { users: [] } }))
      const authUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === emailClean)
      if (authUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch((e: any) => console.error('Erro ao remover usuário de autenticação:', e))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
