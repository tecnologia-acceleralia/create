import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Team } from '@/services/teams';

type TeamDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
};

export function TeamDetailsModal({ open, onOpenChange, team }: TeamDetailsModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{t('teams.teamDetails')}</DialogTitle>
          <DialogDescription>
            {team?.name}
          </DialogDescription>
        </DialogHeader>
        {team && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs defaultValue="team" className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pb-4 pt-4">
                  <TabsList data-team-details-tabs className="grid w-full grid-cols-2">
                    <TabsTrigger value="team">{t('teams.team')}</TabsTrigger>
                    <TabsTrigger value="project">{t('teams.project')}</TabsTrigger>
                  </TabsList>
                </div>
                <div className="px-6">
            
            {/* Tab: Equipo */}
            <TabsContent value="team" className="space-y-6 mt-4">
              {/* Información del Equipo */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('teams.teamInfo')}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('teams.name')}</p>
                    <p className="text-base font-semibold">{team.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('teams.status')}</p>
                    <Badge variant={team.status === 'open' ? 'default' : 'secondary'}>
                      {team.status === 'open' ? t('teams.statusOpen') : t('teams.statusClosed')}
                    </Badge>
                  </div>
                  {team.description && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">{t('teams.description')}</p>
                      <p className="text-base">{team.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Miembros del Equipo */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('teams.members')}</h3>
                <div className="space-y-2">
                  {team.members && team.members.length > 0 ? (
                    team.members.map(member => (
                      <div key={member.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div>
                          <p className="font-medium">
                            {member.user?.first_name} {member.user?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                        </div>
                        <Badge variant={member.role === 'captain' ? 'default' : 'outline'}>
                          {member.role === 'captain' ? t('teams.captain') : t('teams.member')}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('teams.noMembers')}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Proyecto */}
            <TabsContent value="project" className="space-y-4 mt-4">
              {team.project ? (
                <div className="space-y-4 rounded-lg border border-border/70 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('teams.projectName')}</p>
                      <p className="text-base font-semibold">{team.project.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('teams.projectStatus')}</p>
                      <Badge variant="outline" className="capitalize">
                        {team.project.status}
                      </Badge>
                    </div>
                    {team.project.summary && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">{t('teams.projectSummary')}</p>
                        <p className="text-base">{team.project.summary}</p>
                      </div>
                    )}
                    {team.project.problem && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">{t('teams.projectProblem')}</p>
                        <p className="text-base">{team.project.problem}</p>
                      </div>
                    )}
                    {team.project.solution && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">{t('teams.projectSolution')}</p>
                        <p className="text-base">{team.project.solution}</p>
                      </div>
                    )}
                    {team.project.repository_url && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('teams.projectRepo')}</p>
                        <a
                          href={team.project.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base text-primary hover:underline"
                        >
                          {team.project.repository_url}
                        </a>
                      </div>
                    )}
                    {team.project.pitch_url && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('teams.projectPitch')}</p>
                        <a
                          href={team.project.pitch_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base text-primary hover:underline"
                        >
                          {team.project.pitch_url}
                        </a>
                      </div>
                    )}
                    {team.project.logo_url && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">{t('teams.projectImage')}</p>
                        <img
                          src={team.project.logo_url}
                          alt={team.project.name}
                          className="mt-2 max-w-xs rounded-md border border-border"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t('teams.noProject')}</p>
                </div>
              )}
            </TabsContent>
                </div>
              </div>
            </Tabs>
          </div>
        )}
        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

