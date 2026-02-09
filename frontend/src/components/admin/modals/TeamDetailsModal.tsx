import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { safeTranslate } from '@/utils/i18n-helpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { deleteTeam, type Team } from '@/services/teams';

type TeamDetailsModalProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  onTeamDeleted?: () => void;
}>;

export function TeamDetailsModal({ open, onOpenChange, team, onTeamDeleted }: TeamDetailsModalProps) {
  const { t } = useTranslation();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: number) => deleteTeam(teamId),
    onSuccess: () => {
      onTeamDeleted?.();
      onOpenChange(false);
      setDeleteConfirmOpen(false);
      toast.success(safeTranslate(t, 'teams.teamDeleted'));
    },
    onError: (error: unknown) => {
      const message = isAxiosError(error) && error.response?.data?.message
        ? String(error.response.data.message)
        : safeTranslate(t, 'common.error');
      toast.error(message);
    }
  });

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{safeTranslate(t, 'teams.teamDetails')}</DialogTitle>
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
                    <TabsTrigger value="team">{safeTranslate(t, 'teams.team')}</TabsTrigger>
                    <TabsTrigger value="project">{safeTranslate(t, 'teams.project')}</TabsTrigger>
                  </TabsList>
                </div>
                <div className="px-6">
            
            {/* Tab: Equipo */}
            <TabsContent value="team" className="space-y-6 mt-4">
              {/* Información del Equipo */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{safeTranslate(t, 'teams.teamInfo')}</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.name')}</p>
                    <p className="text-base font-semibold">{team.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.status')}</p>
                    <Badge variant={team.status === 'open' ? 'default' : 'secondary'}>
                      {team.status === 'open' ? safeTranslate(t, 'teams.statusOpen') : safeTranslate(t, 'teams.statusClosed')}
                    </Badge>
                  </div>
                  {team.description && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.description')}</p>
                      <p className="text-base">{team.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Miembros del Equipo */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{safeTranslate(t, 'teams.members')}</h3>
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
                          {member.role === 'captain' ? safeTranslate(t, 'teams.captain') : safeTranslate(t, 'teams.member')}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">{safeTranslate(t, 'teams.noMembers')}</p>
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
                      <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.projectName')}</p>
                      <p className="text-base font-semibold">{team.project.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.projectStatus')}</p>
                      <Badge variant="outline" className="capitalize">
                        {team.project.status}
                      </Badge>
                    </div>
                    {team.project.summary && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.projectSummary')}</p>
                        <p className="text-base">{team.project.summary}</p>
                      </div>
                    )}
                    {team.project.problem && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.projectProblem')}</p>
                        <p className="text-base">{team.project.problem}</p>
                      </div>
                    )}
                    {team.project.solution && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.projectSolution')}</p>
                        <p className="text-base">{team.project.solution}</p>
                      </div>
                    )}
                    {team.project.repository_url && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.projectRepo')}</p>
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
                        <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.projectPitch')}</p>
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
                        <p className="text-sm font-medium text-muted-foreground">{safeTranslate(t, 'teams.projectImage')}</p>
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
                    <p className="text-sm text-muted-foreground">{safeTranslate(t, 'teams.noProject')}</p>
                </div>
              )}
            </TabsContent>
                </div>
              </div>
            </Tabs>
          </div>
        )}
        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          {team && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteTeamMutation.isPending}
              className="mr-auto"
            >
              {safeTranslate(t, 'teams.deleteTeam')}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {safeTranslate(t, 'common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {safeTranslate(t, 'teams.deleteTeamConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {safeTranslate(t, 'teams.deleteTeamConfirmDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTeamMutation.isPending}>
            {safeTranslate(t, 'common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => team && deleteTeamMutation.mutate(team.id)}
            disabled={deleteTeamMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteTeamMutation.isPending ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'teams.deleteTeam')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}

