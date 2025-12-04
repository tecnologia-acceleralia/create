import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams, Navigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Download, Upload } from 'lucide-react';
import { isAxiosError } from 'axios';

import { DashboardLayout } from '@/components/layout';
import { Spinner, EmptyState, CardWithActions } from '@/components/common';
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
import { safeTranslate } from '@/utils/i18n-helpers';
import { extractErrorMessage, logError } from '@/utils/error-helpers';
import { getMultilingualText, normalizeMultilingualValue, cleanMultilingualValue } from '@/utils/multilingual';
import {
  phaseSchema,
  taskSchema,
  rubricSchema,
  eventSchema,
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
  createProjectRubric,
  updateProjectRubric,
  deleteProjectRubric,
  updateEvent,
  exportPhasesAndTasks,
  importPhasesAndTasks,
  type Phase,
  type Task,
  type PhaseRubric,
  type RubricPayload,
  type Event,
  type PhaseTaskExportData,
  type MultilingualText,
} from '@/services/events';
import { getTeamsByEvent, type Team } from '@/services/teams';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { EventAssetsManager } from '@/components/events/EventAssetsManager';
import EventStatisticsTab from '@/components/events/EventStatisticsTab';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type EventDetailData = Awaited<ReturnType<typeof getEventDetail>>;

function EventDetailAdminPage() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  
  // Validar y parsear eventId de forma segura
  // Manejar casos donde eventId podría venir como "1:1" o similar
  let numericId: number;
  let isValidId: boolean;
  
  if (!eventId) {
    numericId = NaN;
    isValidId = false;
  } else {
    // Limpiar el eventId: tomar solo la parte antes de ":" o "."
    const cleaned = String(eventId).trim().split(':')[0].split('.')[0];
    numericId = Number.parseInt(cleaned, 10);
    // Verificar que el parseo sea válido
    isValidId = !Number.isNaN(numericId) && Number.isInteger(numericId) && numericId > 0;
    
    if (import.meta.env.DEV && !isValidId) {
      console.warn(`[EventDetailAdminPage] eventId inválido:`, { eventId, cleaned, numericId });
    }
  }
  const { t } = useTranslation();
  const tenantPath = useTenantPath();
  const { user, activeMembership, isSuperAdmin, loading: authLoading } = useAuth();
  const { tenantSlug } = useTenant();

  // Verificar autorización: solo superadmin y admin/organizer pueden acceder
  // Para superadmin, permitir acceso incluso sin membresía activa (se creará automáticamente)
  const roleScopes = new Set(
    activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []
  );
  const isAuthorized = isSuperAdmin || 
    roleScopes.has('tenant_admin') || 
    roleScopes.has('organizer');

  // Para superadmin, verificar si tiene membresía activa para el tenant actual
  // Si no la tiene, el AuthContext la creará automáticamente, pero debemos esperar
  const superAdminHasMembership = isSuperAdmin 
    ? (activeMembership?.tenant?.slug === tenantSlug && activeMembership?.status === 'active')
    : true;

  // Esperar a que termine la carga de autenticación
  // También esperar si es superadmin y aún no tiene membresía (se está creando)
  if (authLoading || (isSuperAdmin && !superAdminHasMembership && user)) {
    return <Spinner fullHeight />;
  }

  // Si el usuario está autenticado pero no está autorizado, redirigir a la vista de participante
  // PERO: si es superadmin, permitir acceso incluso sin membresía activa
  if (user && !isAuthorized && !isSuperAdmin) {
    // Usar numericId validado en lugar de eventId crudo
    if (isValidId) {
      return <Navigate to={tenantPath(`dashboard/events/${numericId}/home`)} replace />;
    }
    // Si el ID no es válido, redirigir al dashboard
    return <Navigate to={tenantPath('dashboard')} replace />;
  }

  // Ejecutar todos los hooks antes de cualquier return condicional
  // Usar raw=true para obtener HTML crudo (necesario para edición)
  // Para superadmin, permitir la query solo si tiene membresía activa o si es superadmin
  const { data: eventDetail, isLoading, isError, error } = useQuery({
    queryKey: ['events', numericId, 'raw'],
    queryFn: () => getEventDetail(numericId, true),
    enabled: isValidId && (isAuthorized || (isSuperAdmin && superAdminHasMembership)),
    retry: false // No reintentar automáticamente para ver el error más rápido
  });

  // Si hay un parámetro phase en la URL, redirigir a la vista de participante
  const phaseParam = searchParams.get('phase');
  if (phaseParam && isValidId) {
    return <Navigate to={tenantPath(`dashboard/events/${numericId}/view?phase=${phaseParam}`)} replace />;
  }

  // Mostrar error con más detalles si la query falla
  useEffect(() => {
    if (isError && error) {
      logError(error, 'EventDetailAdminPage');
      const errorMessage = extractErrorMessage(error, safeTranslate(t, 'common.error'));
      toast.error(errorMessage);
    }
  }, [isError, error, t]);

  if (!isValidId || isLoading) {
    return <Spinner fullHeight />;
  }

  if (isError || !eventDetail) {
    const errorMessage = error ? extractErrorMessage(error, safeTranslate(t, 'common.error')) : safeTranslate(t, 'common.error');
    return (
      <DashboardLayout title={safeTranslate(t, 'events.title')} subtitle={safeTranslate(t, 'common.error')}>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-6 text-sm">
          <p className="text-destructive font-medium mb-2">{safeTranslate(t, 'common.error')}</p>
          <p className="text-muted-foreground text-xs mb-4">{errorMessage}</p>
          {import.meta.env.DEV && error && (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Detalles técnicos (solo desarrollo)</summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                {JSON.stringify(error, null, 2)}
              </pre>
            </details>
          )}
          <Button asChild variant="outline" className="mt-4">
            <Link to={tenantPath('dashboard')}>{safeTranslate(t, 'navigation.dashboard')}</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return <EventDetailAdminView eventDetail={eventDetail} eventId={numericId} />;
}

function EventDetailAdminView({ eventDetail, eventId }: Readonly<{ eventDetail: EventDetailData; eventId: number }>) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
  const queryClient = useQueryClient();
  const { branding } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Leer el tab de la URL, por defecto 'event-data'
  const activeTab = searchParams.get('tab') || 'event-data';

  const phases = eventDetail?.phases ?? [];
  const tasks = eventDetail?.tasks ?? [];
  const rubrics = eventDetail?.rubrics ?? [];

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
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showImportConfirmDialog, setShowImportConfirmDialog] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  // Formularios
  const eventForm = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: normalizeMultilingualValue(eventDetail.name) ?? { es: '', ca: '', en: '' },
      description: normalizeMultilingualValue(eventDetail.description ?? null) ?? { es: '', ca: '', en: '' },
      description_html: normalizeMultilingualValue(eventDetail.description_html ?? null) ?? { es: '', ca: '', en: '' },
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
      toast.success(safeTranslate(t, 'events.eventUpdated'));
      setIsEventModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  // Mutaciones de fases
  const createPhaseMutation = useMutation({
    mutationFn: (payload: Partial<Phase>) => createPhase(eventId, payload),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.phaseCreated'));
      resetPhaseForm();
      setIsPhaseModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const updatePhaseMutation = useMutation({
    mutationFn: ({ phaseId, payload }: { phaseId: number; payload: Partial<Phase> }) =>
      updatePhase(eventId, phaseId, payload),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.phaseUpdated'));
      resetPhaseForm();
      setIsPhaseModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const deletePhaseMutation = useMutation({
    mutationFn: (phaseId: number) => deletePhase(eventId, phaseId),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.phaseDeleted'));
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message || safeTranslate(t, 'common.error');
        toast.error(message);
      } else {
        toast.error(safeTranslate(t, 'common.error'));
      }
    }
  });

  // Mutaciones de tareas
  const taskMutation = useMutation({
    mutationFn: (values: Partial<Task>) => createTask(eventId, values),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.taskCreated'));
      resetTaskForm();
      setIsTaskModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Partial<Task> }) =>
      updateTask(eventId, taskId, payload),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.taskUpdated'));
      resetTaskForm();
      setIsTaskModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(eventId, taskId),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.taskDeleted'));
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  // Mutaciones de rúbricas
  const createRubricMutation = useMutation({
    mutationFn: ({ phaseId, payload }: { phaseId: number; payload: RubricPayload }) =>
      createRubric(eventId, phaseId, payload),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.rubricCreated'));
      resetRubricForm();
      setIsRubricModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const updateRubricMutation = useMutation({
    mutationFn: ({ phaseId, rubricId, payload }: { phaseId: number; rubricId: number; payload: Partial<RubricPayload> }) =>
      updateRubric(eventId, phaseId, rubricId, payload),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.rubricUpdated'));
      resetRubricForm();
      setIsRubricModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const deleteRubricMutation = useMutation({
    mutationFn: ({ phaseId, rubricId }: { phaseId: number; rubricId: number }) =>
      deleteRubric(eventId, phaseId, rubricId),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.rubricDeleted'));
      if (editingRubric?.id) {
        resetRubricForm();
      }
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  // Mutaciones de rúbricas de proyecto
  const createProjectRubricMutation = useMutation({
    mutationFn: (payload: RubricPayload) => createProjectRubric(eventId, payload),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.rubricCreated'));
      resetRubricForm();
      setIsRubricModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const updateProjectRubricMutation = useMutation({
    mutationFn: ({ rubricId, payload }: { rubricId: number; payload: Partial<RubricPayload> }) =>
      updateProjectRubric(eventId, rubricId, payload),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.rubricUpdated'));
      resetRubricForm();
      setIsRubricModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const deleteProjectRubricMutation = useMutation({
    mutationFn: (rubricId: number) => deleteProjectRubric(eventId, rubricId),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'events.rubricDeleted'));
      if (editingRubric?.id) {
        resetRubricForm();
      }
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  // Query de equipos
  const { data: teams } = useQuery<Team[]>({
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
      name: normalizeMultilingualValue(eventDetail.name) ?? { es: '', ca: '', en: '' },
      description: normalizeMultilingualValue(eventDetail.description ?? null) ?? { es: '', ca: '', en: '' },
      description_html: normalizeMultilingualValue(eventDetail.description_html ?? null) ?? { es: '', ca: '', en: '' },
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
    // Limpiar valores multiidioma antes de enviar
    // name es requerido, así que siempre debe tener al menos texto en español
    let cleanedName: MultilingualText | string | undefined;
    if (typeof values.name === 'object' && values.name !== null) {
      // Normalizar primero para asegurar que ca y en estén presentes (aunque sean strings vacíos)
      const normalizedName = normalizeMultilingualValue(values.name);
      if (normalizedName) {
        cleanedName = cleanMultilingualValue(normalizedName, true) ?? undefined;
        // Si cleanMultilingualValue retorna null para un campo requerido, usar el valor normalizado
        // (la validación del formulario debería haber rechazado esto)
        if (!cleanedName && normalizedName.es) {
          cleanedName = { es: normalizedName.es.trim() };
          if (normalizedName.ca?.trim()) cleanedName.ca = normalizedName.ca.trim();
          if (normalizedName.en?.trim()) cleanedName.en = normalizedName.en.trim();
        }
      }
    } else if (typeof values.name === 'string') {
      cleanedName = values.name.trim() || undefined;
    }

    // description y description_html son opcionales
    // Normalizar primero para asegurar que ca y en estén presentes (aunque sean strings vacíos)
    const normalizedDescription = typeof values.description === 'object' && values.description !== null
      ? normalizeMultilingualValue(values.description)
      : null;
    const cleanedDescription = normalizedDescription
      ? cleanMultilingualValue(normalizedDescription, false)
      : (typeof values.description === 'string' && values.description.trim() ? values.description.trim() : undefined);
    
    const normalizedDescriptionHtml = typeof values.description_html === 'object' && values.description_html !== null
      ? normalizeMultilingualValue(values.description_html)
      : null;
    const cleanedDescriptionHtml = normalizedDescriptionHtml
      ? cleanMultilingualValue(normalizedDescriptionHtml, false)
      : (typeof values.description_html === 'string' && values.description_html.trim() ? values.description_html.trim() : undefined);

    const payload: Partial<Event> = {
      name: cleanedName,
      description: cleanedDescription,
      description_html: cleanedDescriptionHtml,
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
      registration_schema: values.registration_schema ?? undefined
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
        return;
      }
      updateRubricMutation.mutate({
        phaseId: values.phase_id ?? 0,
        rubricId: editingRubric.id,
        payload
      });
      return;
    }
    
    if (isProject) {
      createProjectRubricMutation.mutate(payload);
      return;
    }
    createRubricMutation.mutate({
      phaseId: values.phase_id ?? 0,
      payload
    });
  };

  // Agrupar tareas por fase
  const tasksByPhase = useMemo(() => {
    const grouped = new Map<number, Task[]>();
    for (const task of tasks) {
      const bucket = grouped.get(task.phase_id) ?? [];
      bucket.push(task);
      grouped.set(task.phase_id, bucket);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }
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

  const rubricsGroupedByPhase = useMemo(() => {
    const grouped = new Map<number | 'project', PhaseRubric[]>();
    for (const rubric of rubrics) {
      const key = rubric.rubric_scope === 'project' ? 'project' : (rubric.phase_id ?? 0);
      const existing = grouped.get(key) ?? [];
      existing.push(rubric);
      grouped.set(key, existing);
    }
    return grouped;
  }, [rubrics]);

  const projectRubrics = useMemo(() => {
    return rubrics.filter(r => r.rubric_scope === 'project');
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
      if (existing?.parentNode) {
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

  // Funciones de exportación e importación
  const handleExportPhasesAndTasks = async () => {
    try {
      const exportData = await exportPhasesAndTasks(eventId);
      
      // Crear archivo JSON y descargarlo
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `phases-tasks-${getMultilingualText(eventDetail.name, currentLang).replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(safeTranslate(t, 'events.phasesTasksExported'));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || safeTranslate(t, 'common.error'));
    }
  };

  const handleImportPhasesAndTasks = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Guardar el archivo y mostrar el diálogo de confirmación
      setImportFile(file);
      setShowImportConfirmDialog(true);
    };
    input.click();
  };

  const handleCancelImport = () => {
    setShowImportConfirmDialog(false);
    setImportFile(null);
  };

  const handleConfirmImport = () => {
    setShowImportConfirmDialog(false);
    // Ahora preguntar si quiere reemplazar o añadir
    setShowReplaceDialog(true);
  };

  const handleCancelReplace = () => {
    setShowReplaceDialog(false);
    setImportFile(null);
  };

  const handleProcessImport = async (replace: boolean) => {
    setShowReplaceDialog(false);
    
    if (!importFile) return;

    try {
      setIsImporting(true);
      const text = await importFile.text();
      const importData = JSON.parse(text) as PhaseTaskExportData;

      if (!importData.phases || !Array.isArray(importData.phases)) {
        toast.error(safeTranslate(t, 'events.invalidImportFormat'));
        setImportFile(null);
        return;
      }

      // Normalizar los datos: convertir objetos multilingües a strings
      const normalizeMultilingual = (value: unknown): string | null => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string') return value;
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Es un objeto multilingüe, extraer español o el primer valor
          const obj = value as Record<string, unknown>;
          return (obj.es || obj.ca || obj.en || Object.values(obj)[0] || '') as string;
        }
        return String(value);
      };

      const normalizedData: PhaseTaskExportData = {
        ...importData,
        event_name: typeof importData.event_name === 'string' 
          ? importData.event_name 
          : normalizeMultilingual(importData.event_name) || '',
        phases: importData.phases.map(phase => {
          const normalizedPhase: any = {
            name: normalizeMultilingual(phase.name) || '',
            order_index: phase.order_index,
            is_elimination: phase.is_elimination,
            tasks: phase.tasks?.map(task => {
              const normalizedTask: any = {
                title: normalizeMultilingual(task.title) || '',
                delivery_type: task.delivery_type,
                is_required: task.is_required,
                status: task.status,
                order_index: task.order_index,
                max_files: task.max_files
              };
              
              // Solo agregar campos opcionales si no son null
              const taskDescription = phase.description !== undefined ? normalizeMultilingual(task.description) : undefined;
              if (taskDescription !== null && taskDescription !== undefined) {
                normalizedTask.description = taskDescription;
              }
              
              const taskIntroHtml = task.intro_html !== undefined ? normalizeMultilingual(task.intro_html) : undefined;
              if (taskIntroHtml !== null && taskIntroHtml !== undefined) {
                normalizedTask.intro_html = taskIntroHtml;
              }
              
              if (task.due_date !== null && task.due_date !== undefined) {
                normalizedTask.due_date = task.due_date;
              }
              
              if (task.max_file_size_mb !== null && task.max_file_size_mb !== undefined) {
                normalizedTask.max_file_size_mb = task.max_file_size_mb;
              }
              
              if (task.allowed_mime_types !== null && task.allowed_mime_types !== undefined) {
                normalizedTask.allowed_mime_types = task.allowed_mime_types;
              }
              
              return normalizedTask;
            }) || []
          };
          
          // Solo agregar campos opcionales de fase si no son null
          const phaseDescription = phase.description !== undefined ? normalizeMultilingual(phase.description) : undefined;
          if (phaseDescription !== null && phaseDescription !== undefined) {
            normalizedPhase.description = phaseDescription;
          }
          
          const phaseIntroHtml = phase.intro_html !== undefined ? normalizeMultilingual(phase.intro_html) : undefined;
          if (phaseIntroHtml !== null && phaseIntroHtml !== undefined) {
            normalizedPhase.intro_html = phaseIntroHtml;
          }
          
          if (phase.start_date !== null && phase.start_date !== undefined) {
            normalizedPhase.start_date = phase.start_date;
          }
          
          if (phase.end_date !== null && phase.end_date !== undefined) {
            normalizedPhase.end_date = phase.end_date;
          }
          
          if (phase.view_start_date !== null && phase.view_start_date !== undefined) {
            normalizedPhase.view_start_date = phase.view_start_date;
          }
          
          if (phase.view_end_date !== null && phase.view_end_date !== undefined) {
            normalizedPhase.view_end_date = phase.view_end_date;
          }
          
          return normalizedPhase;
        })
      };

      // Log temporal para debugging
      if (import.meta.env.DEV) {
        console.log('[Import] Datos normalizados:', {
          phasesCount: normalizedData.phases.length,
          firstPhase: normalizedData.phases[0] ? {
            name: normalizedData.phases[0].name,
            nameType: typeof normalizedData.phases[0].name,
            description: normalizedData.phases[0].description,
            descriptionType: typeof normalizedData.phases[0].description,
            tasksCount: normalizedData.phases[0].tasks?.length || 0,
            firstTask: normalizedData.phases[0].tasks?.[0] ? {
              title: normalizedData.phases[0].tasks[0].title,
              titleType: typeof normalizedData.phases[0].tasks[0].title
            } : null
          } : null
        });
      }

      const result = await importPhasesAndTasks(eventId, normalizedData, replace);
      
      if (!result) {
        console.error('[Import] Result es undefined');
        toast.error(safeTranslate(t, 'common.error'));
        setImportFile(null);
        return;
      }
      
      if (result.success) {
        if (replace) {
          toast.success(
            safeTranslate(t, 'events.phasesTasksReplaced', {
              phases: result.imported.phases,
              tasks: result.imported.tasks
            })
          );
        } else {
          toast.success(
            safeTranslate(t, 'events.phasesTasksImported', {
              phases: result.imported.phases,
              tasks: result.imported.tasks
            })
          );
        }
        void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      } else if (result.errors && result.errors.length > 0) {
        toast.warning(
          safeTranslate(t, 'events.phasesTasksImportedPartial', {
            phases: result.imported.phases,
            tasks: result.imported.tasks,
            errors: result.errors.length
          })
        );
        console.warn('Errores de importación:', result.errors);
        void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      }
      
      setImportFile(null);
    } catch (error: any) {
      console.error('[Import] Error completo:', error);
      console.error('[Import] Error response:', error?.response);
      console.error('[Import] Error data:', error?.response?.data);
      
      if (error instanceof SyntaxError) {
        toast.error(safeTranslate(t, 'events.invalidJsonFile'));
      } else {
        const errorMessage = error?.response?.data?.message || error?.message || safeTranslate(t, 'common.error');
        console.error('[Import] Mostrando error al usuario:', errorMessage);
        toast.error(errorMessage);
      }
      setImportFile(null);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <DashboardLayout title={getMultilingualText(eventDetail.name, currentLang)} subtitle={getMultilingualText(eventDetail.description, currentLang)}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList data-event-tabs>
          <TabsTrigger value="event-data">{safeTranslate(t, 'events.eventData')}</TabsTrigger>
          <TabsTrigger value="phases-tasks">{safeTranslate(t, 'events.phasesAndTasks')}</TabsTrigger>
          <TabsTrigger value="rubrics">{safeTranslate(t, 'events.rubricsTitle')}</TabsTrigger>
          <TabsTrigger value="assets">{safeTranslate(t, 'events.assetsTitle', { defaultValue: 'Recursos' })}</TabsTrigger>
          <TabsTrigger value="statistics">{safeTranslate(t, 'events.statistics', { defaultValue: 'Estadísticas' })}</TabsTrigger>
        </TabsList>

        {/* Tab: Datos del evento */}
        <TabsContent value="event-data">
          <CardWithActions
            title={safeTranslate(t, 'events.eventData')}
            actions={
              <Button onClick={handleOpenEventModal}>
                {safeTranslate(t, 'common.edit')}
              </Button>
            }
            contentClassName="space-y-4"
          >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.name')}</p>
                  <p className="text-base font-semibold">{getMultilingualText(eventDetail.name, currentLang)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.description')}</p>
                  <p className="text-base">{getMultilingualText(eventDetail.description, currentLang) || safeTranslate(t, 'common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.start')}</p>
                  <p className="text-base">{formatDateValue(eventDetail.start_date) || safeTranslate(t, 'common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.end')}</p>
                  <p className="text-base">{formatDateValue(eventDetail.end_date) || safeTranslate(t, 'common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.minTeam')}</p>
                  <p className="text-base">{eventDetail.min_team_size}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.maxTeam')}</p>
                  <p className="text-base">{eventDetail.max_team_size}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.statusLabel')}</p>
                  <p className="text-base">{safeTranslate(t, `events.status.${eventDetail.status}`, { defaultValue: eventDetail.status })}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.videoUrl')}</p>
                  <p className="text-base">{eventDetail.video_url || safeTranslate(t, 'common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.isPublic')}</p>
                  <p className="text-base">{eventDetail.is_public ? safeTranslate(t, 'common.yes') : safeTranslate(t, 'common.no')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.allowOpenRegistration')}</p>
                  <p className="text-base">{eventDetail.allow_open_registration ? safeTranslate(t, 'common.yes') : safeTranslate(t, 'common.no')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.publishStart')}</p>
                  <p className="text-base">{formatDateValue(eventDetail.publish_start_at) || safeTranslate(t, 'common.notAvailable')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.publishEnd')}</p>
                  <p className="text-base">{formatDateValue(eventDetail.publish_end_at) || safeTranslate(t, 'common.notAvailable')}</p>
                </div>
                {eventDetail.registration_schema && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'events.registrationSchema')}</p>
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
            title={safeTranslate(t, 'events.phasesAndTasks')}
            actions={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportPhasesAndTasks}
                  disabled={sortedPhases.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {safeTranslate(t, 'events.exportPhasesTasks')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleImportPhasesAndTasks}
                  disabled={isImporting}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isImporting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'events.importPhasesTasks')}
                </Button>
                <Button onClick={() => handleOpenPhaseModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  {safeTranslate(t, 'events.addPhase')}
                </Button>
              </div>
            }
            contentClassName="space-y-6"
          >
            {sortedPhases.length === 0 ? (
              <EmptyState message={safeTranslate(t, 'events.noPhases')} />
            ) : (
                sortedPhases.map(phase => {
                  const phaseTasks = tasksByPhase.get(phase.id) ?? [];
                  return (
                    <div key={phase.id} className="space-y-3 rounded-lg border border-border/70 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{getMultilingualText(phase.name, currentLang)}</p>
                          {phase.description && (
                            <p className="text-xs text-muted-foreground mt-1">{getMultilingualText(phase.description, currentLang)}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {phase.start_date && (
                              <span>{safeTranslate(t, 'events.phaseStart')}: {formatDateValue(phase.start_date)}</span>
                            )}
                            {phase.end_date && (
                              <span>{safeTranslate(t, 'events.phaseEnd')}: {formatDateValue(phase.end_date)}</span>
                            )}
                            {phase.is_elimination && (
                              <Badge variant="secondary">{safeTranslate(t, 'events.phaseElimination')}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenPhaseModal(phase)}>
                            {safeTranslate(t, 'common.edit')}
                          </Button>
                          {phase.order_index !== 0 && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(safeTranslate(t, 'events.confirmDeletePhase'))) {
                                  deletePhaseMutation.mutate(phase.id);
                                }
                              }}
                            >
                              {safeTranslate(t, 'common.delete')}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">{safeTranslate(t, 'events.tasksTitle')}</p>
                          <Button size="sm" variant="outline" onClick={() => handleOpenTaskModal(undefined, phase.id)}>
                            <Plus className="h-3 w-3 mr-1" />
                            {safeTranslate(t, 'events.addTask')}
                          </Button>
                        </div>
                        {phaseTasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground ml-2">{safeTranslate(t, 'events.noTasksInPhase')}</p>
                        ) : (
                          phaseTasks.map(task => (
                            <div
                              key={task.id}
                              className="flex flex-col gap-2 rounded-md border border-border/60 bg-card/60 p-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-foreground">{getMultilingualText(task.title, currentLang)}</p>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground">{getMultilingualText(task.description, currentLang)}</p>
                                )}
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  {task.due_date && (
                                    <>
                                      <span className="font-medium">{safeTranslate(t, 'events.taskDueDate')}:</span>
                                      <span>{formatDateValue(task.due_date)}</span>
                                    </>
                                  )}
                                  {task.is_required && (
                                    <>
                                      {task.due_date && <span>·</span>}
                                      <Badge variant="secondary">{safeTranslate(t, 'events.taskRequired')}</Badge>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleOpenTaskModal(task)}>
                                  {safeTranslate(t, 'common.edit')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm(safeTranslate(t, 'events.confirmDeleteTask'))) {
                                      deleteTaskMutation.mutate(task.id);
                                    }
                                  }}
                                >
                                  {safeTranslate(t, 'common.delete')}
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
            title={safeTranslate(t, 'events.rubricsTitle')}
            actions={
              <Button onClick={() => handleOpenRubricModal()}>
                <Plus className="h-4 w-4 mr-2" />
                {safeTranslate(t, 'common.add')}
              </Button>
            }
            contentClassName="space-y-6"
          >
              {/* Rúbricas de proyecto */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{safeTranslate(t, 'events.projectRubrics')}</p>
                {projectRubrics.length ? (
                  <div className="space-y-3">
                    {projectRubrics.map(rubric => (
                      <div key={rubric.id} className="rounded-md border border-border/60 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{rubric.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {safeTranslate(t, 'events.rubricScaleSummary', { min: rubric.scale_min ?? 0, max: rubric.scale_max ?? 100 })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleOpenRubricModal(rubric)}>
                              {safeTranslate(t, 'events.rubricEdit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(safeTranslate(t, 'events.confirmDeleteRubric'))) {
                                  deleteProjectRubricMutation.mutate(rubric.id);
                                }
                              }}
                            >
                              {safeTranslate(t, 'events.rubricDelete')}
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
                              · {safeTranslate(t, 'events.rubricWeightLabel', { weight: criterion.weight ?? 1 })}
                              {criterion.max_score ? ` · ${safeTranslate(t, 'events.rubricMaxScoreLabel', { score: criterion.max_score })}` : ''}
                              {criterion.description ? ` — ${criterion.description}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{safeTranslate(t, 'events.noProjectRubrics')}</p>
                )}
              </div>

              {/* Rúbricas por fase */}
              {sortedPhases.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{safeTranslate(t, 'events.phaseRubrics')}</p>
                  <p className="text-sm text-muted-foreground">{safeTranslate(t, 'events.rubricsEmptyPhases')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground">{safeTranslate(t, 'events.phaseRubrics')}</p>
                  {sortedPhases.map(phase => {
                    const phaseRubricsList = rubricsGroupedByPhase.get(phase.id) ?? [];
                    return (
                      <div key={phase.id} className="space-y-2 rounded-lg border border-border/70 p-4">
                        <p className="text-sm font-semibold text-foreground">{getMultilingualText(phase.name, currentLang)}</p>
                        {phaseRubricsList.length ? (
                          <div className="space-y-3">
                            {phaseRubricsList.map(rubric => (
                              <div key={rubric.id} className="rounded-md border border-border/60 p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-foreground">{rubric.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {safeTranslate(t, 'events.rubricScaleSummary', { min: rubric.scale_min ?? 0, max: rubric.scale_max ?? 100 })}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleOpenRubricModal(rubric)}>
                                      {safeTranslate(t, 'events.rubricEdit')}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        if (confirm(safeTranslate(t, 'events.confirmDeleteRubric'))) {
                                          deleteRubricMutation.mutate({ phaseId: rubric.phase_id ?? 0, rubricId: rubric.id });
                                        }
                                      }}
                                    >
                                      {safeTranslate(t, 'events.rubricDelete')}
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
                                      · {safeTranslate(t, 'events.rubricWeightLabel', { weight: criterion.weight ?? 1 })}
                                      {criterion.max_score ? ` · ${safeTranslate(t, 'events.rubricMaxScoreLabel', { score: criterion.max_score })}` : ''}
                                      {criterion.description ? ` — ${criterion.description}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{safeTranslate(t, 'events.noRubricsPhase')}</p>
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

      {/* Diálogo de confirmación de importación */}
      <AlertDialog open={showImportConfirmDialog} onOpenChange={(open) => {
        if (!open) {
          handleCancelImport();
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {safeTranslate(t, 'events.confirmImport', { defaultValue: 'Confirmar importación' })}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {safeTranslate(t, 'events.confirmImportDescription', {
                  defaultValue: '¿Deseas importar las fases y tareas del archivo seleccionado?'
                })}
              </p>
              {importFile && (
                <p className="font-medium text-sm mt-2 p-2 bg-muted rounded-md">
                  📄 {importFile.name}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelImport}>
              {safeTranslate(t, 'common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>
              {safeTranslate(t, 'common.continue', { defaultValue: 'Continuar' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo para elegir reemplazar o añadir */}
      <AlertDialog open={showReplaceDialog} onOpenChange={(open) => {
        if (!open) {
          handleCancelReplace();
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {safeTranslate(t, 'events.importReplaceTitle', { defaultValue: 'Modo de importación' })}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {safeTranslate(t, 'events.importReplaceConfirm', {
                defaultValue: '¿Deseas reemplazar todas las fases y tareas existentes?\n\n- Sí: Se borrarán todas las fases y tareas actuales y se importarán las del archivo.\n- No: Se añadirán las fases y tareas del archivo a las existentes.'
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplace}>
              {safeTranslate(t, 'common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleProcessImport(false)}>
              {safeTranslate(t, 'events.addToExisting', { defaultValue: 'Añadir' })}
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleProcessImport(true)}>
              {safeTranslate(t, 'events.replaceAll', { defaultValue: 'Reemplazar' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

export default EventDetailAdminPage;
