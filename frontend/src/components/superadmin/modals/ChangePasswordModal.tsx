import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/form';
import { PasswordField } from '@/components/common';
import { cn } from '@/utils/cn';
import { safeTranslate } from '@/utils/i18n-helpers';
import type { SuperAdminUser } from '@/services/superadmin';

type ChangePasswordModalProps = {
  user: SuperAdminUser | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (userId: number, password: string) => Promise<void>;
  isSubmitting: boolean;
};

export function ChangePasswordModal({
  user,
  open,
  onClose,
  onSubmit,
  isSubmitting
}: ChangePasswordModalProps) {
  const { t } = useTranslation();

  const changePasswordSchema = z
    .object({
      password: z
        .string()
        .min(6, safeTranslate(t, 'auth.passwordReset.passwordTooShort', { defaultValue: 'La contraseña debe tener al menos 6 caracteres' })),
      confirmPassword: z
        .string()
        .min(6, safeTranslate(t, 'auth.passwordReset.passwordTooShort', { defaultValue: 'La contraseña debe tener al menos 6 caracteres' }))
    })
    .refine(data => data.password === data.confirmPassword, {
      message: safeTranslate(t, 'auth.passwordReset.passwordMismatch', { defaultValue: 'Las contraseñas no coinciden' }),
      path: ['confirmPassword']
    });

  type ChangePasswordFormSchema = z.infer<typeof changePasswordSchema>;

  const form = useForm<ChangePasswordFormSchema>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: ''
    }
  });

  const handleClose = () => {
    onClose();
    form.reset();
  };

  const submitForm = async (values: ChangePasswordFormSchema) => {
    if (!user) {
      return;
    }

    await onSubmit(user.id, values.password);
    handleClose();
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={openState => (!openState ? handleClose() : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {safeTranslate(t, 'superadmin.users.changePasswordTitle', { email: user.email })}
          </DialogTitle>
          <DialogDescription>
            {safeTranslate(t, 'superadmin.users.changePasswordDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(submitForm)} className="space-y-4">
          <FormField label={safeTranslate(t, 'superadmin.users.newPassword')} required>
            <PasswordField
              className={cn('w-full', form.formState.errors.password && 'border-destructive')}
              showGenerator
              onPasswordGenerated={password => {
                form.setValue('password', password, { shouldValidate: true });
                form.setValue('confirmPassword', password, { shouldValidate: true });
              }}
              generatorAriaLabel={safeTranslate(t, 'superadmin.users.generatePassword')}
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </FormField>

          <FormField label={safeTranslate(t, 'superadmin.users.confirmPassword')} required>
            <PasswordField
              className={cn('w-full', form.formState.errors.confirmPassword && 'border-destructive')}
              {...form.register('confirmPassword')}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.confirmPassword.message}
              </p>
            ) : null}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {safeTranslate(t, 'common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? safeTranslate(t, 'common.loading')
                : safeTranslate(t, 'superadmin.users.changePassword')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

