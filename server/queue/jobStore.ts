import {ANALYSIS_TASK_TYPES, type AnalysisJobSnapshot, type AnalysisTaskSnapshot, type AnalysisTaskType} from './types';
import {redis} from './redis';

const jobTtlSec = Number(process.env.ANALYSIS_JOB_RESULT_TTL_SEC || 60 * 60 * 24);
const prefix = 'archagent:job';

type JobMeta = {
  jobId: string;
  createdAt: string;
  updatedAt: string;
};

function metaKey(jobId: string): string {
  return `${prefix}:${jobId}:meta`;
}

function taskKey(jobId: string, analysisType: AnalysisTaskType): string {
  return `${prefix}:${jobId}:task:${analysisType}`;
}

function blankTask(): AnalysisTaskSnapshot {
  return {
    status: 'queued',
    startedAt: null,
    finishedAt: null,
    error: null,
    result: null,
  };
}

function parseTask(raw: string | null): AnalysisTaskSnapshot {
  if (!raw) return blankTask();
  try {
    const parsed = JSON.parse(raw) as Partial<AnalysisTaskSnapshot>;
    return {
      status: parsed.status || 'queued',
      startedAt: parsed.startedAt || null,
      finishedAt: parsed.finishedAt || null,
      error: parsed.error || null,
      result: parsed.result ?? null,
    };
  } catch {
    return blankTask();
  }
}

function parseMeta(raw: string | null): JobMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<JobMeta>;
    if (!parsed.jobId || !parsed.createdAt || !parsed.updatedAt) {
      return null;
    }
    return {
      jobId: parsed.jobId,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function computeOverallStatus(
  tasks: Record<AnalysisTaskType, AnalysisTaskSnapshot>,
): AnalysisJobSnapshot['overallStatus'] {
  const statuses = Object.values(tasks).map((task) => task.status);
  const hasQueued = statuses.includes('queued');
  const hasRunning = statuses.includes('running');
  const hasCompleted = statuses.includes('completed');
  const hasFailed = statuses.includes('failed');

  if (hasRunning) return 'running';
  if (hasQueued && !hasCompleted && !hasFailed) return 'queued';
  if (hasCompleted && !hasQueued && !hasFailed) return 'completed';
  if (hasFailed && !hasCompleted && !hasQueued) return 'failed';
  if (hasFailed && hasCompleted && !hasQueued) return 'partial_completed';
  if (hasQueued) return 'running';
  return 'running';
}

export async function createJobSnapshot(jobId: string): Promise<void> {
  const now = new Date().toISOString();
  const meta: JobMeta = {jobId, createdAt: now, updatedAt: now};
  const pipeline = redis.multi();
  pipeline.set(metaKey(jobId), JSON.stringify(meta), 'EX', jobTtlSec);
  for (const analysisType of ANALYSIS_TASK_TYPES) {
    pipeline.set(taskKey(jobId, analysisType), JSON.stringify(blankTask()), 'EX', jobTtlSec);
  }
  await pipeline.exec();
}

async function touchMeta(jobId: string): Promise<void> {
  const key = metaKey(jobId);
  const existing = parseMeta(await redis.get(key));
  if (!existing) return;
  existing.updatedAt = new Date().toISOString();
  await redis.set(key, JSON.stringify(existing), 'EX', jobTtlSec);
}

export async function updateTaskSnapshot(
  jobId: string,
  analysisType: AnalysisTaskType,
  patch: Partial<AnalysisTaskSnapshot>,
): Promise<void> {
  const key = taskKey(jobId, analysisType);
  const current = parseTask(await redis.get(key));
  const next: AnalysisTaskSnapshot = {
    ...current,
    ...patch,
  };
  await redis.set(key, JSON.stringify(next), 'EX', jobTtlSec);
  await touchMeta(jobId);
}

export async function markTaskQueued(jobId: string, analysisType: AnalysisTaskType): Promise<void> {
  await updateTaskSnapshot(jobId, analysisType, {
    status: 'queued',
    error: null,
  });
}

export async function markTaskRunning(jobId: string, analysisType: AnalysisTaskType): Promise<void> {
  await updateTaskSnapshot(jobId, analysisType, {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  });
}

export async function markTaskCompleted(
  jobId: string,
  analysisType: AnalysisTaskType,
  result: unknown,
): Promise<void> {
  await updateTaskSnapshot(jobId, analysisType, {
    status: 'completed',
    finishedAt: new Date().toISOString(),
    error: null,
    result,
  });
}

export async function markTaskFailed(
  jobId: string,
  analysisType: AnalysisTaskType,
  errorMessage: string,
): Promise<void> {
  await updateTaskSnapshot(jobId, analysisType, {
    status: 'failed',
    finishedAt: new Date().toISOString(),
    error: errorMessage,
  });
}

export async function getJobSnapshot(jobId: string): Promise<AnalysisJobSnapshot | null> {
  const [metaRaw, ...taskRaw] = await redis.mget([
    metaKey(jobId),
    ...ANALYSIS_TASK_TYPES.map((analysisType) => taskKey(jobId, analysisType)),
  ]);

  const meta = parseMeta(metaRaw);
  if (!meta) return null;

  const tasks = ANALYSIS_TASK_TYPES.reduce((acc, analysisType, index) => {
    acc[analysisType] = parseTask(taskRaw[index] ?? null);
    return acc;
  }, {} as Record<AnalysisTaskType, AnalysisTaskSnapshot>);

  return {
    jobId: meta.jobId,
    overallStatus: computeOverallStatus(tasks),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    tasks,
  };
}
