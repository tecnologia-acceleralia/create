import { apiClient } from './api';

export type SubmissionFile = {
  id: number;
  url: string;
  mime_type: string;
  size_bytes: number;
  original_name: string;
};

export type Submission = {
  id: number;
  task_id: number;
  team_id: number;
  status: 'draft' | 'final';
  type: 'provisional' | 'final';
  content?: string;
  attachment_url?: string;
  submitted_at: string;
  files: SubmissionFile[];
};

export type Evaluation = {
  id: number;
  submission_id: number;
  score?: number;
  comment?: string;
  created_at: string;
  source: 'manual' | 'ai_assisted';
  metadata?: {
    criteria?: Array<{
      criterionId?: number;
      score?: number;
      feedback?: string;
    }>;
    usage?: Record<string, unknown>;
    raw?: unknown;
  };
  rubric_snapshot?: {
    id: number;
    name: string;
    description?: string;
    scaleMin?: number;
    scaleMax?: number;
    criteria?: Array<{
      id: number;
      title: string;
      description?: string;
      weight?: number;
      maxScore?: number | null;
    }>;
  } | null;
};

type SubmissionFilePayload = {
  base64: string;
  name?: string;
};

export async function getSubmissions(taskId: number) {
  const response = await apiClient.get(`/tasks/${taskId}/submissions`);
  return response.data.data as Submission[];
}

export async function createSubmission(
  taskId: number,
  payload: {
    content?: string;
    attachment_url?: string;
    status?: 'draft' | 'final';
    type?: 'provisional' | 'final';
    team_id?: number;
    files?: SubmissionFilePayload[];
  }
) {
  const response = await apiClient.post(`/tasks/${taskId}/submissions`, payload);
  return response.data.data as Submission;
}

export async function getEvaluations(submissionId: number) {
  const response = await apiClient.get(`/submissions/${submissionId}/evaluations`);
  return response.data.data as Evaluation[];
}

export async function createEvaluation(
  submissionId: number,
  payload: { score?: number; comment?: string; source?: 'manual' | 'ai_assisted'; rubric_snapshot?: unknown; metadata?: unknown }
) {
  const response = await apiClient.post(`/submissions/${submissionId}/evaluations`, payload);
  return response.data.data as Evaluation;
}

export async function createAiEvaluation(submissionId: number, payload: { locale?: string }) {
  const response = await apiClient.post(`/submissions/${submissionId}/evaluations/ai`, payload);
  return response.data.data as Evaluation;
}

