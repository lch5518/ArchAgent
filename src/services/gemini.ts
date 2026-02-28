const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function getApiUrl(path: string): string {
  return `${apiBase}${path}`;
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  }

  if (!response.ok) {
    const error =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Request failed (${response.status})`;
    throw new Error(error);
  }

  return payload as T;
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

export async function analyzeDrawing(imageData: string, mimeType: string): Promise<string> {
  const result = await requestJson<{ analysis: string }>('/api/analyze', { imageData, mimeType });
  return result.analysis || 'Analysis failed.';
}

export async function checkWheelchairAccessibility(
  imageData: string,
  mimeType: string,
): Promise<WheelchairAnalysis> {
  return requestJson<WheelchairAnalysis>('/api/wheelchair', { imageData, mimeType });
}

export async function checkThermalEfficiency(
  imageData: string,
  mimeType: string,
): Promise<ThermalAnalysis> {
  return requestJson<ThermalAnalysis>('/api/thermal', { imageData, mimeType });
}

export async function chatWithAgent(
  message: string,
  history: Array<{ role: string; content: string }>,
  imageData?: { data: string; mimeType: string },
): Promise<string> {
  const result = await requestJson<{ response: string }>('/api/chat', { message, history, imageData });
  return result.response || '죄송합니다. 답변을 생성하지 못했습니다.';
}
