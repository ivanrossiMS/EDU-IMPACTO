import { NextResponse } from 'next/server';
import { GoogleGenAI, Type, Schema } from '@google/genai';

export async function POST(request: Request) {
  try {
    const { disciplina, assunto, dificuldade, detalhes, turma, formato } = await request.json();

    if (!disciplina || !assunto) {
      return NextResponse.json(
        { error: 'Disciplina e Assunto são obrigatórios.' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Chave da API do Gemini não configurada.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let formatoInstrucao = 'O enunciado deve ser contextualizado de forma equilibrada (nem muito curto, nem muito longo).';
    if (formato === 'curto') {
      formatoInstrucao = 'O enunciado deve ser BEM CURTO, direto e altamente objetivo, contendo apenas a pergunta direta e sem textos de apoio.';
    } else if (formato === 'enem') {
      formatoInstrucao = 'O enunciado deve seguir o rigoroso estilo do ENEM, apresentando um texto-base longo (um trecho de artigo, poesia, notícia ou crônica) seguido de uma situação-problema complexa focada em interpretação e correlação de conceitos.';
    } else if (formato === 'caso_clinico') {
      formatoInstrucao = 'O enunciado deve ser estruturado como um estudo de caso ou situação do mundo real (caso prático ou clínico), descrevendo uma história e pedindo a solução com base na situação relatada.';
    }

    const systemInstruction = `Você é um professor experiente e conteudista educacional. 
Seu objetivo é criar uma questão de múltipla escolha para simulados ou provas escolares brasileiras.
Siga estas instruções estritamente:
- A questão deve ser sobre a disciplina: ${disciplina}.
- O assunto/tema é: ${assunto}.
- O nível de dificuldade deve ser: ${dificuldade || 'Média'}.
- Público alvo / Turma: ${turma || 'Ensino Fundamental/Médio'}.
- Formato do enunciado: ${formatoInstrucao}
${detalhes ? `- Contexto extra/detalhes pedidos pelo usuário: ${detalhes}` : ''}

A questão deve conter:
1. Um enunciado claro, contextualizado (de preferência com uma situação-problema) formatado em HTML (apenas tags básicas como <p>, <strong>, <br> se necessário).
2. Exatamente 5 alternativas. Apenas UMA alternativa deve ser correta.
3. As alternativas NÃO devem ter as letras "A)", "B)", etc. no próprio texto, retorne apenas o conteúdo da alternativa.

CRÍTICO PARA A ORIGINALIDADE:
- Seja altamente criativo e INÉDITO.
- NUNCA crie a mesma questão ou use o mesmo contexto duas vezes. Escolha ângulos diferentes, abordagens raras, e situações inusitadas sobre o assunto para evitar repetições.
- Evite exemplos clichês e óbvios da disciplina.

Você deve retornar APENAS um objeto JSON.`;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        enunciado: {
          type: Type.STRING,
          description: 'O texto do enunciado formatado em HTML básico.',
        },
        alternativas: {
          type: Type.ARRAY,
          description: 'Lista de exatamente 5 alternativas',
          items: {
            type: Type.OBJECT,
            properties: {
              texto: {
                type: Type.STRING,
                description: 'O texto da alternativa (sem a letra A, B, C...)',
              },
              eh_correta: {
                type: Type.BOOLEAN,
                description: 'True se for a resposta certa, False se for incorreta',
              },
            },
            required: ['texto', 'eh_correta'],
          },
        },
      },
      required: ['enunciado', 'alternativas'],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Gere a questão agora seguindo as instruções dadas.',
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.95,
        topK: 64,
        topP: 0.95,
      }
    });

    const resultText = response.text;
    
    if (!resultText) {
      throw new Error('A IA não retornou conteúdo.');
    }

    const questao = JSON.parse(resultText);

    return NextResponse.json({ success: true, data: questao });

  } catch (error: any) {
    console.error('Erro na geração da questão por IA:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar a questão.', details: error.message },
      { status: 500 }
    );
  }
}
