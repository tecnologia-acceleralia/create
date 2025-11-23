import { apiClient } from './api';

export type TeamMember = {
  id: number;
  user_id: number;
  role: 'captain' | 'member' | 'evaluator';
  user?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
};

export type Team = {
  id: number;
  name: string;
  description?: string;
  status: 'open' | 'closed';
  event_id: number;
  captain_id: number;
  members: TeamMember[];
  project?: {
    id: number;
    name: string;
    summary?: string;
    status: 'active' | 'inactive';
    problem?: string;
    solution?: string;
    repository_url?: string;
    pitch_url?: string;
    logo_url?: string;
  } | null;
};

export type TeamMembership = {
  id: number;
  team_id: number;
  role: string;
  team: Team;
};

export async function getMyTeams() {
  const response = await apiClient.get('/teams/my');
  return response.data.data as TeamMembership[];
}

export async function createTeam(payload: {
  event_id: number;
  name: string;
  description?: string;
  requirements?: string;
}) {
  const response = await apiClient.post('/teams', payload);
  // La sesión se refrescará desde el componente que llama esta función
  return response.data.data as Team;
}

export async function addTeamMember(teamId: number, payload: { user_id?: number; user_email?: string; role?: string }) {
  const response = await apiClient.post(`/teams/${teamId}/members`, payload);
  return response.data.data as TeamMember;
}

export async function removeTeamMember(teamId: number, userId: number) {
  await apiClient.delete(`/teams/${teamId}/members/${userId}`);
}

export async function setCaptain(teamId: number, userId: number) {
  await apiClient.patch(`/teams/${teamId}/captain`, { user_id: userId });
  // La sesión se refrescará desde el componente que llama esta función
}

export async function getTeamsByEvent(eventId: number) {
  const response = await apiClient.get(`/teams/events/${eventId}`);
  return response.data.data as Team[];
}

export async function joinTeam(teamId: number) {
  const response = await apiClient.post(`/teams/${teamId}/join`);
  return response.data.data as { member: TeamMember; team: Team };
}

export async function leaveTeam(teamId: number) {
  await apiClient.post(`/teams/${teamId}/leave`);
  // La sesión se refrescará desde el componente que llama esta función
}

export type SubmissionSummary = {
  id: number;
  status: 'draft' | 'final';
  type: 'provisional' | 'final';
  submitted_at: string;
  content?: string;
  files_count: number;
  evaluations: Array<{
    id: number;
    score?: number;
    status?: 'draft' | 'final';
    created_at: string;
    language?: string;
    metadata?: {
      language?: string;
      [key: string]: unknown;
    };
  }>;
};

export type TaskSubmissionsSummary = {
  task_id: number;
  task_title: string | { es: string; ca?: string; en?: string };
  submissions: SubmissionSummary[];
};

export type PhaseEvaluationSummary = {
  id: number;
  score?: number;
  status?: 'draft' | 'final';
  comment?: string;
  created_at: string;
  language?: string;
  metadata?: {
    language?: string;
    [key: string]: unknown;
  };
};

export type PhaseSubmissionsSummary = {
  phase_id: number;
  phase_name: string | { es: string; ca?: string; en?: string };
  tasks: TaskSubmissionsSummary[];
  phase_evaluations: PhaseEvaluationSummary[];
};

export type ProjectEvaluationSummary = {
  id: number;
  score?: number;
  status?: 'draft' | 'final';
  comment?: string;
  created_at: string;
  language?: string;
  metadata?: {
    language?: string;
    [key: string]: unknown;
  };
} | null;

export type TeamSubmissionsAndEvaluationsSummary = {
  team_id: number;
  phases: PhaseSubmissionsSummary[];
  project_evaluation: ProjectEvaluationSummary;
};

export async function getTeamSubmissionsAndEvaluationsSummary(teamId: number) {
  const response = await apiClient.get(`/teams/${teamId}/submissions-evaluations-summary`);
  return response.data.data as TeamSubmissionsAndEvaluationsSummary;
}

