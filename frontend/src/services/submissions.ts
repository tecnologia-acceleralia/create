import { apiClient } from './api';

export type Submission = {
  id: number;
  task_id: number;
  team_id: number;
  status: 'draft' | 'final';
  type: 'provisional' | 'final';
  content?: string;
  attachment_url?: string;
  submitted_at: string;
};

export type Evaluation = {
  id: number;
  submission_id: number;
  score?: number;
  comment?: string;
  created_at: string;
};

export async function getSubmissions(taskId: number) {
  const response = await apiClient.get(`/tasks/${taskId}/submissions`);
  return response.data.data as Submission[];
}

export async function createSubmission(taskId: number, payload: { content?: string; attachment_url?: string; status?: 'draft' | 'final'; type?: 'provisional' | 'final'; team_id?: number }) {
  const response = await apiClient.post(`/tasks/${taskId}/submissions`, payload);
  return response.data.data as Submission;
}

export async function getEvaluations(submissionId: number) {
  const response = await apiClient.get(`/submissions/${submissionId}/evaluations`);
  return response.data.data as Evaluation[];
}

export async function createEvaluation(submissionId: number, payload: { score?: number; comment?: string }) {
  const response = await apiClient.post(`/submissions/${submissionId}/evaluations`, payload);
  return response.data.data as Evaluation;
}

