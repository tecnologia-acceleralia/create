import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTenantPath } from '@/hooks/useTenantPath';
import { AuthCard, ErrorDisplay, PasswordInput } from '@/components/common';
import { FormField } from '@/components/form';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const { t } = useTranslation();
  const { login, user, activeMembership, loading } = useAuth();
  const navigate = useNavigate();
  const tenantPath = useTenantPath();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && activeMembership) {
      navigate(tenantPath('dashboard'), { replace: true });
    }
  }, [loading, user, activeMembership, navigate, tenantPath]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    try {
      // Limpiar el error solo cuando se intenta iniciar sesión de nuevo
      setError(null);
      await login(values);
      navigate(tenantPath('dashboard'));
    } catch (err) {
      if (isAxiosError(err)) {
        const message = err.response?.data?.message ?? t('auth.invalidCredentials');
        setError(message);
      } else {
        setError(t('common.error'));
      }
    }
  };

  return (
    <AuthCard
      footer={
        <div className="flex flex-col items-center gap-3">
          <Link to={tenantPath('password-reset')} className="text-sm text-primary underline underline-offset-4">
            {t('auth.forgotPassword')}
          </Link>
          {!user && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">{t('auth.dontHaveAccount')}</p>
              <Button variant="link" size="sm" className="p-0 text-[color:var(--tenant-primary)]" asChild>
                <Link to={tenantPath('register')}>{t('auth.goToRegister')}</Link>
              </Button>
            </div>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label={t('auth.email')}
          htmlFor="email"
          error={errors.email ? t(errors.email.message ?? '', { defaultValue: errors.email.message }) : undefined}
          required
        >
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
        </FormField>

        <FormField
          label={t('auth.password')}
          htmlFor="password"
          error={errors.password ? t(errors.password.message ?? '', { defaultValue: errors.password.message }) : undefined}
          required
        >
          <PasswordInput id="password" autoComplete="current-password" {...register('password')} />
        </FormField>

        <ErrorDisplay error={error} />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t('common.loading') : t('auth.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}

export default LoginPage;
