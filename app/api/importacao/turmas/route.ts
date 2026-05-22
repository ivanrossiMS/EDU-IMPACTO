import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export async function POST(request: Request) {
  try {
    const supabase = await createProtectedClient()
    const body = await request.json()
    const { rows, mapping, config, hasHeaders, headers } = body as { 
      rows: any[][]; 
      mapping: Record<string, string>; 
      config: string;
      hasHeaders: boolean;
      headers: string[] | null;
    }

    if (!Array.isArray(rows) || !mapping) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    let inseridos = 0
    let atualizados = 0
    let erros = 0
    const erroDetails: { linha: number; msg: string }[] = []

    // 1. Buscar todas as turmas existentes para evitar DB queries em loop
    const { data: existingTurmasData, error: fetchError } = await supabase
      .from('turmas')
      .select('id, nome, ano')
    
    if (fetchError) throw fetchError

    const existingTurmas = existingTurmasData || []
    const existingIds = new Set(existingTurmas.map(t => t.id))
    
    // Mapeamento para busca rápida por Nome + Ano (Normalizado)
    const existingMap = new Map<string, string>()
    existingTurmas.forEach(t => {
      existingMap.set(`${normalize(t.nome)}_${t.ano}`, t.id)
    })

    const rowsToUpsert: any[] = []

    // Função para gerar ID único de 4 dígitos em memória
    const generateUniqueId = () => {
      let id = ''
      let attempts = 0
      while (attempts < 1000) {
        id = Math.floor(1000 + Math.random() * 9000).toString()
        if (!existingIds.has(id)) {
          existingIds.add(id)
          return id
        }
        attempts++
      }
      throw new Error('Não foi possível gerar um ID único para a turma')
    }

    for (const [index, row] of rows.entries()) {
      try {
        // Extrair dados baseados no mapeamento
        const extractedData: any = {}

        Object.entries(mapping).forEach(([column, target]) => {
          if (!target) return
          let value;
          if (hasHeaders && headers) {
            const colIdx = headers.indexOf(column)
            if (colIdx !== -1) value = row[colIdx]
          } else {
            const colIdx = parseInt(column)
            if (!isNaN(colIdx)) value = row[colIdx]
          }

          if (value === undefined || value === null || value === '') return
          extractedData[target] = value
        })

        // Validação obrigatória
        if (!extractedData.nome) {
          erros++
          erroDetails.push({ linha: index + (hasHeaders ? 2 : 1), msg: 'Nome da turma é obrigatório' })
          continue
        }

        const nome = String(extractedData.nome).trim()
        const ano = parseInt(extractedData.ano) || new Date().getFullYear()
        const key = `${normalize(nome)}_${ano}`
        
        const existingId = existingMap.get(key)
        const isUpdate = !!existingId

        let finalTurmaData: any = {}

        if (isUpdate) {
          finalTurmaData.id = existingId
          atualizados++
        } else {
          finalTurmaData.id = generateUniqueId()
          finalTurmaData.codigo = finalTurmaData.id
          finalTurmaData.matriculados = 0
          inseridos++
        }

        finalTurmaData.nome = nome
        finalTurmaData.ano = ano
        finalTurmaData.serie = extractedData.serie || ''
        finalTurmaData.turno = extractedData.turno || ''
        finalTurmaData.capacidade = parseInt(extractedData.capacidade) || 30
        
        // Dados extras no JSONB
        finalTurmaData.dados = {
          status: 'ativa',
          segmento: extractedData.segmento || '',
          dataMatricula: new Date().toISOString().split('T')[0]
        }

        rowsToUpsert.push(finalTurmaData)

      } catch (e: any) {
        erros++
        erroDetails.push({ linha: index + (hasHeaders ? 2 : 1), msg: e.message })
      }
    }

    // 2. Upsert em lote (MUITO mais rápido)
    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('turmas')
        .upsert(rowsToUpsert)

      if (upsertError) {
        console.error('[Import Turmas] Erro no upsert:', upsertError)
        return NextResponse.json({ error: `Erro ao salvar turmas: ${upsertError.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      inseridos,
      atualizados,
      erros,
      erroDetails: erroDetails.slice(0, 20),
    })

  } catch (e: any) {
    console.error('[POST /api/importacao/turmas]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
