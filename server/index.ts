import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GoogleGenAI, Type, type GenerateContentResponse} from '@google/genai';

dotenv.config({path: '.env.local'});
dotenv.config();

const app = express();
const port =
  Number(process.env.API_PORT) ||
  (process.env.NODE_ENV === 'production' ? Number(process.env.PORT) : 8787);
const model = 'gemini-3.1-pro-preview';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');

app.use(express.json({limit: '25mb'}));

type ChatHistoryItem = {
  role?: string;
  content?: string;
};

type ChatImage = {
  data: string;
  mimeType?: string;
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing. Set it in .env or .env.local.');
  }
  return new GoogleGenAI({apiKey});
}

async function normalizeImageData(
  imageData: string,
  fallbackMimeType = 'image/png',
): Promise<{data: string; mimeType: string}> {
  if (!imageData || typeof imageData !== 'string') {
    throw new Error('imageData must be a non-empty string.');
  }

  const dataUrlMatch = imageData.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {mimeType: dataUrlMatch[1], data: dataUrlMatch[2]};
  }

  if (/^https?:\/\//i.test(imageData)) {
    const response = await fetch(imageData);
    if (!response.ok) {
      throw new Error(`Failed to download remote image: ${response.status}`);
    }
    const contentType =
      response.headers.get('content-type')?.split(';')[0] || fallbackMimeType;
    const buffer = Buffer.from(await response.arrayBuffer());
    return {mimeType: contentType, data: buffer.toString('base64')};
  }

  if (imageData.includes(',')) {
    const [, base64] = imageData.split(',', 2);
    return {mimeType: fallbackMimeType, data: base64};
  }

  return {mimeType: fallbackMimeType, data: imageData};
}

function buildHistoryText(history: ChatHistoryItem[]): string {
  return history
    .filter((item) => item && typeof item.content === 'string')
    .map((item) => {
      const role = item.role === 'user' ? 'User' : 'Assistant';
      return `${role}: ${item.content}`;
    })
    .join('\n');
}

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

app.get('/api/health', (_req, res) => {
  res.json({ok: true});
});

app.post('/api/analyze', async (req, res) => {
  try {
    const {imageData, mimeType} = req.body ?? {};
    if (typeof imageData !== 'string') {
      return res.status(400).json({error: 'imageData is required.'});
    }

    const ai = getAiClient();
    const normalized = await normalizeImageData(imageData, mimeType);
    const prompt = `
      [도면 분석 미션: 일반 설계 진단]
      첨부된 건축 도면을 보고 접근성/동선/출입구/화장실 중심으로 핵심만 간결하게 평가해줘.
      출력 언어는 반드시 한국어만 사용해줘. (영문 단어/약어 사용 금지)
      project_type은 2~8자 한글로 매우 짧게 작성해줘.
      summary는 1~2문장으로 90자 이내로 작성해줘.
      key_findings/detail, legal_checks/note, improvement_actions도 각 항목당 짧고 간결하게 작성해줘.
      반드시 아래 JSON 스키마 형식으로만 답변해줘.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {inlineData: {data: normalized.data, mimeType: normalized.mimeType}},
          {text: prompt},
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            project_type: {type: Type.STRING},
            summary: {type: Type.STRING},
            compliance_level: {type: Type.STRING},
            overall_score: {type: Type.NUMBER},
            key_findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item: {type: Type.STRING},
                  status: {type: Type.STRING},
                  detail: {type: Type.STRING},
                },
                required: ['item', 'status', 'detail'],
              },
            },
            legal_checks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: {type: Type.STRING},
                  result: {type: Type.STRING},
                  note: {type: Type.STRING},
                },
                required: ['code', 'result', 'note'],
              },
            },
            improvement_actions: {
              type: Type.ARRAY,
              items: {type: Type.STRING},
            },
          },
          required: [
            'project_type',
            'summary',
            'compliance_level',
            'overall_score',
            'key_findings',
            'legal_checks',
            'improvement_actions',
          ],
        },
      },
    });

    const text = response.text || '';
    let analysis: unknown;

    try {
      analysis = parseModelJson(text);
    } catch {
      analysis = {
        project_type: '건축 도면',
        summary: text || '분석 결과를 생성하지 못했습니다.',
        compliance_level: '보통',
        overall_score: 50,
        key_findings: [],
        legal_checks: [],
        improvement_actions: [],
      };
    }

    return res.json({analysis});
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Analyze failed.';
    return res.status(500).json({error: message});
  }
});

app.post('/api/wheelchair', async (req, res) => {
  try {
    const {imageData, mimeType} = req.body ?? {};
    if (typeof imageData !== 'string') {
      return res.status(400).json({error: 'imageData is required.'});
    }

    const ai = getAiClient();
    const normalized = await normalizeImageData(imageData, mimeType);
    const prompt = `
      [도면 분석 미션: 휠체어 접근성 데이터 추출]
      첨부된 도면(지상 2층, 3층 평면도)을 분석하여 반드시 아래의 JSON 스키마 형식으로만 답변해줘.

      [분석 항목 및 JSON 키]
      1. entry_access: 주출입구 위치 및 승강기(E/V) 유무 분석
      2. path_dimensions: 주출입문 유효 폭(900mm 기준) 및 내부 회전 공간(1.5m x 1.5m 기준) 확보 여부
      3. slope_and_steps: 경사로(Ramp) 존재 여부 및 문턱/단차 식별 결과
      4. disabled_facilities: 화장실 등 전용 시설의 적정성 분석
      5. overall_compliance: 휠체어 접근성 최종 적합도 (High / Medium / Low)
      6. marker_points: 도면 위에 표시할 마커 목록

      [marker_points 규칙]
      - x, y는 도면 좌측 상단 기준 백분율 좌표(0~100)
      - status는 반드시 "양호" 또는 "미흡"
      - label은 짧은 한글 태그 (예: 주출입구, 문 너비)
      - reason은 1문장 설명
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {inlineData: {data: normalized.data, mimeType: normalized.mimeType}},
          {text: prompt},
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            floor_analysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  floor: {type: Type.STRING},
                  entry_access: {
                    type: Type.OBJECT,
                    properties: {
                      location: {type: Type.STRING},
                      elevator_exists: {type: Type.BOOLEAN},
                      description: {type: Type.STRING},
                    },
                    required: ['location', 'elevator_exists', 'description'],
                  },
                  path_dimensions: {
                    type: Type.OBJECT,
                    properties: {
                      door_width_ok: {type: Type.BOOLEAN},
                      turning_space_ok: {type: Type.BOOLEAN},
                      details: {type: Type.STRING},
                    },
                    required: ['door_width_ok', 'turning_space_ok', 'details'],
                  },
                  slope_and_steps: {
                    type: Type.OBJECT,
                    properties: {
                      ramp_found: {type: Type.BOOLEAN},
                      steps_identified: {type: Type.STRING},
                    },
                    required: ['ramp_found', 'steps_identified'],
                  },
                  disabled_facilities: {
                    type: Type.OBJECT,
                    properties: {
                      accessible_toilet: {type: Type.BOOLEAN},
                      details: {type: Type.STRING},
                    },
                    required: ['accessible_toilet', 'details'],
                  },
                  compliance_level: {type: Type.STRING},
                },
                required: [
                  'floor',
                  'entry_access',
                  'path_dimensions',
                  'slope_and_steps',
                  'disabled_facilities',
                  'compliance_level',
                ],
              },
            },
            summary_recommendation: {type: Type.STRING},
            marker_points: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  floor: {type: Type.STRING},
                  label: {type: Type.STRING},
                  status: {type: Type.STRING},
                  x: {type: Type.NUMBER},
                  y: {type: Type.NUMBER},
                  reason: {type: Type.STRING},
                },
                required: ['floor', 'label', 'status', 'x', 'y', 'reason'],
              },
            },
          },
          required: ['floor_analysis', 'summary_recommendation', 'marker_points'],
        },
      },
    });

    const text = response.text || '{}';
    const data = parseModelJson(text);
    return res.json(data);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Wheelchair analysis failed.';
    return res.status(500).json({error: message});
  }
});

app.post('/api/thermal', async (req, res) => {
  try {
    const {imageData, mimeType} = req.body ?? {};
    if (typeof imageData !== 'string') {
      return res.status(400).json({error: 'imageData is required.'});
    }

    const ai = getAiClient();
    const normalized = await normalizeImageData(imageData, mimeType);
    const prompt = `
      [도면 분석 미션: 일조량 및 열효율 분석]
      첨부된 도면을 분석하여 창문의 크기와 위치를 바탕으로 일조량과 열효율을 예측해줘.
      여름철 냉방 부하와 겨울철 난방 효율에 대한 예측을 포함해야 해.
      응답의 모든 문자열 값은 반드시 한국어만 사용해줘. (영문 단어/약어/N,E,S,W 표기 금지)
      방향 표기는 반드시 "북/남/동/서/북동/남동/북서/남서" 중에서만 사용해줘.
      반드시 아래 JSON 스키마 형식으로만 답변해줘.

      [분석 항목]
      1. sunlight_exposure: 오전/오후 일조량 및 종합 등급
      2. thermal_efficiency: 여름철 열 유입 및 겨울철 열 손실 분석
      3. window_analysis: 주요 창문의 위치, 크기(추정), 방향 및 영향
      4. estimated_cost_impact: 계절별 비용 영향 예측
      5. recommendations: 개선을 위한 설계 제안
      6. heatmap_regions: 도면 위 일조 집중 영역 좌표 목록

      [heatmap_regions 규칙]
      - x, y: 도면 좌상단 기준 백분율 좌표 (0~100)
      - radius: 픽셀 반경 (40~220)
      - intensity: 강도 (0~1, 값이 클수록 더 뜨거운 영역)
      - label: 한글 짧은 설명
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {inlineData: {data: normalized.data, mimeType: normalized.mimeType}},
          {text: prompt},
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sunlight_exposure: {
              type: Type.OBJECT,
              properties: {
                morning: {type: Type.STRING},
                afternoon: {type: Type.STRING},
                overall_rating: {type: Type.STRING},
              },
              required: ['morning', 'afternoon', 'overall_rating'],
            },
            thermal_efficiency: {
              type: Type.OBJECT,
              properties: {
                summer_heat_gain: {type: Type.STRING},
                winter_heat_loss: {type: Type.STRING},
                details: {type: Type.STRING},
              },
              required: ['summer_heat_gain', 'winter_heat_loss', 'details'],
            },
            window_analysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  location: {type: Type.STRING},
                  size_estimate: {type: Type.STRING},
                  orientation: {type: Type.STRING},
                  impact: {type: Type.STRING},
                },
                required: ['location', 'size_estimate', 'orientation', 'impact'],
              },
            },
            estimated_cost_impact: {
              type: Type.OBJECT,
              properties: {
                summer_cooling: {type: Type.STRING},
                winter_heating: {type: Type.STRING},
              },
              required: ['summer_cooling', 'winter_heating'],
            },
            recommendations: {
              type: Type.ARRAY,
              items: {type: Type.STRING},
            },
            heatmap_regions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: {type: Type.STRING},
                  x: {type: Type.NUMBER},
                  y: {type: Type.NUMBER},
                  radius: {type: Type.NUMBER},
                  intensity: {type: Type.NUMBER},
                },
                required: ['label', 'x', 'y', 'radius', 'intensity'],
              },
            },
          },
          required: [
            'sunlight_exposure',
            'thermal_efficiency',
            'window_analysis',
            'estimated_cost_impact',
            'recommendations',
            'heatmap_regions',
          ],
        },
      },
    });

    const text = response.text || '{}';
    const data = parseModelJson(text);
    return res.json(data);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Thermal analysis failed.';
    return res.status(500).json({error: message});
  }
});

app.post('/api/fire', async (req, res) => {
  try {
    const {imageData, mimeType} = req.body ?? {};
    if (typeof imageData !== 'string') {
      return res.status(400).json({error: 'imageData is required.'});
    }

    const ai = getAiClient();
    const normalized = await normalizeImageData(imageData, mimeType);
    const prompt = `
      [도면 분석 미션: 화재 확산 경로 예측 및 대피로 제안]
      첨부된 도면을 보고 벽체 재질/구획과 환기 시스템을 분석해 화재 시 연기 확산 특성을 평가해줘.
      출력 언어는 반드시 한국어만 사용해줘.
      반드시 아래 JSON 스키마 형식으로만 답변해줘.

      [분석 항목]
      1. fire_risk_level: 전체 화재 위험도 (낮음/보통/높음)
      2. wall_material_assessment: 구역별 벽체 재질과 내화 성능, 위험 노트
      3. ventilation_assessment: 배연 설비 유무, 압력 구역, 확산 요인
      4. smoke_spread: 연기 확산 속도(m/s), 주요 확산 방향, 시간대별 영향 구역
      5. evacuation_routes: 후보 대피 경로와 예상 대피 시간, 안전 점수
      6. safest_route: 최적 대피 경로와 이유, 단계별 대피 절차
      7. recommendations: 개선 권장 사항
      8. route_points: 도면 오버레이용 경로 좌표

      [route_points 규칙]
      - x, y: 도면 좌상단 기준 백분율 좌표 (0~100)
      - status: 반드시 "안전" 또는 "주의" 또는 "위험"
      - label: 한글 짧은 태그 (예: 출발, 계단실, 외부출구)
      - note: 1문장 설명
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {inlineData: {data: normalized.data, mimeType: normalized.mimeType}},
          {text: prompt},
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fire_risk_level: {type: Type.STRING},
            wall_material_assessment: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  zone: {type: Type.STRING},
                  material: {type: Type.STRING},
                  fire_resistance: {type: Type.STRING},
                  risk_note: {type: Type.STRING},
                },
                required: ['zone', 'material', 'fire_resistance', 'risk_note'],
              },
            },
            ventilation_assessment: {
              type: Type.OBJECT,
              properties: {
                smoke_exhaust_present: {type: Type.BOOLEAN},
                pressure_zones: {type: Type.STRING},
                spread_factor: {type: Type.STRING},
                detail: {type: Type.STRING},
              },
              required: ['smoke_exhaust_present', 'pressure_zones', 'spread_factor', 'detail'],
            },
            smoke_spread: {
              type: Type.OBJECT,
              properties: {
                predicted_speed_mps: {type: Type.NUMBER},
                major_direction: {type: Type.STRING},
                timeline: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      minute: {type: Type.NUMBER},
                      affected_zones: {type: Type.STRING},
                    },
                    required: ['minute', 'affected_zones'],
                  },
                },
              },
              required: ['predicted_speed_mps', 'major_direction', 'timeline'],
            },
            evacuation_routes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {type: Type.STRING},
                  path: {type: Type.STRING},
                  estimated_time_sec: {type: Type.NUMBER},
                  safety_score: {type: Type.NUMBER},
                  bottleneck: {type: Type.STRING},
                },
                required: ['name', 'path', 'estimated_time_sec', 'safety_score', 'bottleneck'],
              },
            },
            safest_route: {
              type: Type.OBJECT,
              properties: {
                name: {type: Type.STRING},
                reason: {type: Type.STRING},
                step_by_step: {
                  type: Type.ARRAY,
                  items: {type: Type.STRING},
                },
              },
              required: ['name', 'reason', 'step_by_step'],
            },
            recommendations: {
              type: Type.ARRAY,
              items: {type: Type.STRING},
            },
            route_points: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  route_name: {type: Type.STRING},
                  label: {type: Type.STRING},
                  status: {type: Type.STRING},
                  x: {type: Type.NUMBER},
                  y: {type: Type.NUMBER},
                  note: {type: Type.STRING},
                },
                required: ['route_name', 'label', 'status', 'x', 'y', 'note'],
              },
            },
          },
          required: [
            'fire_risk_level',
            'wall_material_assessment',
            'ventilation_assessment',
            'smoke_spread',
            'evacuation_routes',
            'safest_route',
            'recommendations',
            'route_points',
          ],
        },
      },
    });

    const text = response.text || '{}';
    let data: unknown;
    try {
      data = parseModelJson(text);
    } catch {
      data = {
        fire_risk_level: '보통',
        wall_material_assessment: [],
        ventilation_assessment: {
          smoke_exhaust_present: false,
          pressure_zones: '정보 없음',
          spread_factor: '정보 없음',
          detail: text || '환기 정보 분석 실패',
        },
        smoke_spread: {
          predicted_speed_mps: 0.8,
          major_direction: '정보 없음',
          timeline: [
            {minute: 2, affected_zones: '발화 구역 주변'},
            {minute: 5, affected_zones: '중앙 복도'},
            {minute: 8, affected_zones: '계단실 접근 구간'},
          ],
        },
        evacuation_routes: [],
        safest_route: {
          name: '기본 대피 경로',
          reason: '상세 데이터 부족으로 기본 경로를 제안',
          step_by_step: ['가장 가까운 비상통로 확인', '계단을 통해 하향 대피', '외부 안전지대로 이동'],
        },
        recommendations: [],
        route_points: [],
      };
    }

    return res.json(data);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Fire safety analysis failed.';
    return res.status(500).json({error: message});
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const {message, history, imageData} = req.body ?? {
      message: '',
      history: [],
    };

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({error: 'message is required.'});
    }

    const ai = getAiClient();
    const historyItems = Array.isArray(history) ? (history as ChatHistoryItem[]) : [];
    const historyText = buildHistoryText(historyItems);

    const prompt = `
      You are ArchAgent, a professional architectural design AI.
      You help architects and designers verify plans against regulations (like ADA or local accessibility laws) and suggest improvements.
      Be helpful, precise, and technical.

      Conversation so far:
      ${historyText || '(no previous messages)'}

      User: ${message}
      Assistant:
    `;

    const parts: Array<{text?: string; inlineData?: {data: string; mimeType: string}}> = [];

    if (imageData && typeof imageData === 'object' && typeof (imageData as ChatImage).data === 'string') {
      const normalized = await normalizeImageData(
        (imageData as ChatImage).data,
        (imageData as ChatImage).mimeType || 'image/png',
      );
      parts.push({inlineData: {data: normalized.data, mimeType: normalized.mimeType}});
    }
    parts.push({text: prompt});

    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {parts},
    });

    return res.json({response: response.text || ''});
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Chat failed.';
    return res.status(500).json({error: message});
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // For missing static assets (js/css/png/etc), return 404 instead of index.html.
  // This avoids MIME errors like "module script but server responded with text/html".
  if (req.path.startsWith('/assets/') || path.extname(req.path)) {
    return res.status(404).send('Not found');
  }

  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(indexPath);
  }

  return res.status(200).send('Server is running. Build frontend with "npm run build" to serve the app UI.');
});

app.listen(port, () => {
  console.log(`ArchAgent server listening on http://localhost:${port}`);
});
