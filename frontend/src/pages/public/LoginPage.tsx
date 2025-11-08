import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useNavigate } from 'react-router';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type FormValues = z.infer<typeof schema>;

function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setError(null);
      await login(values);
      navigate('/dashboard');
    } catch (err) {
      setError(t('common.error'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.loginTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="email">
                {t('auth.email')}
              </label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="password">
                {t('auth.password')}
              </label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('auth.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginPage;

