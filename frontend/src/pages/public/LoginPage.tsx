import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTenantPath } from '@/hooks/useTenantPath';
import { PageContainer } from '@/components/common';
import { useTenant } from '@/context/TenantContext';
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
  const { branding, tenantSlug } = useTenant();
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
    <PageContainer className="flex justify-center">
      <Card className="h-full w-full max-w-md border-border/70 shadow-lg shadow-[color:var(--tenant-primary)]/10">
        <CardHeader className="flex flex-col items-center gap-3">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={t('navigation.brand', { defaultValue: 'Create' })}
              className="h-12 w-auto"
            />
          ) : null}
          {tenantSlug ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('auth.loginForTenant', { tenant: tenantSlug })}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
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
              <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            </FormField>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('auth.submit')}
            </Button>

            <div className="text-center">
              <Link to={tenantPath('password-reset')} className="text-sm text-primary underline underline-offset-4">
                {t('auth.forgotPassword')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default LoginPage;
