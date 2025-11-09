import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout';
import { useAuth } from '@/context/AuthContext';

function ProfilePage() {
  const { t } = useTranslation();
  const { user, activeMembership, memberships, isSuperAdmin } = useAuth();

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

  return (
    <DashboardLayout title={t('profile.title')} subtitle={t('profile.subtitle')}>
      <Card className="max-w-3xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-foreground">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-border/60 bg-card shadow-sm">
              {user ? (
                <img
                  src={user.avatarUrl}
                  alt={fullName ?? user.email}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                  {t('profile.noUser')}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.name')}</p>
              <p className="text-base font-medium">{fullName ?? '—'}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('profile.email')}</p>
              <p className="text-base font-medium">{user?.email ?? '—'}</p>
              {isSuperAdmin ? (
                <div className="mt-2 inline-flex items-center rounded-full bg-[color:var(--tenant-primary)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--tenant-primary)]">
                  {t('profile.superadmin')}
                </div>
              ) : null}
            </div>
          </div>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('profile.currentRoles')}
            </p>
            {currentRoles.length ? (
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
            ) : (
              <p className="text-sm text-muted-foreground">{t('profile.noRoles')}</p>
            )}
          </section>

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
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

export default ProfilePage;
