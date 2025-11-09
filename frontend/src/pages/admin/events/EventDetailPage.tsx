import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useTranslation } from 'react-i18next';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import {
  phaseSchema,
  taskSchema,
  rubricSchema,
  PhaseForm,
  TaskForm,
  RubricForm,
  type PhaseFormValues,
  type TaskFormValues,
  type RubricFormValues
} from '@/components/events/forms';
import {
  createPhase,
  createTask,
  deletePhase,
  deleteTask,
  getEventDetail,
  createRubric,
  updateRubric,
  deleteRubric,
  type Phase,
  type Task,
  type PhaseRubric,
  type RubricPayload
} from '@/services/events';

function EventDetailPage() {
  const { eventId } = useParams();
  const numericId = Number(eventId);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tenantPath = useTenantPath();
  const [searchParams] = useSearchParams();

  const { data: eventDetail, isLoading } = useQuery({
    queryKey: ['events', numericId],
    queryFn: () => getEventDetail(numericId),
    enabled: Number.isInteger(numericId)
  });

  const phases = (eventDetail?.phases ?? []) as Phase[];
  const tasks = (eventDetail?.tasks ?? []) as Task[];
  const rubrics = (eventDetail?.rubrics ?? []) as PhaseRubric[];

  const notAvailableLabel = t('common.notAvailable', { defaultValue: 'N/A' });
  const formatDateValue = (value?: string | null) => {
    if (!value) {
      return notAvailableLabel;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return notAvailableLabel;
    }
    return date.toLocaleDateString();
  };

  const phaseMap = useMemo(() => new Map(phases.map(phase => [phase.id, phase.name])), [phases]);
  const rubricMap = useMemo(() => new Map(rubrics.map(rubric => [rubric.id, rubric])), [rubrics]);

  const phaseForm = useForm<PhaseFormValues>({
    resolver: zodResolver(phaseSchema)
  });

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      delivery_type: 'file',
      is_required: true,
      max_files: 1
    }
  });

  const rubricForm = useForm<RubricFormValues>({
    resolver: zodResolver(rubricSchema),
    defaultValues: {
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
    if (phases.length && !rubricForm.getValues('phase_id')) {
      rubricForm.setValue('phase_id', phases[0].id);
    }
  }, [phases, rubricForm]);

  const criteriaArray = useFieldArray({
    control: rubricForm.control,
    name: 'criteria',
    keyName: 'fieldId'
  });

  const [editingRubric, setEditingRubric] = useState<PhaseRubric | null>(null);

  const phaseMutation = useMutation({
    mutationFn: (values: PhaseFormValues) => createPhase(numericId, values),
    onSuccess: () => {
      toast.success(t('events.phaseCreated'));
      phaseForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['events', numericId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const taskMutation = useMutation({
    mutationFn: (values: TaskFormValues) => createTask(numericId, values),
    onSuccess: () => {
      toast.success(t('events.taskCreated'));
      taskForm.reset({ delivery_type: 'file', is_required: true, max_files: 1 });
      void queryClient.invalidateQueries({ queryKey: ['events', numericId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const deletePhaseMutation = useMutation({
    mutationFn: (phaseId: number) => deletePhase(numericId, phaseId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['events', numericId] })
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(numericId, taskId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['events', numericId] })
  });

  const createRubricMutation = useMutation({
    mutationFn: ({ phaseId, payload }: { phaseId: number; payload: RubricPayload }) =>
      createRubric(numericId, phaseId, payload),
    onSuccess: () => {
      toast.success(t('events.rubricCreated'));
      resetRubricForm();
      void queryClient.invalidateQueries({ queryKey: ['events', numericId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const updateRubricMutation = useMutation({
    mutationFn: ({ phaseId, rubricId, payload }: { phaseId: number; rubricId: number; payload: Partial<RubricPayload> }) =>
      updateRubric(numericId, phaseId, rubricId, payload),
    onSuccess: () => {
      toast.success(t('events.rubricUpdated'));
      resetRubricForm();
      void queryClient.invalidateQueries({ queryKey: ['events', numericId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const deleteRubricMutation = useMutation({
    mutationFn: ({ phaseId, rubricId }: { phaseId: number; rubricId: number }) =>
      deleteRubric(numericId, phaseId, rubricId),
    onSuccess: () => {
      toast.success(t('events.rubricDeleted'));
      if (editingRubric?.id) {
        resetRubricForm();
      }
      void queryClient.invalidateQueries({ queryKey: ['events', numericId] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const resetRubricForm = () => {
    rubricForm.reset({
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

  if (isNaN(numericId) || isLoading) {
    return <Spinner fullHeight />;
  }

  if (!eventDetail) {
    return (
      <DashboardLayout title={t('events.title')} subtitle={t('common.error')}>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-6 text-sm">
          <p className="text-destructive">{t('common.error')}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to={tenantPath('dashboard/events')}>{t('events.manage')}</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const eventPhases = eventDetail.phases as Phase[];
  const activePhase = Number(searchParams.get('phase'));
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

  const handleEditRubric = (rubric: PhaseRubric) => {
    setEditingRubric(rubric);
    rubricForm.reset({
      phase_id: rubric.phase_id,
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
  };

  useEffect(() => {
    if (!activePhase) {
      return;
    }

    const element = document.getElementById(`phase-${activePhase}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activePhase, eventDetail]);

  const onSubmitPhase = (values: PhaseFormValues) => {
    phaseMutation.mutate({
      ...values,
      start_date: values.start_date || undefined,
      end_date: values.end_date || undefined,
      view_start_date: values.view_start_date || undefined,
      view_end_date: values.view_end_date || undefined,
      is_elimination: Boolean(values.is_elimination)
    });
  };

  const onSubmitTask = (values: TaskFormValues) => {
    taskMutation.mutate({
      ...values,
      phase_id: Number(values.phase_id),
      is_required: Boolean(values.is_required),
      due_date: values.due_date || undefined,
      phase_rubric_id: Number.isNaN(values.phase_rubric_id) ? undefined : values.phase_rubric_id,
      max_files: Number.isNaN(values.max_files) ? undefined : values.max_files,
      max_file_size_mb: Number.isNaN(values.max_file_size_mb) ? undefined : values.max_file_size_mb,
      allowed_mime_types: values.allowed_mime_types
        ? values.allowed_mime_types
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        : undefined
    });
  };

  const onSubmitRubric = (values: RubricFormValues) => {
    const payload: RubricPayload = {
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

    if (editingRubric) {
      updateRubricMutation.mutate({
        phaseId: values.phase_id,
        rubricId: editingRubric.id,
        payload
      });
    } else {
      createRubricMutation.mutate({
        phaseId: values.phase_id,
        payload
      });
    }
  };

  const rubricsGroupedByPhase = useMemo(() => {
    const grouped = new Map<number, PhaseRubric[]>();
    rubrics.forEach(rubric => {
      const existing = grouped.get(rubric.phase_id) ?? [];
      existing.push(rubric);
      grouped.set(rubric.phase_id, existing);
    });
    return grouped;
  }, [rubrics]);

  return (
    <DashboardLayout title={eventDetail.name} subtitle={eventDetail.description ?? ''}>
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>{t('events.phasesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PhaseForm form={phaseForm} onSubmit={onSubmitPhase} isSubmitting={phaseMutation.isLoading} />

          <div className="flex flex-col gap-3">
            {eventPhases?.map(phase => {
              const isActive = activePhase === phase.id;
              const deliverySummary = t('events.phaseDeliveryInfo', {
                start: formatDateValue(phase.start_date),
                end: formatDateValue(phase.end_date)
              });
              const visibilitySummary = t('events.phaseVisibilityInfo', {
                start: formatDateValue(phase.view_start_date),
                end: formatDateValue(phase.view_end_date)
              });
              return (
                <div
                  key={phase.id}
                  id={`phase-${phase.id}`}
                  className={cn(
                    'flex items-start justify-between gap-4 rounded-2xl border border-border/70 px-4 py-4 transition-colors md:items-center',
                    isActive ? 'bg-[color:var(--tenant-primary)]/10 border-[color:var(--tenant-primary)]/50' : 'bg-card/60'
                  )}
                >
                  <div>
                    <p className="text-base font-semibold text-foreground">{phase.name}</p>
                    <p className="text-xs text-muted-foreground">{deliverySummary}</p>
                    <p className="text-xs text-muted-foreground">{visibilitySummary}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deletePhaseMutation.mutate(phase.id)}
                  >
                    {t('events.phaseDelete')}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>{t('events.rubricsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RubricForm
            form={rubricForm}
            phases={eventPhases}
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
            isSubmitting={createRubricMutation.isLoading || updateRubricMutation.isLoading}
            isEditing={Boolean(editingRubric)}
          />

          <div className="space-y-4">
            {eventPhases.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('events.rubricsEmptyPhases')}</p>
            ) : (
              eventPhases.map(phase => {
                const phaseRubrics = rubricsGroupedByPhase.get(phase.id) ?? [];
                return (
                  <div key={phase.id} className="space-y-2 rounded-lg border border-border/70 p-4">
                    <p className="text-sm font-semibold text-foreground">{phase.name}</p>
                    {phaseRubrics.length ? (
                      <div className="space-y-3">
                        {phaseRubrics.map(rubric => (
                          <div key={rubric.id} className="rounded-md border border-border/60 p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-foreground">{rubric.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {t('events.rubricScaleSummary', { min: rubric.scale_min ?? 0, max: rubric.scale_max ?? 100 })}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleEditRubric(rubric)}>
                                  {t('events.rubricEdit')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    deleteRubricMutation.mutate({ phaseId: rubric.phase_id, rubricId: rubric.id })
                                  }
                                >
                                  {t('events.rubricDelete')}
                                </Button>
                              </div>
                            </div>
                            {rubric.description ? (
                              <p className="mt-2 text-xs text-muted-foreground">{rubric.description}</p>
                            ) : null}
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
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>{t('events.tasksTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <TaskForm
            form={taskForm}
            phases={eventPhases}
            availableRubrics={availableRubrics}
            onSubmit={onSubmitTask}
            isSubmitting={taskMutation.isLoading}
          />

          <div className="flex flex-col gap-3">
            {tasks?.map(task => (
              <div key={task.id} className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/60 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{t('events.taskRubric')}:</span>{' '}
                    {task.phase_rubric_id ? rubricMap.get(task.phase_rubric_id)?.name ?? t('events.taskRubricNone') : t('events.taskRubricNone')}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatTaskConstraints(task)}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteTaskMutation.mutate(task.id)}
                >
                  {t('events.taskDelete')}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default EventDetailPage;
