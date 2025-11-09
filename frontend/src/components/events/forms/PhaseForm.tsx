import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormGrid } from '@/components/form';
import type { PhaseFormValues } from './schemas';

type PhaseFormProps = {
  form: UseFormReturn<PhaseFormValues>;
  onSubmit: (values: PhaseFormValues) => void;
  isSubmitting?: boolean;
};

export function PhaseForm({ form, onSubmit, isSubmitting }: PhaseFormProps) {
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
          label={t('events.phaseName')}
          htmlFor="phase-name"
          error={translateError(errors.name?.message)}
          required
        >
          <Input id="phase-name" {...register('name')} />
        </FormField>
        <FormField
          label={t('events.description')}
          htmlFor="phase-description"
          error={translateError(errors.description?.message)}
        >
          <Input id="phase-description" {...register('description')} />
        </FormField>
        <FormField
          label={t('events.phaseStart')}
          htmlFor="phase-start"
          error={translateError(errors.start_date?.message)}
        >
          <Input id="phase-start" type="date" {...register('start_date')} />
        </FormField>
        <FormField
          label={t('events.phaseEnd')}
          htmlFor="phase-end"
          error={translateError(errors.end_date?.message)}
        >
          <Input id="phase-end" type="date" {...register('end_date')} />
        </FormField>
        <FormField
          label={t('events.phaseViewStart')}
          htmlFor="phase-view-start"
          error={translateError(errors.view_start_date?.message)}
        >
          <Input id="phase-view-start" type="date" {...register('view_start_date')} />
        </FormField>
        <FormField
          label={t('events.phaseViewEnd')}
          htmlFor="phase-view-end"
          error={translateError(errors.view_end_date?.message)}
          description={t('events.phaseVisibilityHint')}
        >
          <Input id="phase-view-end" type="date" {...register('view_end_date')} />
        </FormField>
      </FormGrid>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" {...register('is_elimination')} />
        {t('events.phaseElimination')}
      </label>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('events.phaseCreate')}
      </Button>
    </form>
  );
}


