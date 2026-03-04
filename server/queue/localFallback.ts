import {
  runFireAnalysis,
  runGeneralAnalysis,
  runThermalAnalysis,
  runWheelchairAnalysis,
} from '../services/analyzers';
import {
  ANALYSIS_TASK_TYPES,
  type AnalysisJobSnapshot,
  type AnalysisTaskSnapshot,
  type AnalysisTaskType,
} from './types';

type DedupeEntry = {
  jobId: string;
  expiresAt: number;
};

const jobs = new Map<string, AnalysisJobSnapshot>();
const dedupeMap = new Map<string, DedupeEntry>();

const jobTtlMs = Number(process.env.ANALYSIS_JOB_RESULT_TTL_SEC || 60 * 60 * 24) * 1000;
const dedupeTtlMs = Number(process.env.ANALYSIS_DEDUPE_TTL_SEC || 60 * 10) * 1000;

function nowIso(): string {
  return new Date().toISOString();
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

function computeOverallStatus(tasks: AnalysisJobSnapshot['tasks']): AnalysisJobSnapshot['overallStatus'] {
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

function touchJob(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.updatedAt = nowIso();
  job.overallStatus = computeOverallStatus(job.tasks);
}

function updateTask(
  jobId: string,
  analysisType: AnalysisTaskType,
  patch: Partial<AnalysisTaskSnapshot>,
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.tasks[analysisType] = {
    ...job.tasks[analysisType],
    ...patch,
  };
  touchJob(jobId);
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [hash, entry] of dedupeMap.entries()) {
    if (entry.expiresAt <= now) {
      dedupeMap.delete(hash);
    }
  }
  for (const [jobId, snapshot] of jobs.entries()) {
    const updatedAt = new Date(snapshot.updatedAt).getTime();
    if (Number.isFinite(updatedAt) && now - updatedAt > jobTtlMs) {
      jobs.delete(jobId);
    }
  }
}

function toUserError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '분석 작업 처리 중 오류가 발생했습니다.';
}

async function runTask(
  jobId: string,
  analysisType: AnalysisTaskType,
  imageData: string,
  mimeType?: string,
): Promise<void> {
  updateTask(jobId, analysisType, {
    status: 'running',
    startedAt: nowIso(),
    finishedAt: null,
    error: null,
  });

  try {
    let result: unknown;
    if (analysisType === 'general') {
      result = await runGeneralAnalysis(imageData, mimeType);
    } else if (analysisType === 'wheelchair') {
      result = await runWheelchairAnalysis(imageData, mimeType);
    } else if (analysisType === 'thermal') {
      result = await runThermalAnalysis(imageData, mimeType);
    } else {
      result = await runFireAnalysis(imageData, mimeType);
    }

    updateTask(jobId, analysisType, {
      status: 'completed',
      finishedAt: nowIso(),
      error: null,
      result,
    });
  } catch (error) {
    updateTask(jobId, analysisType, {
      status: 'failed',
      finishedAt: nowIso(),
      error: toUserError(error),
    });
  }
}

export function createLocalJobSnapshot(jobId: string): void {
  cleanupExpiredEntries();
  const now = nowIso();
  const tasks = ANALYSIS_TASK_TYPES.reduce((acc, analysisType) => {
    acc[analysisType] = blankTask();
    return acc;
  }, {} as AnalysisJobSnapshot['tasks']);

  jobs.set(jobId, {
    jobId,
    overallStatus: 'queued',
    createdAt: now,
    updatedAt: now,
    tasks,
  });
}

export function enqueueLocalAnalysisTasks(
  jobId: string,
  imageData: string,
  mimeType?: string,
): void {
  for (const analysisType of ANALYSIS_TASK_TYPES) {
    void runTask(jobId, analysisType, imageData, mimeType);
  }
}

export function getLocalJobSnapshot(jobId: string): AnalysisJobSnapshot | null {
  cleanupExpiredEntries();
  const snapshot = jobs.get(jobId);
  if (!snapshot) return null;
  return {
    ...snapshot,
    tasks: {
      general: {...snapshot.tasks.general},
      wheelchair: {...snapshot.tasks.wheelchair},
      thermal: {...snapshot.tasks.thermal},
      fire: {...snapshot.tasks.fire},
    },
  };
}

export function findLocalDedupeJobId(hash: string): string | null {
  cleanupExpiredEntries();
  const entry = dedupeMap.get(hash);
  if (!entry) return null;
  return entry.jobId;
}

export function saveLocalDedupeJobId(hash: string, jobId: string): void {
  cleanupExpiredEntries();
  dedupeMap.set(hash, {
    jobId,
    expiresAt: Date.now() + dedupeTtlMs,
  });
}
