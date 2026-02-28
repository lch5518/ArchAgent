import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  compliance: boolean;
  issues: string[];
  suggestions: string[];
  measurements: { [key: string]: string };
}

export async function analyzeDrawing(imageData: string, mimeType: string): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    You are an expert architectural design assistant. 
    Analyze the provided architectural drawing for accessibility compliance (Universal Design).
    Focus on:
    1. Wheelchair accessibility (ramps, slopes, turning circles).
    2. Entrance and door widths (minimum 900mm recommended).
    3. Circulation paths and corridor widths.
    4. Restroom accessibility.
    
    Provide a detailed analysis in Markdown format. 
    Include a section for "Compliance Check" with specific findings and "Design Suggestions" for improvements.
    Be precise and professional.
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: imageData.split(',')[1], mimeType } },
        { text: prompt }
      ]
    }
  });

  return response.text || "Analysis failed.";
}

export async function chatWithAgent(message: string, history: any[], imageData?: { data: string, mimeType: string }) {
  const model = "gemini-3.1-pro-preview";
  
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: "You are ArchAgent, a professional architectural design AI. You help architects and designers verify their plans against regulations (like ADA or local accessibility laws) and suggest improvements. You are helpful, precise, and technical.",
    },
    history: history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    }))
  });

  const parts: any[] = [{ text: message }];
  if (imageData) {
    parts.push({
      inlineData: {
        data: imageData.data.split(',')[1],
        mimeType: imageData.mimeType
      }
    });
  }

  const response = await chat.sendMessage({ message });
  return response.text;
}
