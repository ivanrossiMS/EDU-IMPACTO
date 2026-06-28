import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('.env.local') });

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-001',
        prompt: 'A cute cat playing with yarn',
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '1:1'
        }
    });
    console.log("Success! Image generated.");
  } catch (e) {
    console.error("Error generating image:", e.message);
  }
}
run();
