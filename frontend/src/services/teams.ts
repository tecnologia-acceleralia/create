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
    status: 'draft' | 'active' | 'completed';
    problem?: string;
    solution?: string;
    repository_url?: string;
    pitch_url?: string;
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
}

