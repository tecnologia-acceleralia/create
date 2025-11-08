import { useEffect } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '@/context/AuthContext';
import { Spinner, PageHeader } from '@/components/common';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getMyTeams, createTeam, addTeamMember, removeTeamMember } from '@/services/teams';
import { updateProject } from '@/services/projects';

const createTeamSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
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
  repository_url: z.string().url().optional().or(z.literal('')),
  pitch_url: z.string().url().optional().or(z.literal(''))
});

type CreateTeamValues = z.infer<typeof createTeamSchema>;
type AddMemberValues = z.infer<typeof addMemberSchema>;
type ProjectValues = z.infer<typeof projectSchema>;

function TeamDashboardPage() {
  const { eventId } = useParams();
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

  const createTeamForm = useForm<CreateTeamValues>({ resolver: zodResolver(createTeamSchema) });
  const addMemberForm = useForm<AddMemberValues>({ resolver: zodResolver(addMemberSchema) });
  const projectForm = useForm<ProjectValues>({ resolver: zodResolver(projectSchema) });

  useEffect(() => {
    if (myMembership?.team.project) {
      projectForm.reset({
        name: myMembership.team.project.name,
        summary: myMembership.team.project.summary ?? '',
        problem: myMembership.team.project.problem ?? '',
        solution: myMembership.team.project.solution ?? '',
        repository_url: myMembership.team.project.repository_url ?? '',
        pitch_url: myMembership.team.project.pitch_url ?? ''
      });
    }
  }, [myMembership?.team.project?.id, projectForm]);

  const createTeamMutation = useMutation({
    mutationFn: (values: CreateTeamValues) => createTeam({ ...values, event_id: numericEventId }),
    onSuccess: () => {
      toast.success(t('teams.createSuccess'));
      createTeamForm.reset();
      void queryClient.invalidateQueries({ queryKey: ['my-teams'] });
    },
    onError: () => toast.error(t('common.error'))
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
    mutationFn: (values: ProjectValues) => updateProject(myMembership!.team.project!.id, {
      ...values,
      repository_url: values.repository_url || undefined,
      pitch_url: values.pitch_url || undefined
    }),
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

  const handleCreateTeam = (values: CreateTeamValues) => {
    createTeamMutation.mutate(values);
  };

  const handleAddMember = (values: AddMemberValues) => {
    addMemberMutation.mutate(values);
  };

  const handleUpdateProject = (values: ProjectValues) => {
    projectMutation.mutate(values);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t('teams.title')} subtitle={myMembership?.team.name ?? ''} />

      {!myMembership ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('teams.createTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">{t('teams.noTeam')}</p>
            <form onSubmit={createTeamForm.handleSubmit(handleCreateTeam)} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="team-name">{t('teams.name')}</label>
                <Input id="team-name" {...createTeamForm.register('name')} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="team-description">{t('teams.description')}</label>
                <Textarea id="team-description" rows={3} {...createTeamForm.register('description')} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="team-requirements">{t('teams.requirements')}</label>
                <Textarea id="team-requirements" rows={3} {...createTeamForm.register('requirements')} />
              </div>
              <Button type="submit" disabled={createTeamMutation.isLoading}>
                {createTeamMutation.isLoading ? t('common.loading') : t('teams.create')}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
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
                  <div className="flex-grow">
                    <label className="text-sm font-medium" htmlFor="member-email">{t('teams.memberEmail')}</label>
                    <Input id="member-email" type="email" {...addMemberForm.register('user_email')} />
                  </div>
                  <Button type="submit" className="md:self-end" disabled={addMemberMutation.isLoading}>
                    {addMemberMutation.isLoading ? t('common.loading') : t('teams.addMember')}
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
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" htmlFor="project-name">{t('teams.projectName')}</label>
                    <Input id="project-name" defaultValue={myMembership.team.project.name} {...projectForm.register('name')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium" htmlFor="project-summary">{t('teams.projectSummary')}</label>
                    <Textarea id="project-summary" rows={3} defaultValue={myMembership.team.project.summary ?? ''} {...projectForm.register('summary')} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium" htmlFor="project-problem">{t('teams.projectProblem')}</label>
                      <Textarea id="project-problem" rows={3} defaultValue={myMembership.team.project.problem ?? ''} {...projectForm.register('problem')} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium" htmlFor="project-solution">{t('teams.projectSolution')}</label>
                      <Textarea id="project-solution" rows={3} defaultValue={myMembership.team.project.solution ?? ''} {...projectForm.register('solution')} />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium" htmlFor="project-repo">{t('teams.projectRepo')}</label>
                      <Input id="project-repo" defaultValue={myMembership.team.project.repository_url ?? ''} {...projectForm.register('repository_url')} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium" htmlFor="project-pitch">{t('teams.projectPitch')}</label>
                      <Input id="project-pitch" defaultValue={myMembership.team.project.pitch_url ?? ''} {...projectForm.register('pitch_url')} />
                    </div>
                  </div>
                  <Button type="submit" disabled={projectMutation.isLoading || !isCaptain}>
                    {projectMutation.isLoading ? t('common.loading') : t('teams.save')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

export default TeamDashboardPage;

