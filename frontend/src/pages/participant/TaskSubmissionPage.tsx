import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Spinner } from '@/components/common';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormGrid, FileUploadList } from '@/components/form';
import { TaskContextCard } from '@/components/events';
import { getEventDetail, type Phase } from '@/services/events';
import {
  createSubmission,
  getSubmissions,
  getEvaluations,
  createEvaluation,
  createAiEvaluation,
  type Submission,
  type Evaluation
} from '@/services/submissions';
import { getMyTeams } from '@/services/teams';
import { useAuth } from '@/context/AuthContext';
import { fileToBase64 } from '@/utils/files';
import { parseDate } from '@/utils/date';
import { cn } from '@/utils/cn';

const submissionSchema = z.object({
  content: z.string().optional(),
  status: z.enum(['draft', 'final'])
});

type SubmissionFormValues = z.infer<typeof submissionSchema>;

const evaluationSchema = z.object({
  score: z.union([z.number().min(0), z.nan()]).optional(),
  comment: z.string().min(1)
});

type EvaluationFormValues = z.infer<typeof evaluationSchema>;

function TaskSubmissionPage() {
  const { eventId, taskId } = useParams();
  const numericTaskId = Number(taskId);
  const numericEventId = Number(eventId);
  const { t, i18n } = useTranslation();
  const locale = i18n.language ?? 'es';
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const { user, activeMembership, isSuperAdmin } = useAuth();
  const roleScopes = useMemo(
    () => new Set<string>(activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []),
    [activeMembership, user]
  );
  const isReviewer = isSuperAdmin || roleScopes.has('evaluator') || roleScopes.has('organizer') || roleScopes.has('tenant_admin');

  const { data: eventDetail, isLoading: eventLoading } = useQuery({
    queryKey: ['event', numericEventId],
    queryFn: () => getEventDetail(numericEventId),
    enabled: Number.isInteger(numericEventId)
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['submissions', numericTaskId],
    queryFn: () => getSubmissions(numericTaskId),
    enabled: Number.isInteger(numericTaskId)
  });

  const { data: myTeams, isLoading: teamsLoading } = useQuery({
    queryKey: ['myTeams'],
    queryFn: getMyTeams,
    enabled: !isReviewer
  });

  const isTeamCaptain = useMemo(() => {
    if (isReviewer) {
      return true; // Los revisores pueden ver
    }
    if (!myTeams || !numericEventId) {
      return false;
    }
    return myTeams.some(membership => {
      const teamEventId = membership?.team?.event_id;
      return teamEventId && Number(teamEventId) === numericEventId && membership.role === 'captain';
    });
  }, [myTeams, numericEventId, isReviewer]);

  const [evaluations, setEvaluations] = useState<Record<number, Evaluation[]>>({});

  const form = useForm<SubmissionFormValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { status: 'final' }
  });

  const evaluationForm = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: { score: undefined, comment: '' }
  });

  const createSubmissionMutation = useMutation({
    mutationFn: async (values: SubmissionFormValues) => {
      const payloadFiles = await Promise.all(
        files.map(async file => ({
          base64: await fileToBase64(file),
          name: file.name
        }))
      );
      return createSubmission(numericTaskId, {
        content: values.content,
        status: values.status,
        type: values.status === 'final' ? 'final' : 'provisional',
        files: payloadFiles.length ? payloadFiles : undefined
      });
    },
    onSuccess: () => {
      toast.success(t('submissions.created'));
      form.reset({ status: 'final', content: '' });
      setFiles([]);
      void queryClient.invalidateQueries({ queryKey: ['submissions', numericTaskId] });
    },
    onError: (error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number; data?: { message?: string } } }).response === 'object'
      ) {
        const response = (error as { response: { status?: number; data?: { message?: string } } }).response;
        if (response.status === 403 && response.data?.message?.includes('capitán')) {
          toast.error(t('submissions.onlyCaptainCanSubmit'));
          return;
        }
      }
      toast.error(t('common.error'));
    }
  });

  const handleViewEvaluations = async (submission: Submission) => {
    setSelectedSubmission(submission);
    evaluationForm.reset({ score: undefined, comment: '' });
    if (!evaluations[submission.id]) {
      const evals = await getEvaluations(submission.id);
      setEvaluations(prev => ({ ...prev, [submission.id]: evals }));
    }
  };

  const evaluationMutation = useMutation({
    mutationFn: (values: EvaluationFormValues) => createEvaluation(selectedSubmission!.id, {
      score: Number.isNaN(values.score) ? undefined : values.score,
      comment: values.comment
    }),
    onSuccess: async () => {
      toast.success(t('evaluations.created'));
      evaluationForm.reset({ score: undefined, comment: '' });
      if (selectedSubmission) {
        const evals = await getEvaluations(selectedSubmission.id);
        setEvaluations(prev => ({ ...prev, [selectedSubmission.id]: evals }));
      }
    },
    onError: () => toast.error(t('common.error'))
  });

  const aiEvaluationMutation = useMutation({
    mutationFn: () => createAiEvaluation(selectedSubmission!.id, { locale: i18n.language }),
    onSuccess: async () => {
      toast.success(t('evaluations.aiCreated'));
      if (selectedSubmission) {
        const evals = await getEvaluations(selectedSubmission.id);
        setEvaluations(prev => ({ ...prev, [selectedSubmission.id]: evals }));
      }
    },
    onError: (error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { status?: number } }).response === 'object'
      ) {
        const response = (error as { response: { status?: number } }).response;
        if (response.status === 409) {
          toast.error(t('evaluations.missingRubric'));
          return;
        }
        if (response.status === 500) {
          toast.error(t('evaluations.aiServiceUnavailable'));
          return;
        }
      }
      toast.error(t('common.error'));
    }
  });

  useEffect(() => {
    if (!Number.isInteger(numericTaskId) || !Number.isInteger(numericEventId)) {
      toast.error('Ruta inválida');
    }
  }, [numericTaskId, numericEventId]);

  const task = eventDetail?.tasks?.find(tk => tk.id === numericTaskId);
  const phase = eventDetail?.phases?.find(ph => ph.id === task?.phase_id) as Phase | undefined;
  const layoutSubtitle = useMemo(() => {
    if (!phase) {
      return '';
    }
    const parts: string[] = [phase.name];
    if (phase.description) {
      parts.push(phase.description);
    }
    return parts.join(' - ');
  }, [phase]);
  const taskConstraints = useMemo(() => {
    if (!task) {
      return {
        maxFiles: 1,
        maxFileSizeMb: null as number | null,
        allowedMimeTypes: [] as string[]
      };
    }
    return {
      maxFiles: task.max_files ?? 1,
      maxFileSizeMb: task.max_file_size_mb ?? null,
      allowedMimeTypes: task.allowed_mime_types ?? []
    };
  }, [task]);

  // Verificar si la tarea tiene tipo de entrega "Sin entrega"
  const hasNoDelivery = useMemo(() => {
    return task?.delivery_type === 'none';
  }, [task?.delivery_type]);

  // Verificar si es fase 0
  const isPhaseZero = useMemo(() => {
    if (!phase) return false;
    const normalizedName = phase.name?.toLowerCase() ?? '';
    return (
      phase.order_index === 0 ||
      normalizedName.includes('fase 0') ||
      normalizedName.includes('phase 0')
    );
  }, [phase]);

  // Función para verificar si una tarea está en su periodo válido
  const periodStatus = useMemo(() => {
    if (!task || !phase) {
      return { isValid: false, reason: 'no_dates' as const };
    }

    const startDate = phase.start_date ? parseDate(phase.start_date) : null;
    const endDate = phase.end_date ? parseDate(phase.end_date) : null;

    // Si no hay fechas, permitir entregas (comportamiento por defecto)
    if (!startDate && !endDate) {
      return { isValid: true, reason: 'valid' as const };
    }

    const now = new Date();
    const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (startDate) {
      const startNormalized = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      if (nowNormalized < startNormalized) {
        return { isValid: false, reason: 'not_started' as const };
      }
    }

    if (endDate) {
      const endNormalized = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
      if (nowNormalized > endNormalized) {
        return { isValid: false, reason: 'ended' as const };
      }
    }

    return { isValid: true, reason: 'valid' as const };
  }, [task, phase]);

  if (eventLoading || submissionsLoading || teamsLoading) {
    return <Spinner fullHeight />;
  }

  if (!task) {
    return <div className="p-6 text-sm text-destructive">Tarea no encontrada</div>;
  }

  const onSubmit = (values: SubmissionFormValues) => {
    if (files.length > 0 && task?.delivery_type === 'text') {
      toast.error(t('submissions.filesNotAllowed'));
      return;
    }
    createSubmissionMutation.mutate(values);
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = event => {
    const incomingFiles = Array.from(event.target.files ?? []);
    if (!incomingFiles.length) {
      return;
    }

    const { maxFiles, maxFileSizeMb, allowedMimeTypes } = taskConstraints;
    const nextFiles: File[] = [];

    for (const file of incomingFiles) {
      if (files.length + nextFiles.length >= maxFiles) {
        toast.warning(t('submissions.maxFilesReached', { count: maxFiles }));
        break;
      }

      if (maxFileSizeMb && file.size > maxFileSizeMb * 1024 * 1024) {
        toast.error(t('submissions.fileTooLarge', { name: file.name, size: maxFileSizeMb }));
        continue;
      }

      if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
        toast.error(t('submissions.fileTypeNotAllowed', { name: file.name }));
        continue;
      }

      nextFiles.push(file);
    }

    if (nextFiles.length) {
      setFiles(prev => [...prev, ...nextFiles]);
    }

    event.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  return (
    <DashboardLayout title={eventDetail?.name ?? ''} subtitle={layoutSubtitle}>
      <div className="space-y-6">
        {task && phase ? (
          <TaskContextCard
            task={task}
            phase={phase}
            locale={locale}
            defaultExpanded={true}
            showActions={false}
            eventId={numericEventId}
            isPhaseZero={isPhaseZero}
            periodStatus={periodStatus}
          />
        ) : null}

        {!hasNoDelivery && (
          <>
            {!isTeamCaptain && !isReviewer ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('submissions.register')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t('submissions.notTeamCaptain')}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{t('submissions.register')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField label={t('submissions.description')} htmlFor="submission-content">
                    <Textarea id="submission-content" rows={4} {...form.register('content')} />
                  </FormField>
                  <FormField
                    label={t('submissions.attachments')}
                    htmlFor="submission-file"
                    description={t('submissions.filesHelper', {
                      count: taskConstraints.maxFiles,
                      maxSize: taskConstraints.maxFileSizeMb ?? t('submissions.unlimited'),
                      types: taskConstraints.allowedMimeTypes.length
                        ? taskConstraints.allowedMimeTypes.join(', ')
                        : t('submissions.anyMime')
                    })}
                  >
                    <>
                      <Input
                        id="submission-file"
                        type="file"
                        multiple={taskConstraints.maxFiles > 1}
                        onChange={handleFileChange}
                        accept={taskConstraints.allowedMimeTypes.length ? taskConstraints.allowedMimeTypes.join(',') : undefined}
                      />
                      <FileUploadList files={files} onRemove={handleRemoveFile} />
                    </>
                  </FormField>
                  <FormField label={t('submissions.type')}>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" value="draft" {...form.register('status')} /> {t('submissions.draft')}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" value="final" {...form.register('status')} /> {t('submissions.final')}
                      </label>
                    </div>
                  </FormField>
                  <Button type="submit" disabled={createSubmissionMutation.isPending}>
                    {createSubmissionMutation.isPending ? t('common.loading') : t('submissions.submit')}
                  </Button>
                </form>
              </CardContent>
            </Card>
            )}
          </>
        )}

        {!hasNoDelivery && (
          <Card>
            <CardHeader>
              <CardTitle>{t('submissions.list')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {submissions?.length ? submissions.map(submission => (
              <div key={submission.id} className="rounded-md border border-border p-4">
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{new Date(submission.submitted_at).toLocaleString()}</span>
                  {submission.content ? <span>{submission.content}</span> : null}
                  {submission.files?.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {submission.files.map(file => (
                        <li key={file.id}>
                          <a className="text-primary underline" href={file.url} target="_blank" rel="noreferrer">
                            {file.original_name}
                          </a>{' '}
                          · {(file.size_bytes / 1024 / 1024).toFixed(2)} MB · {file.mime_type}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => handleViewEvaluations(submission)}>
                    {t('submissions.viewEvaluations')}
                  </Button>
                </div>

                {selectedSubmission?.id === submission.id ? (
                  <div className="mt-3 space-y-2 rounded-md border border-dashed border-border/60 p-3 text-sm">
                    {evaluations[submission.id]?.length ? (
                      evaluations[submission.id].map(evaluation => (
                        <div key={evaluation.id}>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {t('submissions.score')}: {evaluation.score ?? 'N/A'}
                            </p>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs',
                                evaluation.source === 'ai_assisted'
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {evaluation.source === 'ai_assisted' ? t('evaluations.aiBadge') : t('evaluations.manualBadge')}
                            </span>
                          </div>
                          <p>{evaluation.comment}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('submissions.evaluatedAt')}: {new Date(evaluation.created_at).toLocaleString()}
                          </p>
                          {evaluation.metadata?.criteria?.length ? (
                            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                              {evaluation.metadata.criteria.map((criterion, idx) => (
                                <li key={`${evaluation.id}-criterion-${idx}`}>
                                  {t('evaluations.criteriaScore', {
                                    index: idx + 1,
                                    score: criterion.score ?? 'N/A'
                                  })}: {criterion.feedback}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">{t('submissions.noEvaluations')}</p>
                    )}
                    {isReviewer ? (
                      <form
                        className="mt-3 space-y-3"
                        onSubmit={evaluationForm.handleSubmit(values => evaluationMutation.mutate(values))}
                      >
                        <FormGrid columns={2}>
                          <FormField label={t('evaluations.score')} htmlFor="evaluation-score">
                            <Input
                              id="evaluation-score"
                              type="number"
                              step="0.1"
                              {...evaluationForm.register('score', { valueAsNumber: true })}
                            />
                          </FormField>
                          <FormField className="md:col-span-2" label={t('evaluations.comment')} htmlFor="evaluation-comment">
                            <Textarea id="evaluation-comment" rows={3} {...evaluationForm.register('comment')} />
                          </FormField>
                        </FormGrid>
                        <div className="flex flex-wrap gap-3 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={aiEvaluationMutation.isPending}
                            onClick={() => aiEvaluationMutation.mutate()}
                          >
                            {aiEvaluationMutation.isPending ? t('evaluations.generatingAi') : t('evaluations.generateAi')}
                          </Button>
                          <Button type="submit" size="sm" disabled={evaluationMutation.isPending}>
                            {evaluationMutation.isPending ? t('common.loading') : t('evaluations.submit')}
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
              )) : (
                <p className="text-sm text-muted-foreground">{t('submissions.noSubmissions')}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default TaskSubmissionPage;

