import { useParams, Link } from 'react-router';
import { useTenantPath } from '@/hooks/useTenantPath';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { PageHeader, Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  createPhase,
  createTask,
  deletePhase,
  deleteTask,
  getEventDetail,
  type Phase,
  type Task
} from '@/services/events';

const phaseSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_elimination: z.boolean().optional()
});

const taskSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  phase_id: z.number().int(),
  delivery_type: z.enum(['text', 'file', 'url', 'video', 'audio', 'zip']).default('file'),
  due_date: z.string().optional(),
  is_required: z.boolean().optional()
});

type PhaseFormValues = z.infer<typeof phaseSchema>;
type TaskFormValues = z.infer<typeof taskSchema>;

function EventDetailPage() {
  const { eventId } = useParams();
  const numericId = Number(eventId);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tenantPath = useTenantPath();

  const { data: eventDetail, isLoading } = useQuery({
    queryKey: ['events', numericId],
    queryFn: () => getEventDetail(numericId),
    enabled: Number.isInteger(numericId)
  });

  const phaseForm = useForm<PhaseFormValues>({
    resolver: zodResolver(phaseSchema)
  });

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { delivery_type: 'file', is_required: true }
  });

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
      taskForm.reset({ delivery_type: 'file', is_required: true });
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

  if (isNaN(numericId) || isLoading) {
    return <Spinner fullHeight />;
  }

  if (!eventDetail) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{t('common.error')}</p>
        <Link to={tenantPath('dashboard/events')} className="text-primary underline">
          {t('events.manage')}
        </Link>
      </div>
    );
  }

  const phases = eventDetail.phases as Phase[];
  const tasks = eventDetail.tasks as Task[];

  const onSubmitPhase = (values: PhaseFormValues) => {
    phaseMutation.mutate({
      ...values,
      start_date: values.start_date || undefined,
      end_date: values.end_date || undefined,
      is_elimination: Boolean(values.is_elimination)
    });
  };

  const onSubmitTask = (values: TaskFormValues) => {
    taskMutation.mutate({
      ...values,
      phase_id: Number(values.phase_id),
      is_required: Boolean(values.is_required),
      due_date: values.due_date || undefined
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={eventDetail.name} subtitle={eventDetail.description ?? ''} />

      <Card>
        <CardHeader>
          <CardTitle>{t('events.phasesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={phaseForm.handleSubmit(onSubmitPhase)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="phase-name">{t('events.phaseName')}</label>
              <Input id="phase-name" {...phaseForm.register('name')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="phase-description">{t('events.description')}</label>
              <Input id="phase-description" {...phaseForm.register('description')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="phase-start">{t('events.phaseStart')}</label>
              <Input id="phase-start" type="date" {...phaseForm.register('start_date')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="phase-end">{t('events.phaseEnd')}</label>
              <Input id="phase-end" type="date" {...phaseForm.register('end_date')} />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" {...phaseForm.register('is_elimination')} />
              {t('events.phaseElimination')}
            </label>
            <div className="md:col-span-2">
              <Button type="submit" disabled={phaseMutation.isLoading}>
                {phaseMutation.isLoading ? t('common.loading') : t('events.phaseCreate')}
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-3">
            {phases?.map(phase => (
              <div key={phase.id} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                <div>
                  <p className="font-medium">{phase.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {phase.start_date ? new Date(phase.start_date).toLocaleDateString() : '—'} -
                    {phase.end_date ? ` ${new Date(phase.end_date).toLocaleDateString()}` : ' —'}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deletePhaseMutation.mutate(phase.id)}
                >
                  {t('events.phaseDelete')}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('events.tasksTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={taskForm.handleSubmit(onSubmitTask)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="task-title">{t('events.taskTitle')}</label>
              <Input id="task-title" {...taskForm.register('title')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="task-description">{t('events.description')}</label>
              <Input id="task-description" {...taskForm.register('description')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="task-phase">{t('events.taskPhase')}</label>
              <Select id="task-phase" {...taskForm.register('phase_id', { valueAsNumber: true })}>
                <option value="" disabled>{t('events.taskPhase')}</option>
                {phases?.map(phase => (
                  <option key={phase.id} value={phase.id}>{phase.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="task-type">{t('events.taskType')}</label>
              <Select id="task-type" {...taskForm.register('delivery_type')}>
                <option value="file">File</option>
                <option value="text">Text</option>
                <option value="url">URL</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="zip">Zip</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="task-due">{t('events.taskDueDate')}</label>
              <Input id="task-due" type="date" {...taskForm.register('due_date')} />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" defaultChecked {...taskForm.register('is_required')} />
              {t('events.taskRequired')}
            </label>
            <div className="md:col-span-2">
              <Button type="submit" disabled={taskMutation.isLoading}>
                {taskMutation.isLoading ? t('common.loading') : t('events.taskCreate')}
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-3">
            {tasks?.map(task => (
              <div key={task.id} className="flex flex-col gap-2 rounded-md border border-border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
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
    </div>
  );
}

export default EventDetailPage;

