import dotenv from 'dotenv';
import {Worker} from 'bullmq';
import {
  runFireAnalysis,
  runGeneralAnalysis,
  runThermalAnalysis,
  runWheelchairAnalysis,
} from './services/analyzers';
import {ANALYSIS_QUEUE_NAME} from './queue/analysisQueue';
import {bullmqConnection, redis} from './queue/redis';
import {
  markTaskCompleted,
  markTaskFailed,
  markTaskQueued,
  markTaskRunning,
} from './queue/jobStore';
import type {AnalysisQueueJobData} from './queue/types';

dotenv.config({path: '.env.local'});
dotenv.config();

const concurrency = Number(process.env.ANALYSIS_WORKER_CONCURRENCY || 2);

function toUserError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '분석 작업 처리 중 오류가 발생했습니다.';
}

const worker = new Worker<AnalysisQueueJobData>(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    const {analysisType, imageData, mimeType} = job.data;
    if (analysisType === 'general') {
      return runGeneralAnalysis(imageData, mimeType);
    }
    if (analysisType === 'wheelchair') {
      return runWheelchairAnalysis(imageData, mimeType);
    }
    if (analysisType === 'thermal') {
      return runThermalAnalysis(imageData, mimeType);
    }
    if (analysisType === 'fire') {
      return runFireAnalysis(imageData, mimeType);
    }
    throw new Error(`Unsupported analysis type: ${analysisType}`);
  },
  {
    connection: bullmqConnection,
    concurrency,
  },
);

worker.on('active', (job) => {
  void markTaskRunning(job.data.jobId, job.data.analysisType);
});

worker.on('completed', (job, result) => {
  void markTaskCompleted(job.data.jobId, job.data.analysisType, result);
});

worker.on('failed', (job, error) => {
  if (!job) return;
  const attempts = job.opts.attempts || 1;
  if (job.attemptsMade < attempts) {
    void markTaskQueued(job.data.jobId, job.data.analysisType);
    return;
  }
  void markTaskFailed(job.data.jobId, job.data.analysisType, toUserError(error));
});

worker.on('error', (error) => {
  console.error('[worker] fatal error', error);
});

const shutdown = async () => {
  await worker.close();
  await redis.quit();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

console.log(`[worker] listening queue=${ANALYSIS_QUEUE_NAME} concurrency=${concurrency}`);
