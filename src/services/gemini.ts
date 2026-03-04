const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function getApiUrl(path: string): string {
  return `${apiBase}${path}`;
}

async function requestApi<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const method = options.method || 'POST';
  let response: Response;
  try {
    response = await fetch(getApiUrl(path), {
      method,
      headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(options.body ?? {}),
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

async function requestPostJson<T>(path: string, body: unknown): Promise<T> {
  return requestApi<T>(path, { method: 'POST', body });
}

async function requestGetJson<T>(path: string): Promise<T> {
  return requestApi<T>(path, { method: 'GET' });
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

export interface FireAnalysis {
  fire_risk_level: '낮음' | '보통' | '높음';
  wall_material_assessment: Array<{
    zone: string;
    material: string;
    fire_resistance: string;
    risk_note: string;
  }>;
  ventilation_assessment: {
    smoke_exhaust_present: boolean;
    pressure_zones: string;
    spread_factor: string;
    detail: string;
  };
  smoke_spread: {
    predicted_speed_mps: number;
    major_direction: string;
    timeline: Array<{
      minute: number;
      affected_zones: string;
    }>;
  };
  evacuation_routes: Array<{
    name: string;
    path: string;
    estimated_time_sec: number;
    safety_score: number;
    bottleneck: string;
  }>;
  safest_route: {
    name: string;
    reason: string;
    step_by_step: string[];
  };
  recommendations: string[];
  route_points: Array<{
    route_name: string;
    label: string;
    status: '안전' | '주의' | '위험';
    x: number;
    y: number;
    note: string;
  }>;
}

function toKoreanThermalText(value: unknown, fallback: string, maxLength = 80): string {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw
    .replace(/northwest/gi, '북서')
    .replace(/northeast/gi, '북동')
    .replace(/southwest/gi, '남서')
    .replace(/southeast/gi, '남동')
    .replace(/north/gi, '북')
    .replace(/south/gi, '남')
    .replace(/east/gi, '동')
    .replace(/west/gi, '서')
    .replace(/morning/gi, '오전')
    .replace(/afternoon/gi, '오후')
    .replace(/summer/gi, '여름')
    .replace(/winter/gi, '겨울')
    .replace(/heat gain/gi, '열유입')
    .replace(/heat loss/gi, '열손실')
    .replace(/[A-Za-z]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const base = normalized || fallback;
  if (base.length <= maxLength) return base;
  return `${base.slice(0, maxLength)}...`;
}

function toKoreanFireText(value: unknown, fallback: string, maxLength = 80): string {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw
    .replace(/safe/gi, '안전')
    .replace(/caution/gi, '주의')
    .replace(/danger/gi, '위험')
    .replace(/northwest/gi, '북서')
    .replace(/northeast/gi, '북동')
    .replace(/southwest/gi, '남서')
    .replace(/southeast/gi, '남동')
    .replace(/north/gi, '북')
    .replace(/south/gi, '남')
    .replace(/east/gi, '동')
    .replace(/west/gi, '서')
    .replace(/seconds/gi, '초')
    .replace(/second/gi, '초')
    .replace(/minutes/gi, '분')
    .replace(/minute/gi, '분')
    .replace(/[A-Za-z]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const base = normalized || fallback;
  if (base.length <= maxLength) return base;
  return `${base.slice(0, maxLength)}...`;
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
      location: toKoreanThermalText(win.location, `창 ${idx + 1}`, 30),
      size_estimate: toKoreanThermalText(win.size_estimate, '정보 없음', 40),
      orientation: toKoreanThermalText(win.orientation, '정보 없음', 20),
      impact: toKoreanThermalText(win.impact, '정보 없음', 70),
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
        label: toKoreanThermalText(region.label, `일조 영역 ${idx + 1}`, 20),
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
      morning: toKoreanThermalText(sunlight.morning, '정보 없음', 70),
      afternoon: toKoreanThermalText(sunlight.afternoon, '정보 없음', 70),
      overall_rating: toKoreanThermalText(sunlight.overall_rating, '정보 없음', 40),
    },
    thermal_efficiency: {
      summer_heat_gain: toKoreanThermalText(thermal.summer_heat_gain, '정보 없음', 70),
      winter_heat_loss: toKoreanThermalText(thermal.winter_heat_loss, '정보 없음', 70),
      details: toKoreanThermalText(thermal.details, '세부 정보 없음', 90),
    },
    window_analysis,
    estimated_cost_impact: {
      summer_cooling: toKoreanThermalText(estimated.summer_cooling, '정보 없음', 70),
      winter_heating: toKoreanThermalText(estimated.winter_heating, '정보 없음', 70),
    },
    recommendations: recommendationsRaw
      .filter((item): item is string => typeof item === 'string')
      .map((item) => toKoreanThermalText(item, '개선 제안 없음', 90))
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

function normalizeFireAnalysis(input: unknown): FireAnalysis {
  const data = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const wallRaw = Array.isArray(data.wall_material_assessment) ? data.wall_material_assessment : [];
  const smokeRaw = (data.smoke_spread && typeof data.smoke_spread === 'object'
    ? data.smoke_spread
    : {}) as Record<string, unknown>;
  const ventRaw = (data.ventilation_assessment && typeof data.ventilation_assessment === 'object'
    ? data.ventilation_assessment
    : {}) as Record<string, unknown>;
  const routesRaw = Array.isArray(data.evacuation_routes) ? data.evacuation_routes : [];
  const safestRaw = (data.safest_route && typeof data.safest_route === 'object'
    ? data.safest_route
    : {}) as Record<string, unknown>;
  const recommendationsRaw = Array.isArray(data.recommendations) ? data.recommendations : [];
  const routePointsRaw = Array.isArray(data.route_points) ? data.route_points : [];
  const timelineRaw = Array.isArray(smokeRaw.timeline) ? smokeRaw.timeline : [];

  const wall_material_assessment = wallRaw.map((item, idx) => {
    const wall = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      zone: toKoreanFireText(wall.zone, `구역 ${idx + 1}`, 24),
      material: toKoreanFireText(wall.material, '재질 정보 없음', 24),
      fire_resistance: toKoreanFireText(wall.fire_resistance, '내화성 정보 없음', 24),
      risk_note: toKoreanFireText(wall.risk_note, '위험도 설명 없음', 80),
    };
  });

  const timeline = timelineRaw.map((item, idx) => {
    const point = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const minuteRaw = typeof point.minute === 'number' ? point.minute : Number(point.minute);
    return {
      minute: Number.isFinite(minuteRaw) ? Math.max(0, Math.round(minuteRaw)) : (idx + 1) * 2,
      affected_zones: toKoreanFireText(point.affected_zones, '영향 구역 정보 없음', 80),
    };
  });

  const evacuation_routes = routesRaw.map((item, idx) => {
    const route = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const estimatedRaw = typeof route.estimated_time_sec === 'number'
      ? route.estimated_time_sec
      : Number(route.estimated_time_sec);
    const scoreRaw = typeof route.safety_score === 'number' ? route.safety_score : Number(route.safety_score);
    return {
      name: toKoreanFireText(route.name, `대피 경로 ${idx + 1}`, 24),
      path: toKoreanFireText(route.path, '경로 정보 없음', 80),
      estimated_time_sec: Number.isFinite(estimatedRaw) ? Math.max(0, Math.round(estimatedRaw)) : 120,
      safety_score: Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 60,
      bottleneck: toKoreanFireText(route.bottleneck, '병목 구간 정보 없음', 60),
    };
  });

  const route_points = routePointsRaw
    .map((item, idx) => {
      const point = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const statusRaw = typeof point.status === 'string' ? point.status : '';
      const status: '안전' | '주의' | '위험' =
        statusRaw === '안전' || statusRaw === '주의' || statusRaw === '위험'
          ? statusRaw
          : idx % 3 === 0
            ? '안전'
            : idx % 3 === 1
              ? '주의'
              : '위험';
      const xRaw = typeof point.x === 'number' ? point.x : Number(point.x);
      const yRaw = typeof point.y === 'number' ? point.y : Number(point.y);

      return {
        route_name: toKoreanFireText(point.route_name, evacuation_routes[0]?.name || '추천 경로', 24),
        label: toKoreanFireText(point.label, `지점 ${idx + 1}`, 20),
        status,
        x: Number.isFinite(xRaw) ? Math.max(2, Math.min(98, xRaw)) : [20, 36, 52, 66, 80][idx % 5],
        y: Number.isFinite(yRaw) ? Math.max(2, Math.min(98, yRaw)) : [74, 62, 52, 40, 26][idx % 5],
        note: toKoreanFireText(point.note, '세부 설명 없음', 80),
      };
    });

  const predictedSpeedRaw = typeof smokeRaw.predicted_speed_mps === 'number'
    ? smokeRaw.predicted_speed_mps
    : Number(smokeRaw.predicted_speed_mps);

  const riskSource = typeof data.fire_risk_level === 'string' ? data.fire_risk_level : '';
  const fire_risk_level: FireAnalysis['fire_risk_level'] =
    riskSource === '낮음' || riskSource === '보통' || riskSource === '높음'
      ? riskSource
      : '보통';

  const recommendations = recommendationsRaw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => toKoreanFireText(item, '개선 권장 사항 없음', 90))
    .filter(Boolean);

  const safest_step_by_step = Array.isArray(safestRaw.step_by_step)
    ? safestRaw.step_by_step
      .filter((item): item is string => typeof item === 'string')
      .map((item) => toKoreanFireText(item, '대피 단계 정보 없음', 60))
    : [];

  const fallbackRoutes = evacuation_routes.length > 0
    ? evacuation_routes
    : [{
      name: '기본 대피 경로',
      path: '주출입구에서 가장 가까운 계단실을 통해 1층 외부 출구로 이동',
      estimated_time_sec: 140,
      safety_score: 65,
      bottleneck: '계단실 입구 병목 가능',
    }];

  const fallbackRoutePoints = route_points.length > 0
    ? route_points
    : [
      { route_name: fallbackRoutes[0].name, label: '출발', status: '주의' as const, x: 18, y: 78, note: '현재 층 시작 지점' },
      { route_name: fallbackRoutes[0].name, label: '계단실', status: '안전' as const, x: 43, y: 58, note: '방화구획 경유' },
      { route_name: fallbackRoutes[0].name, label: '외부출구', status: '안전' as const, x: 78, y: 26, note: '최종 대피 지점' },
    ];

  return {
    fire_risk_level,
    wall_material_assessment,
    ventilation_assessment: {
      smoke_exhaust_present: typeof ventRaw.smoke_exhaust_present === 'boolean' ? ventRaw.smoke_exhaust_present : false,
      pressure_zones: toKoreanFireText(ventRaw.pressure_zones, '압력 구역 정보 없음', 70),
      spread_factor: toKoreanFireText(ventRaw.spread_factor, '확산 요인 정보 없음', 70),
      detail: toKoreanFireText(ventRaw.detail, '환기 상세 정보 없음', 90),
    },
    smoke_spread: {
      predicted_speed_mps: Number.isFinite(predictedSpeedRaw) ? Math.max(0.1, Math.min(5, Number(predictedSpeedRaw.toFixed(2)))) : 0.8,
      major_direction: toKoreanFireText(smokeRaw.major_direction, '주요 확산 방향 정보 없음', 40),
      timeline: timeline.length > 0
        ? timeline
        : [
          { minute: 2, affected_zones: '발화 구역 주변 복도' },
          { minute: 5, affected_zones: '중앙 홀 및 인접 실' },
          { minute: 8, affected_zones: '계단실 접근 구간' },
        ],
    },
    evacuation_routes: fallbackRoutes,
    safest_route: {
      name: toKoreanFireText(safestRaw.name, fallbackRoutes[0].name, 30),
      reason: toKoreanFireText(safestRaw.reason, '연기 확산 방향과 반대이며 병목 가능성이 낮아 상대적으로 안전함', 90),
      step_by_step: safest_step_by_step.length > 0
        ? safest_step_by_step
        : [
          '현재 위치에서 가장 가까운 방화구획 통로로 이동',
          '계단실 방향으로 우회하여 하향 이동',
          '1층 외부 출구를 통해 건물 밖 안전지대로 대피',
        ],
    },
    recommendations:
      recommendations.length > 0
        ? recommendations
        : [
          '복도와 계단실 경계에 연기 차단 구획 보강',
          '배연 설비 자동 제어 연동 점검',
          '피난 유도 표지 가시성 강화',
        ],
    route_points: fallbackRoutePoints,
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

export type AnalysisTaskType = 'general' | 'wheelchair' | 'thermal' | 'fire';
export type AnalysisTaskStatus = 'queued' | 'running' | 'completed' | 'failed';
export type AnalysisOverallStatus = 'queued' | 'running' | 'partial_completed' | 'completed' | 'failed';

export interface AnalysisTaskState<T> {
  status: AnalysisTaskStatus;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  result: T | null;
}

export interface AnalysisJobCreateResponse {
  jobId: string;
  status: 'queued';
  analysisKeys: AnalysisTaskType[];
  pollUrl: string;
}

export interface AnalysisJobStatusResponse {
  jobId: string;
  overallStatus: AnalysisOverallStatus;
  createdAt: string;
  updatedAt: string;
  tasks: {
    general: AnalysisTaskState<GeneralAnalysis>;
    wheelchair: AnalysisTaskState<WheelchairAnalysis>;
    thermal: AnalysisTaskState<ThermalAnalysis>;
    fire: AnalysisTaskState<FireAnalysis>;
  };
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
  const result = await requestPostJson<{ analysis: GeneralAnalysis | string }>('/api/analyze', { imageData, mimeType });
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
  const result = await requestPostJson<unknown>('/api/wheelchair', { imageData, mimeType });
  return normalizeWheelchairAnalysis(result);
}

export async function checkThermalEfficiency(
  imageData: string,
  mimeType: string,
): Promise<ThermalAnalysis> {
  const result = await requestPostJson<unknown>('/api/thermal', { imageData, mimeType });
  return normalizeThermalAnalysis(result);
}

export async function checkFireSafety(
  imageData: string,
  mimeType: string,
): Promise<FireAnalysis> {
  const result = await requestPostJson<unknown>('/api/fire', { imageData, mimeType });
  return normalizeFireAnalysis(result);
}

export async function createAnalysisJob(
  imageData: string,
  mimeType: string,
): Promise<AnalysisJobCreateResponse> {
  return requestPostJson<AnalysisJobCreateResponse>('/api/jobs/analyze-all', { imageData, mimeType });
}

export async function getAnalysisJobStatus(
  jobId: string,
): Promise<AnalysisJobStatusResponse> {
  const raw = await requestGetJson<{
    jobId: string;
    overallStatus: AnalysisOverallStatus;
    createdAt: string;
    updatedAt: string;
    tasks: Record<AnalysisTaskType, AnalysisTaskState<unknown>>;
  }>(`/api/jobs/${jobId}`);

  return {
    ...raw,
    tasks: {
      general: raw.tasks.general
        ? {...raw.tasks.general, result: raw.tasks.general.result ? normalizeGeneralAnalysis(raw.tasks.general.result) : null}
        : {status: 'queued', startedAt: null, finishedAt: null, error: null, result: null},
      wheelchair: raw.tasks.wheelchair
        ? {...raw.tasks.wheelchair, result: raw.tasks.wheelchair.result ? normalizeWheelchairAnalysis(raw.tasks.wheelchair.result) : null}
        : {status: 'queued', startedAt: null, finishedAt: null, error: null, result: null},
      thermal: raw.tasks.thermal
        ? {...raw.tasks.thermal, result: raw.tasks.thermal.result ? normalizeThermalAnalysis(raw.tasks.thermal.result) : null}
        : {status: 'queued', startedAt: null, finishedAt: null, error: null, result: null},
      fire: raw.tasks.fire
        ? {...raw.tasks.fire, result: raw.tasks.fire.result ? normalizeFireAnalysis(raw.tasks.fire.result) : null}
        : {status: 'queued', startedAt: null, finishedAt: null, error: null, result: null},
    },
  };
}

export async function chatWithAgent(
  message: string,
  history: Array<{ role: string; content: string }>,
  imageData?: { data: string; mimeType: string },
): Promise<string> {
  const result = await requestPostJson<{ response: string }>('/api/chat', { message, history, imageData });
  return result.response || '죄송합니다. 답변을 생성하지 못했습니다.';
}
