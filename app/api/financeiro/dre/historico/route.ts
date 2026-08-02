import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const STORE_FILE = path.join(process.cwd(), '.dre_historico_store.json')

async function readLocalStore(): Promise<any[]> {
  try {
    const data = await fs.readFile(STORE_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (e) {
    return []
  }
}

async function writeLocalStore(items: any[]) {
  try {
    await fs.writeFile(STORE_FILE, JSON.stringify(items, null, 2), 'utf-8')
  } catch (e) {
    console.warn('Erro ao gravar .dre_historico_store.json:', e)
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const from = (page - 1) * limit
    const to = from + limit - 1

    let dbItems: any[] = []

    try {
      const { data, error } = await supabase
        .from('dre_uploads')
        .select('id, nome_arquivo, tipo_arquivo, periodo_descricao, periodo_inicio, periodo_fim, empresa, total_receitas, total_despesas, resultado_liquido, criado_em, dados_dre')
        .order('criado_em', { ascending: false })
        .range(from, to)

      if (!error && data) {
        dbItems = data
      }
    } catch (dbErr) {
      console.warn('[DRE Histórico GET] Exceção Supabase:', dbErr)
    }

    // Lê os itens do arquivo local de backup
    const localItems = await readLocalStore()

    // Mescla os dois ignorando duplicados por ID
    const itemMap = new Map<string, any>()
    for (const item of localItems) {
      if (item.dados_dre?._arquivo_base64 && !item.arquivo_base64) {
        item.arquivo_base64 = item.dados_dre._arquivo_base64
      }
      itemMap.set(item.id, item)
    }
    for (const item of dbItems) {
      if (item.dados_dre?._arquivo_base64 && !item.arquivo_base64) {
        item.arquivo_base64 = item.dados_dre._arquivo_base64
      }
      itemMap.set(item.id, item)
    }

    const combinedList = Array.from(itemMap.values()).sort((a, b) => {
      return new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime()
    })

    return NextResponse.json({
      data: combinedList,
      total: combinedList.length,
      page,
      limit
    })

  } catch (err: any) {
    console.error('[DRE Histórico GET] Erro:', err)
    return NextResponse.json({ data: [], total: 0, page: 1, limit: 50 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })
    }

    // Apaga do Supabase
    try {
      await supabase.from('dre_uploads').delete().eq('id', id)
    } catch (e) {}

    // Apaga do arquivo local
    let localItems = await readLocalStore()
    localItems = localItems.filter(i => i.id !== id)
    await writeLocalStore(localItems)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DRE Histórico DELETE]', err)
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
  }
}

// Renomear arquivo no Supabase e no arquivo local
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { id, novoNome } = await request.json()

    if (!id || !novoNome) {
      return NextResponse.json({ error: 'ID e Novo Nome são obrigatórios.' }, { status: 400 })
    }

    // Atualiza no Supabase
    try {
      await supabase.from('dre_uploads').update({ nome_arquivo: novoNome }).eq('id', id)
    } catch (e) {}

    // Atualiza no arquivo local
    let localItems = await readLocalStore()
    localItems = localItems.map(i => i.id === id ? { ...i, nome_arquivo: novoNome } : i)
    await writeLocalStore(localItems)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DRE Histórico PUT]', err)
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Ação: Salvar DRE explicitamente
    if (body.action === 'save') {
      const { nomeArquivo, dadosDRE, tipoArquivo = 'pdf', arquivoBase64 } = body
      const { data: userData } = await supabase.auth.getUser()

      const base64ToUse = arquivoBase64 || dadosDRE?._arquivo_base64

      const itemToSave: any = {
        id: crypto.randomUUID(),
        nome_arquivo: nomeArquivo || 'DRE - Relatório Analítico',
        tipo_arquivo: tipoArquivo,
        dados_dre: dadosDRE,
        arquivo_base64: base64ToUse,
        periodo_descricao: dadosDRE?.periodo?.descricao || 'Análise Anual',
        empresa: dadosDRE?.empresa || 'Colégio Impacto',
        total_receitas: dadosDRE?.receitas?.total_geral || 0,
        total_despesas: dadosDRE?.despesas?.total_geral || 0,
        resultado_liquido: dadosDRE?.resultado_operacional || 0,
        criado_em: new Date().toISOString()
      }

      if (userData?.user?.id) {
        itemToSave.usuario_id = userData.user.id
      }

      // Tenta salvar no Supabase
      try {
        await supabase.from('dre_uploads').insert(itemToSave)
      } catch (dbErr) {
        console.warn('Post ao Supabase dre_uploads opcional:', dbErr)
      }

      // Salva no arquivo local
      let localItems = await readLocalStore()
      localItems = [itemToSave, ...localItems.filter(i => i.id !== itemToSave.id)].slice(0, 100)
      await writeLocalStore(localItems)

      return NextResponse.json({ success: true, id: itemToSave.id, item: itemToSave })
    }

    // Ação: Carregar um DRE específico pelo ID
    const { id } = body
    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })
    }

    // Busca no arquivo local primeiro
    const localItems = await readLocalStore()
    const itemEncontrado = localItems.find(i => i.id === id)
    if (itemEncontrado && itemEncontrado.dados_dre) {
      return NextResponse.json({ data: itemEncontrado })
    }

    // Se não encontrou no arquivo local, busca no Supabase
    const { data, error } = await supabase
      .from('dre_uploads')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[DRE Histórico POST]', err)
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
  }
}
