import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTenantPath } from '@/hooks/useTenantPath';
import { ErrorDisplay, PasswordInput, CompleteRegistrationModal } from '@/components/common';
import { AuthCard } from '@/components/common/AuthCard';
import { FormField } from '@/components/form';
import { safeTranslate } from '@/utils/i18n-helpers';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const { t } = useTranslation();
  const { login, user, activeMembership, loading, hydrateSession } = useAuth();
  const navigate = useNavigate();
  const tenantPath = useTenantPath();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [missingFieldsData, setMissingFieldsData] = useState<{
    tenant?: { schema: unknown; missingFields: unknown[] } | null;
    event?: { eventId: number; schema: unknown; missingFields: unknown[] } | null;
    authData: unknown;
  } | null>(null);

  const eventIdParam = searchParams.get('event_id');
  const eventId = eventIdParam ? Number.parseInt(eventIdParam, 10) : undefined;

  useEffect(() => {
    if (!loading && user && activeMembership && !missingFieldsData) {
      navigate(tenantPath('dashboard'), { replace: true });
    }
  }, [loading, user, activeMembership, navigate, tenantPath, missingFieldsData]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    try {
      // Limpiar el error solo cuando se intenta iniciar sesión de nuevo
      setError(null);
      const result = await login({ ...values, event_id: eventId });
      
      if (result && result.hasMissingFields && result.missingFields) {
        setMissingFieldsData({
          tenant: result.missingFields.tenant || null,
          event: result.missingFields.event || null,
          authData: result.authData
        });
      } else {
        navigate(tenantPath('dashboard'));
      }
    } catch (err) {
      if (isAxiosError(err)) {
        const message = err.response?.data?.message ?? safeTranslate(t, 'auth.invalidCredentials');
        setError(message);
      } else {
        setError(safeTranslate(t, 'common.error'));
      }
    }
  };

  const handleCompleteRegistration = () => {
    if (missingFieldsData?.authData) {
      hydrateSession(missingFieldsData.authData);
      setMissingFieldsData(null);
      navigate(tenantPath('dashboard'));
    }
  };

  const handleCancelRegistration = () => {
    setMissingFieldsData(null);
    // El usuario puede cerrar el modal pero permanecerá logueado
  };

  return (
    <AuthCard
      footer={
        <div className="flex flex-col items-center gap-3">
          <Link to={tenantPath('password-reset')} className="text-sm text-primary underline underline-offset-4">
            {safeTranslate(t, 'auth.forgotPassword')}
          </Link>
          {!user && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">{safeTranslate(t, 'auth.dontHaveAccount')}</p>
              <Button variant="link" size="sm" className="p-0 text-[color:var(--tenant-primary)]" asChild>
                <Link to={tenantPath('register')}>{safeTranslate(t, 'auth.goToRegister')}</Link>
              </Button>
            </div>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label={safeTranslate(t, 'auth.email')}
          htmlFor="email"
          error={errors.email ? safeTranslate(t, errors.email.message ?? '', { defaultValue: errors.email.message }) : undefined}
          required
        >
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
        </FormField>

        <FormField
          label={safeTranslate(t, 'auth.password')}
          htmlFor="password"
          error={errors.password ? safeTranslate(t, errors.password.message ?? '', { defaultValue: errors.password.message }) : undefined}
          required
        >
          <PasswordInput id="password" autoComplete="current-password" {...register('password')} />
        </FormField>

        <ErrorDisplay error={error} />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'auth.submit')}
        </Button>
      </form>

      {missingFieldsData && (
        <>
          {missingFieldsData.tenant && (
            <CompleteRegistrationModal
              open={true}
              missingFields={missingFieldsData.tenant.missingFields as never}
              schema={missingFieldsData.tenant.schema}
              onComplete={handleCompleteRegistration}
              onCancel={handleCancelRegistration}
            />
          )}
          {missingFieldsData.event && (
            <CompleteRegistrationModal
              open={true}
              missingFields={missingFieldsData.event.missingFields as never}
              schema={missingFieldsData.event.schema}
              eventId={missingFieldsData.event.eventId}
              onComplete={handleCompleteRegistration}
              onCancel={handleCancelRegistration}
            />
          )}
        </>
      )}
    </AuthCard>
  );
}

export default LoginPage;
