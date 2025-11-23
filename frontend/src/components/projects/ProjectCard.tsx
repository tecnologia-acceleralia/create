import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import type { ProjectCard as ProjectCardType } from '@/services/projects';
import { ProjectViewModal } from './ProjectViewModal';

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
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const projectTitle = getMultilingualText(project.title, currentLang);
  const projectDescription = project.description ? getMultilingualText(project.description, currentLang) : null;

  const statusLabel = project.status
    ? safeTranslate(t, `projects.status.${project.status}`, {
        defaultValue: project.status.charAt(0).toUpperCase() + project.status.slice(1)
      })
    : null;
  const teamStatusLabel = project.team_status
    ? safeTranslate(t, `projects.teamStatus.${project.team_status}`, {
        defaultValue: project.team_status.charAt(0).toUpperCase() + project.team_status.slice(1)
      })
    : null;

  const captainDisplay = getCaptainDisplay(project);

  return (
    <>
      <Card
        className={cn(
          'flex max-h-[600px] flex-col overflow-hidden border border-border/60 bg-card/80 shadow-sm transition hover:shadow-lg',
          className
        )}
      >
        {project.image_url ? (
          <div className="h-40 flex-shrink-0 w-full overflow-hidden border-b border-border/40 bg-muted">
            <img
              src={project.image_url}
              alt={projectTitle}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <CardHeader className="flex-shrink-0 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle
              className="line-clamp-2 cursor-pointer text-lg font-semibold transition-colors hover:text-primary"
              onClick={() => setIsModalOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsModalOpen(true);
                }
              }}
            >
              {projectTitle}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              {statusLabel ? <Badge variant="secondary">{statusLabel}</Badge> : null}
              {teamStatusLabel ? <Badge variant="outline">{teamStatusLabel}</Badge> : null}
              {project.is_captain ? <Badge variant="success">{safeTranslate(t, 'projects.captainBadge')}</Badge> : null}
              {!project.is_captain && project.is_member ? (
                <Badge variant="secondary">{safeTranslate(t, 'projects.memberBadge')}</Badge>
              ) : null}
              {project.is_pending_member ? (
                <Badge variant="warning">{safeTranslate(t, 'projects.pendingBadge')}</Badge>
              ) : null}
            </div>
          </div>
          {project.summary ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{project.summary}</p>
          ) : null}
        </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-y-auto text-sm">
        {projectDescription ? (
          <div className="space-y-1">
            <p className="font-semibold text-foreground/80">{safeTranslate(t, 'projects.teamDescription')}</p>
            <p className="line-clamp-3 text-muted-foreground">{projectDescription}</p>
          </div>
        ) : null}
        {project.requirements ? (
          <div className="space-y-1">
            <p className="font-semibold text-foreground/80">{safeTranslate(t, 'projects.requirements')}</p>
            <p className="line-clamp-3 text-muted-foreground">{project.requirements}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="truncate">{safeTranslate(t, 'projects.membersCount', { count: project.members_count })}</span>
          {project.remaining_slots !== null ? (
            <span className="truncate">
              {project.remaining_slots === 0
                ? safeTranslate(t, 'projects.noSlots')
                : safeTranslate(t, 'projects.slots', { count: project.remaining_slots })}
            </span>
          ) : null}
          {captainDisplay ? <span className="truncate">{safeTranslate(t, 'projects.captainLabel', { name: captainDisplay })}</span> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
    <ProjectViewModal project={project} open={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
}


