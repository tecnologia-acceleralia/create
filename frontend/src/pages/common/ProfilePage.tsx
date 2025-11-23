import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileInput } from '@/components/ui/file-input';
import { FormField } from '@/components/form';
import { DashboardLayout } from '@/components/layout';
import { CardWithActions, PasswordField } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { useAuth, mapUser } from '@/context/AuthContext';
import { updateProfile, changePassword } from '@/services/auth';
import { fileToBase64 } from '@/utils/files';
import { useTenant } from '@/context/TenantContext';
import { safeTranslate } from '@/utils/i18n-helpers';
import i18n from '@/i18n/config';

const profileSchema = z.object({
  first_name: z.string().trim().min(1, 'profile.firstNameRequired').max(150),
  last_name: z.string().trim().min(1, 'profile.lastNameRequired').max(150),
  email: z.string().email('profile.emailInvalid'),
  language: z.enum(['es', 'en', 'ca'])
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'profile.changePassword.currentPasswordRequired'),
    newPassword: z.string().min(8, 'profile.changePassword.newPasswordMinLength'),
    confirmNewPassword: z.string().min(1, 'profile.changePassword.newPasswordRequired')
  })
  .refine(data => data.newPassword === data.confirmNewPassword, {
    message: 'profile.changePassword.passwordsMismatch',
    path: ['confirmNewPassword']
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

function ProfilePage() {
  const { t } = useTranslation();
  const { user, activeMembership, memberships, isSuperAdmin, hydrateSession, tokens } = useAuth();
  const { branding } = useTenant();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImageBase64, setProfileImageBase64] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState<string | null>(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
      language: user?.language ?? 'es'
    }
  });

  const changePasswordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: ''
    }
  });

  useEffect(() => {
    if (user) {
      form.reset({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        email: user.email ?? '',
        language: user?.language ?? 'es'
      });
      setProfileImageBase64(null);
      setProfileImageError(null);
      setRemoveProfileImage(false);
    }
  }, [user, form]);

  const fullName = useMemo(() => {
    if (!user) {
      return null;
    }
    const parts = [user.first_name, user.last_name].filter(Boolean);
    if (parts.length) {
      return parts.join(' ');
    }
    return user.email;
  }, [user]);

  const otherMemberships = memberships.filter(membership => membership.id !== activeMembership?.id);
  const statusLabel = (status: string) =>
    safeTranslate(t, `profile.status.${status}`, {
      defaultValue: status
    });

  const languageLabel = useMemo(() => {
    const lang = (user as any)?.language ?? 'es';
    const labels: Record<string, string> = {
      es: 'Español',
      en: 'English',
      ca: 'Català'
    };
    return labels[lang] ?? '—';
  }, [user]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (user) {
      form.reset({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        email: user.email ?? '',
        language: user?.language ?? 'es'
      });
      setProfileImageBase64(null);
      setProfileImageError(null);
      setRemoveProfileImage(false);
    }
  };

  const handleProfileImageFileChange: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.target.files?.[0];
    if (!file) {
      setProfileImageBase64(null);
      setProfileImageError(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileImageError(safeTranslate(t, 'profile.profileImageTooLarge'));
      setProfileImageBase64(null);
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setProfileImageBase64(base64);
      setProfileImageError(null);
      setRemoveProfileImage(false);
    } catch (error) {
      setProfileImageError(safeTranslate(t, 'profile.profileImageReadError'));
      setProfileImageBase64(null);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        language: data.language
      };

      // Manejar imagen de perfil
      if (removeProfileImage) {
        payload.profile_image_url = null;
      } else if (profileImageBase64) {
        payload.profile_image = profileImageBase64;
      }

      const response = await updateProfile(payload);
      const updatedUser = response.data.user as any;

      // Actualizar el usuario en el contexto
      const roleScopes = activeMembership?.roles?.map(role => role.scope) ?? [];
      const mappedUser = mapUser(updatedUser, roleScopes);

      // Actualizar el contexto con los datos actuales más el usuario actualizado
      if (tokens) {
        hydrateSession({
          tokens,
          user: updatedUser,
          memberships,
          activeMembership,
          isSuperAdmin
        });
      }

      // Actualizar idioma de i18n si cambió
      if (updatedUser.language && ['es', 'en', 'ca'].includes(updatedUser.language)) {
        if (i18n.language !== updatedUser.language) {
          await i18n.changeLanguage(updatedUser.language);
        }
      }

      toast.success(safeTranslate(t, 'profile.updateSuccess'));
      setIsEditing(false);
      setProfileImageBase64(null);
      setRemoveProfileImage(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message ?? safeTranslate(t, 'profile.updateError');
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (data: ChangePasswordFormValues) => {
    setIsChangingPassword(true);
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      toast.success(safeTranslate(t, 'profile.changePassword.changePasswordSuccess'));
      setIsChangePasswordDialogOpen(false);
      changePasswordForm.reset();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ?? safeTranslate(t, 'profile.changePassword.changePasswordError');
      toast.error(errorMessage);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCloseChangePasswordDialog = () => {
    setIsChangePasswordDialogOpen(false);
    changePasswordForm.reset();
  };

  if (!user) {
    return (
      <DashboardLayout title={safeTranslate(t, 'profile.title')} subtitle={safeTranslate(t, 'profile.subtitle')}>
        <Card className="max-w-3xl border-border/70 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{safeTranslate(t, 'profile.noUser')}</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={safeTranslate(t, 'profile.title')} subtitle={safeTranslate(t, 'profile.subtitle')}>
      <CardWithActions
        title={isEditing ? safeTranslate(t, 'profile.editing') : safeTranslate(t, 'profile.title')}
        actions={
          !isEditing ? (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              {safeTranslate(t, 'profile.edit')}
            </Button>
          ) : undefined
        }
        className="max-w-3xl"
        contentClassName="space-y-6 text-sm text-foreground"
      >
          {isEditing ? (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={safeTranslate(t, 'profile.firstName')}
                  htmlFor="first_name"
                  error={form.formState.errors.first_name?.message ? safeTranslate(t, form.formState.errors.first_name.message) : undefined}
                  required
                >
                  <Input id="first_name" {...form.register('first_name')} />
                </FormField>

                <FormField
                  label={safeTranslate(t, 'profile.lastName')}
                  htmlFor="last_name"
                  error={form.formState.errors.last_name?.message ? safeTranslate(t, form.formState.errors.last_name.message) : undefined}
                  required
                >
                  <Input id="last_name" {...form.register('last_name')} />
                </FormField>
              </div>

              <FormField
                label={safeTranslate(t, 'profile.email')}
                htmlFor="email"
                error={form.formState.errors.email?.message ? safeTranslate(t, form.formState.errors.email.message) : undefined}
                required
              >
                <Input id="email" type="email" {...form.register('email')} />
              </FormField>

              <FormField
                label={safeTranslate(t, 'profile.language')}
                htmlFor="language"
                error={form.formState.errors.language?.message ? safeTranslate(t, form.formState.errors.language.message) : undefined}
              >
                <select
                  id="language"
                  className="flex h-10 w-full rounded-md border border-input bg-card/80 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...form.register('language')}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="ca">Català</option>
                </select>
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label={safeTranslate(t, 'profile.profileImage')}
                  htmlFor="profile_image"
                  description={safeTranslate(t, 'profile.profileImageInfo')}
                  error={profileImageError ?? undefined}
                >
                  <FileInput
                    id="profile_image"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleProfileImageFileChange}
                  />
                  {profileImageError ? <p className="text-xs text-destructive mt-1">{profileImageError}</p> : null}
                </FormField>

                {profileImageBase64 ? (
                  <FormField label={safeTranslate(t, 'profile.profileImagePreview')}>
                    <div
                      className="flex h-32 w-auto items-center justify-center rounded border border-border p-2"
                      style={{ backgroundColor: branding.primaryColor || '#f3f4f6' }}
                    >
                      <img
                        src={profileImageBase64}
                        alt=""
                        className="h-full w-auto max-h-full max-w-full object-contain"
                      />
                    </div>
                  </FormField>
                ) : null}

                {user?.profile_image_url && !profileImageBase64 ? (
                  <FormField label={safeTranslate(t, 'profile.currentProfileImage')}>
                    <div className="flex flex-col gap-2">
                      <div
                        className="flex h-32 w-auto items-center justify-center rounded border border-border p-2"
                        style={{ backgroundColor: branding.primaryColor || '#f3f4f6' }}
                      >
                        <img
                          src={user.profile_image_url}
                          alt=""
                          className="h-full w-auto max-h-full max-w-full object-contain"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={removeProfileImage}
                          onChange={event => setRemoveProfileImage(event.target.checked)}
                        />
                        {safeTranslate(t, 'profile.removeProfileImage')}
                      </label>
                    </div>
                  </FormField>
                ) : null}
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'profile.saveChanges')}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                  {safeTranslate(t, 'profile.cancelEdit')}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-20 w-20 overflow-hidden rounded-full border border-border/60 bg-card shadow-sm">
                  <img
                    src={user.avatarUrl}
                    alt={fullName ?? user.email}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{safeTranslate(t, 'profile.name')}</p>
                  <p className="text-base font-medium">{fullName ?? '—'}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{safeTranslate(t, 'profile.email')}</p>
                  <p className="text-base font-medium">{user?.email ?? '—'}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{safeTranslate(t, 'profile.language')}</p>
                  <p className="text-base font-medium">{languageLabel}</p>
                  {isSuperAdmin ? (
                    <div className="mt-2 inline-flex items-center rounded-full bg-[color:var(--tenant-primary)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--tenant-primary)]">
                      {safeTranslate(t, 'profile.superadmin')}
                    </div>
                  ) : null}
                </div>
              </div>

              {otherMemberships.length ? (
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {safeTranslate(t, 'profile.otherTenants')}
                  </p>
                  <div className="space-y-2">
                    {otherMemberships.map(membership => (
                      <div
                        key={membership.id}
                        className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm"
                      >
                        <p className="text-sm font-semibold">
                          {membership.tenant?.name ?? safeTranslate(t, 'profile.unknownTenant')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {safeTranslate(t, 'profile.membershipStatus', { status: statusLabel(membership.status) })}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="pt-4 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsChangePasswordDialogOpen(true)}
                  className="w-full sm:w-auto"
                >
                  {safeTranslate(t, 'profile.changePassword.title')}
                </Button>
              </section>
            </>
          )}
      </CardWithActions>

      <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{safeTranslate(t, 'profile.changePassword.title')}</DialogTitle>
            <DialogDescription>
              {safeTranslate(t, 'profile.changePassword.newPasswordMinLength')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={changePasswordForm.handleSubmit(handleChangePassword)} className="space-y-4">
            <FormField
              label={safeTranslate(t, 'profile.changePassword.currentPassword')}
              htmlFor="currentPassword"
              error={
                changePasswordForm.formState.errors.currentPassword?.message
                  ? safeTranslate(t, changePasswordForm.formState.errors.currentPassword.message)
                  : undefined
              }
              required
            >
              <div className="flex gap-2">
                <PasswordField
                  id="currentPassword"
                  autoComplete="current-password"
                  className="flex-1"
                  {...changePasswordForm.register('currentPassword')}
                />
                <div className="w-10" aria-hidden="true" />
              </div>
            </FormField>

            <FormField
              label={safeTranslate(t, 'profile.changePassword.newPassword')}
              htmlFor="newPassword"
              error={
                changePasswordForm.formState.errors.newPassword?.message
                  ? safeTranslate(t, changePasswordForm.formState.errors.newPassword.message)
                  : undefined
              }
              required
            >
              <PasswordField
                id="newPassword"
                autoComplete="new-password"
                showGenerator
                onPasswordGenerated={password => {
                  changePasswordForm.setValue('newPassword', password, { shouldValidate: true });
                  changePasswordForm.setValue('confirmNewPassword', password, { shouldValidate: true });
                }}
                generatorAriaLabel={safeTranslate(t, 'profile.changePassword.title')}
                {...changePasswordForm.register('newPassword')}
              />
            </FormField>

            <FormField
              label={safeTranslate(t, 'profile.changePassword.confirmNewPassword')}
              htmlFor="confirmNewPassword"
              error={
                changePasswordForm.formState.errors.confirmNewPassword?.message
                  ? safeTranslate(t, changePasswordForm.formState.errors.confirmNewPassword.message)
                  : undefined
              }
              required
            >
              <div className="flex gap-2">
                <PasswordField
                  id="confirmNewPassword"
                  autoComplete="new-password"
                  className="flex-1"
                  {...changePasswordForm.register('confirmNewPassword')}
                />
                <div className="w-10" aria-hidden="true" />
              </div>
            </FormField>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseChangePasswordDialog}
                disabled={isChangingPassword}
              >
                {safeTranslate(t, 'profile.changePassword.cancel')}
              </Button>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword
                  ? safeTranslate(t, 'common.loading')
                  : safeTranslate(t, 'profile.changePassword.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default ProfilePage;
