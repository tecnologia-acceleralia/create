import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams, Navigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { DashboardLayout } from '@/components/layout';
import { Spinner, EmptyState, CardWithActions } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  EventEditModal,
  PhaseModal,
  TaskModal,
  RubricModal,
  TeamDetailsModal
} from '@/components/admin/modals';
import { formatDateValue } from '@/utils/date';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormGrid } from '@/components/form';
import type { RegistrationSchema } from '@/services/public';
import {
  phaseSchema,
  taskSchema,
  rubricSchema,
  eventSchema,
  PhaseForm,
  TaskForm,
  RubricForm,
  EventForm,
  type PhaseFormValues,
  type TaskFormValues,
  type RubricFormValues,
  type EventFormValues
} from '@/components/events/forms';
import {
  createPhase,
  updatePhase,
  deletePhase,
  createTask,
  deleteTask,
  updateTask,
  getEventDetail,
  createRubric,
  updateRubric,
  deleteRubric,
  getProjectRubrics,
  createProjectRubric,
  updateProjectRubric,
  deleteProjectRubric,
  updateEvent,
  getEventStatistics,
  type Phase,
  type Task,
  type PhaseRubric,
  type RubricPayload,
  type Event,
  type EventStatistics
} from '@/services/events';
import { getTeamsByEvent, type Team } from '@/services/teams';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useTenant } from '@/context/TenantContext';
import { EventAssetsManager } from '@/components/events/EventAssetsManager';
import EventStatisticsTab from '@/components/events/EventStatisticsTab';
import EventDeliverablesTrackingTab from '@/components/events/EventDeliverablesTrackingTab';

type EventDetailData = Awaited<ReturnType<typeof getEventDetail>>;

function EventDetailAdminPage() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const numericId = Number(eventId);
  const { t } = useTranslation();
  const tenantPath = useTenantPath();

  // Ejecutar todos los hooks antes de cualquier return condicional
  // Usar raw=true para obtener HTML crudo (necesario para edición)
  const { data: eventDetail, isLoading } = useQuery({
    queryKey: ['events', numericId, 'raw'],
    queryFn: () => getEventDetail(numericId, true),
    enabled: Number.isInteger(numericId)
  });

  // Si hay un parámetro phase en la URL, redirigir a la vista de participante
  const phaseParam = searchParams.get('phase');
  if (phaseParam) {
    return <Navigate to={tenantPath(`dashboard/events/${eventId}/view?phase=${phaseParam}`)} replace />;
  }

  if (isNaN(numericId) || isLoading) {
    return <Spinner fullHeight />;
  }

  if (!eventDetail) {
    return (
      <DashboardLayout title={t('events.title')} subtitle={t('common.error')}>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-6 text-sm">
          <p className="text-destructive">{t('common.error')}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to={tenantPath('dashboard')}>{t('navigation.dashboard')}</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return <EventDetailAdminView eventDetail={eventDetail} eventId={numericId} />;
}

function EventDetailAdminView({ eventDetail, eventId }: { eventDetail: EventDetailData; eventId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tenantPath = useTenantPath();
  const { branding } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Leer el tab de la URL, por defecto 'event-data'
  const activeTab = searchParams.get('tab') || 'event-data';

  const phases = (eventDetail?.phases ?? []) as Phase[];
  const tasks = (eventDetail?.tasks ?? []) as Task[];
  const rubrics = (eventDetail?.rubrics ?? []) as PhaseRubric[];

  // Función auxiliar para convertir fecha ISO a formato YYYY-MM-DD
  const formatDateForInput = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Estados para modales
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [isTeamDetailsModalOpen, setIsTeamDetailsModalOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingRubric, setEditingRubric] = useState<PhaseRubric | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Formularios
  const eventForm = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: eventDetail.name,
      description: eventDetail.description ?? '',
      description_html: eventDetail.description_html ?? '',
      start_date: formatDateForInput(eventDetail.start_date),
      end_date: formatDateForInput(eventDetail.end_date),
      min_team_size: eventDetail.min_team_size,
      max_team_size: eventDetail.max_team_size,
      status: eventDetail.status,
      video_url: eventDetail.video_url ?? '',
      is_public: eventDetail.is_public ?? false,
      allow_open_registration: eventDetail.allow_open_registration ?? true,
      publish_start_at: formatDateForInput(eventDetail.publish_start_at),
      publish_end_at: formatDateForInput(eventDetail.publish_end_at),
      registration_schema: eventDetail.registration_schema ?? null
    }
  });

  const phaseForm = useForm<PhaseFormValues>({
    resolver: zodResolver(phaseSchema),
    defaultValues: {
      name: '',
      description: '',
      intro_html: '',
      start_date: '',
      end_date: '',
      view_start_date: '',
      view_end_date: '',
      order_index: 0,
      is_elimination: false
    }
  });

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema) as any,
    defaultValues: {
      delivery_type: 'file' as const,
      is_required: true,
      max_files: 1,
      order_index: 0,
      phase_id: phases[0]?.id ?? 0
    }
  });

  const rubricForm = useForm<RubricFormValues>({
    resolver: zodResolver(rubricSchema),
    defaultValues: {
      rubric_scope: 'phase',
      phase_id: phases[0]?.id ?? 0,
      name: '',
      description: '',
      scale_min: 0,
      scale_max: 100,
      model_preference: '',
      criteria: [
        {
          title: '',
          description: '',
          weight: 1,
          max_score: null,
          order_index: 1
        }
      ]
    }
  });

  useEffect(() => {
    if (phases.length && !taskForm.getValues('phase_id')) {
      taskForm.setValue('phase_id', phases[0].id);
    }
    if (phases.length && !rubricForm.getValues('phase_id')) {
      rubricForm.setValue('phase_id', phases[0].id);
    }
  }, [phases, taskForm, rubricForm]);

  const criteriaArray = useFieldArray({
    control: rubricForm.control,
    name: 'criteria',
    keyName: 'fieldId'
  });

  // Mutación de evento
  const updateEventMutation = useMutation({
    mutationFn: (payload: Partial<Event>) => updateEvent(eventId, payload),
    onSuccess: () => {
      toast.success(t('events.eventUpdated'));
      setIsEventModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  // Mutaciones de fases
  const createPhaseMutation = useMutation({
    mutationFn: (payload: Partial<Phase>) => createPhase(eventId, payload),
    onSuccess: () => {
      toast.success(t('events.phaseCreated'));
      resetPhaseForm();
      setIsPhaseModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const updatePhaseMutation = useMutation({
    mutationFn: ({ phaseId, payload }: { phaseId: number; payload: Partial<Phase> }) =>
      updatePhase(eventId, phaseId, payload),
    onSuccess: () => {
      toast.success(t('events.phaseUpdated'));
      resetPhaseForm();
      setIsPhaseModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const deletePhaseMutation = useMutation({
    mutationFn: (phaseId: number) => deletePhase(eventId, phaseId),
    onSuccess: () => {
      toast.success(t('events.phaseDeleted'));
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  // Mutaciones de tareas
  const taskMutation = useMutation({
    mutationFn: (values: Partial<Task>) => createTask(eventId, values),
    onSuccess: () => {
      toast.success(t('events.taskCreated'));
      resetTaskForm();
      setIsTaskModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Partial<Task> }) =>
      updateTask(eventId, taskId, payload),
    onSuccess: () => {
      toast.success(t('events.taskUpdated'));
      resetTaskForm();
      setIsTaskModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(eventId, taskId),
    onSuccess: () => {
      toast.success(t('events.taskDeleted'));
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  // Mutaciones de rúbricas
  const createRubricMutation = useMutation({
    mutationFn: ({ phaseId, payload }: { phaseId: number; payload: RubricPayload }) =>
      createRubric(eventId, phaseId, payload),
    onSuccess: () => {
      toast.success(t('events.rubricCreated'));
      resetRubricForm();
      setIsRubricModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const updateRubricMutation = useMutation({
    mutationFn: ({ phaseId, rubricId, payload }: { phaseId: number; rubricId: number; payload: Partial<RubricPayload> }) =>
      updateRubric(eventId, phaseId, rubricId, payload),
    onSuccess: () => {
      toast.success(t('events.rubricUpdated'));
      resetRubricForm();
      setIsRubricModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const deleteRubricMutation = useMutation({
    mutationFn: ({ phaseId, rubricId }: { phaseId: number; rubricId: number }) =>
      deleteRubric(eventId, phaseId, rubricId),
    onSuccess: () => {
      toast.success(t('events.rubricDeleted'));
      if (editingRubric?.id) {
        resetRubricForm();
      }
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  // Mutaciones de rúbricas de proyecto
  const createProjectRubricMutation = useMutation({
    mutationFn: (payload: RubricPayload) => createProjectRubric(eventId, payload),
    onSuccess: () => {
      toast.success(t('events.rubricCreated'));
      resetRubricForm();
      setIsRubricModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const updateProjectRubricMutation = useMutation({
    mutationFn: ({ rubricId, payload }: { rubricId: number; payload: Partial<RubricPayload> }) =>
      updateProjectRubric(eventId, rubricId, payload),
    onSuccess: () => {
      toast.success(t('events.rubricUpdated'));
      resetRubricForm();
      setIsRubricModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const deleteProjectRubricMutation = useMutation({
    mutationFn: (rubricId: number) => deleteProjectRubric(eventId, rubricId),
    onSuccess: () => {
      toast.success(t('events.rubricDeleted'));
      if (editingRubric?.id) {
        resetRubricForm();
      }
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  // Query de equipos
  const { data: teams, isLoading: isLoadingTeams } = useQuery<Team[]>({
    queryKey: ['teams', eventId],
    queryFn: () => getTeamsByEvent(eventId),
    enabled: Number.isInteger(eventId)
  });

  // Funciones de reset
  const resetPhaseForm = () => {
    phaseForm.reset({
      name: '',
      description: '',
      intro_html: '',
      start_date: '',
      end_date: '',
      view_start_date: '',
      view_end_date: '',
      order_index: 0,
      is_elimination: false
    });
    setEditingPhase(null);
  };

  const resetTaskForm = () => {
    taskForm.reset({
      delivery_type: 'file',
      is_required: true,
      max_files: 1,
      order_index: 0,
      phase_id: phases[0]?.id ?? 0
    });
    setEditingTask(null);
  };

  const resetRubricForm = () => {
    rubricForm.reset({
      rubric_scope: 'phase',
      phase_id: phases[0]?.id ?? 0,
      name: '',
      description: '',
      scale_min: 0,
      scale_max: 100,
      model_preference: '',
      criteria: [
        {
          title: '',
          description: '',
          weight: 1,
          max_score: null,
          order_index: 1
        }
      ]
    });
    setEditingRubric(null);
  };

  // Handlers
  const handleOpenEventModal = () => {
    eventForm.reset({
      name: eventDetail.name,
      description: eventDetail.description ?? '',
      description_html: eventDetail.description_html ?? '',
      start_date: formatDateForInput(eventDetail.start_date),
      end_date: formatDateForInput(eventDetail.end_date),
      min_team_size: eventDetail.min_team_size,
      max_team_size: eventDetail.max_team_size,
      status: eventDetail.status,
      video_url: eventDetail.video_url ?? '',
      is_public: eventDetail.is_public ?? false,
      allow_open_registration: eventDetail.allow_open_registration ?? true,
      publish_start_at: formatDateForInput(eventDetail.publish_start_at),
      publish_end_at: formatDateForInput(eventDetail.publish_end_at),
      registration_schema: eventDetail.registration_schema ?? null
    });
    setIsEventModalOpen(true);
  };

  const handleOpenPhaseModal = (phase?: Phase) => {
    if (phase) {
      setEditingPhase(phase);
      phaseForm.reset({
        name: phase.name,
        description: phase.description ?? '',
        intro_html: phase.intro_html ?? '',
        start_date: formatDateForInput(phase.start_date),
        end_date: formatDateForInput(phase.end_date),
        view_start_date: formatDateForInput(phase.view_start_date),
        view_end_date: formatDateForInput(phase.view_end_date),
        order_index: phase.order_index ?? 0,
        is_elimination: phase.is_elimination ?? false
      });
    } else {
      resetPhaseForm();
    }
    setIsPhaseModalOpen(true);
  };

  const handleOpenTaskModal = (task?: Task, phaseId?: number) => {
    if (task) {
      setEditingTask(task);
      taskForm.reset({
        title: task.title,
        description: task.description ?? '',
        intro_html: task.intro_html ?? '',
        phase_id: task.phase_id,
        delivery_type: task.delivery_type as any,
        is_required: task.is_required,
        due_date: formatDateForInput(task.due_date),
        order_index: task.order_index ?? 0,
        max_files: task.max_files ?? undefined,
        max_file_size_mb: task.max_file_size_mb ?? undefined,
        allowed_mime_types: task.allowed_mime_types?.join(', ') ?? '',
        phase_rubric_id: task.phase_rubric_id ?? undefined
      });
    } else {
      resetTaskForm();
      if (phaseId) {
        taskForm.setValue('phase_id', phaseId);
      }
    }
    setIsTaskModalOpen(true);
  };

  const handleOpenRubricModal = (rubric?: PhaseRubric) => {
    if (rubric) {
      setEditingRubric(rubric);
      rubricForm.reset({
        rubric_scope: rubric.rubric_scope ?? 'phase',
        phase_id: rubric.phase_id ?? (phases[0]?.id ?? 0),
        name: rubric.name,
        description: rubric.description ?? '',
        scale_min: rubric.scale_min ?? 0,
        scale_max: rubric.scale_max ?? 100,
        model_preference: rubric.model_preference ?? '',
        criteria: rubric.criteria.map((criterion, index) => ({
          title: criterion.title,
          description: criterion.description ?? '',
          weight: criterion.weight ?? 1,
          max_score: criterion.max_score ?? null,
          order_index: criterion.order_index ?? index + 1
        }))
      });
    } else {
      resetRubricForm();
    }
    setIsRubricModalOpen(true);
  };

  const onSubmitEvent = (values: EventFormValues) => {
    const payload: Partial<Event> = {
      name: values.name,
      description: values.description || undefined,
      description_html: values.description_html || undefined,
      start_date: values.start_date || undefined,
      end_date: values.end_date || undefined,
      min_team_size: Number(values.min_team_size),
      max_team_size: Number(values.max_team_size),
      status: values.status,
      video_url: values.video_url || undefined,
      is_public: Boolean(values.is_public),
      allow_open_registration: Boolean(values.allow_open_registration),
      publish_start_at: values.publish_start_at || undefined,
      publish_end_at: values.publish_end_at || undefined,
      registration_schema: values.registration_schema !== undefined ? values.registration_schema : undefined
    };
    updateEventMutation.mutate(payload);
  };

  const onSubmitPhase = (values: PhaseFormValues) => {
    const payload: Partial<Phase> = {
      name: values.name,
      description: values.description || undefined,
      intro_html: values.intro_html || undefined,
      start_date: values.start_date || undefined,
      end_date: values.end_date || undefined,
      view_start_date: values.view_start_date || undefined,
      view_end_date: values.view_end_date || undefined,
      order_index: values.order_index !== undefined && !Number.isNaN(values.order_index) ? Number(values.order_index) : undefined,
      is_elimination: Boolean(values.is_elimination)
    };

    if (editingPhase) {
      updatePhaseMutation.mutate({ phaseId: editingPhase.id, payload });
    } else {
      createPhaseMutation.mutate(payload);
    }
  };

  const onSubmitTask = (values: TaskFormValues) => {
    const payload: Partial<Task> = {
      title: values.title,
      description: values.description || undefined,
      intro_html: values.intro_html || undefined,
      phase_id: Number(values.phase_id),
      delivery_type: values.delivery_type ?? 'file',
      is_required: Boolean(values.is_required),
      due_date: values.due_date || undefined,
      order_index: values.order_index !== undefined && !Number.isNaN(values.order_index) ? Number(values.order_index) : undefined,
      max_files: Number.isNaN(values.max_files) ? undefined : values.max_files,
      max_file_size_mb: Number.isNaN(values.max_file_size_mb) ? undefined : values.max_file_size_mb,
      allowed_mime_types: values.allowed_mime_types
        ? values.allowed_mime_types
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        : undefined
    };

    // Manejar phase_rubric_id: incluir solo si tiene valor o si queremos limpiarlo explícitamente
    if (values.phase_rubric_id !== undefined && !Number.isNaN(values.phase_rubric_id)) {
      payload.phase_rubric_id = Number(values.phase_rubric_id);
    } else if (editingTask) {
      // Si estamos editando y el campo está vacío, limpiar el valor existente
      payload.phase_rubric_id = null;
    }

    if (editingTask) {
      updateTaskMutation.mutate({ taskId: editingTask.id, payload });
    } else {
      taskMutation.mutate(payload);
    }
  };

  const onSubmitRubric = (values: RubricFormValues) => {
    const payload: RubricPayload = {
      rubric_scope: values.rubric_scope,
      name: values.name,
      description: values.description || undefined,
      scale_min: Number.isNaN(values.scale_min) ? undefined : values.scale_min,
      scale_max: Number.isNaN(values.scale_max) ? undefined : values.scale_max,
      model_preference: values.model_preference || undefined,
      criteria: values.criteria.map((criterion, index) => ({
        title: criterion.title,
        description: criterion.description || undefined,
        weight: Number.isNaN(criterion.weight) ? 1 : Number(criterion.weight ?? 1),
        max_score: Number.isNaN(criterion.max_score) ? null : Number(criterion.max_score ?? null),
        order_index: Number.isNaN(criterion.order_index) ? index + 1 : Number(criterion.order_index ?? index + 1)
      }))
    };

    const isProject = values.rubric_scope === 'project';

    if (editingRubric) {
      if (isProject) {
        updateProjectRubricMutation.mutate({
          rubricId: editingRubric.id,
          payload
        });
      } else {
        updateRubricMutation.mutate({
          phaseId: values.phase_id ?? 0,
          rubricId: editingRubric.id,
          payload
        });
      }
    } else {
      if (isProject) {
        createProjectRubricMutation.mutate(payload);
      } else {
        createRubricMutation.mutate({
          phaseId: values.phase_id ?? 0,
          payload
        });
      }
    }
  };

  // Agrupar tareas por fase
  const tasksByPhase = useMemo(() => {
    const grouped = new Map<number, Task[]>();
    tasks.forEach(task => {
      const bucket = grouped.get(task.phase_id) ?? [];
      bucket.push(task);
      grouped.set(task.phase_id, bucket);
    });
    grouped.forEach(list => {
      list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    });
    return grouped;
  }, [tasks]);

  // Ordenar fases
  const sortedPhases = useMemo(() => {
    return [...phases].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }, [phases]);

  const selectedTaskPhase = taskForm.watch('phase_id');
  const availableRubrics = useMemo(
    () =>
      rubrics.filter(rubric =>
        selectedTaskPhase ? rubric.phase_id === Number(selectedTaskPhase) : true
      ),
    [rubrics, selectedTaskPhase]
  );

  const formatMimeTypes = (types?: string[] | null) => (types && types.length ? types.join(', ') : t('events.taskMimeAny'));
  const formatTaskConstraints = (task: Task) => {
    const maxFiles = task.max_files ?? 1;
    const maxSize = task.max_file_size_mb ? `${task.max_file_size_mb} MB` : t('events.taskSizeUnlimited');
    return `${t('events.taskMaxFilesLabel', { count: maxFiles })} · ${t('events.taskMaxSizeLabel', { size: maxSize })} · ${t('events.taskAllowedMimesLabel', { types: formatMimeTypes(task.allowed_mime_types) })}`;
  };

  const rubricMap = useMemo(() => new Map(rubrics.map(rubric => [rubric.id, rubric])), [rubrics]);

  const rubricsGroupedByPhase = useMemo(() => {
    const grouped = new Map<number | 'project', PhaseRubric[]>();
    rubrics.forEach(rubric => {
      const key = rubric.rubric_scope === 'project' ? 'project' : (rubric.phase_id ?? 0);
      const existing = grouped.get(key) ?? [];
      existing.push(rubric);
      grouped.set(key, existing);
    });
    return grouped;
  }, [rubrics]);

  const projectRubrics = useMemo(() => {
    return rubrics.filter(r => r.rubric_scope === 'project');
  }, [rubrics]);

  const phaseRubrics = useMemo(() => {
    return rubrics.filter(r => r.rubric_scope === 'phase');
  }, [rubrics]);

  const primaryColor = branding.primaryColor || 'hsl(var(--primary))';

  // Aplicar estilos a tabs activos cuando cambia el color primario
  useEffect(() => {
    const styleId = 'event-detail-tabs-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    styleElement.textContent = `
      [data-event-tabs] button[data-state="active"],
      [data-team-details-tabs] button[data-state="active"],
      [data-event-form-tabs] button[data-state="active"],
      [data-phase-form-tabs] button[data-state="active"],
      [data-task-form-tabs] button[data-state="active"],
      [data-rubric-form-tabs] button[data-state="active"],
      [data-statistics-tabs] button[data-state="active"] {
        background-color: ${primaryColor} !important;
        color: white !important;
      }
    `;
    
    return () => {
      const existing = document.getElementById(styleId);
      if (existing && existing.parentNode) {
        existing.remove();
      }
    };
  }, [primaryColor]);

  const handleTabChange = (value: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (value === 'event-data') {
      // Si es el tab por defecto, eliminar el parámetro de la URL
      newSearchParams.delete('tab');
    } else {
      newSearchParams.set('tab', value);
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  return (
    <DashboardLayout title={eventDetail.name} subtitle={eventDetail.description ?? ''}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList data-event-tabs>
          <TabsTrigger value="event-data">{t('events.eventData')}</TabsTrigger>
          <TabsTrigger value="phases-tasks">{t('events.phasesAndTasks')}</TabsTrigger>
          <TabsTrigger value="rubrics">{t('events.rubricsTitle')}</TabsTrigger>
          <TabsTrigger value="assets">{t('events.assetsTitle', { defaultValue: 'Recursos' })}</TabsTrigger>
          <TabsTrigger value="statistics">{t('events.statistics', { defaultValue: 'Estadísticas' })}</TabsTrigger>
          <TabsTrigger value="deliverables-tracking">{t('events.deliverablesTracking.title', { defaultValue: 'Seguimiento de Entregables' })}</TabsTrigger>
        </TabsList>

        {/* Tab: Datos del evento */}
        <TabsContent value="event-data">
          <CardWithActions
            title={t('events.eventData')}
            actions={
              <Button onClick={handleOpenEventModal}>
                {t('common.edit')}
              </Button>
            }
            contentClassName="space-y-4"
          >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.name')}</p>
                  <p className="text-base font-semibold">{eventDetail.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.description')}</p>
                  <p className="text-base">{eventDetail.description || t('common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.start')}</p>
                  <p className="text-base">{formatDateValue(eventDetail.start_date) || t('common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.end')}</p>
                  <p className="text-base">{formatDateValue(eventDetail.end_date) || t('common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.minTeam')}</p>
                  <p className="text-base">{eventDetail.min_team_size}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.maxTeam')}</p>
                  <p className="text-base">{eventDetail.max_team_size}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.statusLabel')}</p>
                  <p className="text-base">{t(`events.status.${eventDetail.status}` as any) || eventDetail.status}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.videoUrl')}</p>
                  <p className="text-base">{eventDetail.video_url || t('common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.isPublic')}</p>
                  <p className="text-base">{eventDetail.is_public ? t('common.yes') : t('common.no')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.allowOpenRegistration')}</p>
                  <p className="text-base">{eventDetail.allow_open_registration ? t('common.yes') : t('common.no')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.publishStart')}</p>
                  <p className="text-base">{formatDateValue(eventDetail.publish_start_at) || t('common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('events.publishEnd')}</p>
                  <p className="text-base">{formatDateValue(eventDetail.publish_end_at) || t('common.notAvailable')}</p>
                </div>
                {eventDetail.registration_schema && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">{t('events.registrationSchema')}</p>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(eventDetail.registration_schema, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
          </CardWithActions>
        </TabsContent>

        {/* Tab: Fases y Tareas */}
        <TabsContent value="phases-tasks" className="space-y-6">
          <CardWithActions
            title={t('events.phasesAndTasks')}
            actions={
              <Button onClick={() => handleOpenPhaseModal()}>
                <Plus className="h-4 w-4 mr-2" />
                {t('events.addPhase')}
              </Button>
            }
            contentClassName="space-y-6"
          >
            {sortedPhases.length === 0 ? (
              <EmptyState message={t('events.noPhases')} />
            ) : (
                sortedPhases.map(phase => {
                  const phaseTasks = tasksByPhase.get(phase.id) ?? [];
                  return (
                    <div key={phase.id} className="space-y-3 rounded-lg border border-border/70 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{phase.name}</p>
                          {phase.description && (
                            <p className="text-xs text-muted-foreground mt-1">{phase.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {phase.start_date && (
                              <span>{t('events.phaseStart')}: {formatDateValue(phase.start_date)}</span>
                            )}
                            {phase.end_date && (
                              <span>{t('events.phaseEnd')}: {formatDateValue(phase.end_date)}</span>
                            )}
                            {phase.is_elimination && (
                              <Badge variant="secondary">{t('events.phaseElimination')}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenPhaseModal(phase)}>
                            {t('common.edit')}
                          </Button>
                          {phase.order_index !== 0 && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(t('events.confirmDeletePhase'))) {
                                  deletePhaseMutation.mutate(phase.id);
                                }
                              }}
                            >
                              {t('common.delete')}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">{t('events.tasksTitle')}</p>
                          <Button size="sm" variant="outline" onClick={() => handleOpenTaskModal(undefined, phase.id)}>
                            <Plus className="h-3 w-3 mr-1" />
                            {t('events.addTask')}
                          </Button>
                        </div>
                        {phaseTasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground ml-2">{t('events.noTasksInPhase')}</p>
                        ) : (
                          phaseTasks.map(task => (
                            <div
                              key={task.id}
                              className="flex flex-col gap-2 rounded-md border border-border/60 bg-card/60 p-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-foreground">{task.title}</p>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground">{task.description}</p>
                                )}
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {task.due_date && (
                                    <>
                                      <span className="font-medium">{t('events.taskDueDate')}:</span>
                                      <span>{formatDateValue(task.due_date)}</span>
                                    </>
                                  )}
                                  {task.is_required && (
                                    <>
                                      {task.due_date && <span>·</span>}
                                      <Badge variant="secondary">{t('events.taskRequired')}</Badge>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleOpenTaskModal(task)}>
                                  {t('common.edit')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm(t('events.confirmDeleteTask'))) {
                                      deleteTaskMutation.mutate(task.id);
                                    }
                                  }}
                                >
                                  {t('common.delete')}
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
          </CardWithActions>
        </TabsContent>

        {/* Tab: Rúbricas */}
        <TabsContent value="rubrics" className="space-y-6">
          <CardWithActions
            title={t('events.rubricsTitle')}
            actions={
              <Button onClick={() => handleOpenRubricModal()}>
                <Plus className="h-4 w-4 mr-2" />
                {t('common.add')}
              </Button>
            }
            contentClassName="space-y-6"
          >
              {/* Rúbricas de proyecto */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{t('events.projectRubrics')}</p>
                {projectRubrics.length ? (
                  <div className="space-y-3">
                    {projectRubrics.map(rubric => (
                      <div key={rubric.id} className="rounded-md border border-border/60 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{rubric.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('events.rubricScaleSummary', { min: rubric.scale_min ?? 0, max: rubric.scale_max ?? 100 })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleOpenRubricModal(rubric)}>
                              {t('events.rubricEdit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(t('events.confirmDeleteRubric'))) {
                                  deleteProjectRubricMutation.mutate(rubric.id);
                                }
                              }}
                            >
                              {t('events.rubricDelete')}
                            </Button>
                          </div>
                        </div>
                        {rubric.description && (
                          <p className="mt-2 text-xs text-muted-foreground">{rubric.description}</p>
                        )}
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {rubric.criteria.map(criterion => (
                            <li key={criterion.id}>
                              <span className="font-semibold text-foreground">{criterion.title}</span>{' '}
                              · {t('events.rubricWeightLabel', { weight: criterion.weight ?? 1 })}
                              {criterion.max_score ? ` · ${t('events.rubricMaxScoreLabel', { score: criterion.max_score })}` : ''}
                              {criterion.description ? ` — ${criterion.description}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('events.noProjectRubrics')}</p>
                )}
              </div>

              {/* Rúbricas por fase */}
              {sortedPhases.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{t('events.phaseRubrics')}</p>
                  <p className="text-sm text-muted-foreground">{t('events.rubricsEmptyPhases')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground">{t('events.phaseRubrics')}</p>
                  {sortedPhases.map(phase => {
                    const phaseRubricsList = rubricsGroupedByPhase.get(phase.id) ?? [];
                    return (
                      <div key={phase.id} className="space-y-2 rounded-lg border border-border/70 p-4">
                        <p className="text-sm font-semibold text-foreground">{phase.name}</p>
                        {phaseRubricsList.length ? (
                          <div className="space-y-3">
                            {phaseRubricsList.map(rubric => (
                              <div key={rubric.id} className="rounded-md border border-border/60 p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-foreground">{rubric.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {t('events.rubricScaleSummary', { min: rubric.scale_min ?? 0, max: rubric.scale_max ?? 100 })}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleOpenRubricModal(rubric)}>
                                      {t('events.rubricEdit')}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        if (confirm(t('events.confirmDeleteRubric'))) {
                                          deleteRubricMutation.mutate({ phaseId: rubric.phase_id ?? 0, rubricId: rubric.id });
                                        }
                                      }}
                                    >
                                      {t('events.rubricDelete')}
                                    </Button>
                                  </div>
                                </div>
                                {rubric.description && (
                                  <p className="mt-2 text-xs text-muted-foreground">{rubric.description}</p>
                                )}
                                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  {rubric.criteria.map(criterion => (
                                    <li key={criterion.id}>
                                      <span className="font-semibold text-foreground">{criterion.title}</span>{' '}
                                      · {t('events.rubricWeightLabel', { weight: criterion.weight ?? 1 })}
                                      {criterion.max_score ? ` · ${t('events.rubricMaxScoreLabel', { score: criterion.max_score })}` : ''}
                                      {criterion.description ? ` — ${criterion.description}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{t('events.noRubricsPhase')}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </CardWithActions>
        </TabsContent>

        {/* Tab: Recursos */}
        <TabsContent value="assets" className="space-y-6">
          <EventAssetsManager eventId={eventId} />
        </TabsContent>

        {/* Tab: Estadísticas */}
        <TabsContent value="statistics" className="space-y-6">
          <EventStatisticsTab 
            eventId={eventId} 
            onViewTeam={(teamId) => {
              const team = teams?.find(t => t.id === teamId);
              if (team) {
                setSelectedTeam(team);
                setIsTeamDetailsModalOpen(true);
              }
            }}
          />
        </TabsContent>

        {/* Tab: Seguimiento de Entregables */}
        <TabsContent value="deliverables-tracking" className="space-y-6">
          <EventDeliverablesTrackingTab eventId={eventId} />
        </TabsContent>
      </Tabs>

      <EventEditModal
        open={isEventModalOpen}
        onOpenChange={setIsEventModalOpen}
        form={eventForm}
        onSubmit={onSubmitEvent}
        isSubmitting={updateEventMutation.isPending}
        eventId={eventId}
      />

      <PhaseModal
        open={isPhaseModalOpen}
        onOpenChange={setIsPhaseModalOpen}
        form={phaseForm}
        onSubmit={onSubmitPhase}
        isSubmitting={createPhaseMutation.isPending || updatePhaseMutation.isPending}
        editingPhase={editingPhase}
        eventId={eventId}
      />

      <TaskModal
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        form={taskForm}
        onSubmit={onSubmitTask}
        isSubmitting={taskMutation.isPending || updateTaskMutation.isPending}
        editingTask={editingTask}
        phases={sortedPhases}
        availableRubrics={availableRubrics}
        eventId={eventId}
      />

      <RubricModal
        open={isRubricModalOpen}
        onOpenChange={setIsRubricModalOpen}
        form={rubricForm}
        onSubmit={onSubmitRubric}
        onCancelEdit={resetRubricForm}
        isSubmitting={createRubricMutation.isPending || updateRubricMutation.isPending || createProjectRubricMutation.isPending || updateProjectRubricMutation.isPending}
        editingRubric={editingRubric}
        phases={sortedPhases}
        criteriaFields={criteriaArray.fields}
        onAddCriterion={() =>
          criteriaArray.append({
            title: '',
            description: '',
            weight: 1,
            max_score: null,
            order_index: (criteriaArray.fields.length || 0) + 1
          })
        }
        onRemoveCriterion={criteriaArray.remove}
      />

      <TeamDetailsModal
        open={isTeamDetailsModalOpen}
        onOpenChange={setIsTeamDetailsModalOpen}
        team={selectedTeam}
      />
    </DashboardLayout>
  );
}

export default EventDetailAdminPage;
