import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.list();
    console.log(response);
    for await (const model of response) {
      if (model.name.includes("flash") || model.name.includes("pro") || model.name.includes("gemini")) {
        console.log(model.name);
      }
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
