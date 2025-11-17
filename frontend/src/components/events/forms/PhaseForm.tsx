import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormGrid } from '@/components/form';
import { HtmlFieldWithPreview } from '../HtmlFieldWithPreview';
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
            label={t('events.phaseName')}
            htmlFor={`${idPrefix}-name`}
            error={translateError(errors.name?.message)}
            required
          >
            <Input id={`${idPrefix}-name`} {...register('name')} />
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
          label={t('events.phaseIntroHtml')}
          htmlFor={`${idPrefix}-intro-html`}
          error={translateError(errors.intro_html?.message)}
          description={t('events.phaseIntroHtmlHint')}
        >
          <HtmlFieldWithPreview
            id={`${idPrefix}-intro-html`}
            register={register('intro_html')}
            watch={watch}
            fieldName="intro_html"
            rows={showBasic ? 4 : 30}
            previewTitle={t('events.phaseIntroHtmlPreview')}
            eventId={eventId}
          />
        </FormField>
      )}
      {showBasic && (
        <>
        <FormGrid columns={2}>
        <FormField
          label={t('events.phaseStart')}
          htmlFor={`${idPrefix}-start`}
          error={translateError(errors.start_date?.message)}
        >
          <Input id={`${idPrefix}-start`} type="date" {...register('start_date')} />
        </FormField>
        <FormField
          label={t('events.phaseEnd')}
          htmlFor={`${idPrefix}-end`}
          error={translateError(errors.end_date?.message)}
        >
          <Input id={`${idPrefix}-end`} type="date" {...register('end_date')} />
        </FormField>
        <FormField
          label={t('events.phaseViewStart')}
          htmlFor={`${idPrefix}-view-start`}
          error={translateError(errors.view_start_date?.message)}
        >
          <Input id={`${idPrefix}-view-start`} type="date" {...register('view_start_date')} />
        </FormField>
        <FormField
          label={t('events.phaseViewEnd')}
          htmlFor={`${idPrefix}-view-end`}
          error={translateError(errors.view_end_date?.message)}
          description={t('events.phaseVisibilityHint')}
        >
          <Input id={`${idPrefix}-view-end`} type="date" {...register('view_end_date')} />
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
          <input type="checkbox" {...register('is_elimination')} />
          {t('events.phaseElimination')}
        </label>
        {!hideSubmitButton && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.loading') : t('events.phaseCreate')}
          </Button>
        )}
        </>
      )}
    </form>
  );
}


