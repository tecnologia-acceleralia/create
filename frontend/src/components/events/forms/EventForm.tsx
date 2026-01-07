import type { UseFormReturn } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField, FormGrid } from '@/components/form';
import { RegistrationSchemaForm } from './RegistrationSchemaForm';
import { RichTextEditor } from '../RichTextEditor';
import { InfoTooltip } from '@/components/common';
import { MultiLanguageField } from '@/components/common/MultiLanguageField';
import { normalizeMultilingualValue } from '@/utils/multilingual';
import { safeTranslate } from '@/utils/i18n-helpers';
import type { EventFormValues } from './schemas';

type EventFormProps = {
  form: UseFormReturn<EventFormValues>;
  onSubmit: (values: EventFormValues) => void;
  isSubmitting?: boolean;
  hideSubmitButton?: boolean;
  idPrefix?: string;
  sections?: ('basic' | 'html' | 'registration' | 'ai_evaluation')[];
  eventId?: number;
};

export function EventForm({ form, onSubmit, isSubmitting, hideSubmitButton, idPrefix = 'event', sections = ['basic', 'html', 'registration'], eventId }: EventFormProps) {
  const { t } = useTranslation();
  const {
    handleSubmit,
    register,
    control,
    formState: { errors },
    watch
  } = form;
  
  const registrationSchemaValue = watch('registration_schema');

  const translateError = (message?: string) => (message ? safeTranslate(t, message, { defaultValue: message }) : undefined);
  const showBasic = sections.includes('basic');
  const showHtml = sections.includes('html');
  const showRegistrationSchema = sections.includes('registration');
  const showAiEvaluation = sections.includes('ai_evaluation');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {showBasic && (
        <FormGrid columns={2}>
          <FormField
            className="md:col-span-2"
            label={safeTranslate(t, 'events.name')}
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
          name="description_html"
          control={control}
          render={({ field }) => (
            <MultiLanguageField
              value={normalizeMultilingualValue(field.value)}
              onChange={(value) => field.onChange(value)}
              isHtml
              renderField={(value, onChange, language) => {
                const isFullSize = (showBasic ? 10 : 30) >= 20;
                const minHeight = isFullSize ? 'calc(90vh - 200px)' : `${(showBasic ? 10 : 30) * 24}px`;
                return (
                  <RichTextEditor
                    id={`${idPrefix}-description-html-${language}`}
                    value={value || ''}
                    onChange={onChange}
                    placeholder={safeTranslate(t, 'events.descriptionHtmlPlaceholder')}
                    minHeight={minHeight}
                    className={isFullSize ? 'h-full flex-1' : ''}
                    eventId={eventId}
                  />
                );
              }}
              label={safeTranslate(t, 'events.descriptionHtml')}
              error={translateError(errors.description_html?.message)}
              className={showBasic ? 'md:col-span-2' : 'h-full flex flex-col'}
            />
          )}
        />
      )}
      {showBasic && (
        <>
        <FormGrid columns={2}>
        <FormField
          label={safeTranslate(t, 'events.start')}
          htmlFor={`${idPrefix}-start`}
          error={translateError(errors.start_date?.message)}
          required
        >
          <Input id={`${idPrefix}-start`} type="date" {...register('start_date')} />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.end')}
          htmlFor={`${idPrefix}-end`}
          error={translateError(errors.end_date?.message)}
          required
        >
          <Input id={`${idPrefix}-end`} type="date" {...register('end_date')} />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.minTeam')}
          htmlFor={`${idPrefix}-min-team`}
          error={translateError(errors.min_team_size?.message)}
          required
        >
          <Input
            id={`${idPrefix}-min-team`}
            type="number"
            min={1}
            {...register('min_team_size', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.maxTeam')}
          htmlFor={`${idPrefix}-max-team`}
          error={translateError(errors.max_team_size?.message)}
          required
        >
          <Input
            id={`${idPrefix}-max-team`}
            type="number"
            min={1}
            {...register('max_team_size', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.statusLabel')}
          htmlFor={`${idPrefix}-status`}
          error={translateError(errors.status?.message)}
          required
        >
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                id={`${idPrefix}-status`}
                value={field.value}
                onValueChange={value => field.onChange(value)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              >
                <option value="draft">{safeTranslate(t, 'events.statusDraft')}</option>
                <option value="published">{safeTranslate(t, 'events.statusPublished')}</option>
                <option value="archived">{safeTranslate(t, 'events.statusArchived')}</option>
              </Select>
            )}
          />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.videoUrl')}
          htmlFor={`${idPrefix}-video-url`}
          error={translateError(errors.video_url?.message)}
        >
          <Input
            id={`${idPrefix}-video-url`}
            placeholder="https://www.youtube.com/watch?v=..."
            {...register('video_url')}
          />
        </FormField>
        <div className="flex items-center gap-2">
          <input
            id={`${idPrefix}-is-public`}
            type="checkbox"
            className="h-4 w-4"
            {...register('is_public')}
          />
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-is-public`}>
            {safeTranslate(t, 'events.isPublic')}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={`${idPrefix}-allow-open-registration`}
            type="checkbox"
            className="h-4 w-4"
            {...register('allow_open_registration')}
          />
          <label className="text-sm font-medium" htmlFor={`${idPrefix}-allow-open-registration`}>
            {safeTranslate(t, 'events.allowOpenRegistration')}
          </label>
        </div>
        <FormField
          label={safeTranslate(t, 'events.publishStart')}
          htmlFor={`${idPrefix}-publish-start`}
          error={translateError(errors.publish_start_at?.message)}
        >
          <Input id={`${idPrefix}-publish-start`} type="date" {...register('publish_start_at')} />
        </FormField>
        <FormField
          label={safeTranslate(t, 'events.publishEnd')}
          htmlFor={`${idPrefix}-publish-end`}
          error={translateError(errors.publish_end_at?.message)}
        >
          <Input id={`${idPrefix}-publish-end`} type="date" {...register('publish_end_at')} />
        </FormField>
        </FormGrid>
        </>
      )}
      {showRegistrationSchema && (
        <FormField
          className="md:col-span-2"
          label={safeTranslate(t, 'events.registrationSchema')}
          htmlFor={`${idPrefix}-registration-schema`}
          error={translateError(
            typeof errors.registration_schema?.message === 'string' ? errors.registration_schema.message : undefined
          )}
        >
          <RegistrationSchemaForm
            id={`${idPrefix}-registration-schema`}
            value={registrationSchemaValue}
            onChange={value => {
              form.setValue('registration_schema', value, { shouldValidate: true });
            }}
            error={
              typeof errors.registration_schema?.message === 'string' ? errors.registration_schema.message : undefined
            }
          />
        </FormField>
      )}
      {showAiEvaluation && (
        <>
          <FormField
            className="md:col-span-2"
            label={safeTranslate(t, 'events.aiEvaluationPrompt', { defaultValue: 'Prompt de Evaluación con IA' })}
            htmlFor={`${idPrefix}-ai-evaluation-prompt`}
            error={translateError(errors.ai_evaluation_prompt?.message)}
            description={safeTranslate(t, 'events.aiEvaluationPromptDescription', { 
              defaultValue: 'Define un prompt personalizado para la evaluación con IA. Si está vacío, se usará el prompt por defecto del sistema.' 
            })}
          >
            <textarea
              id={`${idPrefix}-ai-evaluation-prompt`}
              {...register('ai_evaluation_prompt')}
              rows={20}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-sm"
              placeholder={safeTranslate(t, 'events.aiEvaluationPromptPlaceholder', { 
                defaultValue: 'Eres un asistente evaluador de proyectos de emprendimiento...' 
              })}
            />
          </FormField>
          <FormGrid columns={3}>
            <FormField
              label={
                <span className="flex items-center gap-2">
                  {safeTranslate(t, 'events.aiEvaluationModel', { defaultValue: 'Modelo de OpenAI' })}
                  <InfoTooltip content={safeTranslate(t, 'events.aiEvaluationModelTooltip', { 
                    defaultValue: 'El modelo de OpenAI determina las capacidades y el coste de la evaluación. Modelos más avanzados (gpt-4o) ofrecen mejor calidad pero son más costosos. Modelos más económicos (gpt-4o-mini) son más rápidos y baratos.' 
                  })} />
                </span>
              }
              htmlFor={`${idPrefix}-ai-evaluation-model`}
              error={translateError(errors.ai_evaluation_model?.message)}
              description={safeTranslate(t, 'events.aiEvaluationModelDescription', { 
                defaultValue: 'Modelo de OpenAI a usar (ej: gpt-4o-mini, gpt-4o). Si está vacío, se usa el modelo por defecto.' 
              })}
            >
              <Input
                id={`${idPrefix}-ai-evaluation-model`}
                placeholder="gpt-4o-mini"
                {...register('ai_evaluation_model')}
              />
            </FormField>
            <FormField
              label={
                <span className="flex items-center gap-2">
                  {safeTranslate(t, 'events.aiEvaluationTemperature', { defaultValue: 'Temperatura' })}
                  <InfoTooltip content={safeTranslate(t, 'events.aiEvaluationTemperatureTooltip', { 
                    defaultValue: 'Controla la aleatoriedad de las respuestas. 0 = muy determinista y consistente (ideal para evaluaciones objetivas). 2 = muy creativo y variado. Para evaluaciones estructuradas se recomienda valores bajos (0.1-0.3).' 
                  })} />
                </span>
              }
              htmlFor={`${idPrefix}-ai-evaluation-temperature`}
              error={translateError(errors.ai_evaluation_temperature?.message)}
              description={safeTranslate(t, 'events.aiEvaluationTemperatureDescription', { 
                defaultValue: 'Temperatura (0-2). Valores más bajos = más determinista. Si está vacío, se usa 0.2.' 
              })}
            >
              <Input
                id={`${idPrefix}-ai-evaluation-temperature`}
                type="number"
                step="0.1"
                min="0"
                max="2"
                placeholder="0.2"
                {...register('ai_evaluation_temperature', { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              label={
                <span className="flex items-center gap-2">
                  {safeTranslate(t, 'events.aiEvaluationMaxTokens', { defaultValue: 'Máx. Tokens' })}
                  <InfoTooltip content={safeTranslate(t, 'events.aiEvaluationMaxTokensTooltip', { 
                    defaultValue: 'Limita la longitud máxima de la respuesta en tokens (1 token ≈ 0.75 palabras). Útil para controlar costes y asegurar respuestas concisas. Para evaluaciones con múltiples criterios, valores entre 1000-2000 suelen ser suficientes.' 
                  })} />
                </span>
              }
              htmlFor={`${idPrefix}-ai-evaluation-max-tokens`}
              error={translateError(errors.ai_evaluation_max_tokens?.message)}
              description={safeTranslate(t, 'events.aiEvaluationMaxTokensDescription', { 
                defaultValue: 'Máximo de tokens en la respuesta. Si está vacío, no se limita.' 
              })}
            >
              <Input
                id={`${idPrefix}-ai-evaluation-max-tokens`}
                type="number"
                min="1"
                placeholder="1200"
                {...register('ai_evaluation_max_tokens', { valueAsNumber: true })}
              />
            </FormField>
          </FormGrid>
          <FormGrid columns={3}>
            <FormField
              label={
                <span className="flex items-center gap-2">
                  {safeTranslate(t, 'events.aiEvaluationTopP', { defaultValue: 'Top-p (Nucleus Sampling)' })}
                  <InfoTooltip content={safeTranslate(t, 'events.aiEvaluationTopPTooltip', { 
                    defaultValue: 'Controla la diversidad considerando solo las opciones más probables. 1.0 = considera todas las opciones (máxima diversidad). 0.1 = solo las más probables (más determinista). Para evaluaciones estructuradas, valores altos (0.9-1.0) suelen funcionar bien.' 
                  })} />
                </span>
              }
              htmlFor={`${idPrefix}-ai-evaluation-top-p`}
              error={translateError(errors.ai_evaluation_top_p?.message)}
              description={safeTranslate(t, 'events.aiEvaluationTopPDescription', { 
                defaultValue: 'Top-p (0-1). Controla la diversidad. Si está vacío, se usa 1.0.' 
              })}
            >
              <Input
                id={`${idPrefix}-ai-evaluation-top-p`}
                type="number"
                step="0.1"
                min="0"
                max="1"
                placeholder="1.0"
                {...register('ai_evaluation_top_p', { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              label={
                <span className="flex items-center gap-2">
                  {safeTranslate(t, 'events.aiEvaluationFrequencyPenalty', { defaultValue: 'Penalización por Frecuencia' })}
                  <InfoTooltip content={safeTranslate(t, 'events.aiEvaluationFrequencyPenaltyTooltip', { 
                    defaultValue: 'Penaliza la repetición de palabras o frases. Valores positivos (0.1-0.5) reducen repeticiones y hacen las respuestas más variadas. Valores negativos aumentan repeticiones. Para evaluaciones estructuradas, valores entre 0.0-0.3 suelen funcionar bien.' 
                  })} />
                </span>
              }
              htmlFor={`${idPrefix}-ai-evaluation-frequency-penalty`}
              error={translateError(errors.ai_evaluation_frequency_penalty?.message)}
              description={safeTranslate(t, 'events.aiEvaluationFrequencyPenaltyDescription', { 
                defaultValue: 'Penalización por frecuencia (-2.0 a 2.0). Reduce repeticiones. Si está vacío, se usa 0.0.' 
              })}
            >
              <Input
                id={`${idPrefix}-ai-evaluation-frequency-penalty`}
                type="number"
                step="0.1"
                min="-2"
                max="2"
                placeholder="0.0"
                {...register('ai_evaluation_frequency_penalty', { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              label={
                <span className="flex items-center gap-2">
                  {safeTranslate(t, 'events.aiEvaluationPresencePenalty', { defaultValue: 'Penalización por Presencia' })}
                  <InfoTooltip content={safeTranslate(t, 'events.aiEvaluationPresencePenaltyTooltip', { 
                    defaultValue: 'Penaliza la aparición de nuevos temas o conceptos. Valores positivos (0.1-0.5) mantienen el modelo enfocado en el contexto proporcionado. Valores negativos incentivan explorar nuevos temas. Para evaluaciones estructuradas, valores entre 0.0-0.2 ayudan a mantener el foco.' 
                  })} />
                </span>
              }
              htmlFor={`${idPrefix}-ai-evaluation-presence-penalty`}
              error={translateError(errors.ai_evaluation_presence_penalty?.message)}
              description={safeTranslate(t, 'events.aiEvaluationPresencePenaltyDescription', { 
                defaultValue: 'Penalización por presencia (-2.0 a 2.0). Incentiva nuevos temas. Si está vacío, se usa 0.0.' 
              })}
            >
              <Input
                id={`${idPrefix}-ai-evaluation-presence-penalty`}
                type="number"
                step="0.1"
                min="-2"
                max="2"
                placeholder="0.0"
                {...register('ai_evaluation_presence_penalty', { valueAsNumber: true })}
              />
            </FormField>
          </FormGrid>
        </>
      )}
    </form>
  );
}

