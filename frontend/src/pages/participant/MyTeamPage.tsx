import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { InfoTooltip, Spinner, TeamSubmissionsSummary } from '@/components/common';

import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { safeTranslate } from '@/utils/i18n-helpers';
import { getMyTeams, addTeamMember, removeTeamMember, setCaptain, leaveTeam, getTeamSubmissionsAndEvaluationsSummary } from '@/services/teams';
import { updateProject, type Project } from '@/services/projects';
import { fileToBase64 } from '@/utils/files';
import { refreshSession } from '@/services/auth';

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
  const { user, isSuperAdmin, activeMembership, updateEventSession, currentEventId, hydrateSession } = useAuth();
  const { branding } = useTenant();
  const tenantPath = useTenantPath();
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

  const { data: submissionsSummary } = useQuery({
    queryKey: ['team-submissions-summary', myMembership?.team.id],
    queryFn: () => getTeamSubmissionsAndEvaluationsSummary(myMembership!.team.id),
    enabled: !!myMembership?.team.id && !isSuperAdmin
  });
  
  // Verificar si el usuario es admin o superadmin para permitir editar URL de imagen
  const roleScopes = new Set<string>(activeMembership?.roles?.map(role => role.scope) ?? user?.roleScopes ?? []);
  const isAdmin = isSuperAdmin || roleScopes.has('tenant_admin') || roleScopes.has('organizer');
  const canEditImageUrl = isAdmin;

  const addMemberForm = useForm<AddMemberValues>({ resolver: zodResolver(addMemberSchema) });
  const projectForm = useForm<ProjectValues>({ resolver: zodResolver(projectSchema) });

  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

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
  
  // Sincronizar sesión del evento cuando se carga el equipo
  useEffect(() => {
    if (myMembership && currentEventId === numericEventId && updateEventSession) {
      const teamRole = myMembership.team.captain_id === user?.id ? 'captain' : myMembership.role as 'captain' | 'member' | 'evaluator';
      updateEventSession(numericEventId, {
        teamId: myMembership.team.id,
        teamRole
      });
    } else if (!myMembership && currentEventId === numericEventId && updateEventSession) {
      // Si no hay membresía pero estamos en el evento, limpiar la sesión
      updateEventSession(numericEventId, {
        teamId: null,
        teamRole: null
      });
    }
  }, [myMembership, currentEventId, numericEventId, user?.id, updateEventSession]);

  const addMemberMutation = useMutation({
    mutationFn: (values: AddMemberValues) => addTeamMember(myMembership!.team.id, values),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'teams.memberAdded'));
      addMemberForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      // Actualizar sesión del evento si es el evento actual
      if (currentEventId === numericEventId && myMembership) {
        updateEventSession(numericEventId, {
          teamId: myMembership.team.id,
          teamRole: myMembership.role as 'captain' | 'member' | 'evaluator'
        });
      }
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message || safeTranslate(t, 'common.error');
        toast.error(message);
      } else {
        toast.error(safeTranslate(t, 'common.error'));
      }
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => removeTeamMember(myMembership!.team.id, userId),
    onSuccess: (_, userId) => {
      toast.success(safeTranslate(t, 'teams.memberRemoved'));
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      // Si el usuario eliminado es el actual, limpiar la sesión del evento
      if (userId === user?.id && currentEventId === numericEventId) {
        updateEventSession(numericEventId, {
          teamId: null,
          teamRole: null
        });
      } else if (currentEventId === numericEventId && myMembership) {
        // Actualizar sesión manteniendo el equipo y rol actual
        updateEventSession(numericEventId, {
          teamId: myMembership.team.id,
          teamRole: myMembership.role as 'captain' | 'member' | 'evaluator'
        });
      }
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message || safeTranslate(t, 'common.error');
        toast.error(message);
      } else {
        toast.error(safeTranslate(t, 'common.error'));
      }
    }
  });

  const setCaptainMutation = useMutation({
    mutationFn: async (userId: number) => {
      await setCaptain(myMembership!.team.id, userId);
      // Refrescar sesión para actualizar roles
      const sessionData = await refreshSession();
      return { userId, sessionData };
    },
    onSuccess: async ({ userId, sessionData }) => {
      // Actualizar la sesión del usuario con los nuevos datos
      hydrateSession(sessionData.data);
      
      toast.success(safeTranslate(t, 'teams.captainChanged'));
      // Actualizar sesión del evento si el nuevo capitán es el usuario actual
      if (userId === user?.id && currentEventId === numericEventId && myMembership) {
        updateEventSession(numericEventId, {
          teamId: myMembership.team.id,
          teamRole: 'captain'
        });
      } else if (currentEventId === numericEventId && myMembership) {
        // Si el usuario actual sigue siendo capitán o miembro, actualizar sesión
        const newRole = userId === user?.id ? 'captain' : (myMembership.role as 'captain' | 'member' | 'evaluator');
        updateEventSession(numericEventId, {
          teamId: myMembership.team.id,
          teamRole: newRole
        });
      }
      // Invalidar queries para refrescar datos
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message || safeTranslate(t, 'common.error');
        toast.error(message);
      } else {
        toast.error(safeTranslate(t, 'common.error'));
      }
    }
  });

  const leaveTeamMutation = useMutation({
    mutationFn: async () => {
      if (!myMembership) {
        throw new Error('No membership found');
      }
      await leaveTeam(myMembership.team.id);
      // Refrescar sesión para actualizar roles (si era capitán, se remueve team_captain)
      const sessionData = await refreshSession();
      return sessionData;
    },
    onSuccess: async (sessionData) => {
      // Actualizar la sesión del usuario con los nuevos datos
      hydrateSession(sessionData.data);
      
      toast.success(safeTranslate(t, 'teams.leftTeam'));
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
      // Limpiar sesión del evento cuando el usuario sale del equipo
      if (currentEventId === numericEventId) {
        updateEventSession(numericEventId, {
          teamId: null,
          teamRole: null
        });
      }
      // Recargar la página para actualizar la vista
      globalThis.location.reload();
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message || safeTranslate(t, 'common.error');
        toast.error(message);
      } else {
        toast.error(safeTranslate(t, 'common.error'));
      }
    }
  });

  const projectMutation = useMutation({
    mutationFn: (values: Partial<Project>) =>
      updateProject(myMembership!.team.project!.id, values),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'teams.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message || safeTranslate(t, 'common.error');
        toast.error(message);
      } else {
        toast.error(safeTranslate(t, 'common.error'));
      }
    }
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
      setLogoError(safeTranslate(t, 'teams.logoTooLarge'));
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
        setLogoError(safeTranslate(t, 'teams.logoReadError'));
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
    message ? safeTranslate(t, message, { defaultValue: message }) : undefined;

  return (
    <DashboardLayout
      title={safeTranslate(t, 'teams.title')}
      subtitle={myMembership?.team.name}
    >
      <div className="space-y-6">

        {myMembership ? (
          <>
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>{safeTranslate(t, 'teams.members')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
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
                                  ({safeTranslate(t, 'teams.captain')})
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
                                {safeTranslate(t, 'teams.makeCaptain')}
                              </Button>
                            ) : null}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeMemberMutation.mutate(member.user_id)}
                              disabled={removeMemberMutation.isPending}
                            >
                              {safeTranslate(t, 'teams.removeMember')}
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {isCaptain ? (
                  <form onSubmit={addMemberForm.handleSubmit(handleAddMember)} className="flex flex-col gap-3 md:flex-row md:flex-1 md:items-end">
                    <FormField
                      className="flex-1"
                      label={safeTranslate(t, 'teams.memberEmail')}
                      htmlFor="member-email"
                      error={translateError(addMemberForm.formState.errors.user_email?.message)}
                    >
                      <Input id="member-email" type="email" {...addMemberForm.register('user_email')} />
                    </FormField>
                    <div className="flex items-center gap-2">
                      <InfoTooltip content={safeTranslate(t, 'teams.addMemberInfo')} />
                      <Button type="submit" className="md:whitespace-nowrap" disabled={addMemberMutation.isPending}>
                        {addMemberMutation.isPending ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'teams.addMember')}
                      </Button>
                    </div>
                  </form>
                ) : null}
                {myMembership && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={leaveTeamMutation.isPending} className={isCaptain ? 'md:ml-auto md:self-end' : ''}>
                        {safeTranslate(t, 'teams.leaveTeam')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{safeTranslate(t, 'teams.leaveTeamConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {isCaptain
                            ? safeTranslate(t, 'teams.leaveTeamConfirmDescriptionCaptain')
                            : safeTranslate(t, 'teams.leaveTeamConfirmDescription')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{safeTranslate(t, 'common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => leaveTeamMutation.mutate()}
                          disabled={leaveTeamMutation.isPending}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {leaveTeamMutation.isPending ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'teams.leaveTeam')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardFooter>
            </Card>

            {myMembership.team.project ? (
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle>{safeTranslate(t, 'teams.project')}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <form id="project-form" onSubmit={projectForm.handleSubmit(handleUpdateProject)} className="space-y-4">
                    <FormField
                      label={safeTranslate(t, 'teams.projectName')}
                      htmlFor="project-name"
                      error={translateError(projectForm.formState.errors.name?.message)}
                      required
                    >
                      <Input id="project-name" {...projectForm.register('name')} disabled={!isCaptain} readOnly={!isCaptain} />
                    </FormField>
                    <FormField label={safeTranslate(t, 'teams.projectSummary')} htmlFor="project-summary">
                      <Textarea id="project-summary" rows={3} {...projectForm.register('summary')} disabled={!isCaptain} readOnly={!isCaptain} />
                    </FormField>
                    <FormGrid columns={2}>
                      <FormField label={safeTranslate(t, 'teams.projectProblem')} htmlFor="project-problem">
                        <Textarea id="project-problem" rows={3} {...projectForm.register('problem')} disabled={!isCaptain} readOnly={!isCaptain} />
                      </FormField>
                      <FormField label={safeTranslate(t, 'teams.projectSolution')} htmlFor="project-solution">
                        <Textarea id="project-solution" rows={3} {...projectForm.register('solution')} disabled={!isCaptain} readOnly={!isCaptain} />
                      </FormField>
                    </FormGrid>
                    <FormGrid columns={2}>
                      <FormField
                        label={
                          <div className="flex items-center gap-2">
                            <span>{safeTranslate(t, 'teams.projectRepo')}</span>
                            <InfoTooltip content={safeTranslate(t, 'teams.projectRepoInfo')} />
                          </div>
                        }
                        htmlFor="project-repo"
                      >
                        <Input id="project-repo" {...projectForm.register('repository_url')} disabled={!isCaptain} readOnly={!isCaptain} />
                      </FormField>
                      <FormField
                        label={
                          <div className="flex items-center gap-2">
                            <span>{safeTranslate(t, 'teams.projectPitch')}</span>
                            <InfoTooltip content={safeTranslate(t, 'teams.projectPitchInfo')} />
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
                            <FormField label={safeTranslate(t, 'teams.projectImageUrl')} htmlFor="project-image-url">
                              <Input 
                                id="project-image-url" 
                                {...projectForm.register('logo_url')} 
                              />
                            </FormField>
                          ) : null}
                          <FormField
                            label={
                              <div className="flex items-center gap-2">
                                <span>{safeTranslate(t, 'teams.projectImageUpload')}</span>
                                <InfoTooltip content={safeTranslate(t, 'teams.projectImageUploadInfo')} />
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
                            <FormField label={safeTranslate(t, 'teams.projectImagePreview')} htmlFor="project-image-preview">
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
                            <FormField className="md:col-span-1" label={safeTranslate(t, 'teams.projectImageCurrent')} htmlFor="project-image-current">
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
                                  {safeTranslate(t, 'teams.removeProjectImage')}
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
                            <FormField className="md:col-span-1" label={safeTranslate(t, 'teams.projectImageCurrent')} htmlFor="project-image-current">
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
                  </form>
                </CardContent>
                {isCaptain ? (
                  <CardFooter>
                    <Button type="submit" form="project-form" disabled={projectMutation.isPending} className="w-full md:w-auto">
                      {projectMutation.isPending ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'teams.save')}
                    </Button>
                  </CardFooter>
                ) : null}
              </Card>
            ) : null}

            {submissionsSummary && (
              <TeamSubmissionsSummary summary={submissionsSummary} />
            )}
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{safeTranslate(t, 'teams.title')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground mb-4 text-center">
                {safeTranslate(t, 'teams.noTeamMessage')}
              </p>
              <Button asChild>
                <Link to={tenantPath(`dashboard/events/${numericEventId}/projects`)}>
                  {safeTranslate(t, 'projects.viewProjects')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

export default MyTeamPage;

