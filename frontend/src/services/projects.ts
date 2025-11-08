import { apiClient } from './api';

export type Project = {
  id: number;
  name: string;
  summary?: string;
  problem?: string;
  solution?: string;
  status: 'draft' | 'active' | 'completed';
  logo_url?: string;
  repository_url?: string;
  pitch_url?: string;
};

export async function getProject(projectId: number) {
  const response = await apiClient.get(`/projects/${projectId}`);
  return response.data.data as Project;
}

export async function updateProject(projectId: number, payload: Partial<Project>) {
  const response = await apiClient.put(`/projects/${projectId}`, payload);
  return response.data.data as Project;
}

