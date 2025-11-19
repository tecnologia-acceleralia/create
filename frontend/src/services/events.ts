import { apiClient } from './api';
import type { RegistrationSchema } from './public';

export type Event = {
  id: number;
  name: string;
  description?: string;
  description_html?: string | null;
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
  registration_schema?: RegistrationSchema | null;
  is_registered?: boolean;
  registration_status?: string | null;
  has_team?: boolean;
  team_id?: number | null;
  team_name?: string | null;
  team_role?: 'captain' | 'member' | 'evaluator' | null;
};

export type Phase = {
  id: number;
  name: string;
  description?: string;
  intro_html?: string | null;
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
  intro_html?: string | null;
  order_index?: number | null;
  delivery_type: string;
  is_required: boolean;
  due_date?: string;
  status: 'draft' | 'active' | 'closed';
  phase_id: number;
  phase_rubric_id?: number | null;
  max_files?: number;
  max_file_size_mb?: number | null;
  allowed_mime_types?: string[] | null;
  created_at?: string;
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
  phase_id: number | null;
  rubric_scope: 'phase' | 'project';
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

export async function getEventDetail(eventId: number, rawHtml = false) {
  const url = `/events/${eventId}${rawHtml ? '?raw=true' : ''}`;
  const response = await apiClient.get(url);
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

export async function getEventTasks(eventId: number) {
  const response = await apiClient.get(`/events/${eventId}/tasks`);
  return response.data.data as Task[];
}

export type RubricPayload = {
  rubric_scope?: 'phase' | 'project';
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

// Funciones para rúbricas de proyecto
export async function getProjectRubrics(eventId: number) {
  const response = await apiClient.get(`/events/${eventId}/rubrics/project`);
  return response.data.data as PhaseRubric[];
}

export async function createProjectRubric(eventId: number, payload: RubricPayload) {
  const response = await apiClient.post(`/events/${eventId}/rubrics/project`, payload);
  return response.data.data as PhaseRubric;
}

export async function updateProjectRubric(eventId: number, rubricId: number, payload: Partial<RubricPayload>) {
  const response = await apiClient.put(`/events/${eventId}/rubrics/project/${rubricId}`, payload);
  return response.data.data as PhaseRubric;
}

export async function deleteProjectRubric(eventId: number, rubricId: number) {
  await apiClient.delete(`/events/${eventId}/rubrics/project/${rubricId}`);
}

export type TeamMemberTracking = {
  id: number;
  userId: number;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

export type TeamDeliverableTracking = {
  taskId: number;
  taskTitle: string;
  required: boolean;
  delivered: boolean;
  submittedAt: string | null;
  submissionId: number | null;
};

export type TeamTracking = {
  id: number;
  name: string;
  description?: string | null;
  status: string;
  eventId: number;
  project:
    | {
        id: number;
        name: string;
        summary?: string | null;
        status: string;
        problem?: string | null;
        solution?: string | null;
        repository_url?: string | null;
        pitch_url?: string | null;
      }
    | null;
  members: TeamMemberTracking[];
  deliverables: TeamDeliverableTracking[];
};

export type UserTracking = {
  id: number;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  lastLoginAt: string | null;
  grade: string | null;
  registrationAnswers: Record<string, unknown> | null;
  team:
    | {
        id: number;
        name: string | null;
        role: string | null;
      }
    | null;
  roles: Array<{
    id: number;
    name: string;
    scope: string;
  }>;
};

export type GradeSummaryEntry = {
  grade: string;
  withTeam: number;
  withoutTeam: number;
  total: number;
};

export type EventTrackingOverview = {
  event: {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    registration_schema?: RegistrationSchema | null;
  };
  tasks: Array<{
    id: number;
    title: string;
    is_required: boolean;
  }>;
  teams: TeamTracking[];
  users: UserTracking[];
  unassignedUsers: UserTracking[];
  gradeSummary: GradeSummaryEntry[];
  totals: {
    registrations: number;
    teams: number;
    tasks: number;
  };
};

export async function getEventTrackingOverview(eventId: number) {
  const response = await apiClient.get(`/events/${eventId}/tracking/overview`);
  return response.data.data as EventTrackingOverview;
}

export type TeamStatistics = {
  id: number;
  name: string;
  project: {
    id: number;
    name: string;
    summary?: string | null;
    status: string;
  } | null;
  captain: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  members: Array<{
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    role: string;
    grade: string | null;
  }>;
  totalMembers: number;
};

export type UserStatistics = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  grade: string | null;
  lastLoginAt: string | null;
  team: {
    id: number;
    name: string;
  } | null;
  roles: string[];
};

export type GradeSummaryEntry = {
  grade: string;
  withTeam: number;
  withoutTeam: number;
  total: number;
};

export type CustomField = {
  name: string;
  label: string;
  type: string;
};

export type CustomFieldAggregate = {
  field: CustomField;
  summary: Array<{
    value: string;
    withTeam: number;
    withoutTeam: number;
    total: number;
  }>;
};

export type EventStatistics = {
  teams: TeamStatistics[];
  users: UserStatistics[];
  usersWithoutTeam: UserStatistics[];
  gradeSummary: GradeSummaryEntry[];
  customFields: CustomField[];
  customFieldAggregates: Record<string, CustomFieldAggregate>;
};

export async function getEventStatistics(eventId: number) {
  const response = await apiClient.get(`/events/${eventId}/statistics`);
  return response.data.data as EventStatistics;
}

export type DeliverableColumn = {
  phaseId: number;
  phaseName: string;
  taskId: number;
  taskTitle: string;
  orderIndex?: number;
};

export type TeamDeliverable = {
  taskId: number;
  taskTitle: string;
  phaseId: number;
  phaseName: string;
  submitted: boolean;
  submissionId: number | null;
  attachmentUrl: string | null;
  content: string | null;
  submittedAt: string | null;
};

export type TeamDeliverablesData = {
  id: number;
  name: string;
  deliverables: TeamDeliverable[];
};

export type EventDeliverablesTracking = {
  teams: TeamDeliverablesData[];
  columns: DeliverableColumn[];
  phases: Array<{ id: number; name: string; orderIndex: number }>;
  tasks: Array<{ id: number; title: string; phaseId: number }>;
};

export async function getEventDeliverablesTracking(eventId: number) {
  const response = await apiClient.get(`/events/${eventId}/deliverables-tracking`);
  return response.data.data as EventDeliverablesTracking;
}

