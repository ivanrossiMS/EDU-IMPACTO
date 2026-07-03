import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

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

    // Usando o SDK novo
    const ai = new GoogleGenAI({ apiKey })

    const prompt = `Você é um assistente especializado em extração de dados de Boletins Escolares.
Vou te enviar um arquivo PDF que contém os boletins de um ou mais alunos.
Analise a estrutura do PDF, leia as tabelas de notas e me retorne **APENAS** um array JSON válido (sem \`\`\`json ou texto extra) contendo os dados de CADA aluno encontrado.

Para CADA aluno encontrado no PDF, crie um objeto no array com o seguinte formato exato:
{
  "codigo": "1234", 
  "nomeArquivo": "NOME DO ALUNO",
  "bimestre": "1º Bimestre",
  "ano": 2026,
  "disciplinas": [
    {
      "nome": "NOME DA DISCIPLINA",
      "avm": "8,0",
      "avb": "7,5",
      "mediaF": "8,0",
      "mediaG": "8,0"
    }
  ]
}

Regras de Extração:
1. "codigo": Extraia o Código ou Matrícula do aluno. (Ex: se tiver "Código: 1234", o valor é "1234").
2. "nomeArquivo": Extraia o nome completo do aluno.
3. "disciplinas": Para cada matéria/disciplina listada para aquele aluno, extraia o nome dela e as notas referentes a AVM, AVB, Media Final (MediaF) e Media Global (MediaG). Mantenha o formato original (ex: "8,0", "Dez", "Falta", etc). Se uma nota estiver em branco, use "".
4. Retorne apenas o JSON. Sem formatação markdown, sem texto antes ou depois.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
      }
    })

    const text = response.text || ''
    
    // Limpar markdown se houver
    let cleanJson = text.trim()
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.substring(7)
    }
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.substring(3)
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.substring(0, cleanJson.length - 3)
    }
    
    cleanJson = cleanJson.trim()

    try {
      const parsedData = JSON.parse(cleanJson)
      return NextResponse.json({ success: true, data: parsedData })
    } catch (parseError) {
      console.error("Erro ao fazer parse do JSON retornado pelo Gemini:", cleanJson)
      return NextResponse.json({ error: 'Erro ao formatar os dados extraídos pelo Gemini.', rawData: cleanJson }, { status: 500 })
    }

  } catch (error: any) {
    console.error("Erro na extração PDF:", error)
    return NextResponse.json({ error: 'Erro interno no servidor ao processar PDF: ' + error.message }, { status: 500 })
  }
}
