import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField, FormGrid } from '@/components/form';
import { RegistrationSchemaForm } from './RegistrationSchemaForm';
import { HtmlFieldWithPreview } from '../HtmlFieldWithPreview';
import type { EventFormValues } from './schemas';

type EventFormProps = {
  form: UseFormReturn<EventFormValues>;
  onSubmit: (values: EventFormValues) => void;
  isSubmitting?: boolean;
  hideSubmitButton?: boolean;
  idPrefix?: string;
  sections?: ('basic' | 'html' | 'registration')[];
  eventId?: number;
};

export function EventForm({ form, onSubmit, isSubmitting, hideSubmitButton, idPrefix = 'event', sections = ['basic', 'html', 'registration'], eventId }: EventFormProps) {
  const { t } = useTranslation();
  const {
    handleSubmit,
    register,
    formState: { errors },
    watch
  } = form;
  
  const registrationSchemaValue = watch('registration_schema');

  const translateError = (message?: string) => (message ? t(message, { defaultValue: message }) : undefined);
  const showBasic = sections.includes('basic');
  const showHtml = sections.includes('html');
  const showRegistrationSchema = sections.includes('registration');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {showBasic && (
        <FormGrid columns={2}>
          <FormField
            label={t('events.name')}
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
          label={t('events.descriptionHtml')}
          htmlFor={`${idPrefix}-description-html`}
          error={translateError(errors.description_html?.message)}
        >
          <HtmlFieldWithPreview
            id={`${idPrefix}-description-html`}
            register={register('description_html')}
            fieldName="description_html"
            rows={showBasic ? 10 : 30}
            placeholder={t('events.descriptionHtmlPlaceholder')}
            eventId={eventId}
          />
        </FormField>
      )}
      {showBasic && (
        <>
        <FormGrid columns={2}>
        <FormField
          label={t('events.start')}
          htmlFor={`${idPrefix}-start`}
          error={translateError(errors.start_date?.message)}
          required
        >
          <Input id={`${idPrefix}-start`} type="date" {...register('start_date')} />
        </FormField>
        <FormField
          label={t('events.end')}
          htmlFor={`${idPrefix}-end`}
          error={translateError(errors.end_date?.message)}
          required
        >
          <Input id={`${idPrefix}-end`} type="date" {...register('end_date')} />
        </FormField>
        <FormField
          label={t('events.minTeam')}
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
          label={t('events.maxTeam')}
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
          label={t('events.statusLabel')}
          htmlFor={`${idPrefix}-status`}
          error={translateError(errors.status?.message)}
          required
        >
          <Select id={`${idPrefix}-status`} {...register('status')}>
            <option value="draft">{t('events.statusDraft')}</option>
            <option value="published">{t('events.statusPublished')}</option>
            <option value="archived">{t('events.statusArchived')}</option>
          </Select>
        </FormField>
        <FormField
          label={t('events.videoUrl')}
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
            {t('events.isPublic')}
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
            {t('events.allowOpenRegistration')}
          </label>
        </div>
        <FormField
          label={t('events.publishStart')}
          htmlFor={`${idPrefix}-publish-start`}
          error={translateError(errors.publish_start_at?.message)}
        >
          <Input id={`${idPrefix}-publish-start`} type="date" {...register('publish_start_at')} />
        </FormField>
        <FormField
          label={t('events.publishEnd')}
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
          label={t('events.registrationSchema')}
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
    </form>
  );
}

