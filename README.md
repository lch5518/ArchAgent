# ArchAgent

ArchAgent는 건축 도면 이미지를 업로드하면 Gemini 기반으로 설계 검토를 수행하는 웹 애플리케이션입니다.

## 프로젝트 요약

- 도면 업로드 후 일반 설계 진단(접근성/동선/출입구/화장실 등) 제공
- 휠체어 접근성 분석(층별 진단 + 마커 좌표)
- 일조량/열효율 분석(창호 영향, 비용 영향, 히트맵 좌표)
- 화재 확산/대피 경로 분석(위험도, 경로 점수, 단계별 대피 가이드)
- 분석 결과 기반 대화형 채팅 지원

프론트엔드는 Vite + React + TypeScript, 백엔드는 Express + `@google/genai`로 구성되어 있습니다.
Gemini 분석 4종(일반/휠체어/일조/화재)은 Redis + BullMQ 큐로 비동기 처리됩니다.

## 사전 준비

1. Node.js 설치 (LTS 권장)
2. 환경 변수 파일 생성

```bash
cp .env.example .env.local
```

필수 값:

- `GEMINI_API_KEY`: Gemini API 키

주요 옵션:

- `API_PORT`: 로컬 백엔드 포트 (기본 `8787`)
- `VITE_API_PROXY_TARGET`: Vite 개발 서버의 `/api` 프록시 대상
- `VITE_API_BASE_URL`: 프론트/백엔드가 다른 오리진일 때 API 베이스 URL
- `REDIS_URL`: 분석 큐 Redis 연결 주소 (기본 `redis://127.0.0.1:6379`)

## 서버 실행 방법

### 1) Redis 실행 (필수)

```bash
docker compose up -d redis
```

### 2) 개발 모드 (프론트/백엔드/워커 분리 실행)

터미널 1:

```bash
npm install
npm run dev:server
```

터미널 2:

```bash
npm run dev:worker
```

터미널 3:

```bash
npm run dev
```

- 프론트엔드: `http://localhost:8080`
- 백엔드 API: `http://localhost:8787` (또는 `API_PORT`)
- 워커: Redis 큐에서 분석 작업 소비
- 개발 환경에서 프론트엔드 `/api` 요청은 백엔드로 프록시됩니다.

한 번에 실행:

```bash
npm run dev:all
```

### 2) 단일 서버 실행 (배포 유사 방식)

터미널 1:

```bash
npm run start
```

터미널 2:

```bash
npm run start:worker
```

또는 한 번에 실행:

```bash
npm run start:all
```

`npm run start`는 아래를 순서대로 실행합니다.

1. `npm run build`로 프론트엔드 빌드
2. Express 서버 실행 (`dist/` 정적 파일 + `/api/*`)

접속 주소:

- `http://localhost:8787` (기본)
- `API_PORT`가 설정되어 있으면 해당 포트 사용
- `NODE_ENV=production`이면 `PORT` 우선 사용

## 자주 쓰는 명령어

```bash
npm run dev         # 프론트엔드 개발 서버
npm run dev:server  # 백엔드 개발 서버
npm run dev:worker  # 분석 큐 워커
npm run dev:all     # 백엔드+워커 동시 실행
npm run start       # 프로덕션 스타일 API 서버
npm run start:worker # 프로덕션 스타일 워커
npm run start:all   # API 서버+워커 동시 실행
npm run build       # 프론트엔드 빌드
npm run preview     # 빌드 결과 미리보기
npm run lint        # 타입 체크(tsc --noEmit)
```

권장 점검:

```bash
npm run lint && npm run build
```
