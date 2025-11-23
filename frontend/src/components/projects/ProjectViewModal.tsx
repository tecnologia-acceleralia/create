import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMultilingualText } from '@/utils/multilingual';
import type { ProjectCard as ProjectCardType } from '@/services/projects';

type ProjectViewModalProps = {
  project: ProjectCardType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function ProjectViewModal({ project, open, onOpenChange }: ProjectViewModalProps) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';

  if (!project) {
    return null;
  }

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">{projectTitle}</DialogTitle>
          {project.summary ? (
            <DialogDescription className="pt-2 text-base">{project.summary}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="mt-3 flex flex-wrap gap-2">
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

        <div className="space-y-6">
          {project.image_url ? (
            <div className="w-full overflow-hidden rounded-lg border border-border/40 bg-muted">
              <img
                src={project.image_url}
                alt={projectTitle}
                className="h-auto w-full object-cover"
              />
            </div>
          ) : null}

          {projectDescription ? (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {safeTranslate(t, 'projects.teamDescription')}
              </h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {projectDescription}
              </p>
            </div>
          ) : null}

          {project.requirements ? (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{safeTranslate(t, 'projects.requirements')}</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {project.requirements}
              </p>
            </div>
          ) : null}

          <div className="border-t border-border/60" />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="font-medium text-foreground">
                {safeTranslate(t, 'projects.membersCount', { count: project.members_count })}
              </div>
              {project.remaining_slots !== null ? (
                <div className="text-muted-foreground">
                  {project.remaining_slots === 0
                    ? safeTranslate(t, 'projects.noSlots')
                    : safeTranslate(t, 'projects.slots', { count: project.remaining_slots })}
                </div>
              ) : null}
              {captainDisplay ? (
                <div className="text-muted-foreground">
                  {safeTranslate(t, 'projects.captainLabel', { name: captainDisplay })}
                </div>
              ) : null}
            </div>

            {project.members && project.members.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {safeTranslate(t, 'projects.membersCount', { count: project.members.length })}
                </h3>
                <div className="space-y-2">
                  {[...project.members]
                    .sort((a, b) => {
                      // Primero los capitanes, luego los demás
                      if (a.role === 'captain' && b.role !== 'captain') return -1;
                      if (a.role !== 'captain' && b.role === 'captain') return 1;
                      return 0;
                    })
                    .map(member => {
                      const memberName = member.user
                        ? [member.user.first_name, member.user.last_name]
                            .filter(Boolean)
                            .join(' ')
                            .trim() || member.user.email
                        : null;
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between rounded-md border border-border/60 bg-card/80 p-2 text-sm"
                        >
                          <span className="text-foreground">{memberName ?? '—'}</span>
                          <Badge variant={member.role === 'captain' ? 'success' : 'secondary'}>
                            {member.role === 'captain'
                              ? safeTranslate(t, 'projects.captainBadge')
                              : safeTranslate(t, 'projects.memberBadge')}
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

