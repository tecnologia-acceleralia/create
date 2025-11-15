import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Filter, Plus, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import {
  createSuperAdminUser,
  deleteSuperAdminUser,
  listSuperAdminTenants,
  listSuperAdminUsers,
  updateSuperAdminUser,
  type SuperAdminTenant,
  type SuperAdminUser,
  TENANT_ROLE_SCOPES,
  type TenantRoleScope,
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
import { PasswordGeneratorButton } from '@/components/common/PasswordGeneratorButton';
import { cn } from '@/utils/cn';
import { formatDateValue } from '@/utils/date';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const USER_STATUS = ['active', 'inactive', 'invited'] as const;

type StatusFilter = (typeof USER_STATUS)[number] | '';

const tenantRoleEnum = z.enum([...TENANT_ROLE_SCOPES] as [TenantRoleScope, ...TenantRoleScope[]]);

type TenantRolesFormValue = Record<string, TenantRoleScope[]>;

const isValidTenantRoleScope = (scope: string): scope is TenantRoleScope =>
  TENANT_ROLE_SCOPES.includes(scope as TenantRoleScope);

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
    .union([z.string().min(6), z.literal('')])
    .transform<string | undefined>(value => (value === '' ? undefined : value))
    .optional(),
  tenantIds: z.array(z.number()).optional(),
  tenantRoles: z.record(z.string(), z.array(tenantRoleEnum)).optional()
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

  const usersQuery = useQuery<UsersListResponse>({
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
    placeholderData: previous => previous
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
                  <Button
                    type="submit"
                    variant="outline"
                    size="icon"
                    aria-label={t('superadmin.users.applyFilters')}
                    title={t('superadmin.users.applyFilters')}
                  >
                    <Filter className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleResetFilters}
                    aria-label={t('superadmin.users.resetFilters')}
                    title={t('superadmin.users.resetFilters')}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
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
                  {usersData.items.map(user => {
                    const isSuperAdminUser = Boolean(
                      user.is_super_admin ?? (user as unknown as { isSuperAdmin?: boolean }).isSuperAdmin
                    );

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{t(`superadmin.userStatus.${user.status}`)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isSuperAdminUser ? 'success' : 'outline'}>
                            {isSuperAdminUser
                              ? t('superadmin.users.superAdminBadge')
                              : t('superadmin.users.standardBadge')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.tenantMemberships.length === 0 ? (
                            <span className="text-xs text-muted-foreground">{t('superadmin.users.noTenants')}</span>
                          ) : (
                            <div className="space-y-2">
                              {user.tenantMemberships.map(membership => {
                                if (!membership.tenant) {
                                  return null;
                                }

                                const roles = membership.assignedRoles ?? [];

                                return (
                                  <div key={membership.id} className="rounded-md border border-border p-2">
                                    <p className="text-xs font-semibold">{membership.tenant.name}</p>
                                    <p className="text-[10px] uppercase text-muted-foreground">{membership.tenant.slug}</p>
                                    {roles.length > 0 ? (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {roles.map(role => (
                                          <Badge key={`${membership.id}-${role.id}`} variant="outline">
                                            {t(`superadmin.users.roleLabels.${role.scope}`, {
                                              defaultValue: role.name ?? role.scope
                                            })}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {t('superadmin.users.roles.empty')}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDateValue(user.created_at ?? user.createdAt) ?? t('common.notAvailable')}
                        </TableCell>
                        <TableCell className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={t('common.edit')}
                            onClick={() => openEditModal(user)}
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                aria-label={t('common.remove')}
                                onClick={() => setPendingDelete(user)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
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
                    );
                  })}
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
      const tenantRolesDefaults = (currentUser.tenantMemberships ?? []).reduce<TenantRolesFormValue>(
        (accumulator, membership) => {
          const tenantId = membership.tenant?.id;
          if (!tenantId) {
            return accumulator;
          }

          const scopes = (membership.assignedRoles ?? [])
            .map(role => role.scope)
            .filter((scope): scope is TenantRoleScope => isValidTenantRoleScope(scope));

          accumulator[String(tenantId)] = scopes;
          return accumulator;
        },
        {}
      );

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
            .filter((id): id is number => typeof id === 'number') ?? [],
        tenantRoles: tenantRolesDefaults
      };
    }

    return {
      email: '',
      first_name: '',
      last_name: '',
      language: 'es',
      status: 'active',
      is_super_admin: false,
      tenantIds: [],
      tenantRoles: {}
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
  const tenantRoles = (form.watch('tenantRoles') ?? {}) as TenantRolesFormValue;

  const availableTenants = useMemo(
    () => tenants.filter(tenant => !tenantSelections.includes(tenant.id)),
    [tenantSelections, tenants]
  );

  const selectedTenants = useMemo(
    () => tenants.filter(tenant => tenantSelections.includes(tenant.id)),
    [tenantSelections, tenants]
  );

  useEffect(() => {
    const currentRoles = (form.getValues('tenantRoles') ?? {}) as TenantRolesFormValue;
    const allowedKeys = new Set((tenantSelections ?? []).map(id => String(id)));
    const filteredEntries = Object.entries(currentRoles).filter(([key]) => allowedKeys.has(key));

    if (filteredEntries.length !== Object.entries(currentRoles).length) {
      form.setValue('tenantRoles', Object.fromEntries(filteredEntries), { shouldDirty: true });
    }
  }, [tenantSelections, form]);

  const handleAddTenant = (tenantId: number) => {
    const tenantKey = String(tenantId);
    const currentRoles = (form.getValues('tenantRoles') ?? {}) as TenantRolesFormValue;
    if (!currentRoles[tenantKey]) {
      form.setValue('tenantRoles', { ...currentRoles, [tenantKey]: [] }, { shouldDirty: true });
    }

    form.setValue('tenantIds', Array.from(new Set([...tenantSelections, tenantId])), { shouldDirty: true });
  };

  const handleRemoveTenant = (tenantId: number) => {
    const tenantKey = String(tenantId);
    const currentRoles = (form.getValues('tenantRoles') ?? {}) as TenantRolesFormValue;
    if (Object.prototype.hasOwnProperty.call(currentRoles, tenantKey)) {
      const { [tenantKey]: _removed, ...rest } = currentRoles;
      form.setValue('tenantRoles', rest, { shouldDirty: true });
    }

    form.setValue(
      'tenantIds',
      tenantSelections.filter(id => id !== tenantId),
      { shouldDirty: true }
    );
  };

  const handleToggleTenantRole = (tenantId: number, scope: TenantRoleScope, checked: boolean) => {
    const tenantKey = String(tenantId);
    const currentRoles = (form.getValues('tenantRoles') ?? {}) as TenantRolesFormValue;
    const existingScopes = Array.isArray(currentRoles[tenantKey]) ? [...currentRoles[tenantKey]] : [];

    const nextScopes = checked
      ? Array.from(new Set([...existingScopes, scope]))
      : existingScopes.filter(item => item !== scope);

    form.setValue(
      'tenantRoles',
      {
        ...currentRoles,
        [tenantKey]: nextScopes
      },
      { shouldDirty: true }
    );
  };

  const handleClose = () => {
    onClose();
    form.reset(getUserFormDefaults(mode, user));
  };

  const submitForm = async (values: UserFormSchema) => {
    const tenantRolesPayload = (values.tenantIds ?? []).reduce<Record<number, TenantRoleScope[]>>(
      (accumulator, tenantId) => {
        const scopes = values.tenantRoles?.[String(tenantId)] ?? [];
        accumulator[tenantId] = scopes as TenantRoleScope[];
        return accumulator;
      },
      {}
    );

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
          tenantIds: values.tenantIds ?? [],
          tenantRoles: tenantRolesPayload
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
          tenantIds: values.tenantIds ?? [],
          tenantRoles: tenantRolesPayload
        }
      });
    }
    form.reset(getUserFormDefaults(mode, user));
  };

  return (
    <Dialog open={open} onOpenChange={openState => (!openState ? handleClose() : null)}>
      <DialogContent className="h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('superadmin.users.createTitle')
              : t('superadmin.users.editTitle', { email: user?.email ?? '' })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(submitForm)} className="flex h-full flex-col overflow-hidden">
          <Tabs defaultValue="general" className="flex h-full flex-col space-y-4">
            <TabsList>
              <TabsTrigger value="general">{t('superadmin.users.tabs.general')}</TabsTrigger>
              <TabsTrigger value="tenants">{t('superadmin.users.tabs.tenants')}</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="general" className="mt-0">
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
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={mode === 'edit' ? t('superadmin.users.passwordOptional') : undefined}
                        className="flex-1"
                        {...form.register('password')}
                      />
                      <PasswordGeneratorButton
                        onGenerate={password => form.setValue('password', password, { shouldValidate: true })}
                        aria-label={t('superadmin.users.generatePassword')}
                      />
                    </div>
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
              </TabsContent>

              <TabsContent value="tenants" className="mt-0">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                    {t('superadmin.users.tenantAccess')}
                  </h3>
                  {tenants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('superadmin.users.noTenantsAvailable')}</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">{t('superadmin.users.tenantsTab.available')}</h4>
                          <div className="rounded-md border bg-background">
                            {availableTenants.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-muted-foreground">
                                {t('superadmin.users.tenantsTab.emptyAvailable')}
                              </p>
                            ) : (
                              <ul className="max-h-64 divide-y overflow-y-auto">
                                {availableTenants.map(tenant => (
                                  <li key={tenant.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                                    <div>
                                      <p className="font-medium">{tenant.name}</p>
                                      <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                                    </div>
                                  <Button type="button" size="sm" onClick={() => handleAddTenant(tenant.id)}>
                                      {t('superadmin.users.tenantsTab.add')}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">{t('superadmin.users.tenantsTab.selected')}</h4>
                          <div className="rounded-md border bg-background">
                            {selectedTenants.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-muted-foreground">
                                {t('superadmin.users.tenantsTab.emptySelected')}
                              </p>
                            ) : (
                              <ul className="max-h-64 divide-y overflow-y-auto">
                                {selectedTenants.map(tenant => (
                                  <li key={tenant.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                                    <div>
                                      <p className="font-medium">{tenant.name}</p>
                                      <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRemoveTenant(tenant.id)}
                                    >
                                      {t('superadmin.users.tenantsTab.remove')}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>

                      {selectedTenants.length > 0 ? (
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold">{t('superadmin.users.roles.title')}</h4>
                          <p className="text-xs text-muted-foreground">{t('superadmin.users.roles.description')}</p>
                          <div className="space-y-3">
                            {selectedTenants.map(tenant => {
                              const tenantKey = String(tenant.id);
                              const selectedScopes = tenantRoles[tenantKey] ?? [];

                              return (
                                <div key={`tenant-role-${tenant.id}`} className="rounded-md border p-4">
                                  <div>
                                    <p className="text-sm font-semibold">{tenant.name}</p>
                                    <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                                  </div>
                                  {TENANT_ROLE_SCOPES.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-4">
                                      {TENANT_ROLE_SCOPES.map(scope => {
                                        const isChecked = selectedScopes.includes(scope);
                                        return (
                                          <label key={`${tenant.id}-${scope}`} className="flex items-center gap-2 text-sm">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={event =>
                                                handleToggleTenantRole(tenant.id, scope, event.target.checked)
                                              }
                                            />
                                            <span>{t(`superadmin.users.roleLabels.${scope}`)}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {t('superadmin.users.roles.noOptions')}
                                    </p>
                                  )}
                                  {selectedScopes.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {t('superadmin.users.roles.empty')}
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              </TabsContent>
            </div>
          </Tabs>

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

