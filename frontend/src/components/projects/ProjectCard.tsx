import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import type { ProjectCard as ProjectCardType } from '@/services/projects';

type ProjectCardProps = {
  project: ProjectCardType;
  className?: string;
  actions?: ReactNode;
};

function getCaptainDisplay(project: ProjectCardType) {
  if (!project.captain) {
    return null;
  }

  const fullName = [project.captain.first_name, project.captain.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName.length ? fullName : project.captain.email;
}

export function ProjectCard({ project, className, actions }: ProjectCardProps) {
  const { t } = useTranslation();

  const statusLabel = project.status
    ? t(`projects.status.${project.status}`, {
        defaultValue: project.status.charAt(0).toUpperCase() + project.status.slice(1)
      })
    : null;
  const teamStatusLabel = project.team_status
    ? t(`projects.teamStatus.${project.team_status}`, {
        defaultValue: project.team_status.charAt(0).toUpperCase() + project.team_status.slice(1)
      })
    : null;

  const captainDisplay = getCaptainDisplay(project);

  return (
    <Card
      className={cn(
        'overflow-hidden border border-border/60 bg-card/80 shadow-sm transition hover:shadow-lg',
        className
      )}
    >
      {project.image_url ? (
        <div className="h-40 w-full overflow-hidden border-b border-border/40 bg-muted">
          <img
            src={project.image_url}
            alt={project.title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold">{project.title}</CardTitle>
          <div className="flex flex-wrap gap-2">
            {statusLabel ? <Badge variant="secondary">{statusLabel}</Badge> : null}
            {teamStatusLabel ? <Badge variant="outline">{teamStatusLabel}</Badge> : null}
            {project.is_captain ? <Badge variant="success">{t('projects.captainBadge')}</Badge> : null}
            {!project.is_captain && project.is_member ? (
              <Badge variant="secondary">{t('projects.memberBadge')}</Badge>
            ) : null}
            {project.is_pending_member ? (
              <Badge variant="warning">{t('projects.pendingBadge')}</Badge>
            ) : null}
          </div>
        </div>
        {project.summary ? (
          <p className="text-sm text-muted-foreground">{project.summary}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {project.description ? (
          <div className="space-y-1">
            <p className="font-semibold text-foreground/80">{t('projects.teamDescription')}</p>
            <p className="text-muted-foreground">{project.description}</p>
          </div>
        ) : null}
        {project.requirements ? (
          <div className="space-y-1">
            <p className="font-semibold text-foreground/80">{t('projects.requirements')}</p>
            <p className="text-muted-foreground">{project.requirements}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>{t('projects.membersCount', { count: project.members_count })}</span>
          {project.remaining_slots !== null ? (
            <span>
              {project.remaining_slots === 0
                ? t('projects.noSlots')
                : t('projects.slots', { count: project.remaining_slots })}
            </span>
          ) : null}
          {captainDisplay ? <span>{t('projects.captainLabel', { name: captainDisplay })}</span> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}


