import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { PageHeader, Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getEventDetail } from '@/services/events';
import { createSubmission, getSubmissions, getEvaluations, createEvaluation, type Submission, type Evaluation } from '@/services/submissions';
import { useAuth } from '@/context/AuthContext';

const submissionSchema = z.object({
  content: z.string().optional(),
  attachment_url: z.string().url().optional().or(z.literal('')),
  status: z.enum(['draft', 'final']).default('final')
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const { user } = useAuth();
  const isReviewer = ['mentor', 'organizer', 'tenant_admin'].includes(user?.role?.scope ?? '');

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
    mutationFn: (values: SubmissionFormValues) => createSubmission(numericTaskId, {
      content: values.content,
      attachment_url: values.attachment_url || undefined,
      status: values.status,
      type: values.status === 'final' ? 'final' : 'provisional'
    }),
    onSuccess: () => {
      toast.success(t('submissions.created'));
      form.reset({ status: 'final', content: '', attachment_url: '' });
      void queryClient.invalidateQueries({ queryKey: ['submissions', numericTaskId] });
    },
    onError: () => toast.error(t('common.error'))
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

  useEffect(() => {
    if (!Number.isInteger(numericTaskId) || !Number.isInteger(numericEventId)) {
      toast.error('Ruta inválida');
    }
  }, [numericTaskId, numericEventId]);

  const task = eventDetail?.tasks?.find(tk => tk.id === numericTaskId);

  if (eventLoading || submissionsLoading) {
    return <Spinner fullHeight />;
  }

  if (!task) {
    return <div className="p-6 text-sm text-destructive">Tarea no encontrada</div>;
  }

  const onSubmit = (values: SubmissionFormValues) => createSubmissionMutation.mutate(values);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={task.title} subtitle={task.description} />

      <Card>
        <CardHeader>
          <CardTitle>{t('submissions.register')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="submission-content">{t('submissions.description')}</label>
              <Textarea id="submission-content" rows={4} {...form.register('content')} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="submission-attachment">{t('submissions.attachment')}</label>
              <Input id="submission-attachment" placeholder="https://" {...form.register('attachment_url')} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">{t('submissions.type')}</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="draft" {...form.register('status')} /> {t('submissions.draft')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="final" {...form.register('status')} /> {t('submissions.final')}
                </label>
              </div>
            </div>
            <Button type="submit" disabled={createSubmissionMutation.isLoading}>
              {createSubmissionMutation.isLoading ? t('common.loading') : t('submissions.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>

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
                {submission.attachment_url ? (
                  <a className="text-primary underline" href={submission.attachment_url} target="_blank" rel="noreferrer">
                    {submission.attachment_url}
                  </a>
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
                        <p className="font-medium">{t('submissions.score')}: {evaluation.score ?? 'N/A'}</p>
                        <p>{evaluation.comment}</p>
                        <p className="text-xs text-muted-foreground">{t('submissions.evaluatedAt')}: {new Date(evaluation.created_at).toLocaleString()}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">{t('submissions.noEvaluations')}</p>
                  )}
                  {isReviewer ? (
                    <form onSubmit={evaluationForm.handleSubmit(values => evaluationMutation.mutate(values))} className="mt-3 space-y-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium" htmlFor="evaluation-score">{t('evaluations.score')}</label>
                        <Input id="evaluation-score" type="number" step="0.1" {...evaluationForm.register('score', { valueAsNumber: true })} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium" htmlFor="evaluation-comment">{t('evaluations.comment')}</label>
                        <Textarea id="evaluation-comment" rows={3} {...evaluationForm.register('comment')} />
                      </div>
                      <Button type="submit" size="sm" disabled={evaluationMutation.isLoading}>
                        {evaluationMutation.isLoading ? t('common.loading') : t('evaluations.submit')}
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          )) : <p className="text-sm text-muted-foreground">{t('submissions.noSubmissions')}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default TaskSubmissionPage;

