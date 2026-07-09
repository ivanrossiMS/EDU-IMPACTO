import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { GoogleGenAI } from '@google/genai'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Chave da API do Gemini não configurada.' }, { status: 500 })
  }

  try {
    const { prompt, variaveisDisponiveis } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'O prompt é obrigatório' }, { status: 400 })
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const systemPrompt = `Você é um assistente de secretaria escolar especializado em redigir documentos oficiais.
O usuário vai pedir para você gerar um modelo de documento (ex: Declaração de Matrícula, Histórico, etc).
Você DEVE escrever o texto de forma formal, clara e de acordo com as normas da língua portuguesa.
IMPORTANTE: Você não tem os dados reais do aluno agora. Você está criando um MODELO.
Por isso, substitua os dados específicos pelas variáveis abaixo:
${variaveisDisponiveis}

Use AS VARIÁVEIS EXATAMENTE COMO ESTÃO ENTRE << >>. Exemplo: "Declaramos para os devidos fins que o aluno <<aluno>>..."
Apenas retorne o texto do documento, sem explicações adicionais, sem markdown de bloco de código (apenas o texto puro, ou HTML se você achar melhor estruturar em parágrafos, mas prefira texto simples com quebras de linha duplas para parágrafos).`

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido. Criarei o modelo de documento usando exatamente as variáveis fornecidas e sem texto extra.' }] },
        { role: 'user', parts: [{ text: `Gere um modelo para: ${prompt}` }] }
      ],
      config: {
        temperature: 0.3, // Baixa temperatura para ser mais determinístico e formal
      }
    });

    const generatedText = response.text || ''

    if (!generatedText.trim()) {
      return NextResponse.json({ error: 'A IA não retornou nenhum texto.' }, { status: 500 })
    }

    return NextResponse.json({ texto: generatedText })

  } catch (error: any) {
    console.error('[API Gemini Error]', error)
    return NextResponse.json({ error: 'Erro ao comunicar com a IA: ' + error.message }, { status: 500 })
  }
}
