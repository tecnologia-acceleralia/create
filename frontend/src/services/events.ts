import { apiClient } from './api';

export type Event = {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  min_team_size: number;
  max_team_size: number;
  status: 'draft' | 'published' | 'archived';
};

export type Phase = {
  id: number;
  name: string;
  description?: string;
  order_index: number;
  is_elimination: boolean;
  start_date?: string;
  end_date?: string;
};

export type Task = {
  id: number;
  title: string;
  description?: string;
  delivery_type: string;
  is_required: boolean;
  due_date?: string;
  status: 'draft' | 'active' | 'closed';
  phase_id: number;
};

export async function getEvents() {
  const response = await apiClient.get('/events');
  return response.data.data as Event[];
}

export async function createEvent(payload: Partial<Event>) {
  const response = await apiClient.post('/events', payload);
  return response.data.data as Event;
}

export async function updateEvent(eventId: number, payload: Partial<Event>) {
  const response = await apiClient.put(`/events/${eventId}`, payload);
  return response.data.data as Event;
}

export async function archiveEvent(eventId: number) {
  await apiClient.delete(`/events/${eventId}`);
}

export async function getEventDetail(eventId: number) {
  const response = await apiClient.get(`/events/${eventId}`);
  return response.data.data as Event & { phases: Phase[]; tasks: Task[] };
}

export async function createPhase(eventId: number, payload: Partial<Phase>) {
  const response = await apiClient.post(`/events/${eventId}/phases`, payload);
  return response.data.data as Phase;
}

export async function updatePhase(eventId: number, phaseId: number, payload: Partial<Phase>) {
  const response = await apiClient.put(`/events/${eventId}/phases/${phaseId}`, payload);
  return response.data.data as Phase;
}

export async function deletePhase(eventId: number, phaseId: number) {
  await apiClient.delete(`/events/${eventId}/phases/${phaseId}`);
}

export async function createTask(eventId: number, payload: Partial<Task>) {
  const response = await apiClient.post(`/events/${eventId}/tasks`, payload);
  return response.data.data as Task;
}

export async function updateTask(eventId: number, taskId: number, payload: Partial<Task>) {
  const response = await apiClient.put(`/events/${eventId}/tasks/${taskId}`, payload);
  return response.data.data as Task;
}

export async function deleteTask(eventId: number, taskId: number) {
  await apiClient.delete(`/events/${eventId}/tasks/${taskId}`);
}

