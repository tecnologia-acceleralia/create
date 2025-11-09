import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  createSuperAdminUser,
  deleteSuperAdminUser,
  listSuperAdminTenants,
  listSuperAdminUsers,
  updateSuperAdminUser,
  type SuperAdminTenant,
  type SuperAdminUser,
  type UsersListResponse
} from '@/services/superadmin';
import { SuperAdminToolbar } from '@/components/superadmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { FormField, FormGrid } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/common';
import { cn } from '@/utils/cn';

const USER_STATUS = ['active', 'inactive', 'invited'] as const;

type StatusFilter = (typeof USER_STATUS)[number] | '';

type UserFilters = {
  search: string;
  status: StatusFilter;
  isSuperAdmin: '' | 'true' | 'false';
  tenantId?: number;
  page: number;
};

const DEFAULT_FILTERS: UserFilters = {
  search: '',
  status: '',
  isSuperAdmin: '',
  tenantId: undefined,
  page: 1
};

const PAGE_SIZE = 10;

const userFormSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  language: z.string().min(2).max(10),
  status: z.enum(USER_STATUS),
  is_super_admin: z.boolean().optional(),
  password: z
    .preprocess(
      value => (value === '' || value === null || value === undefined ? undefined : value),
      z.string().min(6).optional()
    ),
  tenantIds: z.array(z.number()).optional()
});

type UserFormSchema = z.infer<typeof userFormSchema>;

type UserModalMode = 'create' | 'edit';

type UserModalProps = {
  mode: UserModalMode;
  user: SuperAdminUser | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: UserModalSubmitPayload) => Promise<void>;
  isSubmitting: boolean;
  tenants: SuperAdminTenant[];
};

type UserModalSubmitPayload =
  | { type: 'create'; body: Parameters<typeof createSuperAdminUser>[0] }
  | { type: 'update'; userId: number; body: Parameters<typeof updateSuperAdminUser>[1] };

function SuperAdminUsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();

  const initialTenantId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const tenantIdParam = params.get('tenantId');
    const parsed = tenantIdParam ? Number.parseInt(tenantIdParam, 10) : undefined;
    return Number.isNaN(parsed!) ? undefined : parsed;
  }, [location.search]);

  const [filters, setFilters] = useState<UserFilters>({ ...DEFAULT_FILTERS, tenantId: initialTenantId });
  const [modalState, setModalState] = useState<{ open: boolean; mode: UserModalMode; user: SuperAdminUser | null }>({
    open: false,
    mode: 'create',
    user: null
  });
  const [pendingDelete, setPendingDelete] = useState<SuperAdminUser | null>(null);

  useEffect(() => {
    if (initialTenantId) {
      setFilters(prev => ({ ...prev, tenantId: initialTenantId, page: 1 }));
    }
  }, [initialTenantId]);

  const tenantsOptionsQuery = useQuery({
    queryKey: ['superadmin', 'tenants', 'options'],
    queryFn: () =>
      listSuperAdminTenants({
        page: 1,
        pageSize: 100,
        sortField: 'name',
        sortOrder: 'asc'
      }),
    staleTime: 5 * 60 * 1000
  });

  const usersQuery = useQuery({
    queryKey: ['superadmin', 'users', filters],
    queryFn: () =>
      listSuperAdminUsers({
        page: filters.page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        status: filters.status ? [filters.status] : undefined,
        isSuperAdmin: filters.isSuperAdmin ? filters.isSuperAdmin === 'true' : undefined,
        tenantId: filters.tenantId,
        sortField: 'created_at',
        sortOrder: 'desc'
      }),
    keepPreviousData: true
  });

  const createUserMutation = useMutation({
    mutationFn: createSuperAdminUser,
    onSuccess: data => {
      toast.success(
        data.provisionalPassword
          ? t('superadmin.users.createSuccessWithPassword', { password: data.provisionalPassword })
          : t('superadmin.users.createSuccess')
      );
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'overview'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const updateUserMutation = useMutation({
    mutationFn: (variables: { userId: number; body: Parameters<typeof updateSuperAdminUser>[1] }) =>
      updateSuperAdminUser(variables.userId, variables.body),
    onSuccess: () => {
      toast.success(t('superadmin.users.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'overview'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteSuperAdminUser,
    onSuccess: () => {
      toast.success(t('superadmin.users.deleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'overview'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const usersData: UsersListResponse | undefined = usersQuery.data;
  const totalPages = usersData?.meta.totalPages ?? 0;

  const handleFiltersSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = String(formData.get('search') ?? '').trim();
    const status = (formData.get('status') as StatusFilter) ?? '';
    const isSuperAdmin = (formData.get('isSuperAdmin') as '' | 'true' | 'false') ?? '';
    const tenantIdRaw = String(formData.get('tenantId') ?? '').trim();
    const tenantId = tenantIdRaw ? Number.parseInt(tenantIdRaw, 10) : undefined;

    setFilters({
      search,
      status,
      isSuperAdmin,
      tenantId: Number.isNaN(tenantId!) ? undefined : tenantId,
      page: 1
    });
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const openCreateModal = () => {
    setModalState({ open: true, mode: 'create', user: null });
  };

  const openEditModal = (user: SuperAdminUser) => {
    setModalState({ open: true, mode: 'edit', user });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, open: false }));
  };

  const handleModalSubmit = async (payload: UserModalSubmitPayload) => {
    if (payload.type === 'create') {
      await createUserMutation.mutateAsync(payload.body);
    } else {
      await updateUserMutation.mutateAsync({ userId: payload.userId, body: payload.body });
    }
    closeModal();
  };

  const tenantsOptions = tenantsOptionsQuery.data?.items ?? [];
  const isLoading =
    usersQuery.isLoading || createUserMutation.isPending || updateUserMutation.isPending || deleteUserMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('superadmin.users.filtersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFiltersSubmit}>
            <SuperAdminToolbar
              start={
                <>
                  <FormField label={t('common.search')}>
                    <Input
                      name="search"
                      placeholder={t('superadmin.users.searchPlaceholder')}
                      defaultValue={filters.search}
                    />
                  </FormField>
                  <FormField label={t('superadmin.users.filterStatus')}>
                    <Select name="status" defaultValue={filters.status}>
                      <option value="">{t('superadmin.users.allStatuses')}</option>
                      {USER_STATUS.map(status => (
                        <option key={status} value={status}>
                          {t(`superadmin.userStatus.${status}`)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label={t('superadmin.users.filterIsSuperAdmin')}>
                    <Select name="isSuperAdmin" defaultValue={filters.isSuperAdmin}>
                      <option value="">{t('superadmin.users.allScopes')}</option>
                      <option value="true">{t('superadmin.users.superAdmins')}</option>
                      <option value="false">{t('superadmin.users.nonSuperAdmins')}</option>
                    </Select>
                  </FormField>
                  <FormField label={t('superadmin.users.filterTenant')}>
                    <Select name="tenantId" defaultValue={filters.tenantId?.toString() ?? ''}>
                      <option value="">{t('superadmin.users.allTenants')}</option>
                      {tenantsOptions.map(tenant => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </>
              }
              end={
                <>
                  <Button type="submit" variant="outline">
                    {t('superadmin.users.applyFilters')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleResetFilters}>
                    {t('superadmin.users.resetFilters')}
                  </Button>
                </>
              }
            />
          </form>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t('superadmin.users.create')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('superadmin.users.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <Spinner />
          ) : usersData && usersData.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('superadmin.users.table.name')}</TableHead>
                    <TableHead>{t('superadmin.users.table.email')}</TableHead>
                    <TableHead>{t('superadmin.users.table.status')}</TableHead>
                    <TableHead>{t('superadmin.users.table.scope')}</TableHead>
                    <TableHead>{t('superadmin.users.table.tenants')}</TableHead>
                    <TableHead>{t('superadmin.users.table.created')}</TableHead>
                    <TableHead className="text-right">{t('superadmin.users.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData.items.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t(`superadmin.userStatus.${user.status}`)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_super_admin ? 'success' : 'outline'}>
                          {user.is_super_admin ? t('superadmin.users.superAdminBadge') : t('superadmin.users.standardBadge')}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-y-1">
                        {user.tenantMemberships.length === 0 ? (
                          <span className="text-xs text-muted-foreground">{t('superadmin.users.noTenants')}</span>
                        ) : (
                          user.tenantMemberships.map(membership =>
                            membership.tenant ? (
                              <Badge key={membership.id} variant="secondary" className="mr-1">
                                {membership.tenant.name}
                              </Badge>
                            ) : null
                          )
                        )}
                      </TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditModal(user)}>
                          <Pencil className="mr-1 h-4 w-4" aria-hidden />
                          {t('common.edit')}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setPendingDelete(user)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                              {t('common.remove')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('superadmin.users.deleteTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('superadmin.users.deleteDescription', { email: pendingDelete?.email ?? '' })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setPendingDelete(null)}>
                                {t('common.cancel')}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  if (pendingDelete) {
                                    deleteUserMutation.mutate(pendingDelete.id);
                                    setPendingDelete(null);
                                  }
                                }}
                                disabled={deleteUserMutation.isPending}
                              >
                                {deleteUserMutation.isPending ? t('common.loading') : t('common.confirm')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {t('superadmin.users.pagination', {
                    from: (filters.page - 1) * PAGE_SIZE + 1,
                    to: Math.min(filters.page * PAGE_SIZE, usersData.meta.totalItems),
                    total: usersData.meta.totalItems
                  })}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={filters.page <= 1 || isLoading}
                  >
                    {t('superadmin.users.prevPage')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFilters(prev => ({
                        ...prev,
                        page: Math.min(totalPages || prev.page + 1, prev.page + 1)
                      }))
                    }
                    disabled={totalPages === 0 || filters.page >= totalPages || isLoading}
                  >
                    {t('superadmin.users.nextPage')}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('superadmin.users.empty')}</p>
          )}
        </CardContent>
      </Card>

      <UserModal
        mode={modalState.mode}
        user={modalState.user}
        open={modalState.open}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        isSubmitting={createUserMutation.isPending || updateUserMutation.isPending}
        tenants={tenantsOptions}
      />
    </div>
  );
}

function UserModal({ mode, user, open, onClose, onSubmit, isSubmitting, tenants }: UserModalProps) {
  const { t } = useTranslation();

  const getUserFormDefaults = (currentMode: UserModalMode, currentUser: SuperAdminUser | null): UserFormSchema => {
    if (currentMode === 'edit' && currentUser) {
      return {
        email: currentUser.email,
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
        language: currentUser.language ?? 'es',
        status: currentUser.status,
        is_super_admin: currentUser.is_super_admin,
        tenantIds:
          currentUser.tenantMemberships
            .map(membership => membership.tenant?.id)
            .filter((id): id is number => typeof id === 'number') ?? []
      };
    }

    return {
      email: '',
      first_name: '',
      last_name: '',
      language: 'es',
      status: 'active',
      is_super_admin: false,
      tenantIds: []
    };
  };

  const form = useForm<UserFormSchema>({
    resolver: zodResolver(userFormSchema),
    defaultValues: getUserFormDefaults(mode, user)
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset(getUserFormDefaults(mode, user));
  }, [open, mode, user, form]);

  const tenantSelections = form.watch('tenantIds') ?? [];

  const handleClose = () => {
    onClose();
    form.reset(getUserFormDefaults(mode, user));
  };

  const submitForm = async (values: UserFormSchema) => {
    if (mode === 'create') {
      await onSubmit({
        type: 'create',
        body: {
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
          language: values.language,
          status: values.status,
          is_super_admin: Boolean(values.is_super_admin),
          password: values.password ?? undefined,
          tenantIds: values.tenantIds ?? []
        }
      });
    } else if (user) {
      await onSubmit({
        type: 'update',
        userId: user.id,
        body: {
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
          language: values.language,
          status: values.status,
          is_super_admin: Boolean(values.is_super_admin),
          password: values.password ?? undefined,
          tenantIds: values.tenantIds ?? []
        }
      });
    }
    form.reset(getUserFormDefaults(mode, user));
  };

  return (
    <Dialog open={open} onOpenChange={openState => (!openState ? handleClose() : null)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('superadmin.users.createTitle')
              : t('superadmin.users.editTitle', { email: user?.email ?? '' })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(submitForm)} className="space-y-6">
          <FormGrid columns={2}>
            <FormField label={t('superadmin.users.fields.email')} required>
              <Input
                type="email"
                {...form.register('email')}
                className={cn(form.formState.errors.email && 'border-destructive')}
              />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </FormField>
            <FormField label={t('superadmin.users.fields.language')} required>
              <Input
                {...form.register('language')}
                className={cn(form.formState.errors.language && 'border-destructive')}
              />
              {form.formState.errors.language ? (
                <p className="text-xs text-destructive">{form.formState.errors.language.message}</p>
              ) : null}
            </FormField>
            <FormField label={t('superadmin.users.fields.firstName')} required>
              <Input
                {...form.register('first_name')}
                className={cn(form.formState.errors.first_name && 'border-destructive')}
              />
              {form.formState.errors.first_name ? (
                <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
              ) : null}
            </FormField>
            <FormField label={t('superadmin.users.fields.lastName')} required>
              <Input
                {...form.register('last_name')}
                className={cn(form.formState.errors.last_name && 'border-destructive')}
              />
              {form.formState.errors.last_name ? (
                <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>
              ) : null}
            </FormField>
            <FormField label={t('superadmin.users.fields.status')} required>
              <Select {...form.register('status')}>
                {USER_STATUS.map(status => (
                  <option key={status} value={status}>
                    {t(`superadmin.userStatus.${status}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('superadmin.users.fields.password')}>
              <Input
                type="password"
                placeholder={mode === 'edit' ? t('superadmin.users.passwordOptional') : undefined}
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </FormField>
            <FormField label={t('superadmin.users.fields.isSuperAdmin')}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register('is_super_admin')} />
                {t('superadmin.users.superAdminHint')}
              </label>
            </FormField>
          </FormGrid>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              {t('superadmin.users.tenantAccess')}
            </h3>
            <div className="grid gap-2">
              {tenants.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('superadmin.users.noTenantsAvailable')}</p>
              ) : (
                tenants.map(tenant => {
                  const checked = tenantSelections.includes(tenant.id);
                  return (
                    <label key={tenant.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={event => {
                          const nextValue = event.target.checked
                            ? Array.from(new Set([...tenantSelections, tenant.id]))
                            : tenantSelections.filter(id => id !== tenant.id);
                          form.setValue('tenantIds', nextValue, { shouldDirty: true });
                        }}
                      />
                      <span>{tenant.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default SuperAdminUsersPage;

