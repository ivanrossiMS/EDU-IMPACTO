import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const { enunciado, disciplina } = await request.json();

    if (!enunciado) {
      return NextResponse.json(
        { error: 'O enunciado é obrigatório para gerar a imagem.' },
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

    // Extrair apenas o texto limpo do HTML do enunciado
    const plainTextEnunciado = enunciado.replace(/<[^>]+>/g, ' ').substring(0, 1000);

    const systemInstruction = `Você é um especialista em descrever imagens para modelos de IA generativa (como Midjourney, DALL-E, etc).
O usuário deseja criar uma imagem ilustrativa para apoiar a seguinte questão de ${disciplina || 'uma disciplina escolar'}:
"${plainTextEnunciado}"

Sua tarefa:
Crie um ÚNICO prompt curto (máx 40 palavras), EXCLUSIVAMENTE EM INGLÊS, muito visual e descritivo.
- Não inclua textos na imagem (sem diagramas com letras, balões de fala, etc), descreva apenas a CENA ou CONCEITO visual.
- Use estilo "educational flat illustration, colorful, clear" ou adequado ao tema.
- Retorne APENAS o texto do prompt, sem aspas e sem explicações.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Gere o prompt para imagem agora.',
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const imagePrompt = response.text?.trim() || 'educational illustration, colorful, clear vector style';

    // Fetch the image from pollinations in the backend to bypass CORS
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=800&height=500&nologo=true`;
    
    const imgRes = await fetch(pollinationsUrl);
    if (!imgRes.ok) {
      throw new Error('Falha ao baixar imagem gerada pela IA a partir do servidor');
    }
    
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ success: true, prompt: imagePrompt, base64Image: dataUrl });

  } catch (error: any) {
    console.error('Erro ao gerar prompt da imagem por IA:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar o prompt da imagem.', details: error.message },
      { status: 500 }
    );
  }
}
