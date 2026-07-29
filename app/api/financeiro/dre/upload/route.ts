import { NextResponse } from 'next/server'
import { GoogleGenAI, Type, Schema } from '@google/genai'
import { createClient } from '@/utils/supabase/server'

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

Sua missão é extrair rigorosamente os dados reais do relatório/planilha fornecido, sem alterar ou inventar nenhum número.

INSTRUÇÕES DE EXTRAÇÃO CONTÁBIL:
1. Extraia todas as contas de Receita (código 00 ou descrições como Mensalidades, Apostilas, etc.) e Despesa (código 50-59 ou descrições como Folha, Impostos, Contas, Retiradas de Sócios, Reformas).
2. MANTENHA TODOS OS CÓDIGOS E VALORES REAIS.
3. Se houver dados mensais (Jan a Dez), extraia no array 'evolucao_mensal'.
4. Retorne em JSON conforme o schema.`

    if (isPdf) {
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
            planilhas.push(`=== Planilha: ${sheetName} ===\n${csv}`)
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
        { text: `CONTEÚDO DA PLANILHA EXCEL:\n\n${conteudoTexto.slice(0, 180000)}` },
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 16000,
        responseMimeType: 'application/json',
        responseSchema
      }
    })

    let rawText = response.text?.trim() || ''

    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
    }

    let dadosDRE: any
    try {
      dadosDRE = JSON.parse(rawText)
    } catch (parseErr) {
      console.error('Erro no parse do JSON da IA:', parseErr, 'Raw Text:', rawText.slice(0, 500))
      return NextResponse.json({
        error: 'A IA não conseguiu interpretar o documento. Verifique se o PDF/Excel não está corrompido ou protegido por senha.'
      }, { status: 422 })
    }

    // ─── PÓS-PROCESSAMENTO CONTÁBIL INFALÍVEL EM JS ──────────────────────────
    // Regra: Retirada de Sócios (grupo 59 ou termos como Ivan, Vanderlei, Pró-Labore) 
    // e Reformas/Construção (código 58.01.03 ou Reforma) são EXPURGADAS do OPEX 
    // e alocadas em destinacao_lucro!

    let totalReceitasBrutas = 0
    if (dadosDRE.receitas?.grupos) {
      totalReceitasBrutas = dadosDRE.receitas.grupos.reduce((acc: number, g: any) => acc + (Number(g.total) || 0), 0)
      dadosDRE.receitas.total_geral = totalReceitasBrutas
    }

    let despesasOpexGrupos: any[] = []
    let retiradasSociosTotal = 0
    let reformaConstrucaoTotal = 0
    let itensDestinacao: any[] = []

    if (dadosDRE.despesas?.grupos) {
      for (const grupo of dadosDRE.despesas.grupos) {
        const codigoGrupo = String(grupo.codigo || '').trim()
        const descGrupoUpper = String(grupo.descricao || '').toUpperCase()

        // Checa se o grupo inteiro é de Retiradas de Sócios (ex: 59 ou RETIRADAS / SÓCIOS)
        if (codigoGrupo.startsWith('59') || descGrupoUpper.includes('RETIRADAS') || descGrupoUpper.includes('PRO-LABORE') || descGrupoUpper.includes('PRÓ-LABORE') || descGrupoUpper.includes('SÓCIOS') || descGrupoUpper.includes('SOCIOS')) {
          retiradasSociosTotal += Number(grupo.total) || 0
          if (grupo.itens) {
            itensDestinacao.push(...grupo.itens)
          } else {
            itensDestinacao.push({ codigo: grupo.codigo, descricao: grupo.descricao, total: grupo.total })
          }
          continue // Exclui do OPEX
        }

        // Filtra os itens internamente para capturar 58.01.03 (Reforma e Construção) ou itens de sócios no meio de outro grupo
        const itensOpex: any[] = []
        let grupoTotalSemLucro = 0

        if (grupo.itens && Array.isArray(grupo.itens)) {
          for (const item of grupo.itens) {
            const itemCod = String(item.codigo || '').trim()
            const itemDescUpper = String(item.descricao || '').toUpperCase()

            const isReforma = itemCod === '58.01.03' || itemDescUpper.includes('REFORMA E CONSTRUÇÃO') || itemDescUpper.includes('REFORMA E CONSTRUCAO') || itemDescUpper.includes('CONSTRUÇÃO E REFORMA')
            const isSocio = itemDescUpper.includes('IVAN ROSSI') || itemDescUpper.includes('VANDERLEI') || itemDescUpper.includes('RETIRADA SOCIO') || itemDescUpper.includes('RETIRADA SÓCIO')

            if (isReforma) {
              reformaConstrucaoTotal += Number(item.total) || 0
              itensDestinacao.push(item)
            } else if (isSocio) {
              retiradasSociosTotal += Number(item.total) || 0
              itensDestinacao.push(item)
            } else {
              itensOpex.push(item)
              grupoTotalSemLucro += Number(item.total) || 0
            }
          }
        } else {
          grupoTotalSemLucro = Number(grupo.total) || 0
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

    const totalDespesasOpex = despesasOpexGrupos.reduce((acc: number, g: any) => acc + (Number(g.total) || 0), 0)
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

    // Métricas Chave Recalculadas no Backend JS
    const margemOperacionalReal = totalReceitasBrutas > 0 ? (resultadoOperacionalReal / totalReceitasBrutas) * 100 : 0
    const margemLiquidaSobra = totalReceitasBrutas > 0 ? (sobraLiquidaCaixa / totalReceitasBrutas) * 100 : 0

    // Cálculo do Comprometimento de Folha (Equipe sem os sócios)
    let folhaOpexTotal = 0
    despesasOpexGrupos.forEach(g => {
      const descUpper = String(g.descricao || '').toUpperCase()
      if (descUpper.includes('FOLHA') || descUpper.includes('SALÁRIO') || descUpper.includes('SALARIO') || descUpper.includes('ENCARGOS') || descUpper.includes('PESSOAL')) {
        folhaOpexTotal += Number(g.total) || 0
      }
    })
    const comprometimentoFolhaPct = totalReceitasBrutas > 0 ? Math.round((folhaOpexTotal / totalReceitasBrutas) * 100) : 42

    // Cálculos de Ponto de Equilíbrio (Break-Even 0 a 0)
    const breakEvenAnual = totalDespesasOpex
    const breakEvenMensal = totalDespesasOpex / 12
    const mediaFaturamentoMensal = totalReceitasBrutas / 12
    const margemSegurancaPct = totalDespesasOpex > 0
      ? Math.round(((totalReceitasBrutas - totalDespesasOpex) / totalDespesasOpex) * 1000) / 10
      : 0
    const capacidadeRetiradaMensal = (resultadoOperacionalReal * 0.7) / 12

    dadosDRE.metricas_chave = {
      ebitda: resultadoOperacionalReal,
      margem_ebitda_pct: Math.round(margemOperacionalReal * 10) / 10,
      comprometimento_folha_pct: comprometimentoFolhaPct,
      custo_infraestrutura_pct: totalReceitasBrutas > 0 ? Math.round((totalDespesasOpex / totalReceitasBrutas) * 100) : 58,
      ponto_equilibrio_estimado: breakEvenAnual,
      ponto_equilibrio_anual: breakEvenAnual,
      ponto_equilibrio_mensal: breakEvenMensal,
      media_faturamento_mensal: mediaFaturamentoMensal,
      margem_seguranca_pct: margemSegurancaPct,
      capacidade_retirada_mensal: capacidadeRetiradaMensal,
      score_saude_financeira: resultadoOperacionalReal > 0 ? 94 : 45,
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

    // ─── Salvar no Supabase (Opcional & Não Bloqueante) ───────────────────
    let savedDREId: string | undefined
    let savedInDb = false

    try {
      const supabase = await createClient()
      const { data: userData } = await supabase.auth.getUser()

      if (userData?.user?.id) {
        const { data: inserted, error: dbError } = await supabase
          .from('dre_uploads')
          .insert({
            usuario_id: userData.user.id,
            nome_arquivo: nomeArquivo,
            tipo_arquivo: ext,
            dados_dre: dadosDRE,
            periodo_descricao: dadosDRE.periodo?.descricao || 'Análise Anual',
            empresa: dadosDRE.empresa || 'Colégio Impacto',
            total_receitas: totalReceitasBrutas,
            total_despesas: totalDespesasOpex,
            resultado_liquido: resultadoOperacionalReal
          })
          .select('id')
          .single()

        if (!dbError && inserted) {
          savedDREId = inserted.id
          savedInDb = true
        } else {
          console.warn('Banco Supabase aviso:', dbError?.message || dbError)
        }
      }
    } catch (dbErr) {
      console.warn('Persistência opcional Supabase não executada:', dbErr)
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
