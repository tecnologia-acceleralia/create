import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormGrid } from '@/components/form';
import { RichTextEditor } from '../RichTextEditor';
import { MultiLanguageField } from '@/components/common/MultiLanguageField';
import { normalizeMultilingualValue, getMultilingualText } from '@/utils/multilingual';
import { safeTranslate } from '@/utils/i18n-helpers';
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
  eventId?: number;
};

export function TaskForm({ form, phases, availableRubrics, onSubmit, isSubmitting, hideSubmitButton, idPrefix = 'task', sections = ['basic', 'html'], eventId }: TaskFormProps) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
  const {
    handleSubmit,
    register,
    control,
    watch,
    setValue,
    formState: { errors }
  } = form;

  const translateError = (message?: string) => (message ? safeTranslate(t, message, { defaultValue: message }) : undefined);
  const showBasic = sections.includes('basic');
  const showHtml = sections.includes('html');
  const deliveryType = watch('delivery_type');

  // Cuando delivery_type es 'none', bloquear is_required y forzarlo a false
  useEffect(() => {
    if (deliveryType === 'none') {
      setValue('is_required', false);
    }
  }, [deliveryType, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {showBasic && (
        <FormGrid columns={2}>
          <FormField
            className="md:col-span-2"
            label={safeTranslate(t, 'events.taskTitle')}
            htmlFor={`${idPrefix}-title`}
            error={translateError(errors.title?.message)}
            required
          >
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <MultiLanguageField
                  value={normalizeMultilingualValue(field.value)}
                  onChange={(value) => field.onChange(value)}
                  renderField={(value, onChange) => (
                    <Input
                      id={`${idPrefix}-title`}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                    />
                  )}
                  label=""
                  required
                  error={translateError(errors.title?.message)}
                />
              )}
            />
          </FormField>
          <FormField
            className="md:col-span-2"
            label={safeTranslate(t, 'events.description')}
            htmlFor={`${idPrefix}-description`}
            error={translateError(errors.description?.message)}
          >
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <MultiLanguageField
                  value={normalizeMultilingualValue(field.value)}
                  onChange={(value) => field.onChange(value)}
                  renderField={(value, onChange) => (
                    <Input
                      id={`${idPrefix}-description`}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                    />
                  )}
                  label=""
                  error={translateError(errors.description?.message)}
                />
              )}
            />
          </FormField>
        </FormGrid>
      )}
      {showHtml && (
        <Controller
          name="intro_html"
          control={control}
          render={({ field }) => (
            <MultiLanguageField
              value={normalizeMultilingualValue(field.value)}
              onChange={(value) => field.onChange(value)}
              isHtml
              renderField={(value, onChange, language) => {
                const isFullSize = (showBasic ? 4 : 30) >= 20;
                const minHeight = isFullSize ? 'calc(90vh - 200px)' : `${(showBasic ? 4 : 30) * 24}px`;
                return (
                  <RichTextEditor
                    id={`${idPrefix}-intro-html-${language}`}
                    value={value || ''}
                    onChange={onChange}
                    minHeight={minHeight}
                    className={isFullSize ? 'h-full flex-1' : ''}
                    eventId={eventId}
                  />
                );
              }}
              label={safeTranslate(t, 'events.taskIntroHtml')}
              error={translateError(errors.intro_html?.message)}
              className={showBasic ? 'md:col-span-2' : 'h-full flex flex-col'}
            />
          )}
        />
      )}
      {showBasic && (
        <>
        <FormGrid columns={2}>
        <FormField
          label={safeTranslate(t, 'events.taskPhase')}
          htmlFor={`${idPrefix}-phase`}
          error={translateError(errors.phase_id?.message)}
          required
        >
          <Controller
            name="phase_id"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <Select
                id={`${idPrefix}-phase`}
                value={field.value !== undefined && field.value !== null ? String(field.value) : ''}
                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                onBlur={field.onBlur}
                name={field.name}
              >
                <option value="">{safeTranslate(t, 'events.taskPhase')}</option>
                {phases.map(phase => (
                  <option key={phase.id} value={phase.id}>
                    {getMultilingualText(phase.name, currentLang)}
                  </option>
                ))}
              </Select>
            )}
          />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.taskType')}
          htmlFor={`${idPrefix}-type`}
          error={translateError(errors.delivery_type?.message)}
        >
          <Select 
            id={`${idPrefix}-type`} 
            {...register('delivery_type')}
            value={deliveryType ?? 'file'}
          >
            <option value="file">File</option>
            <option value="text">Text</option>
            <option value="url">URL</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="zip">Zip</option>
            <option value="none">{safeTranslate(t, 'events.taskDeliveryTypeNone')}</option>
          </Select>
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.taskRubric')}
          htmlFor={`${idPrefix}-rubric`}
          error={translateError(errors.phase_rubric_id?.message)}
        >
          <Select id={`${idPrefix}-rubric`} {...register('phase_rubric_id', { valueAsNumber: true })}>
            <option value="">{safeTranslate(t, 'events.taskRubricNone')}</option>
            {availableRubrics.map(rubric => (
              <option key={rubric.id} value={rubric.id}>
                {getMultilingualText(rubric.name, currentLang)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.taskMaxFiles')}
          htmlFor={`${idPrefix}-max-files`}
          error={translateError(errors.max_files?.message)}
        >
          <Input id={`${idPrefix}-max-files`} type="number" min={1} {...register('max_files', { valueAsNumber: true })} />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.taskMaxFileSize')}
          htmlFor={`${idPrefix}-max-size`}
          error={translateError(errors.max_file_size_mb?.message)}
        >
          <Input id={`${idPrefix}-max-size`} type="number" min={1} {...register('max_file_size_mb', { valueAsNumber: true })} />
        </FormField>
        <FormField
          className="md:col-span-2"
          label={safeTranslate(t, 'events.taskAllowedMimes')}
          htmlFor={`${idPrefix}-mime-types`}
          error={translateError(errors.allowed_mime_types?.message)}
        >
          <Textarea id={`${idPrefix}-mime-types`} rows={2} placeholder="application/pdf, image/png" {...register('allowed_mime_types')} />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.taskDueDate')}
          htmlFor={`${idPrefix}-due`}
          error={translateError(errors.due_date?.message)}
        >
          <Input id={`${idPrefix}-due`} type="date" {...register('due_date')} />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.orderIndex')}
          htmlFor={`${idPrefix}-order-index`}
          error={translateError(errors.order_index?.message)}
        >
          <Input id={`${idPrefix}-order-index`} type="number" min={0} {...register('order_index', { valueAsNumber: true })} />
        </FormField>
        </FormGrid>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input 
            type="checkbox" 
            {...register('is_required')} 
            disabled={deliveryType === 'none'}
          />
          {safeTranslate(t, 'events.taskRequired')}
        </label>
        {!hideSubmitButton && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'events.taskCreate')}
          </Button>
        )}
        </>
      )}
    </form>
  );
}


