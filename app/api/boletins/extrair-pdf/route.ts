import { NextResponse } from 'next/server'
import { GoogleGenAI, Type, Schema } from '@google/genai'

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
Vou te enviar um arquivo PDF que contém os boletins de uma turma com VÁRIOS ALUNOS.
Analise a estrutura do PDF, leia as tabelas de notas e extraia TODOS os alunos encontrados.
Você DEVE agrupar todos os alunos em um único array JSON.

Retorne EXATAMENTE este formato JSON (um único objeto com a propriedade "alunos"):
{
  "alunos": [
    {
      "codigo": "1234", 
      "nomeArquivo": "Nome do Primeiro Aluno",
      "bimestre": "1º Bimestre",
      "ano": 2026,
      "disciplinas": [
        {
          "nome": "MATEMÁTICA",
          "avm": "8,0",
          "avb": "7,5",
          "mediaF": "8,0",
          "mediaG": "8,0"
        }
      ]
    },
    {
      "codigo": "5678", 
      "nomeArquivo": "Nome do Segundo Aluno",
      "bimestre": "1º Bimestre",
      "ano": 2026,
      "disciplinas": [
        {
          "nome": "LÍNGUA PORTUGUESA",
          "avm": "7,0",
          "avb": "8,5",
          "mediaF": "7,8",
          "mediaG": "7,8"
        }
      ]
    }
  ]
}

Regras de Extração:
1. "codigo": Extraia o Código ou Matrícula do aluno. (Ex: se tiver "Código: 1234", o valor é "1234").
2. "nomeArquivo": Extraia o nome completo do aluno.
3. "disciplinas": Para cada matéria/disciplina listada para aquele aluno, extraia o nome dela e as notas referentes a AVM, AVB, Media Final (MediaF) e Media Global (MediaG). Mantenha o formato original (ex: "8,0", "Dez", "Falta", etc). Se uma nota estiver em branco, use "".
4. CRÍTICO: Não crie múltiplos objetos! Coloque TODOS os alunos dentro do ÚNICO array "alunos".
5. REGRA DE OURO INQUEBRÁVEL: Você está extraindo dados para um banco de dados oficial escolar. É ESTRITAMENTE PROIBIDO pular qualquer aluno. Você DEVE processar 100% do PDF, ler TODAS as páginas e extrair DEZENAS ou CENTENAS de alunos se eles estiverem lá. NÃO PARE A EXTRAÇÃO ANTES DE CHEGAR AO FIM DO PDF.
6. CRÍTICO PARA PDFs GRANDES: Retorne o JSON minificado, sem espaços em branco ou quebras de linha desnecessárias, para economizar tokens!
7. CRÍTICO: Copie o "codigo" e o "nomeArquivo" EXATAMENTE como estão escritos na página, letra por letra. É estritamente proibido auto-corrigir erros ortográficos ou tentar adivinhar o nome correto. Se o nome estiver cortado ou com erro de digitação no PDF, extraia exatamente o que está no PDF.
8. Retorne apenas o JSON. Sem formatação markdown, sem texto antes ou depois.`

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
              bimestre: { type: Type.STRING, description: 'Ex: 1º Bimestre' },
              ano: { type: Type.NUMBER, description: 'Ex: 2026' },
              disciplinas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nome: { type: Type.STRING, description: 'Nome da disciplina' },
                    avm: { type: Type.STRING, description: 'Nota AVM' },
                    avb: { type: Type.STRING, description: 'Nota AVB' },
                    mediaF: { type: Type.STRING, description: 'Media Final' },
                    mediaG: { type: Type.STRING, description: 'Media Global' }
                  },
                  required: ['nome', 'avm', 'avb', 'mediaF', 'mediaG']
                }
              }
            },
            required: ['codigo', 'nomeArquivo', 'bimestre', 'ano', 'disciplinas']
          }
        }
      },
      required: ['alunos']
    }

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
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      }
    })

    const text = response.text || ''
    
    if (!text) {
      console.error("Gemini retornou texto vazio. Resposta completa:", JSON.stringify(response));
      return NextResponse.json({ error: 'A Inteligência Artificial não retornou nenhum dado (o PDF pode estar ilegível ou vazio).' }, { status: 500 })
    }

    // Extração robusta do JSON ignorando qualquer texto antes ou depois
    let cleanJson = text.trim()
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
      const suffixes = ['', '}', ']}', ']}]}', '}]}', '"]}', '"]}]}', '""}]}', '""}]}'];
      
      for (let i = cleanJson.length; i > Math.max(0, cleanJson.length - 3000); i--) {
        const sub = cleanJson.substring(0, i);
        if (sub.length < 10) break;
        
        for (const suffix of suffixes) {
          try {
            const parsed = JSON.parse(sub + suffix);
            const alunosArray = parsed.alunos;
            if (Array.isArray(alunosArray)) {
              console.log("JSON recuperado com sucesso com", alunosArray.length, "alunos.");
              return NextResponse.json({ 
                success: true, 
                data: alunosArray,
                warning: 'O PDF era muito longo e alguns alunos do final podem não ter sido extraídos. Considere dividir o PDF.'
              });
            }
          } catch (e) {
            // Continua tentando
          }
        }
      }

      console.error("Falha total na recuperação do JSON.");
      const errMessage = parseError.message || "Erro desconhecido"
      const endSnippet = cleanJson.length > 50 ? cleanJson.substring(cleanJson.length - 50) : cleanJson
      return NextResponse.json({ error: `Erro no JSON (${errMessage}). Final do texto: ...${endSnippet}` }, { status: 500 })
    }

  } catch (error: any) {
    console.error("Erro na extração PDF:", error)
    const errorMsg = error.message || ''
    
    // Se for erro de timeout da API do Google Gemini
    if (errorMsg.includes('timed out') || errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE')) {
      return NextResponse.json({ 
        error: 'O PDF é muito grande e a IA esgotou o tempo limite para ler todos os alunos de uma só vez. Por favor, divida o PDF em arquivos menores (ex: 10 a 15 páginas por vez) e importe-os separadamente.' 
      }, { status: 503 })
    }

    return NextResponse.json({ error: 'Erro interno no servidor ao processar PDF: ' + errorMsg }, { status: 500 })
  }
}
