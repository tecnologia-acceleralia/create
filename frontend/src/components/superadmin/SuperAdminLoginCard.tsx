import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { safeTranslate } from '@/utils/i18n-helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/common';
import { FormField, FormGrid } from '@/components/form';
import { useSuperAdminSession } from '@/context/SuperAdminContext';

type Credentials = {
  email: string;
  password: string;
};

export function SuperAdminLoginCard() {
  const { t } = useTranslation();
  const { login } = useSuperAdminSession();
  const [credentials, setCredentials] = useState<Credentials>({ email: '', password: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!credentials.email || !credentials.password) {
      setErrorMessage(safeTranslate(t, 'superadmin.loginIncomplete'));
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await login(credentials);
    } catch (error: any) {
      const message = error?.response?.data?.message ?? safeTranslate(t, 'common.error');
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md border-border/70 shadow-lg shadow-[color:var(--tenant-primary)]/10">
      <CardHeader className="text-center">
        <CardTitle>{safeTranslate(t, 'superadmin.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormGrid>
            <FormField label={safeTranslate(t, 'auth.email')} htmlFor="superadmin-email" required>
              <Input
                id="superadmin-email"
                type="email"
                autoComplete="email"
                required
                value={credentials.email}
                onChange={event => setCredentials(prev => ({ ...prev, email: event.target.value }))}
              />
            </FormField>
            <FormField label={safeTranslate(t, 'auth.password')} htmlFor="superadmin-password" required>
              <PasswordInput
                id="superadmin-password"
                autoComplete="current-password"
                required
                value={credentials.password}
                onChange={event => setCredentials(prev => ({ ...prev, password: event.target.value }))}
              />
            </FormField>
          </FormGrid>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'auth.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

