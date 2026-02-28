import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

function getBase64Data(dataUrl: string): string {
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
}

export interface WheelchairAnalysis {
  floor_analysis: Array<{
    floor: string;
    entry_access: { location: string; elevator_exists: boolean; description: string };
    path_dimensions: { door_width_ok: boolean; turning_space_ok: boolean; details: string };
    slope_and_steps: { ramp_found: boolean; steps_identified: string };
    disabled_facilities: { accessible_toilet: boolean; details: string };
    compliance_level: string;
  }>;
  summary_recommendation: string;
}

export async function checkWheelchairAccessibility(imageData: string, mimeType: string): Promise<WheelchairAnalysis> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    [도면 분석 미션: 휠체어 접근성 데이터 추출]
    첨부된 도면(지상 2층, 3층 평면도)을 분석하여 반드시 아래의 JSON 스키마 형식으로만 답변해줘.
    
    [분석 항목 및 JSON 키]
    1. entry_access: 주출입구 위치 및 승강기(E/V) 유무 분석
    2. path_dimensions: 주출입문 유효 폭(900mm 기준) 및 내부 회전 공간(1.5m x 1.5m 기준) 확보 여부
    3. slope_and_steps: 경사로(Ramp) 존재 여부 및 문턱/단차 식별 결과
    4. disabled_facilities: 화장실 등 전용 시설의 적정성 분석
    5. overall_compliance: 휠체어 접근성 최종 적합도 (High / Medium / Low)
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: imageData.split(',')[1], mimeType } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          floor_analysis: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                floor: { type: Type.STRING },
                entry_access: {
                  type: Type.OBJECT,
                  properties: {
                    location: { type: Type.STRING },
                    elevator_exists: { type: Type.BOOLEAN },
                    description: { type: Type.STRING }
                  },
                  required: ["location", "elevator_exists", "description"]
                },
                path_dimensions: {
                  type: Type.OBJECT,
                  properties: {
                    door_width_ok: { type: Type.BOOLEAN },
                    turning_space_ok: { type: Type.BOOLEAN },
                    details: { type: Type.STRING }
                  },
                  required: ["door_width_ok", "turning_space_ok", "details"]
                },
                slope_and_steps: {
                  type: Type.OBJECT,
                  properties: {
                    ramp_found: { type: Type.BOOLEAN },
                    steps_identified: { type: Type.STRING }
                  },
                  required: ["ramp_found", "steps_identified"]
                },
                disabled_facilities: {
                  type: Type.OBJECT,
                  properties: {
                    accessible_toilet: { type: Type.BOOLEAN },
                    details: { type: Type.STRING }
                  },
                  required: ["accessible_toilet", "details"]
                },
                compliance_level: { type: Type.STRING }
              },
              required: ["floor", "entry_access", "path_dimensions", "slope_and_steps", "disabled_facilities", "compliance_level"]
            }
          },
          summary_recommendation: { type: Type.STRING }
        },
        required: ["floor_analysis", "summary_recommendation"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse JSON response", e);
    throw new Error("Invalid JSON response from model");
  }
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
        data: getBase64Data(imageData.data),
        mimeType: imageData.mimeType
      }
    });
  }

  const response = await chat.sendMessage({ message });
  return response.text;
}
