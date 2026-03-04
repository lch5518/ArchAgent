import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {
  runChat,
  runFireAnalysis,
  runGeneralAnalysis,
  runThermalAnalysis,
  runWheelchairAnalysis,
  type ChatHistoryItem,
  type ChatImage,
} from './services/analyzers';
import {
  enqueueAnalysisTasks,
  findDedupeJobId,
  makeDedupeHash,
  saveDedupeJobId,
} from './queue/analysisQueue';
import {ensureRedisAvailable} from './queue/redis';
import {
  createJobSnapshot,
  getJobSnapshot,
  markTaskFailed,
} from './queue/jobStore';
import {ANALYSIS_TASK_TYPES} from './queue/types';

dotenv.config({path: '.env.local'});
dotenv.config();

const app = express();
const port =
  Number(process.env.API_PORT) ||
  (process.env.NODE_ENV === 'production' ? Number(process.env.PORT) : 8787);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');

app.use(express.json({limit: '25mb'}));

app.get('/api/health', (_req, res) => {
  res.json({ok: true});
});

app.post('/api/jobs/analyze-all', async (req, res) => {
  try {
    const {imageData, mimeType} = req.body ?? {};
    if (typeof imageData !== 'string') {
      return res.status(400).json({error: 'imageData is required.'});
    }

    try {
      await ensureRedisAvailable();
    } catch {
      return res.status(503).json({error: '분석 대기열에 연결할 수 없습니다. Redis 상태를 확인해 주세요.'});
    }

    const dedupeHash = makeDedupeHash(imageData, mimeType);
    const dedupedJobId = await findDedupeJobId(dedupeHash);
    if (dedupedJobId) {
      const existing = await getJobSnapshot(dedupedJobId);
      if (existing) {
        return res.status(202).json({
          jobId: dedupedJobId,
          status: 'queued',
          analysisKeys: ANALYSIS_TASK_TYPES,
          pollUrl: `/api/jobs/${dedupedJobId}`,
        });
      }
    }

    const jobId = randomUUID();
    await createJobSnapshot(jobId);

    try {
      await enqueueAnalysisTasks(jobId, imageData, mimeType);
      await saveDedupeJobId(dedupeHash, jobId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '분석 작업을 대기열에 등록하지 못했습니다.';
      await Promise.all(
        ANALYSIS_TASK_TYPES.map((analysisType) =>
          markTaskFailed(jobId, analysisType, message),
        ),
      );
      return res.status(500).json({error: message});
    }

    return res.status(202).json({
      jobId,
      status: 'queued',
      analysisKeys: ANALYSIS_TASK_TYPES,
      pollUrl: `/api/jobs/${jobId}`,
    });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : 'Analyze-all job creation failed.';
    return res.status(500).json({error: message});
  }
});

app.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const {jobId} = req.params;
    const snapshot = await getJobSnapshot(jobId);
    if (!snapshot) {
      return res.status(404).json({error: '작업을 찾을 수 없습니다.'});
    }
    return res.json(snapshot);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : 'Job lookup failed.';
    return res.status(500).json({error: message});
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const {imageData, mimeType} = req.body ?? {};
    if (typeof imageData !== 'string') {
      return res.status(400).json({error: 'imageData is required.'});
    }

    const analysis = await runGeneralAnalysis(imageData, mimeType);
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

    const data = await runWheelchairAnalysis(imageData, mimeType);
    return res.json(data);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : 'Wheelchair analysis failed.';
    return res.status(500).json({error: message});
  }
});

app.post('/api/thermal', async (req, res) => {
  try {
    const {imageData, mimeType} = req.body ?? {};
    if (typeof imageData !== 'string') {
      return res.status(400).json({error: 'imageData is required.'});
    }

    const data = await runThermalAnalysis(imageData, mimeType);
    return res.json(data);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : 'Thermal analysis failed.';
    return res.status(500).json({error: message});
  }
});

app.post('/api/fire', async (req, res) => {
  try {
    const {imageData, mimeType} = req.body ?? {};
    if (typeof imageData !== 'string') {
      return res.status(400).json({error: 'imageData is required.'});
    }

    const data = await runFireAnalysis(imageData, mimeType);
    return res.json(data);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : 'Fire safety analysis failed.';
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

    const historyItems = Array.isArray(history) ? (history as ChatHistoryItem[]) : [];
    const chatImage =
      imageData && typeof imageData === 'object'
        ? (imageData as ChatImage)
        : undefined;

    const response = await runChat(message, historyItems, chatImage);
    return res.json({response});
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

  if (req.path.startsWith('/assets/') || path.extname(req.path)) {
    return res.status(404).send('Not found');
  }

  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(indexPath);
  }

  return res
    .status(200)
    .send('Server is running. Build frontend with "npm run build" to serve the app UI.');
});

app.listen(port, () => {
  console.log(`ArchAgent server listening on http://localhost:${port}`);
});
