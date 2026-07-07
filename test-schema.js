import { GoogleGenAI, Type } from '@google/genai';

async function test() {
  const ai = new GoogleGenAI({ apiKey: "fake" }); 
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: { name: { type: Type.STRING } }
    }
  };
  try {
    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "hello",
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });
  } catch(e) {
    console.error("ERRO:", e.message);
  }
}
test();
