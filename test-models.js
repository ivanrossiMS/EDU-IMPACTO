import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Hello'
    });
    console.log("gemini-3.5-flash OK:", response.text);
  } catch (e) {
    console.log("gemini-3.5-flash Error:", e.message);
  }
}
run();
