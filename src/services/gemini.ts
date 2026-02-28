const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function getApiUrl(path: string): string {
  return `${apiBase}${path}`;
}

<<<<<<< HEAD
async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let payload: unknown = {};

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
=======
function getBase64Data(dataUrl: string): string {
  if (!dataUrl) return "";
  // If it's already base64 (no data: prefix)
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 7);
  }
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1];
>>>>>>> 5f45dae552fee063e6fa1f33108ec1a5133385fb
  }

  if (!response.ok) {
    const error =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as {error: unknown}).error === 'string'
        ? (payload as {error: string}).error
        : `Request failed (${response.status})`;
    throw new Error(error);
  }

  return payload as T;
}

export interface WheelchairAnalysis {
  floor_analysis: Array<{
    floor: string;
    entry_access: {location: string; elevator_exists: boolean; description: string};
    path_dimensions: {door_width_ok: boolean; turning_space_ok: boolean; details: string};
    slope_and_steps: {ramp_found: boolean; steps_identified: string};
    disabled_facilities: {accessible_toilet: boolean; details: string};
    compliance_level: string;
  }>;
  summary_recommendation: string;
}

<<<<<<< HEAD
=======
export interface ThermalAnalysis {
  sunlight_exposure: {
    morning: string;
    afternoon: string;
    overall_rating: string;
  };
  thermal_efficiency: {
    summer_heat_gain: string;
    winter_heat_loss: string;
    details: string;
  };
  window_analysis: Array<{
    location: string;
    size_estimate: string;
    orientation: string;
    impact: string;
  }>;
  estimated_cost_impact: {
    summer_cooling: string;
    winter_heating: string;
  };
  recommendations: string[];
}

export async function checkThermalEfficiency(imageData: string, mimeType: string): Promise<ThermalAnalysis> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    [도면 분석 미션: 일조량 및 열효율 분석]
    첨부된 도면을 분석하여 창문의 크기와 위치를 바탕으로 일조량과 열효율을 예측해줘.
    여름철 냉방 부하와 겨울철 난방 효율에 대한 예측을 포함해야 해.
    반드시 아래의 JSON 스키마 형식으로만 답변해줘.
    
    [분석 항목]
    1. sunlight_exposure: 오전/오후 일조량 및 종합 등급
    2. thermal_efficiency: 여름철 열 유입 및 겨울철 열 손실 분석
    3. window_analysis: 주요 창문의 위치, 크기(추정), 방향 및 영향
    4. estimated_cost_impact: 계절별 비용 영향 예측
    5. recommendations: 개선을 위한 설계 제안
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: getBase64Data(imageData), mimeType } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sunlight_exposure: {
            type: Type.OBJECT,
            properties: {
              morning: { type: Type.STRING },
              afternoon: { type: Type.STRING },
              overall_rating: { type: Type.STRING }
            },
            required: ["morning", "afternoon", "overall_rating"]
          },
          thermal_efficiency: {
            type: Type.OBJECT,
            properties: {
              summer_heat_gain: { type: Type.STRING },
              winter_heat_loss: { type: Type.STRING },
              details: { type: Type.STRING }
            },
            required: ["summer_heat_gain", "winter_heat_loss", "details"]
          },
          window_analysis: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                location: { type: Type.STRING },
                size_estimate: { type: Type.STRING },
                orientation: { type: Type.STRING },
                impact: { type: Type.STRING }
              },
              required: ["location", "size_estimate", "orientation", "impact"]
            }
          },
          estimated_cost_impact: {
            type: Type.OBJECT,
            properties: {
              summer_cooling: { type: Type.STRING },
              winter_heating: { type: Type.STRING }
            },
            required: ["summer_cooling", "winter_heating"]
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["sunlight_exposure", "thermal_efficiency", "window_analysis", "estimated_cost_impact", "recommendations"]
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

>>>>>>> 5f45dae552fee063e6fa1f33108ec1a5133385fb
export async function analyzeDrawing(imageData: string, mimeType: string): Promise<string> {
  const result = await requestJson<{analysis: string}>('/api/analyze', {imageData, mimeType});
  return result.analysis || 'Analysis failed.';
}

export async function checkWheelchairAccessibility(
  imageData: string,
  mimeType: string,
): Promise<WheelchairAnalysis> {
  return requestJson<WheelchairAnalysis>('/api/wheelchair', {imageData, mimeType});
}

export async function chatWithAgent(
  message: string,
  history: Array<{role: string; content: string}>,
  imageData?: {data: string; mimeType: string},
): Promise<string> {
  const result = await requestJson<{response: string}>('/api/chat', {message, history, imageData});
  return result.response || '죄송합니다. 답변을 생성하지 못했습니다.';
}
