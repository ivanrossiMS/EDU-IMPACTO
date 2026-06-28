import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env.local') });

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      enunciado: { type: Type.STRING },
      alternativas: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            texto: { type: Type.STRING },
            eh_correta: { type: Type.BOOLEAN },
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
      systemInstruction: "Você é um professor. Gere uma questão de Geografia sobre Formato da Terra para o 6º Ano.",
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      temperature: 0.7,
    }
  });

  console.log(response.text);
}
run();
