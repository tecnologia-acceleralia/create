import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/common';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FileInput } from '@/components/ui/file-input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/form';
import { ProjectCard as ProjectOverviewCard } from '@/components/projects/ProjectCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { safeTranslate } from '@/utils/i18n-helpers';
import { fileToBase64 } from '@/utils/files';
import { getMyTeams } from '@/services/teams';
import {
  getProjectsByEvent,
  createProjectForEvent,
  joinProject,
  type ProjectCard as ProjectCardModel
} from '@/services/projects';

const createProjectSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  requirements: z.string().optional()
});

type CreateProjectValues = z.infer<typeof createProjectSchema>;

function ProjectsPage() {
  const { eventId } = useParams();
  const numericEventId = Number(eventId);
  const { t } = useTranslation();
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: memberships } = useQuery({
    queryKey: ['my-teams'],
    queryFn: getMyTeams,
    enabled: !isSuperAdmin
  });

  const myMembership = memberships?.find(m => {
    const teamEventId = m?.team?.event_id;
    return teamEventId && Number(teamEventId) === numericEventId;
  });

  const createProjectForm = useForm<CreateProjectValues>({ resolver: zodResolver(createProjectSchema) });

  const {
    data: projects,
    isLoading: isProjectsLoading,
    isRefetching: isProjectsRefetching
  } = useQuery({
    queryKey: ['event-projects', numericEventId],
    queryFn: () => getProjectsByEvent(numericEventId),
    enabled: !Number.isNaN(numericEventId)
  });

  const [joiningProjectId, setJoiningProjectId] = useState<number | null>(null);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [projectImageBase64, setProjectImageBase64] = useState<string | null>(null);
  const [projectImagePreview, setProjectImagePreview] = useState<string | null>(null);
  const [projectImageError, setProjectImageError] = useState<string | null>(null);
  const [projectImageInputKey, setProjectImageInputKey] = useState(0);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'create' || hash === 'projects-create') {
      setIsCreateProjectDialogOpen(true);
    }
  }, []);

  const resetProjectImageSelection = (options?: { clearError?: boolean }) => {
    setProjectImageBase64(null);
    setProjectImagePreview(null);
    setProjectImageInputKey(previous => previous + 1);
    if (options?.clearError) {
      setProjectImageError(null);
    }
  };

  const handleProjectImageChange: React.ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target.files?.[0];

    if (!file) {
      resetProjectImageSelection();
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setProjectImageError(
        safeTranslate(t, 'projects.imageFormatError', {
          defaultValue: 'Formato no soportado. Usa PNG, JPG, WEBP o SVG.'
        })
      );
      resetProjectImageSelection();
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProjectImageError(safeTranslate(t, 'teams.logoTooLarge'));
      resetProjectImageSelection();
      return;
    }

    void (async () => {
      try {
        const base64 = await fileToBase64(file);
        setProjectImageBase64(base64);
        setProjectImagePreview(base64);
        setProjectImageError(null);
      } catch {
        setProjectImageError(
          safeTranslate(t, 'projects.imageReadError', {
            defaultValue: 'No se pudo leer el archivo seleccionado.'
          })
        );
        resetProjectImageSelection();
      }
    })();
  };

  const createProjectMutation = useMutation({
    mutationFn: async (values: CreateProjectValues) => {
      const payload: {
        title: string;
        description?: string;
        requirements?: string;
        logo?: string;
      } = {
        title: values.title,
        description: values.description || undefined,
        requirements: values.requirements || undefined
      };

      if (projectImageBase64) {
        payload.logo = projectImageBase64;
      }

      return createProjectForEvent(numericEventId, payload);
    },
    onSuccess: () => {
      toast.success(safeTranslate(t, 'projects.createSuccess'));
      createProjectForm.reset();
      setIsCreateProjectDialogOpen(false);
      resetProjectImageSelection({ clearError: true });
      void queryClient.invalidateQueries({ queryKey: ['event-projects', numericEventId] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const joinProjectMutation = useMutation({
    mutationFn: (projectId: number) => joinProject(projectId),
    onMutate: projectId => {
      setJoiningProjectId(projectId);
    },
    onSuccess: (data) => {
      if (data.previousTeam) {
        toast.success(safeTranslate(t, 'projects.joinSuccessWithPreviousTeam', { teamName: data.previousTeam.name }), {
          duration: 5000
        });
      } else {
        toast.success(safeTranslate(t, 'projects.joinSuccess'));
      }
      void queryClient.invalidateQueries({ queryKey: ['event-projects', numericEventId] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: (error: any) => {
      const backendMessage = error?.response?.data?.message;
      const message = backendMessage 
        ? safeTranslate(t, backendMessage, { defaultValue: backendMessage })
        : safeTranslate(t, 'common.error');
      toast.error(message);
    },
    onSettled: () => {
      setJoiningProjectId(null);
    }
  });

  if (Number.isNaN(numericEventId)) {
    return <div className="p-6 text-sm text-destructive">Evento inválido</div>;
  }

  const handleCreateProject = (values: CreateProjectValues) => {
    if (Number.isNaN(numericEventId)) {
      toast.error(safeTranslate(t, 'common.error'));
      return;
    }
    createProjectMutation.mutate(values);
  };

  const handleCreateDialogChange = (open: boolean) => {
    setIsCreateProjectDialogOpen(open);
    if (!open) {
      resetProjectImageSelection({ clearError: true });
    }
  };

  const handleJoinProject = (projectId: number) => {
    joinProjectMutation.mutate(projectId);
  };

  const translateError = (message?: string) =>
    message ? safeTranslate(t, message, { defaultValue: message }) : undefined;

  const renderProjectAction = (project: ProjectCardModel) => {
    const isMutatingJoin = joinProjectMutation.isPending;
    const isJoiningThisProject = joiningProjectId === project.id && isMutatingJoin;
    const isCaptainOrMember = project.is_captain || project.is_member;
    const isDisabled =
      isCaptainOrMember ||
      project.is_pending_member ||
      !project.can_join ||
      (isMutatingJoin && joiningProjectId !== project.id) ||
      isJoiningThisProject;

    let label = safeTranslate(t, 'projects.join');
    let variant: 'default' | 'outline' | 'ghost' = 'default';

    if (project.is_captain) {
      label = safeTranslate(t, 'projects.captainBadge');
      variant = 'outline';
    } else if (project.is_member) {
      label = safeTranslate(t, 'projects.joined');
      variant = 'outline';
    } else if (project.is_pending_member) {
      label = safeTranslate(t, 'projects.pendingBadge');
      variant = 'outline';
    } else if (isJoiningThisProject) {
      label = safeTranslate(t, 'projects.joining');
    }
    // Cuando !project.can_join, el botón mantiene el texto "Unirse" pero se desactiva
    // El badge muestra el estado real del equipo (team_status)

    return (
      <Button
        size="sm"
        variant={variant}
        disabled={isDisabled}
        onClick={isDisabled ? undefined : () => handleJoinProject(project.id)}
      >
        {label}
      </Button>
    );
  };

  const projectsLoading = isProjectsLoading || isProjectsRefetching;

  const renderProjectsList = () => {
    if (projectsLoading) {
      return (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      );
    }

    if (projects && projects.length > 0) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map(project => (
            <ProjectOverviewCard
              key={project.id}
              project={project}
              actions={renderProjectAction(project)}
            />
          ))}
        </div>
      );
    }

    return <p className="text-sm text-muted-foreground">{safeTranslate(t, 'projects.empty')}</p>;
  };

  return (
    <DashboardLayout
      title={safeTranslate(t, 'projects.title')}
      subtitle={safeTranslate(t, 'projects.availableSubtitle')}
    >
      <div className="space-y-6">
        <Card id="projects-list">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{safeTranslate(t, 'projects.availableSubtitle')}</p>
              </div>
              {!myMembership && (
                <Button onClick={() => setIsCreateProjectDialogOpen(true)}>
                  {safeTranslate(t, 'projects.create')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderProjectsList()}
          </CardContent>
        </Card>

        <Dialog open={isCreateProjectDialogOpen} onOpenChange={handleCreateDialogChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{safeTranslate(t, 'projects.formSection')}</DialogTitle>
              <DialogDescription>{safeTranslate(t, 'projects.createSubtitle')}</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={createProjectForm.handleSubmit(handleCreateProject)}
              className="space-y-4"
            >
              <FormField
                label={safeTranslate(t, 'projects.projectTitle')}
                htmlFor="project-title"
                error={translateError(createProjectForm.formState.errors.title?.message)}
                required
              >
                <Input id="project-title" {...createProjectForm.register('title')} />
              </FormField>
              <FormField label={safeTranslate(t, 'projects.description')} htmlFor="project-description">
                <Textarea
                  id="project-description"
                  rows={3}
                  {...createProjectForm.register('description')}
                />
              </FormField>
              <FormField label={safeTranslate(t, 'projects.imageUpload')} htmlFor="project-image-upload">
                <div className="space-y-2">
                  <FileInput
                    key={projectImageInputKey}
                    id="project-image-upload"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleProjectImageChange}
                    buttonLabel={safeTranslate(t, 'projects.imageUploadButton', {
                      defaultValue: 'Seleccionar imagen'
                    })}
                  />
                  {projectImageError ? (
                    <p className="text-xs text-destructive">{projectImageError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {safeTranslate(t, 'projects.imageUploadHelper', {
                        defaultValue: 'Formatos permitidos: PNG, JPG, WEBP o SVG (máx. 5 MB).'
                      })}
                    </p>
                  )}
                  {projectImagePreview ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded border border-border bg-muted">
                        <img
                          src={projectImagePreview}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => resetProjectImageSelection({ clearError: true })}
                      >
                        {safeTranslate(t, 'projects.imageClear', { defaultValue: 'Quitar imagen' })}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </FormField>
              <FormField label={safeTranslate(t, 'projects.requirements')} htmlFor="project-requirements">
                <Textarea
                  id="project-requirements"
                  rows={3}
                  {...createProjectForm.register('requirements')}
                />
              </FormField>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateProjectDialogOpen(false)}
                >
                  {safeTranslate(t, 'common.cancel')}
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending}>
                  {createProjectMutation.isPending ? safeTranslate(t, 'projects.creating') : safeTranslate(t, 'projects.create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default ProjectsPage;

