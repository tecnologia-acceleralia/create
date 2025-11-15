import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormGrid } from '@/components/form';
import { HtmlFieldWithPreview } from '../HtmlFieldWithPreview';
import type { Phase, PhaseRubric } from '@/services/events';
import type { TaskFormValues } from './schemas';

type TaskFormProps = {
  form: UseFormReturn<TaskFormValues>;
  phases: Phase[];
  availableRubrics: PhaseRubric[];
  onSubmit: (values: TaskFormValues) => void;
  isSubmitting?: boolean;
  hideSubmitButton?: boolean;
  idPrefix?: string;
  sections?: ('basic' | 'html')[];
};

export function TaskForm({ form, phases, availableRubrics, onSubmit, isSubmitting, hideSubmitButton, idPrefix = 'task', sections = ['basic', 'html'] }: TaskFormProps) {
  const { t } = useTranslation();
  const {
    handleSubmit,
    register,
    watch,
    formState: { errors }
  } = form;

  const translateError = (message?: string) => (message ? t(message, { defaultValue: message }) : undefined);
  const showBasic = sections.includes('basic');
  const showHtml = sections.includes('html');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {showBasic && (
        <FormGrid columns={2}>
          <FormField
            label={t('events.taskTitle')}
            htmlFor={`${idPrefix}-title`}
            error={translateError(errors.title?.message)}
            required
          >
            <Input id={`${idPrefix}-title`} {...register('title')} />
          </FormField>
          <FormField
            label={t('events.description')}
            htmlFor={`${idPrefix}-description`}
            error={translateError(errors.description?.message)}
          >
            <Input id={`${idPrefix}-description`} {...register('description')} />
          </FormField>
        </FormGrid>
      )}
      {showHtml && (
        <FormField
          className={showBasic ? 'md:col-span-2' : 'h-full flex flex-col'}
          label={t('events.taskIntroHtml')}
          htmlFor={`${idPrefix}-intro-html`}
          error={translateError(errors.intro_html?.message)}
          description={t('events.taskIntroHtmlHint')}
        >
          <HtmlFieldWithPreview
            id={`${idPrefix}-intro-html`}
            register={register('intro_html')}
            watch={watch}
            fieldName="intro_html"
            rows={showBasic ? 4 : 30}
            previewTitle={t('events.taskIntroHtmlPreview')}
          />
        </FormField>
      )}
      {showBasic && (
        <>
        <FormGrid columns={2}>
        <FormField
          label={t('events.taskPhase')}
          htmlFor={`${idPrefix}-phase`}
          error={translateError(errors.phase_id?.message)}
          required
        >
          <Select id={`${idPrefix}-phase`} {...register('phase_id', { valueAsNumber: true })}>
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
          htmlFor={`${idPrefix}-type`}
          error={translateError(errors.delivery_type?.message)}
        >
          <Select id={`${idPrefix}-type`} {...register('delivery_type')}>
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
          htmlFor={`${idPrefix}-rubric`}
          error={translateError(errors.phase_rubric_id?.message)}
        >
          <Select id={`${idPrefix}-rubric`} {...register('phase_rubric_id', { valueAsNumber: true })}>
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
          htmlFor={`${idPrefix}-max-files`}
          error={translateError(errors.max_files?.message)}
        >
          <Input id={`${idPrefix}-max-files`} type="number" min={1} {...register('max_files', { valueAsNumber: true })} />
        </FormField>
        <FormField
          label={t('events.taskMaxFileSize')}
          htmlFor={`${idPrefix}-max-size`}
          error={translateError(errors.max_file_size_mb?.message)}
        >
          <Input id={`${idPrefix}-max-size`} type="number" min={1} {...register('max_file_size_mb', { valueAsNumber: true })} />
        </FormField>
        <FormField
          className="md:col-span-2"
          label={t('events.taskAllowedMimes')}
          htmlFor={`${idPrefix}-mime-types`}
          error={translateError(errors.allowed_mime_types?.message)}
        >
          <Textarea id={`${idPrefix}-mime-types`} rows={2} placeholder="application/pdf, image/png" {...register('allowed_mime_types')} />
        </FormField>
        <FormField
          label={t('events.taskDueDate')}
          htmlFor={`${idPrefix}-due`}
          error={translateError(errors.due_date?.message)}
        >
          <Input id={`${idPrefix}-due`} type="date" {...register('due_date')} />
        </FormField>
        <FormField
          label={t('events.orderIndex')}
          htmlFor={`${idPrefix}-order-index`}
          error={translateError(errors.order_index?.message)}
        >
          <Input id={`${idPrefix}-order-index`} type="number" min={0} {...register('order_index', { valueAsNumber: true })} />
        </FormField>
        </FormGrid>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" {...register('is_required')} />
          {t('events.taskRequired')}
        </label>
        {!hideSubmitButton && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.loading') : t('events.taskCreate')}
          </Button>
        )}
        </>
      )}
    </form>
  );
}


