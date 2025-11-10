import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { PageContainer, Spinner } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/form';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { getPublicEvents } from '@/services/public';
import { registerUser } from '@/services/auth';
import { useAuth } from '@/context/AuthContext';

type PublicEvent = Awaited<ReturnType<typeof getPublicEvents>>[number];

const schema = z
  .object({
    firstName: z.string().trim().min(1).max(150),
    lastName: z.string().trim().min(1).max(150),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8)
  })
  .refine(values => values.password === values.confirmPassword, {
    message: 'register.passwordMismatch',
    path: ['confirmPassword']
  });

type FormValues = z.infer<typeof schema>;

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

  const eventIdParam = searchParams.get('eventId');
  const numericEventId = eventIdParam ? Number(eventIdParam) : null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
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

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmissionError(null);
      const language = i18n.language?.split('-')[0]?.toLowerCase();
      const response = await registerUser({
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        email: values.email.toLowerCase(),
        password: values.password,
        language: language === 'es' || language === 'en' || language === 'ca' ? language : 'es',
        event_id: selectedEvent?.id ?? undefined
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
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
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


