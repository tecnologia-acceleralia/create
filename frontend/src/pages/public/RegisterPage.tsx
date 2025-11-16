import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { PageContainer, Spinner } from '@/components/common';
import { PasswordGeneratorButton } from '@/components/common/PasswordGeneratorButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/form';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { getPublicEvents, type RegistrationSchemaField, type RegistrationSchema } from '@/services/public';
import { registerUser } from '@/services/auth';
import { useAuth } from '@/context/AuthContext';

type PublicEvent = Awaited<ReturnType<typeof getPublicEvents>>[number];

const baseSchema = z
  .object({
    firstName: z.string().trim().min(1).max(150),
    lastName: z.string().trim().min(1).max(150),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    grade: z.string().optional(),
    acceptPrivacyPolicy: z.boolean().refine(val => val === true, {
      message: 'register.privacyPolicyRequired'
    })
  })
  .refine(values => values.password === values.confirmPassword, {
    message: 'register.passwordMismatch',
    path: ['confirmPassword']
  });

type BaseFormValues = z.infer<typeof baseSchema>;
type FormValues = BaseFormValues & Record<string, string | boolean | undefined>;

type GradeOption = {
  value: string;
  label: string;
};

function resolveSchemaLabel(
  label: Record<string, string> | string | undefined,
  language: string,
  fallback: string
): string {
  if (!label) {
    return fallback;
  }

  if (typeof label === 'string') {
    return label;
  }

  const normalized = language?.split('-')[0]?.toLowerCase();
  if (normalized && label[normalized]) {
    return label[normalized] ?? fallback;
  }

  return label.es ?? label.en ?? label.ca ?? fallback;
}

function getFieldLabel(
  field: RegistrationSchemaField,
  language: string,
  fallback: string
): string {
  if (!field.label) {
    return fallback;
  }
  if (typeof field.label === 'string') {
    return field.label;
  }
  const normalized = language?.split('-')[0]?.toLowerCase();
  if (normalized && field.label[normalized]) {
    return field.label[normalized] ?? fallback;
  }
  return field.label.es ?? field.label.en ?? field.label.ca ?? fallback;
}

function normalizeAdditionalFields(fields: RegistrationSchemaField[] = []): RegistrationSchemaField[] {
  return fields.map((field, index) => ({
    ...field,
    id: field.id?.trim() ?? `custom_field_${index + 1}`
  }));
}

function isEventOpen(event: PublicEvent | null) {
  if (!event) {
    return false;
  }
  return event.allow_open_registration !== false;
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { tenantSlug, branding } = useTenant();
  const tenantPath = useTenantPath();
  const navigate = useNavigate();
  const { hydrateSession } = useAuth();
  const [searchParams] = useSearchParams();

  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  const [registrationAvailable, setRegistrationAvailable] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const additionalFieldsRef = useRef<RegistrationSchemaField[]>([]);
  const gradeConfigRef = useRef<{ required: boolean; options: string[] }>({
    required: false,
    options: []
  });

  const schema = useMemo(
    () =>
      baseSchema.superRefine((values, ctx) => {
        const gradeValue =
          typeof values.grade === 'string' ? values.grade.trim() : '';
        const { required, options } = gradeConfigRef.current;

        if (required && !gradeValue) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['grade'],
            message: 'register.gradeRequired'
          });
        } else if (gradeValue && options.length && !options.includes(gradeValue)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['grade'],
            message: 'register.gradeInvalid'
          });
        }

        additionalFieldsRef.current.forEach(field => {
          if (!field.required) {
            return;
          }
          const rawValue = (values as Record<string, unknown>)[field.id ?? ''];
          if (typeof rawValue !== 'string' || !rawValue.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [field.id ?? ''],
              message: 'register.dynamicFieldRequired'
            });
          }
        });
      }),
    []
  );

  const eventIdParam = searchParams.get('eventId');
  const numericEventId = eventIdParam ? Number(eventIdParam) : null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
    reset,
    watch,
    setValue
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      acceptPrivacyPolicy: false
    }
  });

  useEffect(() => {
    if (!tenantSlug) {
      return;
    }

    let mounted = true;
    setCheckingRegistration(true);
    setLoadError(false);

    getPublicEvents(tenantSlug)
      .then(fetchedEvents => {
        if (!mounted) {
          return;
        }
        setEvents(fetchedEvents);
        const selected = fetchedEvents.find(event => event.id === numericEventId) ?? null;
        if (numericEventId && !selected) {
          setRegistrationAvailable(false);
          return;
        }
        const hasOpenRegistration = fetchedEvents.some(event => isEventOpen(event));
        setRegistrationAvailable(hasOpenRegistration);
      })
      .catch(() => {
        if (mounted) {
          setLoadError(true);
          setRegistrationAvailable(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setCheckingRegistration(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [tenantSlug, numericEventId]);

  const selectedEvent = useMemo(() => {
    if (!numericEventId) {
      return null;
    }
    return events.find(event => event.id === numericEventId) ?? null;
  }, [events, numericEventId]);

  const registrationSchema = selectedEvent?.registration_schema ?? null;

  const gradeOptions: GradeOption[] = useMemo(() => {
    const rawOptions = registrationSchema?.grade?.options ?? [];
    return rawOptions
      .map(option => {
        if (!option?.value) {
          return null;
        }
        return {
          value: option.value,
          label: resolveSchemaLabel(option.label, i18n.language ?? 'es', option.value)
        };
      })
      .filter((option): option is GradeOption => Boolean(option));
  }, [registrationSchema, i18n.language]);

  const additionalFields = useMemo(() => normalizeAdditionalFields(registrationSchema?.additionalFields), [registrationSchema]);

  useEffect(() => {
    additionalFieldsRef.current = additionalFields;
    gradeConfigRef.current = {
      required: Boolean(registrationSchema?.grade?.required),
      options: gradeOptions.map(option => option.value)
    };

    const currentValues = getValues();
    const nextValues: FormValues = {
      firstName: currentValues.firstName ?? '',
      lastName: currentValues.lastName ?? '',
      email: currentValues.email ?? '',
      password: currentValues.password ?? '',
      confirmPassword: currentValues.confirmPassword ?? '',
      grade: '',
      acceptPrivacyPolicy: currentValues.acceptPrivacyPolicy ?? false
    };

    additionalFields.forEach(field => {
      nextValues[field.id] = '';
    });

    reset(nextValues, {
      keepDirtyValues: false,
      keepErrors: false,
      keepTouched: false
    });
  }, [additionalFields, gradeOptions, registrationSchema, getValues, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmissionError(null);
      const language = i18n.language?.split('-')[0]?.toLowerCase();
      const answersPayload: Record<string, string> = {};
      const gradeValue = typeof values.grade === 'string' ? values.grade.trim() : '';

      if (gradeValue) {
        answersPayload.grade = gradeValue;
      }

      additionalFields.forEach(field => {
        const value = values[field.id];
        if (typeof value !== 'string') {
          return;
        }
        const trimmedValue = value.trim();
        if (trimmedValue) {
          answersPayload[field.id] = trimmedValue;
        }
      });
      const response = await registerUser({
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        email: values.email.toLowerCase(),
        password: values.password,
        language: language === 'es' || language === 'en' || language === 'ca' ? language : 'es',
        event_id: selectedEvent?.id ?? undefined,
        grade: gradeValue || undefined,
        registration_answers: Object.keys(answersPayload).length ? answersPayload : undefined
      });

      const payload = response.data?.data;
      if (payload) {
        hydrateSession(payload);
        navigate(tenantPath('dashboard'));
        return;
      }

      setSubmissionError(t('register.genericError'));
    } catch (error) {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message;
        if (message) {
          setSubmissionError(t(message, { defaultValue: message }));
        } else {
          setSubmissionError(t('register.genericError'));
        }
      } else {
        setSubmissionError(t('register.genericError'));
      }
    }
  };

  if (!tenantSlug) {
    return (
      <PageContainer className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{t('register.missingTenant')}</p>
        <Button asChild>
          <Link to="/">{t('register.goToPublicHub')}</Link>
        </Button>
      </PageContainer>
    );
  }

  if (checkingRegistration) {
    return <Spinner fullHeight />;
  }

  if (loadError || registrationAvailable === false || (selectedEvent && !isEventOpen(selectedEvent))) {
    return (
      <PageContainer className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{t('register.closed')}</p>
        <Button asChild variant="outline">
          <Link to={tenantPath('')}>{t('register.backToLanding')}</Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex justify-center">
      <Card className="h-full w-full max-w-xl border-border/70 shadow-lg shadow-[color:var(--tenant-primary)]/10">
        <CardHeader className="flex flex-col items-center gap-3">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={t('navigation.brand', { defaultValue: 'Create' })}
              className="h-12 w-auto"
            />
          ) : null}
          <CardTitle className="text-2xl font-semibold text-[color:var(--tenant-primary)]">
            {t('register.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('register.subtitle')}</p>
          {selectedEvent ? (
            <div className="rounded-full border border-border/70 bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              {t('register.eventTag', { name: selectedEvent.name })}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label={t('register.firstName')}
                htmlFor="firstName"
                error={
                  errors.firstName
                    ? t(errors.firstName.message ?? '', { defaultValue: errors.firstName.message })
                    : undefined
                }
                required
              >
                <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
              </FormField>
              <FormField
                label={t('register.lastName')}
                htmlFor="lastName"
                error={
                  errors.lastName
                    ? t(errors.lastName.message ?? '', { defaultValue: errors.lastName.message })
                    : undefined
                }
                required
              >
                <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
              </FormField>
            </div>

            <FormField
              label={t('register.email')}
              htmlFor="email"
              error={
                errors.email
                  ? t(errors.email.message ?? '', { defaultValue: errors.email.message })
                  : undefined
              }
              required
            >
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
            </FormField>

            <FormField
              label={
                registrationSchema?.grade?.label
                  ? resolveSchemaLabel(registrationSchema.grade.label, i18n.language ?? 'es', t('register.gradeLabel'))
                  : t('register.gradeLabel')
              }
              htmlFor="grade"
              error={
                errors.grade ? t(errors.grade.message ?? '', { defaultValue: errors.grade.message }) : undefined
              }
            required={Boolean(registrationSchema?.grade?.required)}
            >
              {gradeOptions.length ? (
                <Select id="grade" defaultValue="" {...register('grade')}>
                  <option value="" disabled>
                    {t('register.gradePlaceholder')}
                  </option>
                  {gradeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                    {option.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="grade"
                  placeholder={t('register.gradePlaceholder')}
                {...register('grade')}
                />
              )}
            </FormField>

            {additionalFields.length ? (
              <div className="space-y-4">
                {additionalFields.map(field => {
                  const fieldLabel = getFieldLabel(field, i18n.language ?? 'es', field.id);
                  const errorMessage = errors[field.id]?.message
                    ? t(errors[field.id]?.message ?? '', { defaultValue: errors[field.id]?.message })
                    : undefined;

                  const selectOptions =
                    field.type === 'select'
                      ? (field.options ?? [])
                          .map(option => {
                            if (!option?.value) {
                              return null;
                            }
                            return {
                              value: option.value,
                              label: resolveSchemaLabel(option.label, i18n.language ?? 'es', option.value)
                            };
                          })
                          .filter(
                            (option): option is { value: string; label: string } => Boolean(option)
                          )
                      : [];

                  return (
                    <FormField
                      key={field.id}
                      label={fieldLabel}
                      htmlFor={field.id}
                      error={errorMessage}
                      required={Boolean(field.required)}
                    >
                      {field.type === 'textarea' ? (
                        <Textarea id={field.id} {...register(field.id)} />
                      ) : field.type === 'select' && selectOptions.length ? (
                        <Select id={field.id} defaultValue="" {...register(field.id)}>
                          <option value="" disabled>
                            {t('register.selectPlaceholder')}
                          </option>
                          {selectOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input id={field.id} {...register(field.id)} />
                      )}
                    </FormField>
                  );
                })}
              </div>
            ) : null}

            <FormField
              label={t('register.password')}
              htmlFor="password"
              description={t('register.passwordHelper')}
              error={
                errors.password
                  ? t(errors.password.message ?? '', { defaultValue: errors.password.message })
                  : undefined
              }
              required
            >
              <div className="flex gap-2">
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className="flex-1"
                  {...register('password')}
                />
                <PasswordGeneratorButton
                  onGenerate={password => {
                    setValue('password', password, { shouldValidate: true });
                    setValue('confirmPassword', password, { shouldValidate: true });
                  }}
                  aria-label={t('register.generatePassword')}
                />
              </div>
            </FormField>

            <FormField
              label={t('register.confirmPassword')}
              htmlFor="confirmPassword"
              error={
                errors.confirmPassword
                  ? t(errors.confirmPassword.message ?? '', {
                      defaultValue: errors.confirmPassword.message
                    })
                  : undefined
              }
              required
            >
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            </FormField>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="acceptPrivacyPolicy"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[color:var(--tenant-primary)] focus:ring-2 focus:ring-[color:var(--tenant-primary)] focus:ring-offset-2"
                  {...register('acceptPrivacyPolicy', { required: true })}
                />
                <label htmlFor="acceptPrivacyPolicy" className="text-sm leading-relaxed text-foreground">
                  {t('register.acceptPrivacyPolicy', {
                    defaultValue: 'Acepto la '
                  })}
                  <a
                    href={tenantPath('legal/privacy')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[color:var(--tenant-primary)] underline hover:text-[color:var(--tenant-primary)]/80"
                    onClick={e => e.stopPropagation()}
                  >
                    {t('register.privacyPolicy', { defaultValue: 'Política de Privacidad' })}
                  </a>
                </label>
              </div>
              {errors.acceptPrivacyPolicy ? (
                <p className="text-sm text-destructive">
                  {t(errors.acceptPrivacyPolicy.message ?? '', { defaultValue: errors.acceptPrivacyPolicy.message })}
                </p>
              ) : null}
            </div>

            {submissionError ? <p className="text-sm text-destructive">{submissionError}</p> : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('register.submit')}
            </Button>

            <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
              <p>{t('register.alreadyHaveAccount')}</p>
              <Button variant="link" size="sm" className="p-0 text-[color:var(--tenant-primary)]" asChild>
                <Link to={tenantPath('login')}>{t('register.goToLogin')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}


