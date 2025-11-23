import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Key } from 'lucide-react';
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
import { UserModal, ChangePasswordModal } from '@/components/superadmin/modals';
import { FormField } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { formatDateValue } from '@/utils/date';
import { safeTranslate } from '@/utils/i18n-helpers';
import { FilterCard, DataTable, type Column } from '@/components/common';

const USER_STATUS = ['active', 'inactive', 'invited'] as const;

type StatusFilter = (typeof USER_STATUS)[number] | '';

type UserFilters = {
  search: string;
  status: StatusFilter;
  isSuperAdmin: '' | 'true' | 'false';
  tenantId?: number;
  lastLoginFilter: '' | 'never' | 'last7days' | 'last30days' | 'last90days';
  page: number;
};

const DEFAULT_FILTERS: UserFilters = {
  search: '',
  status: '',
  isSuperAdmin: '',
  tenantId: undefined,
  lastLoginFilter: '',
  page: 1
};

const PAGE_SIZE = 10;

type UserModalMode = 'create' | 'edit';

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
  const [passwordChangeUser, setPasswordChangeUser] = useState<SuperAdminUser | null>(null);

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
        lastLoginFilter: filters.lastLoginFilter || undefined,
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
          ? safeTranslate(t, 'superadmin.users.createSuccessWithPassword', { password: data.provisionalPassword })
          : safeTranslate(t, 'superadmin.users.createSuccess')
      );
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'overview'] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const updateUserMutation = useMutation({
    mutationFn: (variables: { userId: number; body: Parameters<typeof updateSuperAdminUser>[1] }) =>
      updateSuperAdminUser(variables.userId, variables.body),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'superadmin.users.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'overview'] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const changePasswordMutation = useMutation({
    mutationFn: (variables: { userId: number; password: string }) =>
      updateSuperAdminUser(variables.userId, { password: variables.password }),
    onSuccess: () => {
      toast.success(safeTranslate(t, 'superadmin.users.passwordChangedSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteSuperAdminUser,
    onSuccess: () => {
      toast.success(safeTranslate(t, 'superadmin.users.deleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'overview'] });
    },
    onError: () => toast.error(safeTranslate(t, 'common.error'))
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
    const lastLoginFilter = (formData.get('lastLoginFilter') as '' | 'never' | 'last7days' | 'last30days' | 'last90days') ?? '';

    setFilters({
      search,
      status,
      isSuperAdmin,
      tenantId: Number.isNaN(tenantId!) ? undefined : tenantId,
      lastLoginFilter,
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

  const columns: Column<SuperAdminUser>[] = [
    {
      key: 'name',
      header: safeTranslate(t, 'superadmin.users.table.name'),
      render: user => <span className="font-medium">{user.first_name} {user.last_name}</span>
    },
    {
      key: 'email',
      header: safeTranslate(t, 'superadmin.users.table.email'),
      render: user => user.email
    },
    {
      key: 'status',
      header: safeTranslate(t, 'superadmin.users.table.status'),
      render: user => <Badge variant="secondary">{safeTranslate(t, `superadmin.userStatus.${user.status}`, { defaultValue: user.status })}</Badge>
    },
    {
      key: 'scope',
      header: safeTranslate(t, 'superadmin.users.table.scope'),
      render: user => {
        const isSuperAdminUser = Boolean(
          user.is_super_admin ?? (user as unknown as { isSuperAdmin?: boolean }).isSuperAdmin
        );
        return (
          <Badge variant={isSuperAdminUser ? 'success' : 'outline'}>
            {isSuperAdminUser
              ? safeTranslate(t, 'superadmin.users.superAdminBadge')
              : safeTranslate(t, 'superadmin.users.standardBadge')}
          </Badge>
        );
      }
    },
    {
      key: 'tenants',
      header: safeTranslate(t, 'superadmin.users.table.tenants'),
      render: user =>
        user.tenantMemberships.length === 0 ? (
          <span className="text-xs text-muted-foreground">{safeTranslate(t, 'superadmin.users.noTenants')}</span>
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
                          {safeTranslate(t, `superadmin.users.roleLabels.${role.scope}`, {
                            defaultValue: role.name ?? role.scope
                          })}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {safeTranslate(t, 'superadmin.users.roles.empty')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )
    },
    {
      key: 'created',
      header: safeTranslate(t, 'superadmin.users.table.created'),
      render: user => formatDateValue(user.created_at ?? user.createdAt) ?? safeTranslate(t, 'common.notAvailable')
    },
    {
      key: 'lastLogin',
      header: safeTranslate(t, 'superadmin.users.table.lastLogin'),
      render: user => {
        const lastLogin = user.last_login_at;
        if (!lastLogin) {
          return <span className="text-muted-foreground">{safeTranslate(t, 'superadmin.users.neverLoggedIn')}</span>;
        }
        return formatDateValue(lastLogin) ?? safeTranslate(t, 'common.notAvailable');
      }
    },
    {
      key: 'actions',
      header: safeTranslate(t, 'superadmin.users.table.actions'),
      className: 'text-right',
      render: user => (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={safeTranslate(t, 'common.edit')}
            onClick={() => openEditModal(user)}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={safeTranslate(t, 'superadmin.users.changePassword')}
            onClick={() => setPasswordChangeUser(user)}
          >
            <Key className="h-4 w-4" aria-hidden />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                aria-label={safeTranslate(t, 'common.remove')}
                onClick={() => setPendingDelete(user)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{safeTranslate(t, 'superadmin.users.deleteTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {safeTranslate(t, 'superadmin.users.deleteDescription', { email: pendingDelete?.email ?? '' })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPendingDelete(null)}>
                  {safeTranslate(t, 'common.cancel')}
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
                  {deleteUserMutation.isPending ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'common.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <FilterCard
        title={safeTranslate(t, 'superadmin.users.filtersTitle')}
        onSubmit={handleFiltersSubmit}
        onReset={handleResetFilters}
        applyLabel={safeTranslate(t, 'superadmin.users.applyFilters')}
        resetLabel={safeTranslate(t, 'superadmin.users.resetFilters')}
      >
        <FormField label={safeTranslate(t, 'common.search')}>
          <Input
            name="search"
            placeholder={safeTranslate(t, 'superadmin.users.searchPlaceholder')}
            defaultValue={filters.search}
          />
        </FormField>
        <FormField label={safeTranslate(t, 'superadmin.users.filterStatus')}>
          <Select name="status" defaultValue={filters.status}>
            <option value="">{safeTranslate(t, 'superadmin.users.allStatuses')}</option>
            {USER_STATUS.map(status => (
              <option key={status} value={status}>
                {safeTranslate(t, `superadmin.userStatus.${status}`, { defaultValue: status })}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={safeTranslate(t, 'superadmin.users.filterIsSuperAdmin')}>
          <Select name="isSuperAdmin" defaultValue={filters.isSuperAdmin}>
            <option value="">{safeTranslate(t, 'superadmin.users.allScopes')}</option>
            <option value="true">{safeTranslate(t, 'superadmin.users.superAdmins')}</option>
            <option value="false">{safeTranslate(t, 'superadmin.users.nonSuperAdmins')}</option>
          </Select>
        </FormField>
        <FormField label={safeTranslate(t, 'superadmin.users.filterTenant')}>
          <Select name="tenantId" defaultValue={filters.tenantId?.toString() ?? ''}>
            <option value="">{safeTranslate(t, 'superadmin.users.allTenants')}</option>
            {tenantsOptions.map(tenant => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={safeTranslate(t, 'superadmin.users.filterLastLogin')}>
          <Select name="lastLoginFilter" defaultValue={filters.lastLoginFilter}>
            <option value="">{safeTranslate(t, 'superadmin.users.allLastLogins')}</option>
            <option value="never">{safeTranslate(t, 'superadmin.users.neverLoggedIn')}</option>
            <option value="last7days">{safeTranslate(t, 'superadmin.users.last7days')}</option>
            <option value="last30days">{safeTranslate(t, 'superadmin.users.last30days')}</option>
            <option value="last90days">{safeTranslate(t, 'superadmin.users.last90days')}</option>
          </Select>
        </FormField>
      </FilterCard>

      <div className="flex justify-end">
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {safeTranslate(t, 'superadmin.users.create')}
        </Button>
      </div>

      <DataTable
        title={safeTranslate(t, 'superadmin.users.listTitle')}
        columns={columns}
        data={usersData?.items ?? []}
        isLoading={usersQuery.isLoading}
        emptyMessage={safeTranslate(t, 'superadmin.users.empty')}
        pagination={
          usersData
            ? {
                meta: {
                  page: filters.page,
                  pageSize: PAGE_SIZE,
                  totalItems: usersData.meta.totalItems,
                  totalPages: usersData.meta.totalPages
                },
                onPageChange: page => setFilters(prev => ({ ...prev, page })),
                paginationLabel: (from, to, total) =>
                  safeTranslate(t, 'superadmin.users.pagination', { from, to, total }),
                prevLabel: safeTranslate(t, 'superadmin.users.prevPage'),
                nextLabel: safeTranslate(t, 'superadmin.users.nextPage')
              }
            : undefined
        }
      />

      <UserModal
        mode={modalState.mode}
        user={modalState.user}
        open={modalState.open}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        isSubmitting={createUserMutation.isPending || updateUserMutation.isPending}
        tenants={tenantsOptions}
        selectedTenantId={filters.tenantId}
      />

      <ChangePasswordModal
        user={passwordChangeUser}
        open={passwordChangeUser !== null}
        onClose={() => setPasswordChangeUser(null)}
        onSubmit={async (userId, password) => {
          await changePasswordMutation.mutateAsync({ userId, password });
        }}
        isSubmitting={changePasswordMutation.isPending}
      />
    </div>
  );
}


export default SuperAdminUsersPage;

