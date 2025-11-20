import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LineChart, Pencil, Plus, Trash2, Users } from 'lucide-react';
import {
  createTenantSuperAdmin,
  deleteTenantSuperAdmin,
  listSuperAdminTenants,
  updateTenantSuperAdmin,
  cleanEventSuperAdmin,
  type SuperAdminTenant,
  type TenantsListResponse
} from '@/services/superadmin';
import { getAllPublicEvents } from '@/services/public';
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
import { TenantModal, TenantTrackingModal } from '@/components/superadmin/modals';
import { FormField } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { formatDateValue } from '@/utils/date';
import { FilterCard, DataTable, type Column } from '@/components/common';

const TENANT_STATUS = ['active', 'trial', 'suspended', 'cancelled'] as const;
const TENANT_PLANS = ['free', 'basic', 'professional', 'enterprise'] as const;

type StatusFilter = (typeof TENANT_STATUS)[number] | '';
type PlanFilter = (typeof TENANT_PLANS)[number] | '';

type TenantFilters = {
  search: string;
  status: StatusFilter;
  plan: PlanFilter;
  page: number;
};

const DEFAULT_FILTERS: TenantFilters = {
  search: '',
  status: '',
  plan: '',
  page: 1
};

type TenantModalMode = 'create' | 'edit';

type TenantModalState = {
  mode: TenantModalMode;
  tenant: SuperAdminTenant | null;
  open: boolean;
};

type TrackingEventOption = {
  id: number;
  name: string;
};

const INITIAL_MODAL_STATE: TenantModalState = {
  mode: 'create',
  tenant: null,
  open: false
};

const PAGE_SIZE = 10;

function SuperAdminTenantsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<TenantFilters>(DEFAULT_FILTERS);
  const [pendingDelete, setPendingDelete] = useState<SuperAdminTenant | null>(null);
  const [modalState, setModalState] = useState<TenantModalState>(INITIAL_MODAL_STATE);
  const [trackingTenant, setTrackingTenant] = useState<SuperAdminTenant | null>(null);
  const [trackingEventId, setTrackingEventId] = useState('');

  const trackingEventsQuery = useQuery<TrackingEventOption[]>({
    queryKey: ['superadmin', 'tenant-events', trackingTenant?.slug],
    queryFn: async () => {
      if (!trackingTenant?.slug) {
        return [];
      }
      const events = await getAllPublicEvents();
      return events
        .filter(event => event.tenant?.slug === trackingTenant.slug)
        .map<TrackingEventOption>(event => ({
          id: event.id,
          name: event.name
        }));
    },
    enabled: Boolean(trackingTenant?.slug),
    staleTime: 60_000
  });

  const tenantsQuery = useQuery<TenantsListResponse>({
    queryKey: ['superadmin', 'tenants', filters],
    queryFn: () =>
      listSuperAdminTenants({
        page: filters.page,
        pageSize: PAGE_SIZE,
        search: filters.search || undefined,
        status: filters.status ? [filters.status] : undefined,
        plan: filters.plan ? [filters.plan] : undefined,
        sortField: 'created_at',
        sortOrder: 'desc'
      }),
    placeholderData: previousData => previousData,
    staleTime: 30_000
  });

  const createTenantMutation = useMutation({
    mutationFn: createTenantSuperAdmin,
    onSuccess: () => {
      toast.success(t('superadmin.tenants.createSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'tenants'] });
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'overview'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const updateTenantMutation = useMutation({
    mutationFn: (variables: { tenantId: number; payload: Parameters<typeof updateTenantSuperAdmin>[1] }) =>
      updateTenantSuperAdmin(variables.tenantId, variables.payload),
    onSuccess: () => {
      toast.success(t('superadmin.tenants.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'tenants'] });
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'overview'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const deleteTenantMutation = useMutation({
    mutationFn: deleteTenantSuperAdmin,
    onSuccess: () => {
      toast.success(t('superadmin.tenants.deleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'tenants'] });
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'overview'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const cleanEventMutation = useMutation({
    mutationFn: cleanEventSuperAdmin,
    onSuccess: (_, eventId) => {
      const eventName = trackingEvents.find(e => e.id === eventId)?.name ?? '';
      toast.success(t('superadmin.tenants.cleanEventSuccess', { eventName }));
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'tenant-events'] });
    },
    onError: () => toast.error(t('common.error'))
  });

  const tenantsData: TenantsListResponse | undefined = tenantsQuery.data;
  useEffect(() => {
    if (trackingEventsQuery.isError) {
      toast.error(t('superadmin.tenants.trackingEventsError'));
    }
  }, [trackingEventsQuery.isError, t]);

  const trackingEvents: TrackingEventOption[] = trackingEventsQuery.data ?? [];

  const handleApplyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchValue = formData.get('search');
    const search = typeof searchValue === 'string' ? searchValue.trim() : '';
    const status = (formData.get('status') as StatusFilter) ?? '';
    const plan = (formData.get('plan') as PlanFilter) ?? '';
    setFilters(prev => ({
      ...prev,
      search,
      status,
      plan,
      page: 1
    }));
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const openCreateModal = () => {
    setModalState({ mode: 'create', tenant: null, open: true });
  };

  const openEditModal = (tenant: SuperAdminTenant) => {
    setModalState({ mode: 'edit', tenant, open: true });
  };

  const closeModal = () => {
    setModalState(prev => ({ ...prev, open: false }));
  };

  const closeTrackingDialog = () => {
    setTrackingTenant(null);
    setTrackingEventId('');
  };

  const handleModalSubmit = async (payload: TenantModalSubmitPayload) => {
    try {
      if (payload.type === 'create') {
        await createTenantMutation.mutateAsync(payload.body);
      } else {
        await updateTenantMutation.mutateAsync({
          tenantId: payload.tenantId,
          payload: payload.body
        });
      }
      closeModal();
    } catch {
      // Los errores ya se manejan en las mutaciones (onError), pero aquí evitamos cerrar el modal si hay error
      // El modal se cerrará solo cuando la mutación sea exitosa
    }
  };

  const handleOpenTrackingDialog = (tenant: SuperAdminTenant) => {
    setTrackingTenant(tenant);
    setTrackingEventId('');
  };

  const handleTrackingSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trackingTenant) {
      return;
    }
    const eventId = trackingEventId.trim();
    if (!eventId) {
      toast.error(t('superadmin.tenants.trackingMissingEvent'));
      return;
    }
    const tenantSlug = trackingTenant.slug;
    const url = `/${tenantSlug}/dashboard/events/${eventId}?tab=statistics`;
    const fullUrl = `${globalThis.location.origin}${url}`;
    closeTrackingDialog();
    globalThis.window?.open(fullUrl, '_blank', 'noopener,noreferrer');
  };

  const columns: Column<SuperAdminTenant>[] = [
    {
      key: 'name',
      header: t('superadmin.tenants.table.name'),
      render: (tenant: SuperAdminTenant) => <span className="font-medium">{tenant.name}</span>
    },
    {
      key: 'slug',
      header: t('superadmin.tenants.table.slug'),
      render: (tenant: SuperAdminTenant) => (
        <code className="rounded bg-muted px-2 py-1 text-xs">{tenant.slug}</code>
      )
    },
    {
      key: 'status',
      header: t('superadmin.tenants.table.status'),
      render: (tenant: SuperAdminTenant) => (
        <Badge variant="secondary">{t(`superadmin.tenantStatus.${tenant.status}`)}</Badge>
      )
    },
    {
      key: 'plan',
      header: t('superadmin.tenants.table.plan'),
      render: (tenant: SuperAdminTenant) => t(`superadmin.tenantPlan.${tenant.plan_type}`)
    },
    {
      key: 'users',
      header: t('superadmin.tenants.table.users'),
      render: (tenant: SuperAdminTenant) => tenant.user_count
    },
    {
      key: 'created',
      header: t('superadmin.tenants.table.created'),
      render: (tenant: SuperAdminTenant) => formatDateValue(tenant.created_at) ?? t('common.notAvailable')
    },
    {
      key: 'actions',
      header: t('superadmin.tenants.table.actions'),
      className: 'text-right',
      render: (tenant: SuperAdminTenant) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('superadmin.tenants.openTracking')}
            onClick={() => handleOpenTrackingDialog(tenant)}
          >
            <LineChart className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/superadmin/users?tenantId=${tenant.id}`)}
            aria-label={t('superadmin.tenants.manageUsers')}
          >
            <Users className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('common.edit')}
            onClick={() => openEditModal(tenant)}
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
                onClick={() => setPendingDelete(tenant)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('superadmin.tenants.deleteTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('superadmin.tenants.deleteDescription', { name: pendingDelete?.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPendingDelete(null)}>
                  {t('common.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (pendingDelete) {
                      deleteTenantMutation.mutate(pendingDelete.id);
                      setPendingDelete(null);
                    }
                  }}
                  disabled={deleteTenantMutation.isPending}
                >
                  {deleteTenantMutation.isPending ? t('common.loading') : t('common.confirm')}
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
        title={t('superadmin.tenants.filtersTitle')}
        onSubmit={handleApplyFilters}
        onReset={handleResetFilters}
        applyLabel={t('superadmin.tenants.applyFilters')}
        resetLabel={t('superadmin.tenants.resetFilters')}
      >
        <FormField label={t('common.search')}>
          <Input
            name="search"
            defaultValue={filters.search}
            placeholder={t('superadmin.tenants.searchPlaceholder')}
          />
        </FormField>
        <FormField label={t('superadmin.tenants.filterStatus')}>
          <Select name="status" defaultValue={filters.status}>
            <option value="">{t('superadmin.tenants.allStatuses')}</option>
            {TENANT_STATUS.map(statusOption => (
              <option key={statusOption} value={statusOption}>
                {t(`superadmin.tenantStatus.${statusOption}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('superadmin.tenants.filterPlan')}>
          <Select name="plan" defaultValue={filters.plan}>
            <option value="">{t('superadmin.tenants.allPlans')}</option>
            {TENANT_PLANS.map(planOption => (
              <option key={planOption} value={planOption}>
                {t(`superadmin.tenantPlan.${planOption}`)}
              </option>
            ))}
          </Select>
        </FormField>
      </FilterCard>

      <div className="flex justify-end">
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          {t('superadmin.tenants.create')}
        </Button>
      </div>

      <DataTable
        title={t('superadmin.tenants.listTitle')}
        columns={columns}
        data={tenantsData?.items ?? []}
        isLoading={tenantsQuery.isLoading}
        emptyMessage={t('superadmin.tenants.empty')}
        pagination={
          tenantsData
            ? {
                meta: {
                  page: filters.page,
                  pageSize: PAGE_SIZE,
                  totalItems: tenantsData.meta.totalItems,
                  totalPages: tenantsData.meta.totalPages
                },
                onPageChange: page => setFilters(prev => ({ ...prev, page })),
                paginationLabel: (from, to, total) =>
                  t('superadmin.tenants.pagination', { from, to, total }),
                prevLabel: t('superadmin.tenants.prevPage'),
                nextLabel: t('superadmin.tenants.nextPage')
              }
            : undefined
        }
      />

      <TenantTrackingModal
        open={Boolean(trackingTenant)}
        onOpenChange={openState => (openState === false ? closeTrackingDialog() : null)}
        tenant={trackingTenant}
        trackingEventId={trackingEventId}
        onTrackingEventIdChange={setTrackingEventId}
        trackingEvents={trackingEvents}
        isLoadingEvents={trackingEventsQuery.isLoading}
        onSubmit={handleTrackingSubmit}
        onCleanEvent={async eventId => {
          await cleanEventMutation.mutateAsync(eventId);
        }}
        isCleaningEvent={cleanEventMutation.isPending}
      />

      <TenantModal
        mode={modalState.mode}
        tenant={modalState.tenant}
        open={modalState.open}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        isSubmitting={createTenantMutation.isPending || updateTenantMutation.isPending}
      />
    </div>
  );
}

type TenantModalSubmitPayload =
  | {
      type: 'create';
      body: Parameters<typeof createTenantSuperAdmin>[0];
    }
  | {
      type: 'update';
      tenantId: number;
      body: Parameters<typeof updateTenantSuperAdmin>[1];
    };

export default SuperAdminTenantsPage;

