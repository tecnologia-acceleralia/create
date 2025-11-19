import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/form';
import { DashboardLayout } from '@/components/layout';
import { CardWithActions } from '@/components/common';
import { useAuth, mapUser } from '@/context/AuthContext';
import { updateProfile } from '@/services/auth';

const profileSchema = z.object({
  first_name: z.string().trim().min(1, 'profile.firstNameRequired').max(150),
  last_name: z.string().trim().min(1, 'profile.lastNameRequired').max(150),
  email: z.string().email('profile.emailInvalid'),
  language: z.enum(['es', 'en', 'ca']),
  avatar_url: z
    .string()
    .optional()
    .refine(val => !val || val === '' || z.string().url().safeParse(val).success, {
      message: 'URL inválida'
    }),
  profile_image_url: z
    .string()
    .optional()
    .refine(val => !val || val === '' || z.string().url().safeParse(val).success, {
      message: 'URL inválida'
    })
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfilePage() {
  const { t } = useTranslation();
  const { user, activeMembership, memberships, isSuperAdmin, hydrateSession, tokens } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      email: user?.email ?? '',
      language: (user as any)?.language ?? 'es',
      avatar_url: user?.profile_image_url ?? '',
      profile_image_url: user?.profile_image_url ?? ''
    }
  });

  useEffect(() => {
    if (user) {
      form.reset({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        email: user.email ?? '',
        language: (user as any)?.language ?? 'es',
        avatar_url: user.profile_image_url ?? '',
        profile_image_url: user.profile_image_url ?? ''
      });
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

  const currentRoles = activeMembership?.roles ?? [];
  const otherMemberships = memberships.filter(membership => membership.id !== activeMembership?.id);
  const statusLabel = (status: string) =>
    t(`profile.status.${status}`, {
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
        language: (user as any)?.language ?? 'es',
        avatar_url: user.profile_image_url ?? '',
        profile_image_url: user.profile_image_url ?? ''
      });
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

      if (data.avatar_url) {
        payload.avatar_url = data.avatar_url;
      } else {
        payload.avatar_url = null;
      }

      if (data.profile_image_url) {
        payload.profile_image_url = data.profile_image_url;
      } else {
        payload.profile_image_url = null;
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

      toast.success(t('profile.updateSuccess'));
      setIsEditing(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message ?? t('profile.updateError');
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <DashboardLayout title={t('profile.title')} subtitle={t('profile.subtitle')}>
        <Card className="max-w-3xl border-border/70 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">{t('profile.noUser')}</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('profile.title')} subtitle={t('profile.subtitle')}>
      <CardWithActions
        title={isEditing ? t('profile.editing') : t('profile.title')}
        actions={
          !isEditing ? (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              {t('profile.edit')}
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
                  label={t('profile.firstName')}
                  htmlFor="first_name"
                  error={form.formState.errors.first_name?.message ? t(form.formState.errors.first_name.message) : undefined}
                  required
                >
                  <Input id="first_name" {...form.register('first_name')} />
                </FormField>

                <FormField
                  label={t('profile.lastName')}
                  htmlFor="last_name"
                  error={form.formState.errors.last_name?.message ? t(form.formState.errors.last_name.message) : undefined}
                  required
                >
                  <Input id="last_name" {...form.register('last_name')} />
                </FormField>
              </div>

              <FormField
                label={t('profile.email')}
                htmlFor="email"
                error={form.formState.errors.email?.message ? t(form.formState.errors.email.message) : undefined}
                required
              >
                <Input id="email" type="email" {...form.register('email')} />
              </FormField>

              <FormField
                label={t('profile.language')}
                htmlFor="language"
                error={form.formState.errors.language?.message ? t(form.formState.errors.language.message) : undefined}
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

              <FormField
                label={t('profile.avatarUrl')}
                htmlFor="avatar_url"
                description={t('profile.avatarUrl')}
                error={form.formState.errors.avatar_url?.message ? t(form.formState.errors.avatar_url.message) : undefined}
              >
                <Input id="avatar_url" type="url" placeholder="https://..." {...form.register('avatar_url')} />
              </FormField>

              <FormField
                label={t('profile.profileImageUrl')}
                htmlFor="profile_image_url"
                description={t('profile.profileImageUrl')}
                error={form.formState.errors.profile_image_url?.message ? t(form.formState.errors.profile_image_url.message) : undefined}
              >
                <Input id="profile_image_url" type="url" placeholder="https://..." {...form.register('profile_image_url')} />
              </FormField>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('common.loading') : t('profile.saveChanges')}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                  {t('profile.cancelEdit')}
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.name')}</p>
                  <p className="text-base font-medium">{fullName ?? '—'}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.email')}</p>
                  <p className="text-base font-medium">{user?.email ?? '—'}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.language')}</p>
                  <p className="text-base font-medium">{languageLabel}</p>
                  {isSuperAdmin ? (
                    <div className="mt-2 inline-flex items-center rounded-full bg-[color:var(--tenant-primary)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--tenant-primary)]">
                      {t('profile.superadmin')}
                    </div>
                  ) : null}
                </div>
              </div>

              {currentRoles.length ? (
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('profile.currentRoles')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentRoles.map(role => (
                      <span
                        key={role.id}
                        className="inline-flex items-center rounded-full border border-border/70 bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {role.name} ({role.scope})
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {otherMemberships.length ? (
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('profile.otherTenants')}
                  </p>
                  <div className="space-y-2">
                    {otherMemberships.map(membership => (
                      <div
                        key={membership.id}
                        className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm"
                      >
                        <p className="text-sm font-semibold">
                          {membership.tenant?.name ?? t('profile.unknownTenant')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('profile.membershipStatus', { status: statusLabel(membership.status) })}
                        </p>
                        {membership.roles.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {membership.roles.map(role => (
                              <span
                                key={role.id}
                                className="inline-flex items-center rounded-full border border-border/70 px-3 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                              >
                                {role.scope}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
      </CardWithActions>
    </DashboardLayout>
  );
}

export default ProfilePage;
