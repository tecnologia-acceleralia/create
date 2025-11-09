import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormGrid } from '@/components/form';
import type { Phase, PhaseRubric } from '@/services/events';
import type { TaskFormValues } from './schemas';

type TaskFormProps = {
  form: UseFormReturn<TaskFormValues>;
  phases: Phase[];
  availableRubrics: PhaseRubric[];
  onSubmit: (values: TaskFormValues) => void;
  isSubmitting?: boolean;
};

export function TaskForm({ form, phases, availableRubrics, onSubmit, isSubmitting }: TaskFormProps) {
  const { t } = useTranslation();
  const {
    handleSubmit,
    register,
    formState: { errors }
  } = form;

  const translateError = (message?: string) => (message ? t(message, { defaultValue: message }) : undefined);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormGrid columns={2}>
        <FormField
          label={t('events.taskTitle')}
          htmlFor="task-title"
          error={translateError(errors.title?.message)}
          required
        >
          <Input id="task-title" {...register('title')} />
        </FormField>
        <FormField
          label={t('events.description')}
          htmlFor="task-description"
          error={translateError(errors.description?.message)}
        >
          <Input id="task-description" {...register('description')} />
        </FormField>
        <FormField
          label={t('events.taskPhase')}
          htmlFor="task-phase"
          error={translateError(errors.phase_id?.message)}
          required
        >
          <Select id="task-phase" {...register('phase_id', { valueAsNumber: true })}>
            <option value="">{t('events.taskPhase')}</option>
            {phases.map(phase => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label={t('events.taskType')}
          htmlFor="task-type"
          error={translateError(errors.delivery_type?.message)}
        >
          <Select id="task-type" {...register('delivery_type')}>
            <option value="file">File</option>
            <option value="text">Text</option>
            <option value="url">URL</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="zip">Zip</option>
          </Select>
        </FormField>
        <FormField
          label={t('events.taskRubric')}
          htmlFor="task-rubric"
          error={translateError(errors.phase_rubric_id?.message)}
        >
          <Select id="task-rubric" {...register('phase_rubric_id', { valueAsNumber: true })}>
            <option value="">{t('events.taskRubricNone')}</option>
            {availableRubrics.map(rubric => (
              <option key={rubric.id} value={rubric.id}>
                {rubric.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label={t('events.taskMaxFiles')}
          htmlFor="task-max-files"
          error={translateError(errors.max_files?.message)}
        >
          <Input id="task-max-files" type="number" min={1} {...register('max_files', { valueAsNumber: true })} />
        </FormField>
        <FormField
          label={t('events.taskMaxFileSize')}
          htmlFor="task-max-size"
          error={translateError(errors.max_file_size_mb?.message)}
        >
          <Input id="task-max-size" type="number" min={1} {...register('max_file_size_mb', { valueAsNumber: true })} />
        </FormField>
        <FormField
          className="md:col-span-2"
          label={t('events.taskAllowedMimes')}
          htmlFor="task-mime-types"
          error={translateError(errors.allowed_mime_types?.message)}
        >
          <Textarea id="task-mime-types" rows={2} placeholder="application/pdf, image/png" {...register('allowed_mime_types')} />
        </FormField>
        <FormField
          label={t('events.taskDueDate')}
          htmlFor="task-due"
          error={translateError(errors.due_date?.message)}
        >
          <Input id="task-due" type="date" {...register('due_date')} />
        </FormField>
      </FormGrid>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" {...register('is_required')} />
        {t('events.taskRequired')}
      </label>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('events.taskCreate')}
      </Button>
    </form>
  );
}


