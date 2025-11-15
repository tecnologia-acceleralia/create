import { apiClient } from './api';

export type Project = {
  id: number;
  name: string;
  summary?: string | null;
  problem?: string | null;
  solution?: string | null;
  status: 'draft' | 'active' | 'completed';
  logo_url?: string | null;
  repository_url?: string | null;
  pitch_url?: string | null;
};

export type ProjectMember = {
  id: number;
  user_id: number;
  status: 'active' | 'pending' | 'invited';
  role: 'captain' | 'member' | 'evaluator';
  user?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
};

export type ProjectCard = {
  id: number;
  event_id: number;
  team_id: number;
  title: string;
  summary?: string | null;
  description?: string | null;
  requirements?: string | null;
  image_url?: string | null;
  status: 'draft' | 'active' | 'completed';
  team_status?: 'open' | 'closed' | null;
  team_name?: string | null;
  members_count: number;
  remaining_slots: number | null;
  max_team_size: number | null;
  can_join: boolean;
  is_member: boolean;
  is_pending_member: boolean;
  is_captain: boolean;
  captain: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  members: ProjectMember[];
};

export async function getProject(projectId: number) {
  const response = await apiClient.get(`/projects/${projectId}`);
  return response.data.data as Project;
}

export async function updateProject(projectId: number, payload: Partial<Project>) {
  const response = await apiClient.put(`/projects/${projectId}`, payload);
  return response.data.data as Project;
}

export async function getProjectsByEvent(eventId: number) {
  const response = await apiClient.get(`/projects/events/${eventId}`);
  return response.data.data as ProjectCard[];
}

export async function createProjectForEvent(
  eventId: number,
  payload: {
    title: string;
    description?: string;
    image_url?: string;
    requirements?: string;
    team_name?: string;
  }
) {
  const response = await apiClient.post(`/projects/events/${eventId}`, payload);
  return response.data.data as ProjectCard;
}

export async function joinProject(projectId: number) {
  const response = await apiClient.post(`/projects/${projectId}/join`, {});
  return response.data.data as ProjectCard;
}
