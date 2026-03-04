export const ANALYSIS_TASK_TYPES = ['general', 'wheelchair', 'thermal', 'fire'] as const;

export type AnalysisTaskType = (typeof ANALYSIS_TASK_TYPES)[number];

export type AnalysisTaskStatus = 'queued' | 'running' | 'completed' | 'failed';
export type AnalysisOverallStatus =
  | 'queued'
  | 'running'
  | 'partial_completed'
  | 'completed'
  | 'failed';

export type AnalysisTaskSnapshot = {
  status: AnalysisTaskStatus;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  result: unknown | null;
};

export type AnalysisJobSnapshot = {
  jobId: string;
  overallStatus: AnalysisOverallStatus;
  createdAt: string;
  updatedAt: string;
  tasks: Record<AnalysisTaskType, AnalysisTaskSnapshot>;
};

export type AnalysisQueueJobData = {
  jobId: string;
  analysisType: AnalysisTaskType;
  imageData: string;
  mimeType?: string;
};
