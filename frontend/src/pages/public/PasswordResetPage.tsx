import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { useNavigate, Link } from 'react-router';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageContainer } from '@/components/common';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { requestPasswordResetCode, verifyPasswordResetCode, confirmPasswordReset } from '@/services/auth';
import { useAuth } from '@/context/AuthContext';

const requestSchema = z.object({
  email: z.string().email()
});

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: 'auth.passwordReset.codeInvalid' })
});

const passwordSchema = z
  .object({
    password: z.string().min(6),
    confirmPassword: z.string().min(6)
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'auth.passwordReset.passwordMismatch'
      });
    }
  });

type RequestValues = z.infer<typeof requestSchema>;
type CodeValues = z.infer<typeof codeSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

type Step = 'request' | 'verify' | 'confirm';

function PasswordResetPage() {
  const { t } = useTranslation();
  const { branding, tenantSlug } = useTenant();
  const tenantPath = useTenantPath();
  const navigate = useNavigate();
  const { hydrateSession } = useAuth();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema)
  });
  const verifyForm = useForm<CodeValues>({
    resolver: zodResolver(codeSchema)
  });
  const confirmForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema)
  });

  const resetState = useCallback(() => {
    setStep('request');
    setEmail('');
    setCode('');
    setServerError(null);
    setIsResending(false);
    requestForm.reset();
    verifyForm.reset();
    confirmForm.reset();
  }, [requestForm, verifyForm, confirmForm]);

  const handleRequest = async (values: RequestValues) => {
    setServerError(null);
    try {
      const normalizedEmail = values.email.trim().toLowerCase();
      await requestPasswordResetCode({ email: normalizedEmail });
      setEmail(normalizedEmail);
      toast.success(t('auth.passwordReset.emailSent'));
      setStep('verify');
    } catch (error) {
      if (isAxiosError(error)) {
        setServerError(error.response?.data?.message ?? t('common.error'));
      } else {
        setServerError(t('common.error'));
      }
    }
  };

  const handleVerify = async (values: CodeValues) => {
    setServerError(null);
    try {
      await verifyPasswordResetCode({ email, code: values.code.trim() });
      setCode(values.code.trim());
      toast.success(t('auth.passwordReset.codeValidated'));
      setStep('confirm');
    } catch (error) {
      if (isAxiosError(error)) {
        const codeResult = error.response?.data?.code;
        if (codeResult === 'code_invalid') {
          setServerError(t('auth.passwordReset.codeInvalid'));
        } else if (codeResult === 'code_expired') {
          setServerError(t('auth.passwordReset.codeExpired'));
        } else {
          setServerError(error.response?.data?.message ?? t('common.error'));
        }
      } else {
        setServerError(t('common.error'));
      }
    }
  };

  const handleConfirm = async (values: PasswordValues) => {
    setServerError(null);
    try {
      const response = await confirmPasswordReset({
        email,
        code,
        password: values.password
      });
      hydrateSession(response.data.data);
      toast.success(t('auth.passwordReset.success'));
      navigate(tenantPath('dashboard'));
    } catch (error) {
      if (isAxiosError(error)) {
        const codeResult = error.response?.data?.code;
        if (codeResult === 'code_invalid') {
          setServerError(t('auth.passwordReset.codeInvalid'));
        } else if (codeResult === 'code_expired') {
          setServerError(t('auth.passwordReset.codeExpired'));
        } else {
          setServerError(error.response?.data?.message ?? t('common.error'));
        }
      } else {
        setServerError(t('common.error'));
      }
    }
  };

  const handleResend = async () => {
    if (!email) {
      return;
    }
    try {
      setIsResending(true);
      await requestPasswordResetCode({ email });
      toast.success(t('auth.passwordReset.emailSent'));
    } catch (error) {
      if (isAxiosError(error)) {
        setServerError(error.response?.data?.message ?? t('common.error'));
      } else {
        setServerError(t('common.error'));
      }
    } finally {
      setIsResending(false);
    }
  };

  const currentTitle = useMemo(() => {
    if (step === 'verify') {
      return t('auth.passwordReset.verifyTitle');
    }
    if (step === 'confirm') {
      return t('auth.passwordReset.confirmTitle');
    }
    return t('auth.passwordReset.requestTitle');
  }, [step, t]);

  const currentDescription = useMemo(() => {
    if (step === 'verify') {
      return t('auth.passwordReset.verifyDescription');
    }
    if (step === 'confirm') {
      return null;
    }
    return t('auth.passwordReset.requestDescription');
  }, [step, t]);

  const showResend = step === 'verify';

  useEffect(() => {
    if ((step === 'verify' || step === 'confirm') && !email) {
      setStep('request');
    }
  }, [step, email]);

  useEffect(() => {
    if (step === 'confirm' && !code) {
      setStep('verify');
    }
  }, [step, code]);

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
          <h1 className="text-xl font-semibold text-center">{currentTitle}</h1>
          {currentDescription ? (
            <p className="text-center text-sm text-muted-foreground">{currentDescription}</p>
          ) : null}
        </CardHeader>
        <CardContent>
          {step === 'request' ? (
            <form onSubmit={requestForm.handleSubmit(handleRequest)} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="email">
                  {t('auth.email')}
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...requestForm.register('email')}
                />
                {requestForm.formState.errors.email ? (
                  <p className="text-xs text-destructive">
                    {requestForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

              <Button type="submit" className="w-full" disabled={requestForm.formState.isSubmitting}>
                {requestForm.formState.isSubmitting ? t('common.loading') : t('auth.submit')}
              </Button>
            </form>
          ) : null}

          {step === 'verify' ? (
            <form onSubmit={verifyForm.handleSubmit(handleVerify)} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="code">
                  {t('auth.passwordReset.code')}
                </label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  {...verifyForm.register('code')}
                />
                <p className="text-xs text-muted-foreground">{t('auth.passwordReset.codeHelp')}</p>
                {verifyForm.formState.errors.code ? (
                  <p className="text-xs text-destructive">
                    {t(verifyForm.formState.errors.code.message ?? 'auth.passwordReset.codeInvalid')}
                  </p>
                ) : null}
              </div>

              {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

              <Button type="submit" className="w-full" disabled={verifyForm.formState.isSubmitting}>
                {verifyForm.formState.isSubmitting ? t('common.loading') : t('auth.passwordReset.submitCode')}
              </Button>

              {showResend ? (
                <div className="text-center text-sm text-muted-foreground">
                  <p>{t('auth.passwordReset.resendHint')}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2"
                    onClick={handleResend}
                    disabled={verifyForm.formState.isSubmitting || isResending}
                  >
                    {isResending ? t('common.loading') : t('auth.passwordReset.resendCode')}
                  </Button>
                </div>
              ) : null}
            </form>
          ) : null}

          {step === 'confirm' ? (
            <form onSubmit={confirmForm.handleSubmit(handleConfirm)} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="password">
                  {t('auth.passwordReset.newPassword')}
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...confirmForm.register('password')}
                />
                {confirmForm.formState.errors.password ? (
                  <p className="text-xs text-destructive">
                    {confirmForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="confirmPassword">
                  {t('auth.passwordReset.confirmPassword')}
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  {...confirmForm.register('confirmPassword')}
                />
                {confirmForm.formState.errors.confirmPassword ? (
                  <p className="text-xs text-destructive">
                    {t(
                      confirmForm.formState.errors.confirmPassword.message ??
                        'auth.passwordReset.passwordMismatch'
                    )}
                  </p>
                ) : null}
              </div>

              {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

              <Button
                type="submit"
                className="w-full"
                disabled={confirmForm.formState.isSubmitting}
              >
                {confirmForm.formState.isSubmitting
                  ? t('common.loading')
                  : t('auth.passwordReset.submitPassword')}
              </Button>
            </form>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 text-center">
            <Link to={tenantPath('login')} className="text-sm text-primary underline underline-offset-4">
              {t('auth.backToLogin')}
            </Link>
            {step !== 'request' ? (
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-4"
                onClick={resetState}
              >
                {t('auth.passwordReset.cancel')}
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default PasswordResetPage;

