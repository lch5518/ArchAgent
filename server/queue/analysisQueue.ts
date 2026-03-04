import {createHash} from 'node:crypto';
import {Queue} from 'bullmq';
import {bullmqConnection, redis} from './redis';
import {ANALYSIS_TASK_TYPES, type AnalysisQueueJobData} from './types';

export const ANALYSIS_QUEUE_NAME = 'archagent-analysis';
const dedupePrefix = 'archagent:dedupe';

const attempts = Number(process.env.ANALYSIS_JOB_ATTEMPTS || 3);
const backoffDelay = Number(process.env.ANALYSIS_JOB_BACKOFF_MS || 1000);
const dedupeTtlSec = Number(process.env.ANALYSIS_DEDUPE_TTL_SEC || 60 * 10);

export const analysisQueue = new Queue<AnalysisQueueJobData>(ANALYSIS_QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    attempts,
    backoff: {
      type: 'exponential',
      delay: backoffDelay,
    },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});

function dedupeKey(hash: string): string {
  return `${dedupePrefix}:${hash}`;
}

export function makeDedupeHash(imageData: string, mimeType?: string): string {
  return createHash('sha256')
    .update(mimeType || '')
    .update(':')
    .update(imageData)
    .digest('hex');
}

export async function findDedupeJobId(hash: string): Promise<string | null> {
  return redis.get(dedupeKey(hash));
}

export async function saveDedupeJobId(hash: string, jobId: string): Promise<void> {
  await redis.set(dedupeKey(hash), jobId, 'EX', dedupeTtlSec);
}

export async function enqueueAnalysisTasks(
  jobId: string,
  imageData: string,
  mimeType?: string,
): Promise<void> {
  await Promise.all(
    ANALYSIS_TASK_TYPES.map((analysisType) =>
      analysisQueue.add(
        'analysis',
        {
          jobId,
          analysisType,
          imageData,
          mimeType,
        },
        {jobId: `${jobId}:${analysisType}`},
      ),
    ),
  );
}
