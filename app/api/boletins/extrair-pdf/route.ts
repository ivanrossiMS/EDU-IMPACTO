import { NextResponse } from 'next/server'
import { GoogleGenAI, Type, Schema } from '@google/genai'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Data = buffer.toString('base64')

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey })

    const prompt = `Você é um assistente especializado em extração de dados de Boletins Escolares.
Vou te enviar um arquivo PDF que contém os boletins de uma turma com VÁRIOS ALUNOS.
Analise a estrutura do PDF, leia as tabelas de notas e extraia TODOS os alunos encontrados com TODAS as colunas de notas.
Você DEVE agrupar todos os alunos em um único array JSON.

Retorne EXATAMENTE este formato JSON (um único objeto com a propriedade "alunos"):
{
  "alunos": [
    {
      "codigo": "3882", 
      "nomeArquivo": "Alana Reche Leviski",
      "bimestre": "2º Bimestre",
      "ano": 2026,
      "disciplinas": [
        {
          "nome": "MATEMÁTICA",
          "avm": "9,50",
          "avb": "8,75",
          "simulado": "7,50",
          "pntBonu": "1,50",
          "mediaF": "Dez",
          "rec": "---",
          "mediaG": "Dez"
        }
      ]
    }
  ]
}

Regras de Extração:
1. "codigo": Extraia o Código ou Matrícula do aluno. (Ex: se no cabeçalho estiver "Código: 3882", extraia "3882").
2. "nomeArquivo": Extraia o nome completo do aluno exatamente como está no cabeçalho do aluno (Ex: "Aluno: Alana Reche Leviski" -> "Alana Reche Leviski").
3. "bimestre": Extraia o Bimestre indicado no cabeçalho (Ex: se estiver "Bimestre: 2", formate como "2º Bimestre"; se estiver "Bimestre: 1", formate como "1º Bimestre", etc).
4. "ano": Extraia o ano letivo do cabeçalho como número (Ex: "Ano: 2026" -> 2026).
5. "disciplinas": Para cada matéria/componente curricular da tabela de notas do aluno, extraia TODAS as 7 colunas de notas correspondentes:
   - "nome": Nome do Componente Curricular (Ex: "MATEMÁTICA", "LÍNGUA PORTUGUESA", "UNIDADE CURRICULAR MATEMÁTICA", etc.)
   - "avm": Avaliação Mensal (coluna "Av.Mens"). Ex: "9,50", "Dez", "---".
   - "avb": Avaliação Bimestral (coluna "Av.Bim"). Ex: "8,75", "Dez", "---".
   - "simulado": Nota do Simulado (coluna "Simulado"). Ex: "7,50", "9,00", "Dez", "---".
   - "pntBonu": Ponto Bônus (coluna "Pnt.Bônu"). Ex: "1,50", "Hum", "Dez", "---".
   - "mediaF": Média Final (coluna "MedFinal"). Ex: "Dez", "9,00", "9,50", "---".
   - "rec": Recuperação (coluna "Rec"). Ex: "---", ou a nota se houver.
   - "mediaG": Média Geral (coluna "MédGeral"). Ex: "Dez", "9,00", "9,50", "---".
Mantenha o formato original exatamente como impresso no PDF (números como "9,50", palavras como "Dez", "Hum", "Falta", e traços "---"). Se uma coluna estiver em branco ou não existir, preencha com "---".
6. CRÍTICO: Não crie múltiplos objetos! Coloque TODOS os alunos dentro do ÚNICO array "alunos".
7. REGRA DE OURO INQUEBRÁVEL: Você está extraindo dados para um banco de dados oficial escolar. É ESTRITAMENTE PROIBIDO pular qualquer aluno e qualquer matéria. Você DEVE processar 100% do PDF, ler TODAS as páginas e extrair TODOS os alunos. NÃO PARE A EXTRAÇÃO ANTES DE CHEGAR AO FIM DO PDF.
8. CRÍTICO PARA PDFs GRANDES: Retorne o JSON minificado, sem espaços em branco ou quebras de linha desnecessárias, para economizar tokens!
9. CRÍTICO: Copie o "codigo" e o "nomeArquivo" EXATAMENTE como estão escritos na página, letra por letra. É estritamente proibido auto-corrigir erros ortográficos ou tentar adivinhar o nome correto.
10. Retorne apenas o JSON. Sem formatação markdown, sem texto antes ou depois.`

    const responseSchema: Schema = {
      type: Type.OBJECT,
      description: 'Objeto contendo a lista de alunos extraídos',
      properties: {
        alunos: {
          type: Type.ARRAY,
          description: 'Array contendo os dados dos alunos extraídos do boletim',
          items: {
            type: Type.OBJECT,
            properties: {
              codigo: { type: Type.STRING, description: 'Código ou Matrícula do aluno' },
              nomeArquivo: { type: Type.STRING, description: 'Nome completo do aluno' },
              bimestre: { type: Type.STRING, description: 'Ex: 1º Bimestre ou 2º Bimestre' },
              ano: { type: Type.NUMBER, description: 'Ex: 2026' },
              disciplinas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nome: { type: Type.STRING, description: 'Nome da disciplina / Componente Curricular' },
                    avm: { type: Type.STRING, description: 'Nota Av.Mens (Avaliação Mensal)' },
                    avb: { type: Type.STRING, description: 'Nota Av.Bim (Avaliação Bimestral)' },
                    simulado: { type: Type.STRING, description: 'Nota do Simulado' },
                    pntBonu: { type: Type.STRING, description: 'Ponto Bônus (Pnt.Bônu)' },
                    mediaF: { type: Type.STRING, description: 'Média Final (MedFinal)' },
                    rec: { type: Type.STRING, description: 'Nota de Recuperação (Rec)' },
                    mediaG: { type: Type.STRING, description: 'Média Geral (MédGeral)' }
                  },
                  required: ['nome', 'avm', 'avb', 'simulado', 'pntBonu', 'mediaF', 'rec', 'mediaG']
                }
              }
            },
            required: ['codigo', 'nomeArquivo', 'bimestre', 'ano', 'disciplinas']
          }
        }
      },
      required: ['alunos']
    }

    // Modelos em ordem de preferência (com timeout de segurança por tentativa)
    const modelsToTry = ['gemini-2.5-flash', 'gemini-3.5-flash']
    let text = ''
    let lastError: any = null

    for (const model of modelsToTry) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout na chamada do modelo ${model}`)), 24000)
        )

        const generatePromise = ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data
                  }
                }
              ]
            }
          ],
          config: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })

        const response: any = await Promise.race([generatePromise, timeoutPromise])
        text = response.text || ''
        if (text) {
          break
        }
      } catch (err: any) {
        console.warn(`[extrair-pdf] Falha no modelo ${model}:`, err?.message || err)
        lastError = err
      }
    }

    if (!text) {
      console.error("[extrair-pdf] Todos os modelos falharam ou retornaram texto vazio:", lastError)
      return NextResponse.json({ 
        error: 'A Inteligência Artificial não conseguiu ler esta página a tempo. Tente novamente em instantes.' 
      }, { status: 504 })
    }

    // Extração robusta do JSON ignorando blocos markdown ou texto acidental
    let cleanJson = text.trim()
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7)
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3)
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3)
    }
    cleanJson = cleanJson.trim()

    const firstBracket = cleanJson.indexOf('[')
    const firstBrace = cleanJson.indexOf('{')
    let startIndex = -1

    if (firstBracket !== -1 && firstBrace !== -1) {
      startIndex = Math.min(firstBracket, firstBrace)
    } else if (firstBracket !== -1) {
      startIndex = firstBracket
    } else if (firstBrace !== -1) {
      startIndex = firstBrace
    }

    if (startIndex !== -1) {
      const isArray = cleanJson[startIndex] === '['
      const lastIndex = cleanJson.lastIndexOf(isArray ? ']' : '}')
      if (lastIndex !== -1) {
        cleanJson = cleanJson.substring(startIndex, lastIndex + 1)
      }
    }

    try {
      const parsedData = JSON.parse(cleanJson)
      const alunosArray = parsedData.alunos || (Array.isArray(parsedData) ? parsedData : [])
      return NextResponse.json({ success: true, data: alunosArray })
    } catch (parseError: any) {
      console.warn("Erro no parse inicial, tentando recuperação bruta devido a possível corte por limite de tokens...");

      // Tentativa de recuperação de JSON cortado pela metade
      const suffixes = ['', '}', ']}', ']}]}', '}]}', '"]}', '"]}]}', '""}]}', '""}]}']

      for (let i = cleanJson.length; i > Math.max(0, cleanJson.length - 3000); i--) {
        const sub = cleanJson.substring(0, i)
        if (sub.length < 10) break

        for (const suffix of suffixes) {
          try {
            const parsed = JSON.parse(sub + suffix)
            const alunosArray = parsed.alunos
            if (Array.isArray(alunosArray)) {
              console.log("JSON recuperado com sucesso com", alunosArray.length, "alunos.")
              return NextResponse.json({ 
                success: true, 
                data: alunosArray,
                warning: 'Alguns dados podem ter sido truncados devido ao tamanho da página.'
              })
            }
          } catch (e) {
            // Continua tentando
          }
        }
      }

      console.error("Falha total na recuperação do JSON.")
      const errMessage = parseError.message || "Erro desconhecido"
      const endSnippet = cleanJson.length > 50 ? cleanJson.substring(cleanJson.length - 50) : cleanJson
      return NextResponse.json({ error: `Erro no formato de resposta da IA (${errMessage}). Final do texto: ...${endSnippet}` }, { status: 500 })
    }

  } catch (error: any) {
    console.error("Erro na extração PDF:", error)
    const errorMsg = error.message || ''

    if (errorMsg.includes('timed out') || errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE')) {
      return NextResponse.json({ 
        error: 'O servidor de IA demorou para responder. O lote será reprocessado automaticamente.' 
      }, { status: 504 })
    }

    return NextResponse.json({ error: 'Erro ao processar PDF: ' + errorMsg }, { status: 500 })
  }
}
