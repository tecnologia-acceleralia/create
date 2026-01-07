import { apiClient } from './api';
import type { RegistrationSchema } from './public';

/**
 * Limpia y valida un eventId, extrayendo solo la parte numérica válida
 * Maneja casos como "1:1", "1.5", etc.
 */
function cleanEventId(eventId: number | string | undefined | null): number {
  if (eventId === undefined || eventId === null) {
    throw new Error('ID de evento requerido');
  }
  
  // Si ya es un número válido, retornarlo
  if (typeof eventId === 'number') {
    if (Number.isInteger(eventId) && eventId > 0) {
      return eventId;
    }
    throw new Error(`ID de evento inválido: ${eventId}`);
  }
  
  // Si es string, limpiar y parsear
  const cleaned = String(eventId).trim().split(':')[0].split('.')[0];
  const parsed = Number.parseInt(cleaned, 10);
  
  if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`ID de evento inválido: ${eventId}`);
  }
  
  return parsed;
}

export type MultilingualText = {
  es: string;
  ca?: string;
  en?: string;
};

export type Event = {
  id: number;
  name: MultilingualText | string;
  description?: MultilingualText | string | null;
  description_html?: MultilingualText | string | null;
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
  ai_evaluation_prompt?: string | null;
  ai_evaluation_model?: string | null;
  ai_evaluation_temperature?: number | null;
  ai_evaluation_max_tokens?: number | null;
  ai_evaluation_top_p?: number | null;
  ai_evaluation_frequency_penalty?: number | null;
  ai_evaluation_presence_penalty?: number | null;
  is_registered?: boolean;
  registration_status?: string | null;
  has_team?: boolean;
  team_id?: number | null;
  team_name?: string | null;
  team_role?: 'captain' | 'member' | 'evaluator' | null;
};

export type Phase = {
  id: number;
  name: MultilingualText | string;
  description?: MultilingualText | string | null;
  intro_html?: MultilingualText | string | null;
  order_index: number;
  is_elimination: boolean;
  start_date?: string;
  end_date?: string;
  view_start_date?: string | null;
  view_end_date?: string | null;
};

export type Task = {
  id: number;
  title: MultilingualText | string;
  description?: MultilingualText | string | null;
  intro_html?: MultilingualText | string | null;
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
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.put(`/events/${cleanedId}`, payload);
  return response.data.data as Event;
}

export async function archiveEvent(eventId: number) {
  const cleanedId = cleanEventId(eventId);
  await apiClient.delete(`/events/${cleanedId}`);
}

export async function cloneEvent(eventId: number) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.post(`/events/${cleanedId}/clone`);
  return response.data.data as Event;
}

export async function getEventDetail(eventId: number, rawHtml = false) {
  const cleanedId = cleanEventId(eventId);
  const url = `/events/${cleanedId}${rawHtml ? '?raw=true' : ''}`;
  
  if (import.meta.env.DEV) {
    console.log(`[getEventDetail] Llamando a:`, url, { eventId, cleanedId });
  }
  
  const response = await apiClient.get(url);
  return response.data.data as Event & { phases: Phase[]; tasks: Task[]; rubrics: PhaseRubric[] };
}

export async function createPhase(eventId: number, payload: Partial<Phase>) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.post(`/events/${cleanedId}/phases`, payload);
  return response.data.data as Phase;
}

export async function updatePhase(eventId: number, phaseId: number, payload: Partial<Phase>) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.put(`/events/${cleanedId}/phases/${phaseId}`, payload);
  return response.data.data as Phase;
}

export async function deletePhase(eventId: number, phaseId: number) {
  const cleanedId = cleanEventId(eventId);
  await apiClient.delete(`/events/${cleanedId}/phases/${phaseId}`);
}

export async function createTask(eventId: number, payload: Partial<Task>) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.post(`/events/${cleanedId}/tasks`, payload);
  return response.data.data as Task;
}

export async function updateTask(eventId: number, taskId: number, payload: Partial<Task>) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.put(`/events/${cleanedId}/tasks/${taskId}`, payload);
  return response.data.data as Task;
}

export async function deleteTask(eventId: number, taskId: number) {
  const cleanedId = cleanEventId(eventId);
  await apiClient.delete(`/events/${cleanedId}/tasks/${taskId}`);
}

export async function getEventTasks(eventId: number) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.get(`/events/${cleanedId}/tasks`);
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
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.get(`/events/${cleanedId}/phases/${phaseId}/rubrics`);
  return response.data.data as PhaseRubric[];
}

export async function createRubric(eventId: number, phaseId: number, payload: RubricPayload) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.post(`/events/${cleanedId}/phases/${phaseId}/rubrics`, payload);
  return response.data.data as PhaseRubric;
}

export async function updateRubric(eventId: number, phaseId: number, rubricId: number, payload: Partial<RubricPayload>) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.put(`/events/${cleanedId}/phases/${phaseId}/rubrics/${rubricId}`, payload);
  return response.data.data as PhaseRubric;
}

export async function deleteRubric(eventId: number, phaseId: number, rubricId: number) {
  const cleanedId = cleanEventId(eventId);
  await apiClient.delete(`/events/${cleanedId}/phases/${phaseId}/rubrics/${rubricId}`);
}

// Funciones para rúbricas de proyecto
export async function getProjectRubrics(eventId: number) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.get(`/events/${cleanedId}/rubrics/project`);
  return response.data.data as PhaseRubric[];
}

export async function createProjectRubric(eventId: number, payload: RubricPayload) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.post(`/events/${cleanedId}/rubrics/project`, payload);
  return response.data.data as PhaseRubric;
}

export async function updateProjectRubric(eventId: number, rubricId: number, payload: Partial<RubricPayload>) {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.put(`/events/${cleanedId}/rubrics/project/${rubricId}`, payload);
  return response.data.data as PhaseRubric;
}

export async function deleteProjectRubric(eventId: number, rubricId: number) {
  const cleanedId = cleanEventId(eventId);
  await apiClient.delete(`/events/${cleanedId}/rubrics/project/${rubricId}`);
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
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.get(`/events/${cleanedId}/tracking/overview`);
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
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.get(`/events/${cleanedId}/statistics`);
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
  hasFinalEvaluation?: boolean;
  hasPendingEvaluation?: boolean;
  finalEvaluationId?: number | null;
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
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.get(`/events/${cleanedId}/deliverables-tracking`);
  return response.data.data as EventDeliverablesTracking;
}

export type PhaseTaskExportData = {
  version: string;
  event_name: string;
  exported_at: string;
  phases: Array<{
    name: MultilingualText;
    description?: MultilingualText | null;
    intro_html?: MultilingualText | null;
    start_date?: string | null;
    end_date?: string | null;
    view_start_date?: string | null;
    view_end_date?: string | null;
    order_index: number;
    is_elimination: boolean;
    tasks: Array<{
      title: MultilingualText;
      description?: MultilingualText | null;
      intro_html?: MultilingualText | null;
      delivery_type: string;
      is_required: boolean;
      due_date?: string | null;
      status: string;
      order_index: number;
      max_files: number;
      max_file_size_mb?: number | null;
      allowed_mime_types?: string[] | null;
    }>;
  }>;
};

export type PhaseTaskImportResult = {
  success: boolean;
  imported: {
    phases: number;
    tasks: number;
  };
  errors?: string[];
};

export async function exportPhasesAndTasks(eventId: number): Promise<PhaseTaskExportData> {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.get(`/events/${cleanedId}/phases/export`);
  return response.data.data as PhaseTaskExportData;
}

export async function importPhasesAndTasks(eventId: number, data: PhaseTaskExportData, replace = false): Promise<PhaseTaskImportResult> {
  const cleanedId = cleanEventId(eventId);
  const response = await apiClient.post(`/events/${cleanedId}/phases/import`, {
    ...data,
    replace
  });
  
  // El backend puede devolver los datos en dos formatos:
  // 1. Con successResponse: { success: true, data: { success: ..., imported: ..., errors: ... } }
  // 2. Con errores parciales (207): { success: ..., imported: ..., errors: ... }
  
  if (response.data) {
    // Si hay response.data.data, es el formato con successResponse
    if (response.data.data && typeof response.data.data === 'object') {
      return response.data.data as PhaseTaskImportResult;
    }
    
    // Si response.data tiene imported, es el formato directo (207 Multi-Status)
    if (response.data.imported || response.data.success !== undefined) {
      return response.data as PhaseTaskImportResult;
    }
  }
  
  // Si no hay datos, devolver un resultado por defecto
  console.warn('[importPhasesAndTasks] Respuesta inesperada del backend:', response.data);
  return {
    success: false,
    imported: { phases: 0, tasks: 0 },
    errors: ['Respuesta inesperada del servidor']
  };
}

