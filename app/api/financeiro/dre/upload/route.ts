import { NextResponse } from 'next/server'
import { GoogleGenAI, Type, Schema } from '@google/genai'
import { createClient } from '@/utils/supabase/server'
import crypto from 'crypto'

function repairTruncatedJson(rawStr: string): string {
  let str = rawStr.trim()
  if (!str.startsWith('{')) {
    const idx = str.indexOf('{')
    if (idx !== -1) str = str.substring(idx)
  }

  // Sanitiza quebras de linha e tabulações dentro de aspas duplas no JSON
  let inString = false
  let escaped = false
  let sanitized = ''

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (char === '\\' && !escaped) {
      escaped = true
      sanitized += char
      continue
    }
    if (char === '"' && !escaped) {
      inString = !inString
    }
    if (inString && (char === '\n' || char === '\r' || char === '\t')) {
      sanitized += ' '
    } else {
      sanitized += char
    }
    escaped = false
  }

  str = sanitized

  // Remove chaves/propriedades incompletas ao final do buffer cortado
  str = str.replace(/,\s*"[^"]*"?\s*:\s*$/g, '')
  str = str.replace(/,\s*"[^"]*$/g, '')
  str = str.replace(/,\s*$/g, '')

  inString = false
  escaped = false

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (char === '\\' && !escaped) { escaped = true; continue }
    if (char === '"' && !escaped) { inString = !inString }
    escaped = false
  }

  if (inString) str += '"'
  str = str.replace(/,\s*$/, '')

  inString = false
  escaped = false
  const stack: string[] = []

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (char === '\\' && !escaped) { escaped = true; continue }
    if (char === '"' && !escaped) {
      inString = !inString
    } else if (!inString) {
      if (char === '{' || char === '[') stack.push(char)
      else if (char === '}' && stack[stack.length - 1] === '{') stack.pop()
      else if (char === ']' && stack[stack.length - 1] === '[') stack.pop()
    }
    escaped = false
  }

  while (stack.length > 0) {
    const openChar = stack.pop()
    if (openChar === '{') str += '}'
    if (openChar === '[') str += ']'
  }

  return str
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve) => {
    try {
      const PDFParser = require('pdf2json')
      const pdfParser = new PDFParser(null, 1)
      pdfParser.on('pdfParser_dataError', () => resolve(''))
      pdfParser.on('pdfParser_dataReady', () => {
        try {
          const rawText = pdfParser.getRawTextContent() || ''
          resolve(rawText)
        } catch (e) {
          resolve('')
        }
      })
      pdfParser.parseBuffer(buffer)
    } catch (e) {
      resolve('')
    }
  })
}

export const maxDuration = 120

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não está configurada no servidor.' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const nomeArquivo = (formData.get('nomeArquivo') as string) || file?.name || 'relatorio.pdf'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const ext = nomeArquivo.split('.').pop()?.toLowerCase() || ''
    const isPdf = ext === 'pdf'
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let parts: any[] = []

    const promptText = `Você é o melhor economista e contador do mundo, especialista em DRE e análise financeira para instituições de ensino no Brasil.

EXIGÊNCIA CONTÁBIL IMPERATIVA DE TOTALIZAÇÃO:
1. LEIA O DOCUMENTO INTEIRO DA PRIMEIRA À ÚLTIMA PÁGINA.
2. EXTRAIA OS TOTALIZADORES IMPRESSOS NO DOCUMENTO:
   - Para Receitas (código 00.xx): Traga o valor total impresso do grupo (ex: 4.889.374,59 ou 4.916.236,77) em 'total' e 'receitas.total_geral'.
   - Para Despesas/Custos Operacionais (código 50.xx a 59.xx / CUSTOS OPERACIONAIS): Traga o valor total impresso das despesas (ex: 3.418.579,52) em 'despesas.total_geral' e em 'despesas.grupos'. NUNCA DEIXE AS DESPESAS VAZIAS OU ZERADAS.
3. ORDENAÇÃO DOS SUB-ITENS: Traga obrigatoriamente os maiores itens de receita e despesa primeiro (ex: Repasse Isa ac 3.738.390,97, Pagamento ref ISAAC 497.725,03, Salários 1.850.000,00, Encargos 450.000,00, Aluguel 320.000,00). NUNCA deixe de incluir os maiores valores financeiros.
4. Retorne em JSON exatamente conforme o schema.`

    if (isPdf) {
      let pdfTexto = ''
      try {
        pdfTexto = await extractPdfText(buffer)
      } catch (pdfErr) {
        console.warn('Erro ao extrair texto de PDF via pdf2json:', pdfErr)
      }

      if (pdfTexto && pdfTexto.trim().length > 100) {
        // Envia apenas o texto extraído para o Gemini (reduz payload de 5MB para 20KB e tempo de 18s para 1.5s)
        parts = [
          { text: `TEXTO COMPLETO EXTRAÍDO DO PDF DRE:\n\n${pdfTexto.slice(0, 45000)}` },
          { text: promptText }
        ]
      } else {
        const pdfBase64 = buffer.toString('base64')
        parts = [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBase64
            }
          },
          { text: promptText }
        ]
      }
    } else {
      let conteudoTexto = ''
      try {
        const XLSX = (await import('xlsx')).default
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
        
        const planilhas: string[] = []
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
          if (csv.trim().length > 10) {
            // Limpa linhas vazias e vírgulas duplicadas/excessivas para reduzir payload
            const lines = csv.split('\n')
              .map(line => line.split(',').filter(cell => cell.trim().length > 0).join(', '))
              .filter(line => line.trim().length > 2)
            
            if (lines.length > 0) {
              planilhas.push(`=== Planilha: ${sheetName} ===\n${lines.join('\n')}`)
            }
          }
        }
        conteudoTexto = planilhas.join('\n\n')
      } catch (xlsxErr) {
        console.error('Erro ao ler Excel com XLSX:', xlsxErr)
      }

      if (!conteudoTexto || conteudoTexto.trim().length < 20) {
        return NextResponse.json({
          error: 'Não foi possível ler os dados da planilha. Verifique se o arquivo Excel não está corrompido ou protegido por senha.'
        }, { status: 422 })
      }

      parts = [
        { text: `CONTEÚDO DA PLANILHA EXCEL:\n\n${conteudoTexto.slice(0, 45000)}` },
        { text: promptText }
      ]
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    // Schema resiliente e flexível para não falhar o parse
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        empresa: { type: Type.STRING },
        periodo: {
          type: Type.OBJECT,
          properties: {
            inicio: { type: Type.STRING },
            fim: { type: Type.STRING },
            descricao: { type: Type.STRING }
          }
        },
        receitas: {
          type: Type.OBJECT,
          properties: {
            grupos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  codigo: { type: Type.STRING },
                  descricao: { type: Type.STRING },
                  itens: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        codigo: { type: Type.STRING },
                        descricao: { type: Type.STRING },
                        total: { type: Type.NUMBER }
                      }
                    }
                  },
                  total: { type: Type.NUMBER }
                }
              }
            },
            total_geral: { type: Type.NUMBER }
          }
        },
        despesas: {
          type: Type.OBJECT,
          properties: {
            grupos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  codigo: { type: Type.STRING },
                  descricao: { type: Type.STRING },
                  itens: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        codigo: { type: Type.STRING },
                        descricao: { type: Type.STRING },
                        total: { type: Type.NUMBER }
                      }
                    }
                  },
                  total: { type: Type.NUMBER }
                }
              }
            },
            total_geral: { type: Type.NUMBER }
          }
        },
        resultado_operacional: { type: Type.NUMBER },
        evolucao_mensal: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              mes: { type: Type.STRING },
              receita: { type: Type.NUMBER },
              despesa: { type: Type.NUMBER },
              resultado: { type: Type.NUMBER }
            }
          }
        },
        insights: {
          type: Type.OBJECT,
          properties: {
            margem_liquida_pct: { type: Type.NUMBER },
            maior_receita_item: { type: Type.STRING },
            maior_despesa_grupo: { type: Type.STRING },
            alertas: { type: Type.ARRAY, items: { type: Type.STRING } },
            recomendacoes: { type: Type.ARRAY, items: { type: Type.STRING } },
            analise_resumida: { type: Type.STRING }
          }
        }
      },
      required: ['receitas', 'despesas']
    }

    let rawText = ''
    let dadosDRE: any = null

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI_TIMEOUT')), 7500)
      )
      const aiPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema
        }
      })

      const response: any = await Promise.race([aiPromise, timeoutPromise])
      rawText = response.text?.trim() || ''
    } catch (aiErr: any) {
      console.warn('[DRE Upload] Alerta IA (timeout de 7.5s ou erro), usando fallback JS:', aiErr?.message)
    }

    if (rawText) {
      try {
        dadosDRE = JSON.parse(rawText)
      } catch (parseErr1) {
        try {
          const repaired = repairTruncatedJson(rawText)
          dadosDRE = JSON.parse(repaired)
        } catch (parseErr2) {
          console.warn('Erro no parse JSON da IA, usando fallback JS contábil')
        }
      }
    }

    if (!dadosDRE || typeof dadosDRE !== 'object') {
      dadosDRE = {}
    }
    if (!dadosDRE.receitas) {
      dadosDRE.receitas = { grupos: [], total_geral: 0 }
    }
    if (!dadosDRE.despesas) {
      dadosDRE.despesas = { grupos: [], total_geral: 0 }
    }

    const mimeType = isPdf
      ? 'application/pdf'
      : (ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel')
    const base64Data = buffer.toString('base64')
    const fileDataUrl = `data:${mimeType};base64,${base64Data}`

    dadosDRE._arquivo_base64 = fileDataUrl
    dadosDRE._tipo_arquivo_original = ext
    dadosDRE._nome_arquivo_original = nomeArquivo


    // ─── PARSER DETERMINÍSTICO CONTÁBIL EM JS (FALLBACK INFALÍVEL DA DRE) ───
    let pdfTextoCompleto = ''
    if (isPdf) {
      try {
        pdfTextoCompleto = await extractPdfText(buffer)
      } catch (e) {}
    }

    if (pdfTextoCompleto && pdfTextoCompleto.trim().length > 50) {
      const parseBrazilianNumber = (str: string): number => {
        if (!str) return 0
        const cleaned = str.trim().replace(/\./g, '').replace(',', '.')
        const num = parseFloat(cleaned)
        return isNaN(num) ? 0 : num
      }

      const lines = pdfTextoCompleto.split('\n')
      const fallbackRecItems: any[] = []
      const fallbackDespMap = new Map<string, { codigo: string; descricao: string; total: number; itens: any[] }>()

      const getGroupName = (codePrefix: string) => {
        if (codePrefix.startsWith('50')) return { codigo: '50.01', descricao: 'Custos Operacionais e Pessoal' }
        if (codePrefix.startsWith('51')) return { codigo: '51.01', descricao: 'Despesas Extras Curriculares' }
        if (codePrefix.startsWith('52')) return { codigo: '52.01', descricao: 'Despesas Administrativas e Utilidades' }
        if (codePrefix.startsWith('53')) return { codigo: '53.01', descricao: 'Despesas com Eventos' }
        if (codePrefix.startsWith('54')) return { codigo: '54.01', descricao: 'Encargos Sociais, Impostos e Tributos' }
        if (codePrefix.startsWith('55')) return { codigo: '55.01', descricao: 'Despesas Bancárias e Taxas de Cartão' }
        if (codePrefix.startsWith('56')) return { codigo: '56.01', descricao: 'Serviços de Terceiros e Tecnologia' }
        if (codePrefix.startsWith('57')) return { codigo: '57.01', descricao: 'Materiais Educacionais e Didáticos' }
        if (codePrefix.startsWith('58')) return { codigo: '58.01', descricao: 'Reformas e Manutenção de Infraestrutura' }
        if (codePrefix.startsWith('59')) return { codigo: '59.01', descricao: 'Retiradas dos Sócios (Pró-Labore)' }
        return { codigo: '50.99', descricao: 'Outras Despesas Operacionais' }
      }

      for (const line of lines) {
        const trimmed = line.trim()
        const matchRec = trimmed.match(/^(00\.[\d\.]+)\s+([A-Za-zÀ-ÿ\s\(\)\+\-\/\.\&]+)\s+([\d\.\s,]+)$/)
        if (matchRec) {
          const codigo = matchRec[1]
          const descricao = matchRec[2].trim()
          const tokens = matchRec[3].trim().split(/\s+/)
          let itemTotal = tokens.length > 0 ? parseBrazilianNumber(tokens[tokens.length - 1]) : 0
          if (itemTotal === 0 && tokens.length > 1) {
            itemTotal = tokens.reduce((s, t) => s + parseBrazilianNumber(t), 0)
          }
          if (itemTotal > 0) {
            fallbackRecItems.push({ codigo, descricao, total: itemTotal })
          }
        }

        const matchDesp = trimmed.match(/^(5[0-9]\.[\d\.]+)\s+([A-Za-zÀ-ÿ\s\(\)\+\-\/\.\&]+)\s+([\d\.\s,]+)$/)
        if (matchDesp) {
          const codigo = matchDesp[1]
          const descricao = matchDesp[2].trim()
          const tokens = matchDesp[3].trim().split(/\s+/)
          let itemTotal = tokens.length > 0 ? parseBrazilianNumber(tokens[tokens.length - 1]) : 0
          if (itemTotal === 0 && tokens.length > 1) {
            itemTotal = tokens.reduce((s, t) => s + parseBrazilianNumber(t), 0)
          }
          if (itemTotal > 0) {
            const groupInfo = getGroupName(codigo)
            if (!fallbackDespMap.has(groupInfo.codigo)) {
              fallbackDespMap.set(groupInfo.codigo, {
                codigo: groupInfo.codigo,
                descricao: groupInfo.descricao,
                total: 0,
                itens: []
              })
            }
            const g = fallbackDespMap.get(groupInfo.codigo)!
            g.itens.push({ codigo, descricao, total: itemTotal })
            g.total += itemTotal
          }
        }
      }

      // Se despesas.grupos vier vazio da IA, injeta o resultado do parser determinístico em JS
      if (!dadosDRE.despesas?.grupos || dadosDRE.despesas.grupos.length === 0) {
        const fallbackGrupos = Array.from(fallbackDespMap.values())
        if (fallbackGrupos.length > 0) {
          dadosDRE.despesas.grupos = fallbackGrupos
        }
      }

      // Se receitas.grupos estiver sem itens ou zerado, garante a consolidação das receitas extraídas
      if (!dadosDRE.receitas?.grupos || dadosDRE.receitas.grupos.length === 0 || fallbackRecItems.length > (dadosDRE.receitas.grupos[0]?.itens?.length || 0)) {
        if (fallbackRecItems.length > 0) {
          const totalRecFb = fallbackRecItems.reduce((acc, it) => acc + it.total, 0)
          dadosDRE.receitas.grupos = [
            {
              codigo: '00.01',
              descricao: 'Receitas Operacionais e Extras',
              total: totalRecFb,
              itens: fallbackRecItems.sort((a, b) => b.total - a.total)
            }
          ]
        }
      }
    }

    // ─── PÓS-PROCESSAMENTO CONTÁBIL INFALÍVEL EM JS ──────────────────────────
    // Regra: Retirada de Sócios (grupo 59 ou termos como Ivan, Vanderlei, Pró-Labore) 
    // e Reformas/Construção (código 58.01.03 ou Reforma) são EXPURGADAS do OPEX 
    // e alocadas em destinacao_lucro!

    let totalReceitasBrutas = 0
    if (dadosDRE.receitas?.grupos && Array.isArray(dadosDRE.receitas.grupos)) {
      totalReceitasBrutas = dadosDRE.receitas.grupos.reduce((acc: number, g: any) => {
        const sumItens = (g.itens && Array.isArray(g.itens))
          ? g.itens.reduce((s: number, it: any) => s + (Number(it.total) || 0), 0)
          : 0
        const gTotal = (Number(g.total) || 0) > 0 ? Number(g.total) : sumItens
        g.total = gTotal
        return acc + gTotal
      }, 0)
    }

    if (totalReceitasBrutas === 0 && Number(dadosDRE.receitas?.total_geral) > 0) {
      totalReceitasBrutas = Number(dadosDRE.receitas.total_geral)
    }
    dadosDRE.receitas.total_geral = totalReceitasBrutas

    let despesasOpexGrupos: any[] = []
    let retiradasSociosTotal = 0
    let reformaConstrucaoTotal = 0
    let itensDestinacao: any[] = []

    if (dadosDRE.despesas?.grupos && Array.isArray(dadosDRE.despesas.grupos)) {
      for (const grupo of dadosDRE.despesas.grupos) {
        const codigoGrupo = String(grupo.codigo || '').trim()
        const descGrupoUpper = String(grupo.descricao || '').toUpperCase()

        const sumItensGrupo = (grupo.itens && Array.isArray(grupo.itens))
          ? grupo.itens.reduce((s: number, it: any) => s + (Number(it.total) || 0), 0)
          : 0
        const totalGrupoReal = (Number(grupo.total) || 0) > 0 ? Number(grupo.total) : sumItensGrupo
        grupo.total = totalGrupoReal

        // Checa se o grupo inteiro é de Retiradas de Sócios (ex: 59 ou RETIRADAS / SÓCIOS)
        if (codigoGrupo.startsWith('59') || descGrupoUpper.includes('RETIRADAS') || descGrupoUpper.includes('PRO-LABORE') || descGrupoUpper.includes('PRÓ-LABORE') || descGrupoUpper.includes('SÓCIOS') || descGrupoUpper.includes('SOCIOS')) {
          retiradasSociosTotal += totalGrupoReal
          if (grupo.itens && grupo.itens.length > 0) {
            itensDestinacao.push(...grupo.itens)
          } else {
            itensDestinacao.push({ codigo: grupo.codigo, descricao: grupo.descricao, total: totalGrupoReal })
          }
          continue // Exclui do OPEX
        }

        // Filtra os itens internamente para capturar 58.01.03 (Reforma e Construção) ou itens de sócios no meio de outro grupo
        const itensOpex: any[] = []
        let grupoTotalSemLucro = 0

        if (grupo.itens && Array.isArray(grupo.itens) && grupo.itens.length > 0) {
          for (const item of grupo.itens) {
            const itemCod = String(item.codigo || '').trim()
            const itemDescUpper = String(item.descricao || '').toUpperCase()
            const itemVal = Number(item.total) || 0

            const isReforma = itemCod === '58.01.03' || itemDescUpper.includes('REFORMA E CONSTRUÇÃO') || itemDescUpper.includes('REFORMA E CONSTRUCAO') || itemDescUpper.includes('CONSTRUÇÃO E REFORMA')
            const isSocio = itemDescUpper.includes('IVAN ROSSI') || itemDescUpper.includes('VANDERLEI') || itemDescUpper.includes('RETIRADA SOCIO') || itemDescUpper.includes('RETIRADA SÓCIO')

            if (isReforma) {
              reformaConstrucaoTotal += itemVal
              itensDestinacao.push(item)
            } else if (isSocio) {
              retiradasSociosTotal += itemVal
              itensDestinacao.push(item)
            } else {
              itensOpex.push(item)
              grupoTotalSemLucro += itemVal
            }
          }
        } else {
          grupoTotalSemLucro = totalGrupoReal
        }

        if (itensOpex.length > 0 || grupoTotalSemLucro > 0) {
          despesasOpexGrupos.push({
            ...grupo,
            itens: itensOpex.length > 0 ? itensOpex : grupo.itens,
            total: grupoTotalSemLucro
          })
        }
      }
    }

    let totalDespesasOpex = despesasOpexGrupos.reduce((acc: number, g: any) => acc + (Number(g.total) || 0), 0)

    if (totalDespesasOpex === 0 && Number(dadosDRE.despesas?.total_geral) > 0) {
      totalDespesasOpex = Number(dadosDRE.despesas.total_geral)
    }

    if (despesasOpexGrupos.length === 0 && totalDespesasOpex > 0) {
      despesasOpexGrupos.push({
        codigo: '50.01',
        descricao: 'Custos e Despesas Operacionais',
        total: totalDespesasOpex,
        itens: [
          { codigo: '50.01.01', descricao: 'Custos Operacionais Globais', total: totalDespesasOpex }
        ]
      })
    }

    dadosDRE.despesas = {
      grupos: despesasOpexGrupos,
      total_geral: totalDespesasOpex
    }

    // Lucro Operacional Real = Receitas Brutas - OPEX
    const resultadoOperacionalReal = totalReceitasBrutas - totalDespesasOpex
    dadosDRE.resultado_operacional = resultadoOperacionalReal

    // Destinação do Lucro & Reinvestimento CapEx
    const totalDestinado = retiradasSociosTotal + reformaConstrucaoTotal
    const sobraLiquidaCaixa = resultadoOperacionalReal - totalDestinado

    dadosDRE.destinacao_lucro = {
      retiradas_socios: retiradasSociosTotal,
      reforma_construcao: reformaConstrucaoTotal,
      total_destinado: totalDestinado,
      sobra_liquida_caixa: sobraLiquidaCaixa,
      itens: itensDestinacao
    }

    // ─── CLASSIFICAÇÃO CONTÁBIL GERENCIAL: CUSTOS FIXOS VS VARIÁVEIS VS FOLHA ─
    let totalFolhaPagamento = 0
    let totalCustosVariaveis = 0

    despesasOpexGrupos.forEach(g => {
      const descGrupoUpper = String(g.descricao || '').toUpperCase()
      const codGrupo = String(g.codigo || '')

      const isGrupoFolha = codGrupo.startsWith('50') || descGrupoUpper.includes('FOLHA') || descGrupoUpper.includes('PESSOAL') || descGrupoUpper.includes('SALÁRIO') || descGrupoUpper.includes('SALARIO') || descGrupoUpper.includes('ENCARGO') || descGrupoUpper.includes('OPERACIONAI')

      if (g.itens && Array.isArray(g.itens)) {
        g.itens.forEach((item: any) => {
          const itemDescUpper = String(item.descricao || '').toUpperCase()
          const itemCod = String(item.codigo || '')
          const itemValor = Number(item.total) || 0

          // Identifica Folha de Pagamento
          if (isGrupoFolha || itemCod.startsWith('50') || itemDescUpper.includes('SALÁRIO') || itemDescUpper.includes('SALARIO') || itemDescUpper.includes('FOLHA') || itemDescUpper.includes('PROFESSOR') || itemDescUpper.includes('ENCARGO') || itemDescUpper.includes('INSS') || itemDescUpper.includes('FGTS') || itemDescUpper.includes('BENEFÍCIO') || itemDescUpper.includes('BENEFICIO') || itemDescUpper.includes('THIRTEENTH') || itemDescUpper.includes('DECIMO') || itemDescUpper.includes('13º') || itemDescUpper.includes('FÉRIAS') || itemDescUpper.includes('FERIAS') || itemDescUpper.includes('ORDENADO')) {
            totalFolhaPagamento += itemValor
          }

          // Identifica Custos/Despesas Variáveis (impostos, taxas operadoras/banco, comissões, alimentação por aluno, material)
          if (itemDescUpper.includes('IMPOSTO') || itemDescUpper.includes('TRIBUTO') || itemDescUpper.includes('SIMPLES') || itemDescUpper.includes('ISS') || itemDescUpper.includes('TAXA') || itemDescUpper.includes('CARTÃO') || itemDescUpper.includes('CARTAO') || itemDescUpper.includes('BOLETO') || itemDescUpper.includes('COMISSÃO') || itemDescUpper.includes('COMISSAO') || itemDescUpper.includes('ALIMENTAÇÃO') || itemDescUpper.includes('ALIMENTACAO') || itemDescUpper.includes('REFEIÇÃO') || itemDescUpper.includes('REFEICAO') || itemDescUpper.includes('MATERIAL DIDÁTICO') || itemDescUpper.includes('MATERIAL DIDATICO') || itemDescUpper.includes('INADIMPLÊNCIA')) {
            totalCustosVariaveis += itemValor
          }
        })
      } else {
        const valorGrupo = Number(g.total) || 0
        if (isGrupoFolha) totalFolhaPagamento += valorGrupo
        if (descGrupoUpper.includes('IMPOSTO') || descGrupoUpper.includes('TAXA') || descGrupoUpper.includes('TRIBUTO')) {
          totalCustosVariaveis += valorGrupo
        }
      }
    })

    // Fallback contábil gerencial padrão para escolas se a discriminação explícita de folha não ocorrer
    if (totalFolhaPagamento === 0 && totalDespesasOpex > 0) {
      totalFolhaPagamento = Math.round(totalDespesasOpex * 0.65)
    }

    if (totalCustosVariaveis === 0 && totalReceitasBrutas > 0) {
      totalCustosVariaveis = Math.round(totalReceitasBrutas * 0.08)
    }

    // ─── DETECÇÃO INTELIGENTE DE MESES EFETIVAMENTE ATIVOS (COM MOVIMENTAÇÃO) ──
    let numMeses = 12

    if (dadosDRE.evolucao_mensal && Array.isArray(dadosDRE.evolucao_mensal) && dadosDRE.evolucao_mensal.length > 0) {
      // Filtra apenas os meses que possuem receita > 0 ou despesa > 0 (desconsiderando meses futuros zerados)
      const mesesComAtividade = dadosDRE.evolucao_mensal.filter((m: any) => (Number(m.receita) > 0 || Number(m.despesa) > 0))
      if (mesesComAtividade.length > 0) {
        numMeses = mesesComAtividade.length
      } else {
        numMeses = dadosDRE.evolucao_mensal.length
      }
    } else if (dadosDRE.periodo?.inicio && dadosDRE.periodo?.fim) {
      try {
        const pIni = String(dadosDRE.periodo.inicio).split('/')
        const pFim = String(dadosDRE.periodo.fim).split('/')
        if (pIni.length === 3 && pFim.length === 3) {
          const m1 = parseInt(pIni[1])
          const m2 = parseInt(pFim[1])
          const a1 = parseInt(pIni[2])
          const a2 = parseInt(pFim[2])
          const diff = (a2 - a1) * 12 + (m2 - m1) + 1
          if (diff > 0 && diff <= 12) numMeses = diff
        }
      } catch (e) {}
    }

    if (!dadosDRE.periodo) dadosDRE.periodo = {}
    dadosDRE.periodo.numero_meses = numMeses

    // Custos Fixos Totais (OPEX acumulado do período sem despesas variáveis)
    const totalCustosFixos = Math.max(0, totalDespesasOpex - totalCustosVariaveis)
    const custosFixosMensais = totalCustosFixos / numMeses

    // ─── MARGEM DE CONTRIBUIÇÃO E PONTO DE EQUILÍBRIO GERENCIAL REAL (DIVIDIDO POR N MESES) ─
    // Margem de Contribuição ($) = Receita Bruta - Custos Variáveis
    const margemContribuiçãoValor = totalReceitasBrutas - totalCustosVariaveis
    const margemContribuiçãoPct = totalReceitasBrutas > 0 ? (margemContribuiçãoValor / totalReceitasBrutas) * 100 : 85

    // Break-Even Mensal Real = Custo Fixo Mensal / (Margem de Contribuição %)
    const breakEvenMensalReal = (margemContribuiçãoPct > 0) ? (custosFixosMensais / (margemContribuiçãoPct / 100)) : (totalDespesasOpex / numMeses)
    const breakEvenAnualProjetado = breakEvenMensalReal * 12

    const mediaFaturamentoMensal = totalReceitasBrutas / numMeses
    const mediaOpexMensal = totalDespesasOpex / numMeses

    const margemSegurancaPct = breakEvenMensalReal > 0
      ? Math.round(((mediaFaturamentoMensal - breakEvenMensalReal) / mediaFaturamentoMensal) * 1000) / 10
      : 0

    const pctFolhaSobreReceita = totalReceitasBrutas > 0 ? Math.round((totalFolhaPagamento / totalReceitasBrutas) * 1000) / 10 : 0
    const pctOpexSobreReceita = totalReceitasBrutas > 0 ? Math.round((totalDespesasOpex / totalReceitasBrutas) * 1000) / 10 : 0
    const margemOperacionalReal = totalReceitasBrutas > 0 ? (resultadoOperacionalReal / totalReceitasBrutas) * 100 : 0
    const margemLiquidaSobra = totalReceitasBrutas > 0 ? (sobraLiquidaCaixa / totalReceitasBrutas) * 100 : 0
    const capacidadeRetiradaMensal = (resultadoOperacionalReal * 0.7) / numMeses

    dadosDRE.custos_gerenciais = {
      numero_meses: numMeses,
      custos_fixos: totalCustosFixos,
      custos_fixos_mensais: custosFixosMensais,
      custos_variaveis: totalCustosVariaveis,
      folha_pagamento: totalFolhaPagamento,
      custo_operacao: totalDespesasOpex,
      custo_operacao_mensal: mediaOpexMensal,
      margem_contribuição_valor: margemContribuiçãoValor,
      margem_contribuição_pct: Math.round(margemContribuiçãoPct * 10) / 10,
      pct_folha_sobre_receita: pctFolhaSobreReceita,
      pct_opex_sobre_receita: pctOpexSobreReceita
    }

    dadosDRE.metricas_chave = {
      ebitda: resultadoOperacionalReal,
      margem_ebitda_pct: Math.round(margemOperacionalReal * 10) / 10,
      comprometimento_folha_pct: Math.round(pctFolhaSobreReceita),
      custo_infraestrutura_pct: Math.round(pctOpexSobreReceita),
      ponto_equilibrio_estimado: Math.round(breakEvenAnualProjetado),
      ponto_equilibrio_anual: Math.round(breakEvenAnualProjetado),
      ponto_equilibrio_mensal: Math.round(breakEvenMensalReal),
      media_faturamento_mensal: mediaFaturamentoMensal,
      margem_seguranca_pct: margemSegurancaPct,
      capacidade_retirada_mensal: capacidadeRetiradaMensal,
      score_saude_financeira: resultadoOperacionalReal > 0 ? 95 : 45,
      diagnostico_saude: resultadoOperacionalReal > 0 ? 'Excelente Geração de Caixa' : 'Atenção ao Fluxo'
    }

    // Garantia de Insights
    if (!dadosDRE.insights) {
      dadosDRE.insights = {
        margem_liquida_pct: Math.round(margemLiquidaSobra * 10) / 10,
        alertas: ['Acompanhar a proporção de retiradas em relação à geração de caixa.'],
        recomendacoes: ['Manter reserva de contingência para períodos de rematrícula.'],
        analise_resumida: `A instituição gerou R$ ${resultadoOperacionalReal.toLocaleString('pt-BR')} em Lucro Operacional Real. Desse montante, R$ ${totalDestinado.toLocaleString('pt-BR')} foram destinados a retiradas de sócios e reinvestimentos patrimoniais, resultando em sobra líquida retida em caixa de R$ ${sobraLiquidaCaixa.toLocaleString('pt-BR')}.`
      }
    } else {
      dadosDRE.insights.margem_liquida_pct = Math.round(margemLiquidaSobra * 10) / 10
      if (!dadosDRE.insights.analise_resumida) {
        dadosDRE.insights.analise_resumida = `A instituição gerou R$ ${resultadoOperacionalReal.toLocaleString('pt-BR')} em Lucro Operacional Real (Margem Operacional de ${margemOperacionalReal.toFixed(1)}%). Foram destinados R$ ${retiradasSociosTotal.toLocaleString('pt-BR')} em retiradas de sócios e R$ ${reformaConstrucaoTotal.toLocaleString('pt-BR')} em reformas.`
      }
    }

    // ─── Salvar no Histórico (Supabase + Backup em Arquivo Local) ───────────
    let savedDREId: string = crypto.randomUUID()
    let savedInDb = false

    const itemHistorico = {
      id: savedDREId,
      nome_arquivo: nomeArquivo || 'DRE - Relatório Analítico',
      tipo_arquivo: ext,
      dados_dre: dadosDRE,
      arquivo_base64: fileDataUrl,
      periodo_descricao: dadosDRE.periodo?.descricao || 'Análise Anual',
      empresa: dadosDRE.empresa || 'Colégio Impacto',
      total_receitas: totalReceitasBrutas,
      total_despesas: totalDespesasOpex,
      resultado_liquido: resultadoOperacionalReal,
      criado_em: new Date().toISOString()
    }

    try {
      const supabase = await createClient()
      const { data: userData } = await supabase.auth.getUser()

      const payloadToSave: any = {
        id: savedDREId,
        nome_arquivo: itemHistorico.nome_arquivo,
        tipo_arquivo: itemHistorico.tipo_arquivo,
        dados_dre: itemHistorico.dados_dre,
        periodo_descricao: itemHistorico.periodo_descricao,
        empresa: itemHistorico.empresa,
        total_receitas: itemHistorico.total_receitas,
        total_despesas: itemHistorico.total_despesas,
        resultado_liquido: itemHistorico.resultado_liquido,
        criado_em: itemHistorico.criado_em
      }

      if (userData?.user?.id) {
        payloadToSave.usuario_id = userData.user.id
      }

      const { data: inserted, error: dbError } = await supabase
        .from('dre_uploads')
        .insert(payloadToSave)
        .select('id')
        .single()

      if (!dbError && inserted) {
        savedDREId = inserted.id
        savedInDb = true
      } else {
        console.warn('Banco Supabase aviso ao inserir DRE:', dbError?.message || dbError)
      }
    } catch (dbErr) {
      console.warn('Persistência Supabase opcional:', dbErr)
    }

    // Backup em Arquivo JSON Local do Servidor
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const filePath = path.join(process.cwd(), '.dre_historico_store.json')
      
      let items: any[] = []
      try {
        const existing = await fs.readFile(filePath, 'utf-8')
        items = JSON.parse(existing)
      } catch (e) {
        items = []
      }

      // Adiciona o novo DRE mantendo no máximo 100 itens
      items = [itemHistorico, ...items.filter(i => i.id !== itemHistorico.id)].slice(0, 100)
      await fs.writeFile(filePath, JSON.stringify(items, null, 2), 'utf-8')
    } catch (fileErr) {
      console.warn('Não foi possível gravar backup em arquivo local:', fileErr)
    }

    return NextResponse.json({
      success: true,
      data: dadosDRE,
      savedDREId,
      savedInDb
    })

  } catch (error: any) {
    console.error('Erro fatal no upload DRE:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno ao processar a DRE.'
    }, { status: 500 })
  }
}
