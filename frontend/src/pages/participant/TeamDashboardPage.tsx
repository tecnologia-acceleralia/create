import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router';
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
import { FormField, FormGrid } from '@/components/form';
import { ProjectCard as ProjectOverviewCard } from '@/components/projects/ProjectCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { getMyTeams, addTeamMember, removeTeamMember } from '@/services/teams';
import {
  getProjectsByEvent,
  createProjectForEvent,
  joinProject,
  updateProject,
  type ProjectCard as ProjectCardModel,
  type Project
} from '@/services/projects';

const createProjectSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  image_url: z.union([z.string().url(), z.literal('')]).optional(),
  requirements: z.string().optional()
});

const addMemberSchema = z.object({
  user_email: z.string().email()
});

const projectSchema = z.object({
  name: z.string().min(3),
  summary: z.string().optional(),
  problem: z.string().optional(),
  solution: z.string().optional(),
  repository_url: z.union([z.string().url(), z.literal('')]).optional(),
  pitch_url: z.union([z.string().url(), z.literal('')]).optional(),
  logo_url: z.union([z.string().url(), z.literal('')]).optional()
});

type CreateProjectValues = z.infer<typeof createProjectSchema>;
type AddMemberValues = z.infer<typeof addMemberSchema>;
type ProjectValues = z.infer<typeof projectSchema>;

function TeamDashboardPage() {
  const { eventId } = useParams();
  const location = useLocation();
  const numericEventId = Number(eventId);
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: memberships, isLoading } = useQuery({
    queryKey: ['my-teams'],
    queryFn: getMyTeams
  });

  const myMembership = memberships?.find(m => m.team.event_id === numericEventId);
  const isCaptain = myMembership?.team.captain_id === user?.id;

  const createProjectForm = useForm<CreateProjectValues>({ resolver: zodResolver(createProjectSchema) });
  const addMemberForm = useForm<AddMemberValues>({ resolver: zodResolver(addMemberSchema) });
  const projectForm = useForm<ProjectValues>({ resolver: zodResolver(projectSchema) });

  const {
    data: projects,
    isLoading: isProjectsLoading,
    isRefetching: isProjectsRefetching
  } = useQuery({
    queryKey: ['event-projects', numericEventId],
    queryFn: () => getProjectsByEvent(numericEventId),
    enabled: !Number.isNaN(numericEventId) && !myMembership
  });

  const [joiningProjectId, setJoiningProjectId] = useState<number | null>(null);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);

  // Scroll to hash element when page loads or hash changes
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash === 'projects-list') {
      // Wait for content to be rendered
      const timer = setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    } else if (hash === 'projects-create') {
      // Open dialog instead of scrolling
      setIsCreateProjectDialogOpen(true);
    }
  }, [location.hash, isProjectsLoading, myMembership]);

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
    }
  }, [myMembership?.team.project?.id, projectForm]);

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

  const handleAddMember = (values: AddMemberValues) => {
    addMemberMutation.mutate(values);
  };

  const handleUpdateProject = (values: ProjectValues) => {
    const payload: Partial<Project> = {
      name: values.name,
      summary: values.summary || undefined,
      problem: values.problem || undefined,
      solution: values.solution || undefined,
      repository_url: values.repository_url ? values.repository_url : undefined,
      pitch_url: values.pitch_url ? values.pitch_url : undefined,
      logo_url: values.logo_url ? values.logo_url : undefined
    };

    projectMutation.mutate(payload);
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
    } else if (!project.can_join) {
      label = project.remaining_slots === 0 ? t('projects.noSlots') : t('projects.closed');
      variant = 'outline';
    } else if (isJoiningThisProject) {
      label = t('projects.joining');
    }

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
      title={t('teams.title')}
      subtitle={myMembership?.team.name ?? t('projects.preparationSubtitle')}
    >
      {myMembership ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('teams.members')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {myMembership.team.members.map(member => (
                  <li key={member.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <div>
                      <p className="font-medium">{member.user?.first_name} {member.user?.last_name}</p>
                      <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                    </div>
                    {isCaptain && member.user_id !== user?.id ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeMemberMutation.mutate(member.user_id)}
                      >
                        {t('teams.removeMember')}
                      </Button>
                    ) : null}
                  </li>
                ))}
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
                    <Input id="project-name" {...projectForm.register('name')} />
                  </FormField>
                  <FormField label={t('teams.projectSummary')} htmlFor="project-summary">
                    <Textarea id="project-summary" rows={3} {...projectForm.register('summary')} />
                  </FormField>
                  <FormGrid columns={2}>
                    <FormField label={t('teams.projectProblem')} htmlFor="project-problem">
                      <Textarea id="project-problem" rows={3} {...projectForm.register('problem')} />
                    </FormField>
                    <FormField label={t('teams.projectSolution')} htmlFor="project-solution">
                      <Textarea id="project-solution" rows={3} {...projectForm.register('solution')} />
                    </FormField>
                  </FormGrid>
                  <FormGrid columns={2}>
                    <FormField label={t('teams.projectRepo')} htmlFor="project-repo">
                      <Input id="project-repo" {...projectForm.register('repository_url')} />
                    </FormField>
                    <FormField label={t('teams.projectPitch')} htmlFor="project-pitch">
                      <Input id="project-pitch" {...projectForm.register('pitch_url')} />
                    </FormField>
                  </FormGrid>
                  <FormField label={t('teams.projectImage')} htmlFor="project-image-url">
                    <Input id="project-image-url" {...projectForm.register('logo_url')} />
                  </FormField>
                  <Button type="submit" disabled={projectMutation.isPending || !isCaptain}>
                    {projectMutation.isPending ? t('common.loading') : t('teams.save')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : (
        <div className="space-y-6">
          <Card id="projects-list">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('projects.viewProjects')}</CardTitle>
                  <p className="text-sm text-muted-foreground">{t('projects.availableSubtitle')}</p>
                </div>
                <Button onClick={() => setIsCreateProjectDialogOpen(true)}>
                  {t('projects.create')}
                </Button>
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
                  label={t('projects.title')}
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
      )}
    </DashboardLayout>
  );
}

export default TeamDashboardPage;

