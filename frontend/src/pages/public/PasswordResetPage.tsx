import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
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
import { PasswordGeneratorButton } from '@/components/common/PasswordGeneratorButton';
import { useAuth } from '@/context/AuthContext';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const resetCodePattern = /^\d{6}$/;

const requestSchema = z.object({
  email: z
    .string()
    .trim()
    .refine((value) => emailPattern.test(value), {
      message: 'auth.passwordReset.emailInvalid'
    })
});

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .refine((value) => resetCodePattern.test(value), {
      message: 'auth.passwordReset.codeInvalid'
    })
});

const passwordSchema = z
  .object({
    password: z.string().min(6, { message: 'auth.passwordReset.passwordTooShort' }),
    confirmPassword: z
      .string()
      .min(6, { message: 'auth.passwordReset.passwordTooShort' })
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'auth.passwordReset.passwordMismatch'
      });
    }
  });

type RequestValues = z.infer<typeof requestSchema>;
type CodeValues = z.infer<typeof codeSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

type Step = 'request' | 'verify' | 'confirm';

const resolveAxiosMessage = (
  error: unknown,
  fallbackMessage: string,
  codeMessageMap?: Record<string, string>
) => {
  if (isAxiosError(error)) {
    const errorCode = error.response?.data?.code;
    if (errorCode && codeMessageMap?.[errorCode]) {
      return codeMessageMap[errorCode];
    }
    return error.response?.data?.message ?? fallbackMessage;
  }
  return fallbackMessage;
};

type RequestStepFormProps = {
  form: UseFormReturn<RequestValues>;
  serverError: string | null;
  onSubmit: (values: RequestValues) => Promise<void>;
};

const RequestStepForm = ({ form, serverError, onSubmit }: RequestStepFormProps) => {
  const { t } = useTranslation();
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting }
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="email">
          {t('auth.email')}
        </label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        {errors.email ? (
          <p className="text-xs text-destructive">
            {t(errors.email.message ?? 'auth.passwordReset.emailInvalid')}
          </p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('auth.submit')}
      </Button>
    </form>
  );
};

type VerifyStepFormProps = {
  form: UseFormReturn<CodeValues>;
  serverError: string | null;
  onSubmit: (values: CodeValues) => Promise<void>;
  onResend: () => Promise<void>;
  isResending: boolean;
  showResend: boolean;
};

const VerifyStepForm = ({
  form,
  serverError,
  onSubmit,
  onResend,
  isResending,
  showResend
}: VerifyStepFormProps) => {
  const { t } = useTranslation();
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting }
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="code">
          {t('auth.passwordReset.code')}
        </label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          {...register('code')}
        />
        <p className="text-xs text-muted-foreground">{t('auth.passwordReset.codeHelp')}</p>
        {errors.code ? (
          <p className="text-xs text-destructive">
            {t(errors.code.message ?? 'auth.passwordReset.codeInvalid')}
          </p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('auth.passwordReset.submitCode')}
      </Button>

      {showResend ? (
        <div className="text-center text-sm text-muted-foreground">
          <p>{t('auth.passwordReset.resendHint')}</p>
          <Button
            type="button"
            variant="ghost"
            className="mt-2"
            onClick={onResend}
            disabled={isSubmitting || isResending}
          >
            {isResending ? t('common.loading') : t('auth.passwordReset.resendCode')}
          </Button>
        </div>
      ) : null}
    </form>
  );
};

type ConfirmStepFormProps = {
  form: UseFormReturn<PasswordValues>;
  serverError: string | null;
  onSubmit: (values: PasswordValues) => Promise<void>;
};

const ConfirmStepForm = ({ form, serverError, onSubmit }: ConfirmStepFormProps) => {
  const { t } = useTranslation();
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting }
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="password">
          {t('auth.passwordReset.newPassword')}
        </label>
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
              form.setValue('password', password, { shouldValidate: true });
              form.setValue('confirmPassword', password, { shouldValidate: true });
            }}
            aria-label={t('auth.passwordReset.generatePassword')}
          />
        </div>
        {errors.password ? (
          <p className="text-xs text-destructive">
            {t(errors.password.message ?? 'auth.passwordReset.passwordTooShort')}
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
          {...register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-destructive">
            {t(errors.confirmPassword.message ?? 'auth.passwordReset.passwordMismatch')}
          </p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('common.loading') : t('auth.passwordReset.submitPassword')}
      </Button>
    </form>
  );
};

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
      setServerError(resolveAxiosMessage(error, t('common.error')));
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
      setServerError(
        resolveAxiosMessage(error, t('common.error'), {
          code_invalid: t('auth.passwordReset.codeInvalid'),
          code_expired: t('auth.passwordReset.codeExpired')
        })
      );
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
      setServerError(
        resolveAxiosMessage(error, t('common.error'), {
          code_invalid: t('auth.passwordReset.codeInvalid'),
          code_expired: t('auth.passwordReset.codeExpired')
        })
      );
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
      setServerError(resolveAxiosMessage(error, t('common.error')));
    } finally {
      setIsResending(false);
    }
  };

  const stepContent = useMemo(
    () => ({
      request: {
        title: t('auth.passwordReset.requestTitle'),
        description: t('auth.passwordReset.requestDescription')
      },
      verify: {
        title: t('auth.passwordReset.verifyTitle'),
        description: t('auth.passwordReset.verifyDescription')
      },
      confirm: {
        title: t('auth.passwordReset.confirmTitle'),
        description: null
      }
    }),
    [t]
  );

  const { title: currentTitle, description: currentDescription } = stepContent[step];

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
            <RequestStepForm form={requestForm} serverError={serverError} onSubmit={handleRequest} />
          ) : null}

          {step === 'verify' ? (
            <VerifyStepForm
              form={verifyForm}
              serverError={serverError}
              onSubmit={handleVerify}
              onResend={handleResend}
              isResending={isResending}
              showResend={showResend}
            />
          ) : null}

          {step === 'confirm' ? (
            <ConfirmStepForm form={confirmForm} serverError={serverError} onSubmit={handleConfirm} />
          ) : null}

          <div className="mt-6 flex flex-col gap-2 text-center">
            <Link to={tenantPath('login')} className="text-sm text-primary underline underline-offset-4">
              {t('auth.backToLogin')}
            </Link>
            {step === 'request' ? null : (
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-4"
                onClick={resetState}
              >
                {t('auth.passwordReset.cancel')}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default PasswordResetPage;

