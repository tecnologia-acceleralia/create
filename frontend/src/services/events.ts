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
  video_url?: string | null;
  is_public: boolean;
  allow_open_registration: boolean;
  publish_start_at?: string | null;
  publish_end_at?: string | null;
};

export type Phase = {
  id: number;
  name: string;
  description?: string;
  order_index: number;
  is_elimination: boolean;
  start_date?: string;
  end_date?: string;
  view_start_date?: string | null;
  view_end_date?: string | null;
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
  phase_rubric_id?: number | null;
  max_files?: number;
  max_file_size_mb?: number | null;
  allowed_mime_types?: string[] | null;
};

export type RubricCriterion = {
  id: number;
  title: string;
  description?: string | null;
  weight: number;
  max_score?: number | null;
  order_index: number;
};

export type PhaseRubric = {
  id: number;
  name: string;
  description?: string | null;
  event_id: number;
  phase_id: number;
  scale_min: number;
  scale_max: number;
  model_preference?: string | null;
  criteria: RubricCriterion[];
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
  return response.data.data as Event & { phases: Phase[]; tasks: Task[]; rubrics: PhaseRubric[] };
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

export type RubricPayload = {
  name: string;
  description?: string;
  scale_min?: number;
  scale_max?: number;
  model_preference?: string;
  criteria: Array<{
    title: string;
    description?: string;
    weight?: number;
    max_score?: number | null;
    order_index?: number;
  }>;
};

export async function getRubrics(eventId: number, phaseId: number) {
  const response = await apiClient.get(`/events/${eventId}/phases/${phaseId}/rubrics`);
  return response.data.data as PhaseRubric[];
}

export async function createRubric(eventId: number, phaseId: number, payload: RubricPayload) {
  const response = await apiClient.post(`/events/${eventId}/phases/${phaseId}/rubrics`, payload);
  return response.data.data as PhaseRubric;
}

export async function updateRubric(eventId: number, phaseId: number, rubricId: number, payload: Partial<RubricPayload>) {
  const response = await apiClient.put(`/events/${eventId}/phases/${phaseId}/rubrics/${rubricId}`, payload);
  return response.data.data as PhaseRubric;
}

export async function deleteRubric(eventId: number, phaseId: number, rubricId: number) {
  await apiClient.delete(`/events/${eventId}/phases/${phaseId}/rubrics/${rubricId}`);
}

