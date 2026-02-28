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
    const contentType = response.headers.get('content-type') || '';
    const error =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : response.status >= 500 && contentType.includes('text/plain')
          ? '백엔드 서버 연결에 실패했습니다. `npm run dev:server` 실행 상태를 확인해 주세요.'
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
  marker_points: Array<{
    floor: string;
    label: string;
    status: '양호' | '미흡';
    x: number;
    y: number;
    reason: string;
  }>;
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
  heatmap_regions: Array<{
    label: string;
    x: number;
    y: number;
    radius: number;
    intensity: number;
  }>;
}

function normalizeWheelchairAnalysis(input: unknown): WheelchairAnalysis {
  const data = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const floorsRaw = Array.isArray(data.floor_analysis) ? data.floor_analysis : [];
  const floor_analysis = floorsRaw.map((item, idx) => {
    const floor = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const entry = (floor.entry_access && typeof floor.entry_access === 'object' ? floor.entry_access : {}) as Record<string, unknown>;
    const path = (floor.path_dimensions && typeof floor.path_dimensions === 'object' ? floor.path_dimensions : {}) as Record<string, unknown>;
    const slope = (floor.slope_and_steps && typeof floor.slope_and_steps === 'object' ? floor.slope_and_steps : {}) as Record<string, unknown>;
    const disabled = (floor.disabled_facilities && typeof floor.disabled_facilities === 'object' ? floor.disabled_facilities : {}) as Record<string, unknown>;

    return {
      floor: typeof floor.floor === 'string' ? floor.floor : `${idx + 1}층`,
      entry_access: {
        location: typeof entry.location === 'string' ? entry.location : '확인 필요',
        elevator_exists: typeof entry.elevator_exists === 'boolean' ? entry.elevator_exists : false,
        description: typeof entry.description === 'string' ? entry.description : '상세 설명 없음',
      },
      path_dimensions: {
        door_width_ok: typeof path.door_width_ok === 'boolean' ? path.door_width_ok : false,
        turning_space_ok: typeof path.turning_space_ok === 'boolean' ? path.turning_space_ok : false,
        details: typeof path.details === 'string' ? path.details : '상세 설명 없음',
      },
      slope_and_steps: {
        ramp_found: typeof slope.ramp_found === 'boolean' ? slope.ramp_found : false,
        steps_identified: typeof slope.steps_identified === 'string' ? slope.steps_identified : '상세 설명 없음',
      },
      disabled_facilities: {
        accessible_toilet: typeof disabled.accessible_toilet === 'boolean' ? disabled.accessible_toilet : false,
        details: typeof disabled.details === 'string' ? disabled.details : '상세 설명 없음',
      },
      compliance_level:
        floor.compliance_level === 'High' || floor.compliance_level === 'Medium' || floor.compliance_level === 'Low'
          ? floor.compliance_level
          : 'Medium',
    };
  });

  const markerRaw = Array.isArray(data.marker_points) ? data.marker_points : [];
  const marker_points = markerRaw
    .map((item, idx) => {
      const marker = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const statusSource = typeof marker.status === 'string' ? marker.status : '';
      const statusRaw: '양호' | '미흡' | null =
        statusSource === '양호' || statusSource === '미흡' ? statusSource : null;
      const xRaw = typeof marker.x === 'number' ? marker.x : Number(marker.x);
      const yRaw = typeof marker.y === 'number' ? marker.y : Number(marker.y);

      if (!statusRaw || Number.isNaN(xRaw) || Number.isNaN(yRaw)) {
        return null;
      }

      return {
        floor: typeof marker.floor === 'string' ? marker.floor : `${idx + 1}층`,
        label: typeof marker.label === 'string' ? marker.label : '점검 지점',
        status: statusRaw,
        x: Math.max(2, Math.min(98, xRaw)),
        y: Math.max(2, Math.min(98, yRaw)),
        reason: typeof marker.reason === 'string' ? marker.reason : '세부 설명 없음',
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const fallbackMarkers: WheelchairAnalysis['marker_points'] = [];
  const primaryFloor = floor_analysis[0];
  if (primaryFloor) {
    fallbackMarkers.push({
      floor: primaryFloor.floor,
      label: '주출입구',
      status: primaryFloor.entry_access.elevator_exists ? '양호' : '미흡',
      x: 18,
      y: 20,
      reason: primaryFloor.entry_access.description,
    });
    fallbackMarkers.push({
      floor: primaryFloor.floor,
      label: '문 너비',
      status: primaryFloor.path_dimensions.door_width_ok ? '양호' : '미흡',
      x: 60,
      y: 24,
      reason: primaryFloor.path_dimensions.details,
    });
    fallbackMarkers.push({
      floor: primaryFloor.floor,
      label: '회전 공간',
      status: primaryFloor.path_dimensions.turning_space_ok ? '양호' : '미흡',
      x: 32,
      y: 66,
      reason: primaryFloor.path_dimensions.details,
    });
    fallbackMarkers.push({
      floor: primaryFloor.floor,
      label: '장애인 화장실',
      status: primaryFloor.disabled_facilities.accessible_toilet ? '양호' : '미흡',
      x: 74,
      y: 62,
      reason: primaryFloor.disabled_facilities.details,
    });
  }

  return {
    floor_analysis,
    summary_recommendation:
      typeof data.summary_recommendation === 'string'
        ? data.summary_recommendation
        : '요약 권장 사항이 없습니다.',
    marker_points: marker_points.length > 0 ? marker_points : fallbackMarkers,
  };
}

function normalizeThermalAnalysis(input: unknown): ThermalAnalysis {
  const data = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const sunlight = (data.sunlight_exposure && typeof data.sunlight_exposure === 'object'
    ? data.sunlight_exposure
    : {}) as Record<string, unknown>;
  const thermal = (data.thermal_efficiency && typeof data.thermal_efficiency === 'object'
    ? data.thermal_efficiency
    : {}) as Record<string, unknown>;
  const estimated = (data.estimated_cost_impact && typeof data.estimated_cost_impact === 'object'
    ? data.estimated_cost_impact
    : {}) as Record<string, unknown>;
  const windowsRaw = Array.isArray(data.window_analysis) ? data.window_analysis : [];
  const recommendationsRaw = Array.isArray(data.recommendations) ? data.recommendations : [];
  const heatmapRaw = Array.isArray(data.heatmap_regions) ? data.heatmap_regions : [];

  const window_analysis = windowsRaw.map((item, idx) => {
    const win = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      location: typeof win.location === 'string' ? win.location : `창 ${idx + 1}`,
      size_estimate: typeof win.size_estimate === 'string' ? win.size_estimate : '정보 없음',
      orientation: typeof win.orientation === 'string' ? win.orientation : '정보 없음',
      impact: typeof win.impact === 'string' ? win.impact : '정보 없음',
    };
  });

  const heatmap_regions = heatmapRaw
    .map((item, idx) => {
      const region = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const xRaw = typeof region.x === 'number' ? region.x : Number(region.x);
      const yRaw = typeof region.y === 'number' ? region.y : Number(region.y);
      const radiusRaw = typeof region.radius === 'number' ? region.radius : Number(region.radius);
      const intensityRaw = typeof region.intensity === 'number' ? region.intensity : Number(region.intensity);

      if ([xRaw, yRaw, radiusRaw, intensityRaw].some((v) => Number.isNaN(v))) {
        return null;
      }

      return {
        label: typeof region.label === 'string' ? region.label : `일조 영역 ${idx + 1}`,
        x: Math.max(2, Math.min(98, xRaw)),
        y: Math.max(2, Math.min(98, yRaw)),
        radius: Math.max(40, Math.min(220, radiusRaw)),
        intensity: Math.max(0, Math.min(1, intensityRaw)),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const fallbackHeatmapRegions = window_analysis.map((win, idx) => ({
    label: win.location,
    x: [22, 48, 72, 35, 64][idx % 5],
    y: [24, 38, 30, 62, 56][idx % 5],
    radius: [110, 95, 120, 85, 100][idx % 5],
    intensity: [0.85, 0.7, 0.9, 0.6, 0.75][idx % 5],
  }));

  return {
    sunlight_exposure: {
      morning: typeof sunlight.morning === 'string' ? sunlight.morning : '정보 없음',
      afternoon: typeof sunlight.afternoon === 'string' ? sunlight.afternoon : '정보 없음',
      overall_rating: typeof sunlight.overall_rating === 'string' ? sunlight.overall_rating : '정보 없음',
    },
    thermal_efficiency: {
      summer_heat_gain: typeof thermal.summer_heat_gain === 'string' ? thermal.summer_heat_gain : '정보 없음',
      winter_heat_loss: typeof thermal.winter_heat_loss === 'string' ? thermal.winter_heat_loss : '정보 없음',
      details: typeof thermal.details === 'string' ? thermal.details : '세부 정보 없음',
    },
    window_analysis,
    estimated_cost_impact: {
      summer_cooling: typeof estimated.summer_cooling === 'string' ? estimated.summer_cooling : '정보 없음',
      winter_heating: typeof estimated.winter_heating === 'string' ? estimated.winter_heating : '정보 없음',
    },
    recommendations: recommendationsRaw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
    heatmap_regions:
      heatmap_regions.length > 0
        ? heatmap_regions
        : fallbackHeatmapRegions.length > 0
          ? fallbackHeatmapRegions
          : [{
            label: '중앙 일조 영역',
            x: 50,
            y: 45,
            radius: 120,
            intensity: 0.75,
          }],
  };
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
  const result = await requestJson<unknown>('/api/wheelchair', { imageData, mimeType });
  return normalizeWheelchairAnalysis(result);
}

export async function checkThermalEfficiency(
  imageData: string,
  mimeType: string,
): Promise<ThermalAnalysis> {
  const result = await requestJson<unknown>('/api/thermal', { imageData, mimeType });
  return normalizeThermalAnalysis(result);
}

export async function chatWithAgent(
  message: string,
  history: Array<{ role: string; content: string }>,
  imageData?: { data: string; mimeType: string },
): Promise<string> {
  const result = await requestJson<{ response: string }>('/api/chat', { message, history, imageData });
  return result.response || '죄송합니다. 답변을 생성하지 못했습니다.';
}
