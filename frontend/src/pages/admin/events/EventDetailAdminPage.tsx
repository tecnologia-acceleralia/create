import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams, Navigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
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
  type Phase,
  type Task,
  type PhaseRubric,
  type RubricPayload,
  type Event
} from '@/services/events';
import { getTeamsByEvent, type Team } from '@/services/teams';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useTenant } from '@/context/TenantContext';
import { EventAssetsManager } from '@/components/events/EventAssetsManager';

type EventDetailData = Awaited<ReturnType<typeof getEventDetail>>;

function EventDetailAdminPage() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const numericId = Number(eventId);
  const { t } = useTranslation();
  const tenantPath = useTenantPath();

  // Ejecutar todos los hooks antes de cualquier return condicional
  const { data: eventDetail, isLoading } = useQuery({
    queryKey: ['events', numericId],
    queryFn: () => getEventDetail(numericId),
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
      registration_schema: values.registration_schema || undefined
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
      delivery_type: values.delivery_type || 'file',
      is_required: Boolean(values.is_required),
      due_date: values.due_date || undefined,
      order_index: values.order_index !== undefined && !Number.isNaN(values.order_index) ? Number(values.order_index) : undefined,
      phase_rubric_id: Number.isNaN(values.phase_rubric_id) ? undefined : values.phase_rubric_id,
      max_files: Number.isNaN(values.max_files) ? undefined : values.max_files,
      max_file_size_mb: Number.isNaN(values.max_file_size_mb) ? undefined : values.max_file_size_mb,
      allowed_mime_types: values.allowed_mime_types
        ? values.allowed_mime_types
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        : undefined
    };

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
      [data-rubric-form-tabs] button[data-state="active"] {
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

  return (
    <DashboardLayout title={eventDetail.name} subtitle={eventDetail.description ?? ''}>
      <Tabs defaultValue="event-data" className="space-y-6">
        <TabsList data-event-tabs>
          <TabsTrigger value="event-data">{t('events.eventData')}</TabsTrigger>
          <TabsTrigger value="phases-tasks">{t('events.phasesAndTasks')}</TabsTrigger>
          <TabsTrigger value="rubrics">{t('events.rubricsTitle')}</TabsTrigger>
          <TabsTrigger value="assets">{t('events.assetsTitle', { defaultValue: 'Recursos' })}</TabsTrigger>
          <TabsTrigger value="teams">{t('teams.allTeams')}</TabsTrigger>
        </TabsList>

        {/* Tab: Datos del evento */}
        <TabsContent value="event-data">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('events.eventData')}</CardTitle>
              <Button onClick={handleOpenEventModal}>
                {t('common.edit')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Fases y Tareas */}
        <TabsContent value="phases-tasks" className="space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('events.phasesAndTasks')}</CardTitle>
              <Button onClick={() => handleOpenPhaseModal()}>
                <Plus className="h-4 w-4 mr-2" />
                {t('events.addPhase')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {sortedPhases.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('events.noPhases')}</p>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Rúbricas */}
        <TabsContent value="rubrics" className="space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t('events.rubricsTitle')}</CardTitle>
              <Button onClick={() => handleOpenRubricModal()}>
                <Plus className="h-4 w-4 mr-2" />
                {t('common.add')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Recursos */}
        <TabsContent value="assets" className="space-y-6">
          <EventAssetsManager eventId={eventId} />
        </TabsContent>

        {/* Tab: Equipos */}
        <TabsContent value="teams" className="space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>{t('teams.allTeams')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTeams ? (
                <Spinner />
              ) : teams && teams.length > 0 ? (
                <div className="space-y-4">
                  {teams.map(team => (
                    <div key={team.id} className="rounded-lg border border-border/70 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{team.name}</p>
                          {team.description && (
                            <p className="text-xs text-muted-foreground mt-1">{team.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant={team.status === 'open' ? 'default' : 'secondary'}>
                              {team.status === 'open' ? t('teams.statusOpen') : t('teams.statusClosed')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {t('teams.membersCount', { count: team.members?.length ?? 0 })}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTeam(team);
                            setIsTeamDetailsModalOpen(true);
                          }}
                        >
                          {t('teams.viewDetails')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('teams.noTeams')}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Edición de Evento */}
      <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('events.editEvent')}</DialogTitle>
            <DialogDescription>
              {t('events.editEventDescription', { defaultValue: 'Modifica los detalles del evento' })}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList data-event-form-tabs className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">{t('common.basic', { defaultValue: 'Básico' })}</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="registration">{t('events.registrationSchema', { defaultValue: 'Esquema de Registro' })}</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="mt-4">
              <EventForm
                form={eventForm}
                onSubmit={onSubmitEvent}
                isSubmitting={updateEventMutation.isPending}
                hideSubmitButton
                idPrefix="event"
                sections={['basic']}
              />
            </TabsContent>
            <TabsContent value="html" className="mt-4 h-[calc(90vh-200px)]">
              <EventForm
                form={eventForm}
                onSubmit={onSubmitEvent}
                isSubmitting={updateEventMutation.isPending}
                hideSubmitButton
                idPrefix="event"
                sections={['html']}
              />
            </TabsContent>
            <TabsContent value="registration" className="mt-4">
              <EventForm
                form={eventForm}
                onSubmit={onSubmitEvent}
                isSubmitting={updateEventMutation.isPending}
                hideSubmitButton
                idPrefix="event"
                sections={['registration']}
              />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEventModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={eventForm.handleSubmit(onSubmitEvent)}
              disabled={updateEventMutation.isPending}
            >
              {updateEventMutation.isPending ? t('common.loading') : t('common.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Fase */}
      <Dialog open={isPhaseModalOpen} onOpenChange={setIsPhaseModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPhase ? t('events.editPhase') : t('events.createPhase')}
            </DialogTitle>
            <DialogDescription>
              {editingPhase
                ? t('events.editPhaseDescription', { defaultValue: 'Modifica los detalles de la fase' })
                : t('events.createPhaseDescription', { defaultValue: 'Crea una nueva fase para el evento' })}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList data-phase-form-tabs className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">{t('common.basic', { defaultValue: 'Básico' })}</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="mt-4">
              <PhaseForm
                form={phaseForm}
                onSubmit={onSubmitPhase}
                isSubmitting={createPhaseMutation.isPending || updatePhaseMutation.isPending}
                hideSubmitButton={true}
                sections={['basic']}
              />
            </TabsContent>
            <TabsContent value="html" className="mt-4 h-[calc(90vh-200px)]">
              <PhaseForm
                form={phaseForm}
                onSubmit={onSubmitPhase}
                isSubmitting={createPhaseMutation.isPending || updatePhaseMutation.isPending}
                hideSubmitButton={true}
                sections={['html']}
              />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPhaseModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={phaseForm.handleSubmit(onSubmitPhase)}
              disabled={createPhaseMutation.isPending || updatePhaseMutation.isPending}
            >
              {createPhaseMutation.isPending || updatePhaseMutation.isPending
                ? t('common.loading')
                : editingPhase
                  ? t('common.update')
                  : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Tarea */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? t('events.editTask') : t('events.createTask')}
            </DialogTitle>
            <DialogDescription>
              {editingTask
                ? t('events.editTaskDescription', { defaultValue: 'Modifica los detalles de la tarea' })
                : t('events.createTaskDescription', { defaultValue: 'Crea una nueva tarea para la fase' })}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList data-task-form-tabs className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">{t('common.basic', { defaultValue: 'Básico' })}</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="mt-4">
              <TaskForm
                form={taskForm as any}
                phases={sortedPhases}
                availableRubrics={availableRubrics}
                onSubmit={onSubmitTask}
                isSubmitting={taskMutation.isPending || updateTaskMutation.isPending}
                hideSubmitButton={true}
                sections={['basic']}
              />
            </TabsContent>
            <TabsContent value="html" className="mt-4 h-[calc(90vh-200px)]">
              <TaskForm
                form={taskForm as any}
                phases={sortedPhases}
                availableRubrics={availableRubrics}
                onSubmit={onSubmitTask}
                isSubmitting={taskMutation.isPending || updateTaskMutation.isPending}
                hideSubmitButton={true}
                sections={['html']}
              />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={taskForm.handleSubmit(onSubmitTask)}
              disabled={taskMutation.isPending || updateTaskMutation.isPending}
            >
              {taskMutation.isPending || updateTaskMutation.isPending
                ? t('common.loading')
                : editingTask
                  ? t('common.update')
                  : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Rúbrica */}
      <Dialog open={isRubricModalOpen} onOpenChange={setIsRubricModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRubric ? t('events.editRubric') : t('events.createRubric')}
            </DialogTitle>
            <DialogDescription>
              {editingRubric
                ? t('events.editRubricDescription', { defaultValue: 'Modifica los detalles de la rúbrica' })
                : t('events.createRubricDescription', { defaultValue: 'Crea una nueva rúbrica de evaluación' })}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList data-rubric-form-tabs className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">{t('common.basic', { defaultValue: 'Básico' })}</TabsTrigger>
              <TabsTrigger value="criteria">{t('events.rubricCriteriaTitle', { defaultValue: 'Criterios' })}</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="mt-4">
              <RubricForm
                form={rubricForm}
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
                onSubmit={onSubmitRubric}
                onCancelEdit={resetRubricForm}
                isSubmitting={createRubricMutation.isPending || updateRubricMutation.isPending || createProjectRubricMutation.isPending || updateProjectRubricMutation.isPending}
                isEditing={Boolean(editingRubric)}
                hideSubmitButton={true}
                sections={['basic']}
              />
            </TabsContent>
            <TabsContent value="criteria" className="mt-4">
              <RubricForm
                form={rubricForm}
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
                onSubmit={onSubmitRubric}
                onCancelEdit={resetRubricForm}
                isSubmitting={createRubricMutation.isPending || updateRubricMutation.isPending || createProjectRubricMutation.isPending || updateProjectRubricMutation.isPending}
                isEditing={Boolean(editingRubric)}
                hideSubmitButton={true}
                sections={['criteria']}
              />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRubricModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={rubricForm.handleSubmit(onSubmitRubric)}
              disabled={createRubricMutation.isPending || updateRubricMutation.isPending || createProjectRubricMutation.isPending || updateProjectRubricMutation.isPending}
            >
              {createRubricMutation.isPending || updateRubricMutation.isPending || createProjectRubricMutation.isPending || updateProjectRubricMutation.isPending
                ? t('common.loading')
                : editingRubric
                  ? t('common.update')
                  : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalles del Equipo */}
      <Dialog open={isTeamDetailsModalOpen} onOpenChange={setIsTeamDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('teams.teamDetails')}</DialogTitle>
            <DialogDescription>
              {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedTeam && (
            <Tabs defaultValue="team" className="w-full">
              <TabsList data-team-details-tabs className="grid w-full grid-cols-2">
                <TabsTrigger value="team">{t('teams.team')}</TabsTrigger>
                <TabsTrigger value="project">{t('teams.project')}</TabsTrigger>
              </TabsList>
              
              {/* Tab: Equipo */}
              <TabsContent value="team" className="space-y-6 mt-4">
                {/* Información del Equipo */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('teams.teamInfo')}</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('teams.name')}</p>
                      <p className="text-base font-semibold">{selectedTeam.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('teams.status')}</p>
                      <Badge variant={selectedTeam.status === 'open' ? 'default' : 'secondary'}>
                        {selectedTeam.status === 'open' ? t('teams.statusOpen') : t('teams.statusClosed')}
                      </Badge>
                    </div>
                    {selectedTeam.description && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">{t('teams.description')}</p>
                        <p className="text-base">{selectedTeam.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Miembros del Equipo */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('teams.members')}</h3>
                  <div className="space-y-2">
                    {selectedTeam.members && selectedTeam.members.length > 0 ? (
                      selectedTeam.members.map(member => (
                        <div key={member.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                          <div>
                            <p className="font-medium">
                              {member.user?.first_name} {member.user?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                          </div>
                          <Badge variant={member.role === 'captain' ? 'default' : 'outline'}>
                            {member.role === 'captain' ? t('teams.captain') : t('teams.member')}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('teams.noMembers')}</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Proyecto */}
              <TabsContent value="project" className="space-y-4 mt-4">
                {selectedTeam.project ? (
                  <div className="space-y-4 rounded-lg border border-border/70 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('teams.projectName')}</p>
                        <p className="text-base font-semibold">{selectedTeam.project.name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('teams.projectStatus')}</p>
                        <Badge variant="outline" className="capitalize">
                          {selectedTeam.project.status}
                        </Badge>
                      </div>
                      {selectedTeam.project.summary && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">{t('teams.projectSummary')}</p>
                          <p className="text-base">{selectedTeam.project.summary}</p>
                        </div>
                      )}
                      {selectedTeam.project.problem && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">{t('teams.projectProblem')}</p>
                          <p className="text-base">{selectedTeam.project.problem}</p>
                        </div>
                      )}
                      {selectedTeam.project.solution && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">{t('teams.projectSolution')}</p>
                          <p className="text-base">{selectedTeam.project.solution}</p>
                        </div>
                      )}
                      {selectedTeam.project.repository_url && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{t('teams.projectRepo')}</p>
                          <a
                            href={selectedTeam.project.repository_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base text-primary hover:underline"
                          >
                            {selectedTeam.project.repository_url}
                          </a>
                        </div>
                      )}
                      {selectedTeam.project.pitch_url && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{t('teams.projectPitch')}</p>
                          <a
                            href={selectedTeam.project.pitch_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base text-primary hover:underline"
                          >
                            {selectedTeam.project.pitch_url}
                          </a>
                        </div>
                      )}
                      {selectedTeam.project.logo_url && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">{t('teams.projectImage')}</p>
                          <img
                            src={selectedTeam.project.logo_url}
                            alt={selectedTeam.project.name}
                            className="mt-2 max-w-xs rounded-md border border-border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{t('teams.noProject')}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTeamDetailsModalOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default EventDetailAdminPage;
