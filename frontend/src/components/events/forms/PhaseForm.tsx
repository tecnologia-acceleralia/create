import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormGrid } from '@/components/form';
import { RichTextEditor } from '../RichTextEditor';
import { MultiLanguageField } from '@/components/common/MultiLanguageField';
import { normalizeMultilingualValue } from '@/utils/multilingual';
import { safeTranslate } from '@/utils/i18n-helpers';
import type { PhaseFormValues } from './schemas';

type PhaseFormProps = {
  form: UseFormReturn<PhaseFormValues>;
  onSubmit: (values: PhaseFormValues) => void;
  isSubmitting?: boolean;
  hideSubmitButton?: boolean;
  idPrefix?: string;
  sections?: ('basic' | 'html')[];
  eventId?: number;
};

export function PhaseForm({ form, onSubmit, isSubmitting, hideSubmitButton, idPrefix = 'phase', sections = ['basic', 'html'], eventId }: PhaseFormProps) {
  const { t } = useTranslation();
  const {
    handleSubmit,
    register,
    control,
    watch,
    formState: { errors }
  } = form;

  const translateError = (message?: string) => (message ? safeTranslate(t, message, { defaultValue: message }) : undefined);
  const showBasic = sections.includes('basic');
  const showHtml = sections.includes('html');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {showBasic && (
        <FormGrid columns={2}>
          <FormField
            className="md:col-span-2"
            label={safeTranslate(t, 'events.phaseName')}
            htmlFor={`${idPrefix}-name`}
            error={translateError(errors.name?.message)}
            required
          >
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <MultiLanguageField
                  value={normalizeMultilingualValue(field.value)}
                  onChange={(value) => field.onChange(value)}
                  renderField={(value, onChange) => (
                    <Input
                      id={`${idPrefix}-name`}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                    />
                  )}
                  label=""
                  required
                  error={translateError(errors.name?.message)}
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
              label={safeTranslate(t, 'events.phaseIntroHtml')}
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
          label={safeTranslate(t, 'events.phaseStart')}
          htmlFor={`${idPrefix}-start`}
          error={translateError(errors.start_date?.message)}
        >
          <Input id={`${idPrefix}-start`} type="date" {...register('start_date')} />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.phaseEnd')}
          htmlFor={`${idPrefix}-end`}
          error={translateError(errors.end_date?.message)}
        >
          <Input id={`${idPrefix}-end`} type="date" {...register('end_date')} />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.phaseViewStart')}
          htmlFor={`${idPrefix}-view-start`}
          error={translateError(errors.view_start_date?.message)}
        >
          <Input id={`${idPrefix}-view-start`} type="date" {...register('view_start_date')} />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.phaseViewEnd')}
          htmlFor={`${idPrefix}-view-end`}
          error={translateError(errors.view_end_date?.message)}
          description={safeTranslate(t, 'events.phaseVisibilityHint')}
        >
          <Input id={`${idPrefix}-view-end`} type="date" {...register('view_end_date')} />
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
          <input type="checkbox" {...register('is_elimination')} />
          {safeTranslate(t, 'events.phaseElimination')}
        </label>
        {!hideSubmitButton && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'events.phaseCreate')}
          </Button>
        )}
        </>
      )}
    </form>
  );
}


