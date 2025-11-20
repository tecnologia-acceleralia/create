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
  has_final_evaluation?: boolean;
  has_pending_evaluation?: boolean;
  final_evaluation_id?: number | null;
  team?: {
    id: number;
    name: string;
    project?: {
      id: number;
      name: string;
      summary?: string;
      problem?: string;
      solution?: string;
      repository_url?: string;
      pitch_url?: string;
      logo_url?: string;
    } | null;
  };
};

export type Evaluation = {
  id: number;
  submission_id: number;
  score?: number;
  comment?: string;
  created_at: string;
  source: 'manual' | 'ai_assisted';
  status?: 'draft' | 'final';
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

export async function getSubmission(submissionId: number) {
  const response = await apiClient.get(`/submissions/${submissionId}`);
  return response.data.data as Submission;
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
  payload: { score?: number; comment?: string; source?: 'manual' | 'ai_assisted'; status?: 'draft' | 'final'; rubric_snapshot?: unknown; metadata?: unknown }
) {
  const response = await apiClient.post(`/submissions/${submissionId}/evaluations`, payload);
  return response.data.data as Evaluation;
}

export async function createAiEvaluation(submissionId: number, payload: { locale?: string; status?: 'draft' | 'final' }) {
  const response = await apiClient.post(`/submissions/${submissionId}/evaluations/ai`, payload);
  return response.data.data as Evaluation;
}

export async function updateEvaluation(
  submissionId: number,
  evaluationId: number,
  payload: { score?: number; comment?: string; status?: 'draft' | 'final'; rubric_snapshot?: unknown; metadata?: unknown }
) {
  const response = await apiClient.put(`/submissions/${submissionId}/evaluations/${evaluationId}`, payload);
  return response.data.data as Evaluation;
}

export async function getFinalEvaluation(submissionId: number) {
  const response = await apiClient.get(`/submissions/${submissionId}/evaluation/final`);
  return response.data.data as Evaluation;
}

// Evaluaciones de fase
export type PhaseEvaluation = Evaluation & {
  evaluation_scope: 'phase';
  phase_id: number;
  team_id: number;
  evaluated_submission_ids: number[];
};

export async function getPhaseEvaluations(phaseId: number, teamId: number) {
  const response = await apiClient.get(`/phases/${phaseId}/teams/${teamId}/evaluations`);
  return response.data.data as PhaseEvaluation[];
}

export async function createPhaseEvaluation(
  phaseId: number,
  teamId: number,
  payload: {
    submission_ids: number[];
    score?: number;
    comment: string;
    source?: 'manual' | 'ai_assisted';
    status?: 'draft' | 'final';
    rubric_snapshot?: unknown;
    metadata?: unknown;
  }
) {
  const response = await apiClient.post(`/phases/${phaseId}/teams/${teamId}/evaluations`, payload);
  return response.data.data as PhaseEvaluation;
}

export async function createPhaseAiEvaluation(
  phaseId: number,
  teamId: number,
  payload: {
    submission_ids: number[];
    locale?: string;
    status?: 'draft' | 'final';
  }
) {
  const response = await apiClient.post(`/phases/${phaseId}/teams/${teamId}/evaluations/ai`, payload);
  return response.data.data as PhaseEvaluation;
}

