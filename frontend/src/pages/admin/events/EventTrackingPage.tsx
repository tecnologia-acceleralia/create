import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';

import { DashboardLayout } from '@/components/layout';
import { Spinner } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTenantPath } from '@/hooks/useTenantPath';
import { getEventTrackingOverview, type EventTrackingOverview, type TeamTracking, type TeamMemberTracking, type UserTracking } from '@/services/events';
import { formatDateTime } from '@/utils/date';

type NameLike = Pick<UserTracking, 'firstName' | 'lastName' | 'email'>;

function getFullName(person: NameLike) {
  const parts = [person.firstName, person.lastName].filter(Boolean);
  if (parts.length) {
    return parts.join(' ');
  }
  return person.email ?? '—';
}

type TaskMatrixRow = TeamTracking & {
  deliverableMap: Map<number, { delivered: boolean; submittedAt: string | null }>;
};

function buildDeliverableMatrix(teams: TeamTracking[]): TaskMatrixRow[] {
  return teams.map(team => {
    const deliverableMap = new Map<number, { delivered: boolean; submittedAt: string | null }>();
    team.deliverables.forEach(deliverable => {
      deliverableMap.set(deliverable.taskId, {
        delivered: deliverable.delivered,
        submittedAt: deliverable.submittedAt
      });
    });
    return {
      ...team,
      deliverableMap
    };
  });
}

export default function EventTrackingPage() {
  const { t, i18n } = useTranslation();
  const tenantPath = useTenantPath();
  const { eventId } = useParams<{ eventId: string }>();
  const numericEventId = eventId ? Number(eventId) : NaN;

  const { data, isLoading, isError, refetch, isFetching } = useQuery<EventTrackingOverview>({
    queryKey: ['events', numericEventId, 'tracking'],
    queryFn: () => getEventTrackingOverview(numericEventId),
    enabled: Number.isFinite(numericEventId)
  });

  const taskMatrix = useMemo(() => (data ? buildDeliverableMatrix(data.teams) : []), [data]);

  if (!Number.isFinite(numericEventId)) {
    return (
      <DashboardLayout title={t('events.tracking.title')} subtitle="">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('events.tracking.invalidEvent')}
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  if (isError || !data) {
    return (
      <DashboardLayout title={t('events.tracking.title')} subtitle="">
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {t('events.tracking.loadError')}
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? t('common.loading') : t('events.tracking.retry')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const { event, tasks, teams, users, unassignedUsers, gradeSummary, totals } = data;
  const locale = i18n.language ?? 'es';
  const trackingTitle = `${event.name}`;

  return (
    <DashboardLayout
      title={t('events.tracking.title')}
      subtitle={trackingTitle}
      actions={
        <Button variant="outline" asChild>
          <Link to={tenantPath(`dashboard/events/${event.id}`)}>{t('events.tracking.backToEvent')}</Link>
        </Button>
      }
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('events.tracking.overview')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t('events.tracking.eventDates')}</p>
              <p className="text-sm font-medium">
                {formatDateTime(locale, event.start_date)} — {formatDateTime(locale, event.end_date)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t('events.tracking.totalRegistrations')}</p>
              <p className="text-sm font-medium">{totals.registrations}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t('events.tracking.totalTeams')}</p>
              <p className="text-sm font-medium">{totals.teams}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t('events.tracking.totalTasks')}</p>
              <p className="text-sm font-medium">{totals.tasks}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('events.tracking.teamsSection.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('events.tracking.teamsSection.team')}</TableHead>
                  <TableHead>{t('events.tracking.teamsSection.project')}</TableHead>
                  <TableHead>{t('events.tracking.teamsSection.members')}</TableHead>
                  <TableHead>{t('events.tracking.teamsSection.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      {t('events.tracking.noTeams')}
                    </TableCell>
                  </TableRow>
                ) : (
                  teams.map(team => {
                    const captain = team.members.find((member: TeamMemberTracking) => member.role === 'captain');
                    const memberSummary = team.members.map(member => getFullName(member)).join(', ');
                    return (
                      <TableRow key={team.id}>
                        <TableCell>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {captain
                              ? t('events.tracking.teamsSection.captain', { name: getFullName(captain) })
                              : t('events.tracking.teamsSection.captainMissing')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {team.project ? (
                            <>
                              <div className="font-medium">{team.project.name}</div>
                              {team.project.summary ? (
                                <div className="text-xs text-muted-foreground line-clamp-2">{team.project.summary}</div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">{t('events.tracking.teamsSection.noProject')}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{memberSummary || t('events.tracking.teamsSection.noMembers')}</div>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{team.status}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('events.tracking.usersSection.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('events.tracking.usersSection.name')}</TableHead>
                  <TableHead>{t('events.tracking.usersSection.email')}</TableHead>
                  <TableHead>{t('events.tracking.usersSection.team')}</TableHead>
                  <TableHead>{t('events.tracking.usersSection.roles')}</TableHead>
                  <TableHead>{t('events.tracking.usersSection.grade')}</TableHead>
                  <TableHead>{t('events.tracking.usersSection.lastLogin')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      {t('events.tracking.noUsers')}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{getFullName(user)}</TableCell>
                      <TableCell>{user.email ?? '—'}</TableCell>
                      <TableCell>
                        {user.team ? (
                          <>
                            <div>{user.team.name ?? t('events.tracking.usersSection.unnamedTeam')}</div>
                            <div className="text-xs text-muted-foreground">{user.team.role ?? 'member'}</div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('events.tracking.usersSection.noTeam')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length ? (
                            user.roles.map(role => (
                              <Badge key={role.id} variant="outline">
                                {role.scope}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">{t('events.tracking.usersSection.noRoles')}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.grade ?? '—'}</TableCell>
                      <TableCell>{formatDateTime(locale, user.lastLoginAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('events.tracking.unassignedSection.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('events.tracking.unassignedSection.name')}</TableHead>
                  <TableHead>{t('events.tracking.unassignedSection.email')}</TableHead>
                  <TableHead>{t('events.tracking.unassignedSection.grade')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassignedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      {t('events.tracking.unassignedSection.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  unassignedUsers.map(user => (
                    <TableRow key={`unassigned-${user.id}`}>
                      <TableCell className="font-medium">{getFullName(user)}</TableCell>
                      <TableCell>{user.email ?? '—'}</TableCell>
                      <TableCell>{user.grade ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('events.tracking.gradesSection.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('events.tracking.gradesSection.grade')}</TableHead>
                  <TableHead>{t('events.tracking.gradesSection.withTeam')}</TableHead>
                  <TableHead>{t('events.tracking.gradesSection.withoutTeam')}</TableHead>
                  <TableHead>{t('events.tracking.gradesSection.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      {t('events.tracking.gradesSection.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  gradeSummary.map(entry => {
                    const gradeLabel =
                      entry.grade === '__NO_GRADE__'
                        ? t('events.tracking.gradesSection.noGrade')
                        : entry.grade;
                    return (
                      <TableRow key={entry.grade || 'unknown'}>
                        <TableCell className="font-medium">{gradeLabel}</TableCell>
                        <TableCell>{entry.withTeam}</TableCell>
                        <TableCell>{entry.withoutTeam}</TableCell>
                        <TableCell>{entry.total}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('events.tracking.deliverablesSection.title')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('events.tracking.deliverablesSection.team')}</TableHead>
                  {tasks.map(task => (
                    <TableHead key={task.id}>{task.title}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskMatrix.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tasks.length + 1} className="text-center text-sm text-muted-foreground">
                      {t('events.tracking.deliverablesSection.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  taskMatrix.map(team => (
                    <TableRow key={`matrix-${team.id}`}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      {tasks.map(task => {
                        const status = team.deliverableMap.get(task.id);
                        const delivered = status?.delivered ?? false;
                        const submittedAt = status?.submittedAt ?? null;
                        return (
                          <TableCell key={`${team.id}-${task.id}`} className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              {delivered ? (
                                <Check className="h-4 w-4 text-emerald-500" aria-hidden />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground" aria-hidden />
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {submittedAt
                                  ? formatDateTime(locale, submittedAt)
                                  : t('events.tracking.deliverablesSection.noSubmission')}
                              </span>
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}


