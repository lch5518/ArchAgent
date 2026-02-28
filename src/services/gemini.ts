const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function getApiUrl(path: string): string {
  return `${apiBase}${path}`;
}

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(getApiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('백엔드 서버에 연결할 수 없습니다. `npm run dev:server` 실행 상태를 확인해 주세요.');
  }

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
        : response.status >= 500
          ? '서버 내부 오류가 발생했습니다. 백엔드 로그를 확인해 주세요.'
          : `요청 실패 (${response.status})`;
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

export interface GeneralAnalysis {
  project_type: string;
  summary: string;
  compliance_level: '높음' | '보통' | '낮음';
  overall_score: number;
  key_findings: Array<{
    item: string;
    status: '적합' | '주의' | '미흡';
    detail: string;
  }>;
  legal_checks: Array<{
    code: string;
    result: '충족' | '검토 필요' | '미충족';
    note: string;
  }>;
  improvement_actions: string[];
}

function fallbackGeneralAnalysis(summary: string): GeneralAnalysis {
  return {
    project_type: '건축 도면',
    summary: summary || '분석 결과를 생성하지 못했습니다.',
    compliance_level: '보통',
    overall_score: 50,
    key_findings: [],
    legal_checks: [],
    improvement_actions: [],
  };
}

function toKoreanText(value: unknown, fallback: string, maxLength: number): string {
  const raw = typeof value === 'string' ? value : '';
  const cleaned = raw.replace(/[A-Za-z]/g, '').replace(/\s+/g, ' ').trim();
  const base = cleaned || fallback;
  if (base.length <= maxLength) return base;
  return `${base.slice(0, maxLength)}...`;
}

function normalizeGeneralAnalysis(input: unknown): GeneralAnalysis {
  if (!input || typeof input !== 'object') {
    return fallbackGeneralAnalysis('');
  }

  const data = input as Record<string, unknown>;
  const scoreRaw = data.overall_score;
  const scoreNumber = typeof scoreRaw === 'number'
    ? scoreRaw
    : typeof scoreRaw === 'string'
      ? Number(scoreRaw)
      : 50;
  const normalizedScore = Number.isFinite(scoreNumber)
    ? Math.max(0, Math.min(100, Math.round(scoreNumber)))
    : 50;

  const complianceRaw = typeof data.compliance_level === 'string' ? data.compliance_level : '보통';
  const compliance: GeneralAnalysis['compliance_level'] =
    complianceRaw === '높음' || complianceRaw === '보통' || complianceRaw === '낮음'
      ? complianceRaw
      : '보통';

  const keyFindings = Array.isArray(data.key_findings)
    ? data.key_findings.map((item) => {
      const finding = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const statusRaw = typeof finding.status === 'string' ? finding.status : '주의';
      const status: '적합' | '주의' | '미흡' =
        statusRaw === '적합' || statusRaw === '주의' || statusRaw === '미흡'
          ? statusRaw
          : '주의';
      return {
        item: toKoreanText(finding.item, '점검 항목', 18),
        status,
        detail: toKoreanText(finding.detail, '세부 설명 없음', 70),
      };
    })
    : [];

  const legalChecks = Array.isArray(data.legal_checks)
    ? data.legal_checks.map((item) => {
      const check = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const resultRaw = typeof check.result === 'string' ? check.result : '검토 필요';
      const result: '충족' | '검토 필요' | '미충족' =
        resultRaw === '충족' || resultRaw === '검토 필요' || resultRaw === '미충족'
          ? resultRaw
          : '검토 필요';
      return {
        code: toKoreanText(check.code, '관련 기준', 20),
        result,
        note: toKoreanText(check.note, '세부 내용 없음', 70),
      };
    })
    : [];

  const improvementActions = Array.isArray(data.improvement_actions)
    ? data.improvement_actions
      .filter((item): item is string => typeof item === 'string')
      .map((item) => toKoreanText(item, '개선 제안 없음', 70))
    : [];

  return {
    project_type: toKoreanText(data.project_type, '일반 도면', 10),
    summary: toKoreanText(data.summary, '요약 결과가 없습니다.', 110),
    compliance_level: compliance,
    overall_score: normalizedScore,
    key_findings: keyFindings,
    legal_checks: legalChecks,
    improvement_actions: improvementActions,
  };
}

export async function analyzeDrawing(
  imageData: string,
  mimeType: string,
): Promise<GeneralAnalysis> {
  const result = await requestJson<{ analysis: GeneralAnalysis | string }>('/api/analyze', { imageData, mimeType });
  const analysis = result.analysis;

  if (typeof analysis === 'string') {
    try {
      return normalizeGeneralAnalysis(JSON.parse(analysis));
    } catch {
      return fallbackGeneralAnalysis(analysis);
    }
  }

  return normalizeGeneralAnalysis(analysis);
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
