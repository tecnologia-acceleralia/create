import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/form';
import { InfoTooltip } from '@/components/common';
import {
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  setCaptain,
  updateTeamMemberRole,
  type Team,
  type TeamMember
} from '@/services/teams';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const addMemberSchema = z.object({
  user_email: z.string().refine(val => emailPattern.test(val), {
    message: 'Correo electrónico inválido'
  })
});

type AddMemberValues = z.infer<typeof addMemberSchema>;

type TeamDetailsModalProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  onTeamDeleted?: () => void;
  /** Gestión de integrantes (admin/organizador del evento). */
  allowMemberManagement?: boolean;
  eventId?: number;
}>;

function memberRoleBadgeVariant(role: TeamMember['role']): 'default' | 'secondary' | 'outline' {
  if (role === 'captain') return 'default';
  if (role === 'evaluator') return 'secondary';
  return 'outline';
}

export function TeamDetailsModal({
  open,
  onOpenChange,
  team,
  onTeamDeleted,
  allowMemberManagement = false,
  eventId
}: TeamDetailsModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [removeMemberUserId, setRemoveMemberUserId] = useState<number | null>(null);

  const invalidateTeamQueries = () => {
    const eid = eventId ?? team?.event_id;
    if (eid != null) {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams', eid] }),
        queryClient.invalidateQueries({ queryKey: ['events', eid, 'statistics'] })
      ]).catch(() => undefined);
    }
  };

  const addMemberForm = useForm<AddMemberValues>({ resolver: zodResolver(addMemberSchema) });

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: number) => deleteTeam(teamId),
    onSuccess: () => {
      onTeamDeleted?.();
      onOpenChange(false);
      setDeleteConfirmOpen(false);
      toast.success(safeTranslate(t, 'teams.teamDeleted'));
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : safeTranslate(t, 'common.error');
      toast.error(message);
    }
  });

  const addMemberMutation = useMutation({
    mutationFn: (values: AddMemberValues) => addTeamMember(team!.id, { user_email: values.user_email }),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'teams.memberAdded'));
      addMemberForm.reset();
      invalidateTeamQueries();
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : safeTranslate(t, 'common.error');
      toast.error(message);
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => removeTeamMember(team!.id, userId),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'teams.memberRemoved'));
      setRemoveMemberUserId(null);
      invalidateTeamQueries();
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : safeTranslate(t, 'common.error');
      toast.error(message);
    }
  });

  const setCaptainMutation = useMutation({
    mutationFn: (userId: number) => setCaptain(team!.id, userId),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'teams.captainChanged'));
      invalidateTeamQueries();
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : safeTranslate(t, 'common.error');
      toast.error(message);
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'member' | 'evaluator' }) =>
      updateTeamMemberRole(team!.id, userId, role),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'teams.memberRoleUpdated'));
      invalidateTeamQueries();
    },
    onError: (error: unknown) => {
      const message =
        isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : safeTranslate(t, 'common.error');
      toast.error(message);
    }
  });

  const busyMembers =
    addMemberMutation.isPending ||
    removeMemberMutation.isPending ||
    setCaptainMutation.isPending ||
    updateRoleMutation.isPending;

  const handleMemberRoleChange = (member: TeamMember, newRole: string) => {
    if (!team) return;
    if (newRole === member.role) return;
    if (member.role === 'captain' && newRole !== 'captain') {
      toast.error(safeTranslate(t, 'teams.cannotDemoteCaptainHere'));
      return;
    }
    if (newRole === 'captain') {
      setCaptainMutation.mutate(member.user_id);
      return;
    }
    updateRoleMutation.mutate({ userId: member.user_id, role: newRole as 'member' | 'evaluator' });
  };

  const translateMemberRole = (role: TeamMember['role']) => {
    if (role === 'captain') return safeTranslate(t, 'teams.captain');
    if (role === 'evaluator') return safeTranslate(t, 'teams.evaluator');
    return safeTranslate(t, 'teams.member');
  };

  const memberPendingRemove = team?.members?.find(m => m.user_id === removeMemberUserId);
  const removeMemberDisplayName = memberPendingRemove
    ? [memberPendingRemove.user?.first_name, memberPendingRemove.user?.last_name].filter(Boolean).join(' ') ||
      memberPendingRemove.user?.email ||
      `#${memberPendingRemove.user_id}`
    : '';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>{safeTranslate(t, 'teams.teamDetails')}</DialogTitle>
            <DialogDescription>{team?.name}</DialogDescription>
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
                    <TabsContent value="team" className="space-y-6 mt-4">
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
                              {team.status === 'open'
                                ? safeTranslate(t, 'teams.statusOpen')
                                : safeTranslate(t, 'teams.statusClosed')}
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

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">{safeTranslate(t, 'teams.members')}</h3>

                        {allowMemberManagement && (
                          <form
                            onSubmit={addMemberForm.handleSubmit(values => addMemberMutation.mutate(values))}
                            className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-end"
                          >
                            <FormField
                              className="flex-1"
                              label={safeTranslate(t, 'teams.memberEmail')}
                              htmlFor="admin-team-member-email"
                              error={addMemberForm.formState.errors.user_email?.message}
                            >
                              <Input
                                id="admin-team-member-email"
                                type="email"
                                autoComplete="off"
                                {...addMemberForm.register('user_email')}
                              />
                            </FormField>
                            <div className="flex items-center gap-2">
                              <InfoTooltip content={safeTranslate(t, 'teams.addMemberInfo')} />
                              <Button type="submit" disabled={addMemberMutation.isPending || busyMembers}>
                                {addMemberMutation.isPending
                                  ? safeTranslate(t, 'common.loading')
                                  : safeTranslate(t, 'teams.addMember')}
                              </Button>
                            </div>
                          </form>
                        )}

                        <div className="space-y-2">
                          {team.members && team.members.length > 0 ? (
                            team.members.map(member => (
                              <div
                                key={member.id}
                                className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">
                                    {member.user?.first_name} {member.user?.last_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                                </div>
                                {allowMemberManagement ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Select
                                      value={member.role}
                                      onValueChange={v => handleMemberRoleChange(member, v)}
                                      disabled={busyMembers}
                                      className="w-[min(100%,11rem)]"
                                    >
                                      <option value="captain">{safeTranslate(t, 'teams.captain')}</option>
                                      <option value="member">{safeTranslate(t, 'teams.member')}</option>
                                      <option value="evaluator">{safeTranslate(t, 'teams.evaluator')}</option>
                                    </Select>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="h-9 w-9 shrink-0"
                                      disabled={busyMembers}
                                      aria-label={safeTranslate(t, 'teams.removeMember')}
                                      onClick={() => setRemoveMemberUserId(member.user_id)}
                                    >
                                      <Trash2 className="h-4 w-4" aria-hidden />
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge variant={memberRoleBadgeVariant(member.role)}>{translateMemberRole(member.role)}</Badge>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">{safeTranslate(t, 'teams.noMembers')}</p>
                          )}
                        </div>
                      </div>
                    </TabsContent>

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
            <AlertDialogTitle>{safeTranslate(t, 'teams.deleteTeamConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{safeTranslate(t, 'teams.deleteTeamConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTeamMutation.isPending}>{safeTranslate(t, 'common.cancel')}</AlertDialogCancel>
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

      <AlertDialog open={removeMemberUserId != null} onOpenChange={openDlg => !openDlg && setRemoveMemberUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{safeTranslate(t, 'teams.removeMemberConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {safeTranslate(t, 'teams.removeMemberConfirmDescription', { name: removeMemberDisplayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMemberMutation.isPending}>{safeTranslate(t, 'common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMemberUserId != null && removeMemberMutation.mutate(removeMemberUserId)}
              disabled={removeMemberMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMemberMutation.isPending ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'teams.removeMember')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
