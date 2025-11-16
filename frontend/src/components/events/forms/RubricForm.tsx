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
  hideSubmitButton?: boolean;
  idPrefix?: string;
  sections?: ('basic' | 'criteria')[];
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
  isEditing,
  hideSubmitButton,
  idPrefix = 'rubric',
  sections = ['basic', 'criteria']
}: RubricFormProps) {
  const { t } = useTranslation();
  const {
    handleSubmit,
    register,
    formState: { errors }
  } = form;

  const translateError = (message?: string) => (message ? t(message, { defaultValue: message }) : undefined);
  const showBasic = sections.includes('basic');
  const showCriteria = sections.includes('criteria');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {showBasic && (
        <FormGrid columns={2}>
        <FormField
          label={t('events.rubricScope')}
          htmlFor={`${idPrefix}-scope`}
          error={translateError(errors.rubric_scope?.message)}
          required
        >
          <Select id={`${idPrefix}-scope`} {...register('rubric_scope')}>
            <option value="phase">{t('events.rubricScopePhase')}</option>
            <option value="project">{t('events.rubricScopeProject')}</option>
          </Select>
        </FormField>
        {form.watch('rubric_scope') === 'phase' && (
          <FormField
            label={t('events.rubricPhase')}
            htmlFor={`${idPrefix}-phase`}
            error={translateError(errors.phase_id?.message)}
            required
          >
            <Select id={`${idPrefix}-phase`} {...register('phase_id', { valueAsNumber: true })} disabled={!phases.length}>
              {phases.map(phase => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField
          label={t('events.rubricName')}
          htmlFor={`${idPrefix}-name`}
          error={translateError(errors.name?.message)}
          required
        >
          <Input id={`${idPrefix}-name`} {...register('name')} />
        </FormField>
        <FormField className="md:col-span-2" label={t('events.rubricDescription')} htmlFor={`${idPrefix}-description`}>
          <Textarea id={`${idPrefix}-description`} rows={2} {...register('description')} />
        </FormField>
        <FormField
          label={t('events.rubricScaleMin')}
          htmlFor={`${idPrefix}-scale-min`}
          error={translateError(errors.scale_min?.message)}
        >
          <Input
            id={`${idPrefix}-scale-min`}
            type="number"
            step="0.1"
            {...register('scale_min', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label={t('events.rubricScaleMax')}
          htmlFor={`${idPrefix}-scale-max`}
          error={translateError(errors.scale_max?.message)}
        >
          <Input
            id={`${idPrefix}-scale-max`}
            type="number"
            step="0.1"
            {...register('scale_max', { valueAsNumber: true })}
          />
        </FormField>
        <FormField className="md:col-span-2" label={t('events.rubricModelPreference')} htmlFor={`${idPrefix}-model`}>
          <Input id={`${idPrefix}-model`} placeholder="gpt-4o-mini" {...register('model_preference')} />
        </FormField>
        </FormGrid>
      )}

      {showCriteria && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{t('events.rubricCriteriaTitle')}</p>
            <Button type="button" size="sm" variant="outline" onClick={onAddCriterion}>
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
                      htmlFor={`${idPrefix}-criterion-title-${index}`}
                      error={translateError(fieldErrors?.title?.message)}
                      required
                    >
                      <Input id={`${idPrefix}-criterion-title-${index}`} {...register(`criteria.${index}.title` as const)} />
                    </FormField>
                    <FormField
                      label={t('events.rubricCriterionWeight')}
                      htmlFor={`${idPrefix}-criterion-weight-${index}`}
                      error={translateError(fieldErrors?.weight?.message)}
                    >
                      <Input
                        id={`${idPrefix}-criterion-weight-${index}`}
                        type="number"
                        step="0.1"
                        {...register(`criteria.${index}.weight` as const, { valueAsNumber: true })}
                      />
                    </FormField>
                    <FormField
                      className="md:col-span-2"
                      label={t('events.rubricCriterionDescription')}
                      htmlFor={`${idPrefix}-criterion-description-${index}`}
                      error={translateError(fieldErrors?.description?.message)}
                    >
                      <Textarea
                        id={`${idPrefix}-criterion-description-${index}`}
                        rows={2}
                        {...register(`criteria.${index}.description` as const)}
                      />
                    </FormField>
                    <FormField
                      label={t('events.rubricCriterionMaxScore')}
                      htmlFor={`${idPrefix}-criterion-max-score-${index}`}
                      error={translateError(fieldErrors?.max_score?.message)}
                    >
                      <Input
                        id={`${idPrefix}-criterion-max-score-${index}`}
                        type="number"
                        step="0.1"
                        {...register(`criteria.${index}.max_score` as const, { valueAsNumber: true })}
                      />
                    </FormField>
                    <FormField
                      label={t('events.rubricCriterionOrder')}
                      htmlFor={`${idPrefix}-criterion-order-${index}`}
                      error={translateError(fieldErrors?.order_index?.message)}
                    >
                      <Input
                        id={`${idPrefix}-criterion-order-${index}`}
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
      )}

      {!hideSubmitButton && (
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
      )}
    </form>
  );
}


