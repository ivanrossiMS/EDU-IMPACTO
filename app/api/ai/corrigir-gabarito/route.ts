import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

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

    const prompt = `Você é um sistema especializado em leitura óptica de gabaritos escolares brasileiros.

Analise cuidadosamente a imagem de um gabarito respondido por um aluno.

O gabarito possui ${totalQuestoes} questões: ${questionList}.
Cada questão tem alternativas de A a E (ou A a D em alguns casos).
A marcação correta é um círculo completamente preenchido/pintado/sombreado.

Sua tarefa:
1. Identifique qual alternativa o aluno marcou em cada questão (a mais escura/preenchida).
2. Se uma questão não tiver nenhuma marcação clara, use null.
3. Se houver mais de uma alternativa marcada claramente para a mesma questão, você DEVE retornar "ANULADA".

Responda APENAS com um JSON válido no seguinte formato, sem nenhum texto adicional:
{
  "respostas": [
    { "numero": 1, "resposta": "B" },
    { "numero": 2, "resposta": "ANULADA" },
    ...
  ]
}

Retorne exatamente ${totalQuestoes} itens no array, um para cada questão.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
        temperature: 0.1,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    })

    const rawText = response.text?.trim() || ''

    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'A IA não retornou um JSON válido. Tente com uma imagem mais nítida.' }, { status: 422 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const respostasAluno: { numero: number; resposta: string | null }[] = parsed.respostas || []

    // Score the answers
    let acertos = 0
    let anuladas = 0
    const resultadoDetalhado = gabaritoOficial.map((q: any) => {
      const respostaAluno = respostasAluno.find((r) => r.numero === q.numero)
      const respostaStr = respostaAluno?.resposta?.toUpperCase() || null
      const isAnulada = respostaStr === 'ANULADA'
      const correto = !isAnulada && respostaStr === q.resposta?.toUpperCase()
      
      if (correto) acertos++
      if (isAnulada) anuladas++

      return {
        numero: q.numero,
        respostaAluno: respostaStr,
        respostaCorreta: q.resposta?.toUpperCase(),
        correto,
        anulada: isAnulada
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
