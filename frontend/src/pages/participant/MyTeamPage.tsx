import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { InfoTooltip, Spinner } from '@/components/common';

import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormGrid } from '@/components/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { getMyTeams, addTeamMember, removeTeamMember, setCaptain, joinTeam, leaveTeam, getTeamsByEvent } from '@/services/teams';
import { updateProject, type Project } from '@/services/projects';
import { fileToBase64 } from '@/utils/files';

// Validación usando métodos nativos de Zod sin parámetros deprecados
// Los mensajes personalizados se manejan a través de refine para evitar warnings de deprecación
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const addMemberSchema = z.object({
  user_email: z.string().refine(
    (val) => emailPattern.test(val),
    { message: 'Correo electrónico inválido' }
  )
});

const isValidUrl = (val: string): boolean => {
  if (val === '') return true;
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
};

const projectSchema = z.object({
  name: z.string().min(3),
  summary: z.string().optional(),
  problem: z.string().optional(),
  solution: z.string().optional(),
  repository_url: z.union([
    z.string().refine(isValidUrl, { message: 'URL inválida' }),
    z.literal('')
  ]).optional(),
  pitch_url: z.union([
    z.string().refine(isValidUrl, { message: 'URL inválida' }),
    z.literal('')
  ]).optional(),
  logo_url: z.union([
    z.string().refine(isValidUrl, { message: 'URL inválida' }),
    z.literal('')
  ]).optional()
});

type AddMemberValues = z.infer<typeof addMemberSchema>;
type ProjectValues = z.infer<typeof projectSchema>;

function MyTeamPage() {
  const { eventId } = useParams();
  const numericEventId = Number(eventId);
  const { t } = useTranslation();
  const { user, isSuperAdmin, activeMembership } = useAuth();
  const { branding } = useTenant();
  const queryClient = useQueryClient();
  const primaryColor = branding.primaryColor || '#0ea5e9';
  const { data: memberships, isLoading } = useQuery({
    queryKey: ['my-teams'],
    queryFn: getMyTeams,
    enabled: !isSuperAdmin
  });

  const myMembership = memberships?.find(m => {
    const teamEventId = m?.team?.event_id;
    return teamEventId && Number(teamEventId) === numericEventId;
  });
  const isCaptain = myMembership?.team.captain_id === user?.id;
  
  // Verificar si el usuario es admin o superadmin para permitir editar URL de imagen
  const roleScopes = new Set<string>(activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []);
  const isAdmin = isSuperAdmin || roleScopes.has('tenant_admin') || roleScopes.has('organizer');
  const canEditImageUrl = isAdmin;

  const addMemberForm = useForm<AddMemberValues>({ resolver: zodResolver(addMemberSchema) });
  const projectForm = useForm<ProjectValues>({ resolver: zodResolver(projectSchema) });

  const {
    data: availableTeams,
    isLoading: isTeamsLoading
  } = useQuery({
    queryKey: ['event-teams', numericEventId],
    queryFn: () => getTeamsByEvent(numericEventId),
    enabled: !Number.isNaN(numericEventId) && !myMembership
  });

  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [joiningTeamId, setJoiningTeamId] = useState<number | null>(null);

  useEffect(() => {
    if (myMembership?.team.project) {
      projectForm.reset({
        name: myMembership.team.project.name,
        summary: myMembership.team.project.summary ?? '',
        problem: myMembership.team.project.problem ?? '',
        solution: myMembership.team.project.solution ?? '',
        repository_url: myMembership.team.project.repository_url ?? '',
        pitch_url: myMembership.team.project.pitch_url ?? '',
        logo_url: myMembership.team.project.logo_url ?? ''
      });
      setLogoBase64(null);
      setLogoError(null);
      setRemoveLogo(false);
    }
  }, [myMembership?.team.project?.id, projectForm]);

  const addMemberMutation = useMutation({
    mutationFn: (values: AddMemberValues) => addTeamMember(myMembership!.team.id, values),
    onSuccess: () => {
      toast.success(t('teams.memberAdded'));
      addMemberForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => removeTeamMember(myMembership!.team.id, userId),
    onSuccess: () => {
      toast.success(t('teams.memberRemoved'));
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const setCaptainMutation = useMutation({
    mutationFn: (userId: number) => setCaptain(myMembership!.team.id, userId),
    onSuccess: () => {
      toast.success(t('teams.captainChanged'));
      // Recargar la página para reaplicar permisos
      globalThis.location.reload();
    },
    onError: () => toast.error(t('common.error'))
  });

  const leaveTeamMutation = useMutation({
    mutationFn: () => {
      if (!myMembership) {
        throw new Error('No membership found');
      }
      return leaveTeam(myMembership.team.id);
    },
    onSuccess: () => {
      toast.success(t('teams.leftTeam'));
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['event-teams', numericEventId] });
      // Recargar la página para actualizar la vista
      globalThis.location.reload();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || t('common.error');
      toast.error(message);
    }
  });

  const joinTeamMutation = useMutation({
    mutationFn: (teamId: number) => joinTeam(teamId),
    onMutate: (teamId: number) => {
      setJoiningTeamId(teamId);
    },
    onSuccess: () => {
      toast.success(t('teams.joinedTeam'));
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      void queryClient.invalidateQueries({ queryKey: ['event-teams', numericEventId] });
      // Recargar la página para actualizar la vista
      globalThis.location.reload();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || t('common.error');
      toast.error(message);
    },
    onSettled: () => {
      setJoiningTeamId(null);
    }
  });

  const projectMutation = useMutation({
    mutationFn: (values: Partial<Project>) =>
      updateProject(myMembership!.team.project!.id, values),
    onSuccess: () => {
      toast.success(t('teams.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  if (isLoading) {
    return <Spinner fullHeight />;
  }

  if (Number.isNaN(numericEventId)) {
    return <div className="p-6 text-sm text-destructive">Evento inválido</div>;
  }

  const handleAddMember = (values: AddMemberValues) => {
    addMemberMutation.mutate(values);
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoBase64(null);
      setLogoError(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoError(t('teams.logoTooLarge'));
      setLogoBase64(null);
      return;
    }

    void (async () => {
      try {
        const base64 = await fileToBase64(file);
        setLogoBase64(base64);
        setLogoError(null);
        setRemoveLogo(false);
      } catch (error) {
        // Error al leer el archivo - ya se maneja con el mensaje de error
        setLogoError(t('teams.logoReadError'));
        setLogoBase64(null);
      }
    })();
  };

  const handleUpdateProject = (values: ProjectValues) => {
    const payload: Partial<Project & { logo?: string | null }> = {
      name: values.name,
      summary: values.summary || undefined,
      problem: values.problem || undefined,
      solution: values.solution || undefined,
      repository_url: values.repository_url ? values.repository_url : undefined,
      pitch_url: values.pitch_url ? values.pitch_url : undefined,
      logo_url: values.logo_url ? values.logo_url : undefined,
      logo: removeLogo ? null : logoBase64 ?? undefined
    };

    projectMutation.mutate(payload);
  };

  const translateError = (message?: string) =>
    message ? t(message, { defaultValue: message }) : undefined;

  return (
    <DashboardLayout
      title={t('teams.title')}
      subtitle={myMembership?.team.name}
    >
      <div className="space-y-6">

        {myMembership ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('teams.members')}</CardTitle>
                  {myMembership && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={leaveTeamMutation.isPending}>
                          {t('teams.leaveTeam')}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('teams.leaveTeamConfirmTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {isCaptain
                              ? t('teams.leaveTeamConfirmDescriptionCaptain')
                              : t('teams.leaveTeamConfirmDescription')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => leaveTeamMutation.mutate()}
                            disabled={leaveTeamMutation.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {leaveTeamMutation.isPending ? t('common.loading') : t('teams.leaveTeam')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {myMembership.team.members.map(member => {
                    const isMemberCaptain = member.user_id === myMembership.team.captain_id;
                    return (
                      <li key={member.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium">
                              {member.user?.first_name} {member.user?.last_name}
                              {isMemberCaptain && (
                                <span className="ml-2 text-xs font-semibold text-primary">
                                  ({t('teams.captain')})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                          </div>
                        </div>
                        {isCaptain && member.user_id !== user?.id ? (
                          <div className="flex gap-2">
                            {isMemberCaptain === false ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCaptainMutation.mutate(member.user_id)}
                                disabled={setCaptainMutation.isPending}
                              >
                                {t('teams.makeCaptain')}
                              </Button>
                            ) : null}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeMemberMutation.mutate(member.user_id)}
                              disabled={removeMemberMutation.isPending}
                            >
                              {t('teams.removeMember')}
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {isCaptain ? (
                  <form onSubmit={addMemberForm.handleSubmit(handleAddMember)} className="flex flex-col gap-3 md:flex-row">
                    <FormField
                      className="flex-1"
                      label={t('teams.memberEmail')}
                      htmlFor="member-email"
                      error={translateError(addMemberForm.formState.errors.user_email?.message)}
                    >
                      <Input id="member-email" type="email" {...addMemberForm.register('user_email')} />
                    </FormField>
                    <Button type="submit" className="md:self-end md:whitespace-nowrap" disabled={addMemberMutation.isPending}>
                      {addMemberMutation.isPending ? t('common.loading') : t('teams.addMember')}
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>

            {myMembership.team.project ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('teams.project')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={projectForm.handleSubmit(handleUpdateProject)} className="space-y-4">
                    <FormField
                      label={t('teams.projectName')}
                      htmlFor="project-name"
                      error={translateError(projectForm.formState.errors.name?.message)}
                      required
                    >
                      <Input id="project-name" {...projectForm.register('name')} disabled={!isCaptain} readOnly={!isCaptain} />
                    </FormField>
                    <FormField label={t('teams.projectSummary')} htmlFor="project-summary">
                      <Textarea id="project-summary" rows={3} {...projectForm.register('summary')} disabled={!isCaptain} readOnly={!isCaptain} />
                    </FormField>
                    <FormGrid columns={2}>
                      <FormField label={t('teams.projectProblem')} htmlFor="project-problem">
                        <Textarea id="project-problem" rows={3} {...projectForm.register('problem')} disabled={!isCaptain} readOnly={!isCaptain} />
                      </FormField>
                      <FormField label={t('teams.projectSolution')} htmlFor="project-solution">
                        <Textarea id="project-solution" rows={3} {...projectForm.register('solution')} disabled={!isCaptain} readOnly={!isCaptain} />
                      </FormField>
                    </FormGrid>
                    <FormGrid columns={2}>
                      <FormField
                        label={
                          <div className="flex items-center gap-2">
                            <span>{t('teams.projectRepo')}</span>
                            <InfoTooltip content={t('teams.projectRepoInfo')} />
                          </div>
                        }
                        htmlFor="project-repo"
                      >
                        <Input id="project-repo" {...projectForm.register('repository_url')} disabled={!isCaptain} readOnly={!isCaptain} />
                      </FormField>
                      <FormField
                        label={
                          <div className="flex items-center gap-2">
                            <span>{t('teams.projectPitch')}</span>
                            <InfoTooltip content={t('teams.projectPitchInfo')} />
                          </div>
                        }
                        htmlFor="project-pitch"
                      >
                        <Input id="project-pitch" {...projectForm.register('pitch_url')} disabled={!isCaptain} readOnly={!isCaptain} />
                      </FormField>
                    </FormGrid>
                    {isCaptain ? (
                      <>
                        <FormGrid columns={canEditImageUrl ? 3 : 1}>
                          {canEditImageUrl ? (
                            <FormField label={t('teams.projectImageUrl')} htmlFor="project-image-url">
                              <Input 
                                id="project-image-url" 
                                {...projectForm.register('logo_url')} 
                              />
                            </FormField>
                          ) : null}
                          <FormField
                            label={
                              <div className="flex items-center gap-2">
                                <span>{t('teams.projectImageUpload')}</span>
                                <InfoTooltip content={t('teams.projectImageUploadInfo')} />
                              </div>
                            }
                            htmlFor="project-image-upload"
                          >
                            <Input
                              id="project-image-upload"
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/svg+xml"
                              onChange={handleFileChange}
                            />
                            {logoError ? <p className="text-xs text-destructive">{logoError}</p> : null}
                          </FormField>
                          {logoBase64 ? (
                            <FormField label={t('teams.projectImagePreview')} htmlFor="project-image-preview">
                              <div
                                className="flex h-16 w-auto items-center justify-center rounded border border-border p-2"
                                style={{ backgroundColor: primaryColor }}
                              >
                                <img
                                  src={logoBase64}
                                  alt=""
                                  className="h-full w-auto max-h-full max-w-full object-contain"
                                />
                              </div>
                            </FormField>
                          ) : null}
                        </FormGrid>
                        {myMembership.team.project?.logo_url ? (
                          <FormGrid columns={2}>
                            <FormField className="md:col-span-1" label={t('teams.projectImageCurrent')} htmlFor="project-image-current">
                              <div className="flex flex-col gap-2">
                                <div
                                  className="flex h-16 w-auto items-center justify-center rounded border border-border p-2"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  <img
                                    src={myMembership.team.project.logo_url}
                                    alt=""
                                    className="h-full w-auto max-h-full max-w-full object-contain"
                                  />
                                </div>
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={removeLogo}
                                    onChange={event => setRemoveLogo(event.target.checked)}
                                  />
                                  {t('teams.removeProjectImage')}
                                </label>
                              </div>
                            </FormField>
                          </FormGrid>
                        ) : null}
                      </>
                    ) : (
                      (() => {
                        const hasProjectLogo = Boolean(myMembership.team.project?.logo_url);
                        return hasProjectLogo ? (
                          <FormGrid columns={2}>
                            <FormField className="md:col-span-1" label={t('teams.projectImageCurrent')} htmlFor="project-image-current">
                              <div
                                className="flex h-16 w-auto items-center justify-center rounded border border-border p-2"
                                style={{ backgroundColor: primaryColor }}
                              >
                                <img
                                  src={myMembership.team.project.logo_url}
                                  alt=""
                                  className="h-full w-auto max-h-full max-w-full object-contain"
                                />
                              </div>
                            </FormField>
                          </FormGrid>
                        ) : null;
                      })()
                    )}
                    {isCaptain ? (
                      <Button type="submit" disabled={projectMutation.isPending}>
                        {projectMutation.isPending ? t('common.loading') : t('teams.save')}
                      </Button>
                    ) : null}
                  </form>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('teams.availableTeams')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('teams.availableTeamsDescription')}</p>
            </CardHeader>
            <CardContent>
              {(() => {
                if (isTeamsLoading) {
                  return (
                    <div className="flex justify-center py-6">
                      <Spinner />
                    </div>
                  );
                }
                if (availableTeams && availableTeams.length > 0) {
                  return (
                <div className="grid gap-4 md:grid-cols-2">
                  {availableTeams
                    .filter(team => team.status === 'open')
                    .map(team => {
                      const isMember = team.members?.some(m => m.user_id === user?.id);
                      const isJoiningThisTeam = joinTeamMutation.isPending && joiningTeamId === team.id;
                      const isJoiningAnyTeam = joinTeamMutation.isPending;
                      return (
                        <Card key={team.id} className="border-border/70">
                          <CardHeader>
                            <CardTitle className="text-lg">{team.name}</CardTitle>
                            {team.description && (
                              <p className="text-sm text-muted-foreground">{team.description}</p>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {team.members && team.members.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  {t('teams.members')} ({team.members.length})
                                </p>
                                <ul className="space-y-1">
                                  {team.members.slice(0, 3).map(member => (
                                    <li key={member.id} className="text-xs text-muted-foreground">
                                      {member.user?.first_name} {member.user?.last_name}
                                      {member.role === 'captain' && (
                                        <span className="ml-1 text-primary">({t('teams.captain')})</span>
                                      )}
                                    </li>
                                  ))}
                                  {team.members.length > 3 && (
                                    <li className="text-xs text-muted-foreground">
                                      +{team.members.length - 3} {t('teams.moreMembers')}
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant={isMember ? 'outline' : 'default'}
                              disabled={isMember || isJoiningAnyTeam}
                              onClick={() => joinTeamMutation.mutate(team.id)}
                              className="w-full"
                            >
                              {(() => {
                                if (isMember) {
                                  return t('teams.alreadyMember');
                                }
                                if (isJoiningThisTeam) {
                                  return t('teams.joining');
                                }
                                return t('teams.joinTeam');
                              })()}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
                  );
                }
                return <p className="text-sm text-muted-foreground">{t('teams.noTeamsAvailable')}</p>;
              })()}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default MyTeamPage;

