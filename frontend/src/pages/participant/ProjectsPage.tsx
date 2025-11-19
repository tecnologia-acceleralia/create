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
  image_url: z.union([z.string().url(), z.literal('')]).optional(),
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

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'create' || hash === 'projects-create') {
      setIsCreateProjectDialogOpen(true);
    }
  }, []);

  const createProjectMutation = useMutation({
    mutationFn: (values: CreateProjectValues) =>
      createProjectForEvent(numericEventId, {
        title: values.title,
        description: values.description || undefined,
        image_url: values.image_url ? values.image_url : undefined,
        requirements: values.requirements || undefined
      }),
    onSuccess: () => {
      toast.success(t('projects.createSuccess'));
      createProjectForm.reset();
      setIsCreateProjectDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['event-projects', numericEventId] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const joinProjectMutation = useMutation({
    mutationFn: (projectId: number) => joinProject(projectId),
    onMutate: projectId => {
      setJoiningProjectId(projectId);
    },
    onSuccess: () => {
      toast.success(t('projects.joinSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['event-projects', numericEventId] });
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: () => toast.error(t('common.error')),
    onSettled: () => {
      setJoiningProjectId(null);
    }
  });

  if (Number.isNaN(numericEventId)) {
    return <div className="p-6 text-sm text-destructive">Evento inválido</div>;
  }

  const handleCreateProject = (values: CreateProjectValues) => {
    if (Number.isNaN(numericEventId)) {
      toast.error(t('common.error'));
      return;
    }
    createProjectMutation.mutate(values);
  };

  const handleJoinProject = (projectId: number) => {
    joinProjectMutation.mutate(projectId);
  };

  const translateError = (message?: string) =>
    message ? t(message, { defaultValue: message }) : undefined;

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

    let label = t('projects.join');
    let variant: 'default' | 'outline' | 'ghost' = 'default';

    if (project.is_captain) {
      label = t('projects.captainBadge');
      variant = 'outline';
    } else if (project.is_member) {
      label = t('projects.joined');
      variant = 'outline';
    } else if (project.is_pending_member) {
      label = t('projects.pendingBadge');
      variant = 'outline';
    } else if (isJoiningThisProject) {
      label = t('projects.joining');
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

    return <p className="text-sm text-muted-foreground">{t('projects.empty')}</p>;
  };

  return (
    <DashboardLayout
      title={t('projects.title')}
      subtitle={t('projects.availableSubtitle')}
    >
      <div className="space-y-6">
        <Card id="projects-list">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('projects.availableSubtitle')}</p>
              </div>
              {!myMembership && (
                <Button onClick={() => setIsCreateProjectDialogOpen(true)}>
                  {t('projects.create')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderProjectsList()}
          </CardContent>
        </Card>

        <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('projects.formSection')}</DialogTitle>
              <DialogDescription>{t('projects.createSubtitle')}</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={createProjectForm.handleSubmit(handleCreateProject)}
              className="space-y-4"
            >
              <FormField
                label={t('projects.projectTitle')}
                htmlFor="project-title"
                error={translateError(createProjectForm.formState.errors.title?.message)}
                required
              >
                <Input id="project-title" {...createProjectForm.register('title')} />
              </FormField>
              <FormField label={t('projects.description')} htmlFor="project-description">
                <Textarea
                  id="project-description"
                  rows={3}
                  {...createProjectForm.register('description')}
                />
              </FormField>
              <FormField label={t('projects.image')} htmlFor="project-image">
                <Input id="project-image" {...createProjectForm.register('image_url')} />
              </FormField>
              <FormField label={t('projects.requirements')} htmlFor="project-requirements">
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
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending}>
                  {createProjectMutation.isPending ? t('projects.creating') : t('projects.create')}
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

