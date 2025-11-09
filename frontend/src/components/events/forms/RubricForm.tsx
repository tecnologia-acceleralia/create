import type { FieldArrayWithId, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormGrid } from '@/components/form';
import type { Phase } from '@/services/events';
import type { RubricFormValues } from './schemas';

type RubricFormProps = {
  form: UseFormReturn<RubricFormValues>;
  phases: Phase[];
  criteriaFields: Array<FieldArrayWithId<RubricFormValues, 'criteria', 'fieldId'>>;
  onAddCriterion: () => void;
  onRemoveCriterion: (index: number) => void;
  onSubmit: (values: RubricFormValues) => void;
  onCancelEdit?: () => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
};

export function RubricForm({
  form,
  phases,
  criteriaFields,
  onAddCriterion,
  onRemoveCriterion,
  onSubmit,
  onCancelEdit,
  isSubmitting,
  isEditing
}: RubricFormProps) {
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
          label={t('events.rubricPhase')}
          htmlFor="rubric-phase"
          error={translateError(errors.phase_id?.message)}
          required
        >
          <Select id="rubric-phase" {...register('phase_id', { valueAsNumber: true })} disabled={!phases.length}>
            {phases.map(phase => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label={t('events.rubricName')}
          htmlFor="rubric-name"
          error={translateError(errors.name?.message)}
          required
        >
          <Input id="rubric-name" {...register('name')} />
        </FormField>
        <FormField className="md:col-span-2" label={t('events.rubricDescription')} htmlFor="rubric-description">
          <Textarea id="rubric-description" rows={2} {...register('description')} />
        </FormField>
        <FormField
          label={t('events.rubricScaleMin')}
          htmlFor="rubric-scale-min"
          error={translateError(errors.scale_min?.message)}
        >
          <Input
            id="rubric-scale-min"
            type="number"
            step="0.1"
            {...register('scale_min', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label={t('events.rubricScaleMax')}
          htmlFor="rubric-scale-max"
          error={translateError(errors.scale_max?.message)}
        >
          <Input
            id="rubric-scale-max"
            type="number"
            step="0.1"
            {...register('scale_max', { valueAsNumber: true })}
          />
        </FormField>
        <FormField className="md:col-span-2" label={t('events.rubricModelPreference')} htmlFor="rubric-model">
          <Input id="rubric-model" placeholder="gpt-4o-mini" {...register('model_preference')} />
        </FormField>
      </FormGrid>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{t('events.rubricCriteriaTitle')}</p>
          <Button type="button" size="sm" variant="secondary" onClick={onAddCriterion}>
            {t('events.rubricAddCriterion')}
          </Button>
        </div>
        <div className="space-y-4">
          {criteriaFields.map((field, index) => {
            const fieldErrors = errors.criteria?.[index];

            return (
              <div key={field.fieldId} className="rounded-lg border border-border/70 p-4">
                <FormGrid columns={2}>
                  <FormField
                    label={t('events.rubricCriterionTitle')}
                    htmlFor={`criterion-title-${index}`}
                    error={translateError(fieldErrors?.title?.message)}
                    required
                  >
                    <Input id={`criterion-title-${index}`} {...register(`criteria.${index}.title` as const)} />
                  </FormField>
                  <FormField
                    label={t('events.rubricCriterionWeight')}
                    htmlFor={`criterion-weight-${index}`}
                    error={translateError(fieldErrors?.weight?.message)}
                  >
                    <Input
                      id={`criterion-weight-${index}`}
                      type="number"
                      step="0.1"
                      {...register(`criteria.${index}.weight` as const, { valueAsNumber: true })}
                    />
                  </FormField>
                  <FormField
                    className="md:col-span-2"
                    label={t('events.rubricCriterionDescription')}
                    htmlFor={`criterion-description-${index}`}
                    error={translateError(fieldErrors?.description?.message)}
                  >
                    <Textarea
                      id={`criterion-description-${index}`}
                      rows={2}
                      {...register(`criteria.${index}.description` as const)}
                    />
                  </FormField>
                  <FormField
                    label={t('events.rubricCriterionMaxScore')}
                    htmlFor={`criterion-max-score-${index}`}
                    error={translateError(fieldErrors?.max_score?.message)}
                  >
                    <Input
                      id={`criterion-max-score-${index}`}
                      type="number"
                      step="0.1"
                      {...register(`criteria.${index}.max_score` as const, { valueAsNumber: true })}
                    />
                  </FormField>
                  <FormField
                    label={t('events.rubricCriterionOrder')}
                    htmlFor={`criterion-order-${index}`}
                    error={translateError(fieldErrors?.order_index?.message)}
                  >
                    <Input
                      id={`criterion-order-${index}`}
                      type="number"
                      {...register(`criteria.${index}.order_index` as const, { valueAsNumber: true })}
                    />
                  </FormField>
                </FormGrid>
                {criteriaFields.length > 1 ? (
                  <div className="mt-3 flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveCriterion(index)}>
                      {t('events.rubricRemoveCriterion')}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {isEditing ? (
          <Button type="button" variant="outline" onClick={onCancelEdit}>
            {t('events.rubricCancelEdit')}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : isEditing ? t('events.rubricUpdateAction') : t('events.rubricCreateAction')}
        </Button>
      </div>
    </form>
  );
}


