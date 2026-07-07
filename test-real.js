import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env.local') });

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const responseSchema = {
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
  };

  const base64Data = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCgkvRjIgNSAwIFIKICAgID4+CiAgPj4KICAvQ29udGVudHMgNiAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8CiAgL1R5cGUgL0ZvbnQKICAvU3VidHlwZSAvVHlwZTEKICAvQmFzZUZvbnQgL1RpbWVzLVJvbWFuCj4+CmVuZG9iagoKNSAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCgo2IDAgb2JqCjw8CiAgL0xlbmd0aCA3MwovRmlsdGVyIC9GbGF0ZURlY29kZQo+PgpzdHJlYW0KeJwr5HIK4dJ3M1QwNVAISeFyDeEK5CpUMFSAcwx1FIwNFcIhzEAhc0Mgc4hTKMQOADhACkYKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjggMDAwMDAgbiAKMDAwMDAwMDE2NyAwMDAwMCBuIAowMDAwMDAwMzE0IDAwMDAwIG4gCjAwMDAwMDA0MDUgMDAwMDAgbiAKMDAwMDAwMDQ5MyAwMDAwMCBuIAp0cmFpbGVyCjw8CiAgL1NpemUgNwogIC9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo2MjEKJSVFT0YK";
  
  const prompt = "Vou te enviar um arquivo PDF. Me retorne JSON.";
  try {
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
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      }
    });

    console.log("RESPONSE TEXT:");
    console.log(response.text);
    const parsed = JSON.parse(response.text);
    console.log("PARSE OK!");
  } catch(e) {
    console.error("ERROR CAUGHT:");
    console.error(e);
  }
}
run();
