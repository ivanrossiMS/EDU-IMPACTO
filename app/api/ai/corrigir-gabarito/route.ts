import { NextResponse } from 'next/server'
import { GoogleGenAI, Type, Schema } from '@google/genai'

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, gabaritoOficial } = await request.json()

    if (!imageBase64 || !gabaritoOficial) {
      return NextResponse.json({ error: 'Imagem e gabarito oficial são obrigatórios.' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave da API do Gemini não configurada.' }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const totalQuestoes = gabaritoOficial.length
    const questionList = gabaritoOficial.map((q: any) => `Questão ${q.numero}`).join(', ')

    const prompt = `Você é um sistema de Leitura Óptica de Caracteres e Gabaritos (OMR - Optical Mark Recognition) de altíssima precisão.

Sua missão é ler com 100% de exatidão as respostas assinaladas pelo aluno na folha de respostas anexada.

ESTRUTURA DO GABARITO:
- À esquerda de cada linha há o NÚMERO impresso da questão (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15...).
- Na mesma linha horizontal do número da questão estão as alternativas em círculos: (A) (B) (C) (D) (E).
- O exame a ser corrigido possui EXATAMENTE ${totalQuestoes} questões (${questionList}).
- NOTA: Pode haver mais linhas impressas na folha (ex: questões 16 a 22 ou mais), mas você deve avaliar estritamente as questões de 1 a ${totalQuestoes}.

METODOLOGIA OBRIGATÓRIA DE LEITURA LINHA POR LINHA:
1. Para CADA questão de 1 a ${totalQuestoes}:
   a. Localize visualmente o NÚMERO da questão na coluna esquerda (ex: número "1", número "2", número "3", ..., número "${totalQuestoes}").
   b. Siga rigorosamente a LINHA HORIZONTAL exata desse número da esquerda para a direita.
   c. CUIDADO COM DESLOCAMENTO: Não confunda a linha atual com a linha superior ou inferior. Cada número corresponde unicamente à sua própria linha horizontal de bolhas.
   d. Avalie cada bolha (A, B, C, D, E):
      - BOLHA PREENCHIDA: Círculo escurecido, pintado à caneta ou lápis (notoriamente preto/cinza escuro, preenchendo o interior da bolha).
      - BOLHA VAZIA: Círculo em branco com a letra visível no centro e fundo branco.
2. CRITÉRIOS DE DECISÃO:
   - Uma única bolha preenchida com clareza: Retorne a letra dessa bolha ("A", "B", "C", "D" ou "E").
   - Nenhuma bolha preenchida na linha: Retorne null.
   - Duas ou mais bolhas preenchidas na mesma linha: Retorne "ANULADA".
   - Rasura com tentativa clara de anulação (ex: riscada com X e outra preenchida): considere a opção que o aluno marcou definitivamente como preenchida.

Retorne um JSON com o array de respostas para exatamente as ${totalQuestoes} questões.`

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        respostas: {
          type: Type.ARRAY,
          description: `Lista de respostas para as ${totalQuestoes} questões`,
          items: {
            type: Type.OBJECT,
            properties: {
              numero: { type: Type.NUMBER, description: 'Número da questão (1 a ' + totalQuestoes + ')' },
              resposta: { type: Type.STRING, nullable: true, description: 'Letra marcada (A, B, C, D, E), ANULADA ou null se em branco' },
              detalhe: { type: Type.STRING, description: 'Breve confirmação visual da linha e bolha lida' }
            },
            required: ['numero', 'resposta']
          }
        }
      },
      required: ['respostas']
    }

    // Attempt with state-of-the-art Gemini 3.8 Flash, with automatic fallback to Gemini 2.5 Flash
    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash']
    let rawText = ''
    let lastError: any = null

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: imageBase64
                  }
                },
                { text: prompt }
              ]
            }
          ],
          config: {
            temperature: 0.0,
            responseMimeType: 'application/json',
            responseSchema: responseSchema
          }
        })

        rawText = response.text?.trim() || ''
        if (rawText) break
      } catch (err: any) {
        console.warn(`[corrigir-gabarito] Modelo ${model} falhou, tentando fallback:`, err.message)
        lastError = err
      }
    }

    if (!rawText) {
      throw lastError || new Error('Não foi possível obter resposta do modelo de IA.')
    }

    // Parse JSON
    let parsed: any
    try {
      parsed = JSON.parse(rawText)
    } catch (e) {
      return NextResponse.json({ error: 'Erro ao interpretar a resposta da IA. Tente com uma imagem mais nítida.' }, { status: 422 })
    }

    const rawList: { numero: number; resposta: string | null; detalhe?: string }[] = parsed.respostas || []

    // Ensure all questions from 1 to totalQuestoes are strictly represented and sanitized
    const respostasAluno = gabaritoOficial.map((q: any) => {
      const found = rawList.find((r) => Number(r.numero) === Number(q.numero))
      let resp = found?.resposta?.trim().toUpperCase() || null
      if (resp !== 'A' && resp !== 'B' && resp !== 'C' && resp !== 'D' && resp !== 'E' && resp !== 'ANULADA') {
        resp = null
      }
      return {
        numero: q.numero,
        resposta: resp,
        detalhe: found?.detalhe || ''
      }
    })

    // Score the answers against the official key
    let acertos = 0
    let anuladas = 0
    const resultadoDetalhado = gabaritoOficial.map((q: any) => {
      const alunoItem = respostasAluno.find((r: any) => r.numero === q.numero)
      const respostaStr = alunoItem?.resposta || null
      const isAnulada = respostaStr === 'ANULADA'
      const correto = !isAnulada && respostaStr === q.resposta?.toUpperCase()

      if (correto) acertos++
      if (isAnulada) anuladas++

      return {
        numero: q.numero,
        respostaAluno: respostaStr,
        respostaCorreta: q.resposta?.toUpperCase(),
        correto,
        anulada: isAnulada,
        detalhe: alunoItem?.detalhe || ''
      }
    })

    const percentual = totalQuestoes > 0 ? Math.round((acertos / totalQuestoes) * 10000) / 100 : 0

    return NextResponse.json({
      respostasAluno,
      resultadoDetalhado,
      totalQuestoes,
      totalAcertos: acertos,
      totalAnuladas: anuladas,
      percentual
    })
  } catch (err: any) {
    console.error('[corrigir-gabarito] Erro:', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao processar o gabarito.' }, { status: 500 })
  }
}
