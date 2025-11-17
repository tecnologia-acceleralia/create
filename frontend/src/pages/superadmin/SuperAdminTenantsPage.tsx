import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import { Filter, LineChart, Pencil, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import {
  createTenantSuperAdmin,
  deleteTenantSuperAdmin,
  listSuperAdminTenants,
  updateTenantSuperAdmin,
  type SuperAdminTenant,
  type TenantsListResponse
} from '@/services/superadmin';
import { getAllPublicEvents } from '@/services/public';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField, FormGrid } from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateValue } from '@/utils/date';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/common';
import { cn } from '@/utils/cn';
import { fileToBase64 } from '@/utils/files';
import { useForm, type UseFormReturn, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

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

const nullableString = () =>
  z.preprocess(
    value => {
      if (value === '' || value === undefined) {
        return null;
      }
      return typeof value === 'string' ? value.trim() : value;
    },
    z.nullable(z.string())
  );

const nullableNumber = () =>
  z.preprocess(
    value => {
      if (value === '' || value === undefined || value === null) {
        return null;
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    },
    z.nullable(z.number().int().nonnegative())
  );

const colorSchema = z.preprocess(
  value => {
    if (value === '' || value === undefined || value === null) {
      return null;
    }
    return value;
  },
  z
    .nullable(z.string().refine(val => val === null || /^#([\da-fA-F]{3}|[\da-fA-F]{6})$/.test(val), 'Color inválido'))
);

const tenantFormSchemaBase = z.object({
  slug: z.string().min(3, 'Slug inválido'),
  name: z.string().min(1, 'El nombre es obligatorio'),
  subdomain: nullableString(),
  custom_domain: nullableString(),
  plan_type: z.enum(TENANT_PLANS),
  status: z.enum(TENANT_STATUS),
  primary_color: colorSchema,
  secondary_color: colorSchema,
  accent_color: colorSchema,
  start_date: nullableString(),
  end_date: nullableString(),
  website_url: nullableString(),
  facebook_url: nullableString(),
  instagram_url: nullableString(),
  linkedin_url: nullableString(),
  twitter_url: nullableString(),
  youtube_url: nullableString(),
  max_evaluators: nullableNumber(),
  max_participants: nullableNumber(),
  max_appointments_per_month: nullableNumber(),
  hero_content: nullableString(),
  tenant_css: nullableString(),
  logo_url: nullableString(),
  admin_email: z.preprocess(
    value => {
      if (value === '' || value === undefined || value === null) {
        return undefined;
      }
      return value;
    },
    z.string().email({ message: 'Correo inválido' }).optional()
  ),
  admin_first_name: nullableString(),
  admin_last_name: nullableString(),
  admin_language: nullableString(),
  admin_password: nullableString()
});

// Tipo explícito para el formulario que coincide con la salida del esquema
type TenantFormSchema = {
  slug: string;
  name: string;
  subdomain: string | null;
  custom_domain: string | null;
  plan_type: 'free' | 'basic' | 'professional' | 'enterprise';
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  start_date: string | null;
  end_date: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  max_evaluators: number | null;
  max_participants: number | null;
  max_appointments_per_month: number | null;
  hero_content: string | null;
  tenant_css: string | null;
  logo_url: string | null;
  admin_email?: string;
  admin_first_name: string | null;
  admin_last_name: string | null;
  admin_language: string | null;
  admin_password: string | null;
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

  const tenantsData: TenantsListResponse | undefined = tenantsQuery.data;
  const totalPages = tenantsData?.meta.totalPages ?? 0;
  useEffect(() => {
    if (trackingEventsQuery.isError) {
      toast.error(t('superadmin.tenants.trackingEventsError'));
    }
  }, [trackingEventsQuery.isError, t]);

  const trackingEvents: TrackingEventOption[] = trackingEventsQuery.data ?? [];

  const handleApplyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = String(formData.get('search') ?? '').trim();
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
    } catch (error) {
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
    closeTrackingDialog();
    navigate(`/${tenantSlug}/dashboard/events/${eventId}/tracking`);
  };

  const isLoading = tenantsQuery.isLoading || createTenantMutation.isPending || updateTenantMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('superadmin.tenants.filtersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleApplyFilters} className="space-y-4">
            <SuperAdminToolbar
              start={
                <>
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
                </>
              }
              end={
                <>
                  <Button
                    type="submit"
                    variant="outline"
                    size="icon"
                    aria-label={t('superadmin.tenants.applyFilters')}
                    title={t('superadmin.tenants.applyFilters')}
                  >
                    <Filter className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleResetFilters}
                    aria-label={t('superadmin.tenants.resetFilters')}
                    title={t('superadmin.tenants.resetFilters')}
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
          {t('superadmin.tenants.create')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('superadmin.tenants.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {tenantsQuery.isLoading ? (
            <Spinner />
          ) : tenantsData && tenantsData.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('superadmin.tenants.table.name')}</TableHead>
                    <TableHead>{t('superadmin.tenants.table.slug')}</TableHead>
                    <TableHead>{t('superadmin.tenants.table.status')}</TableHead>
                    <TableHead>{t('superadmin.tenants.table.plan')}</TableHead>
                    <TableHead>{t('superadmin.tenants.table.users')}</TableHead>
                    <TableHead>{t('superadmin.tenants.table.created')}</TableHead>
                    <TableHead className="text-right">{t('superadmin.tenants.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantsData.items.map(tenant => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-xs">{tenant.slug}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{t(`superadmin.tenantStatus.${tenant.status}`)}</Badge>
                      </TableCell>
                      <TableCell>{t(`superadmin.tenantPlan.${tenant.plan_type}`)}</TableCell>
                      <TableCell>{tenant.user_count}</TableCell>
                      <TableCell>{formatDateValue(tenant.created_at) ?? t('common.notAvailable')}</TableCell>
                      <TableCell className="flex items-center justify-end gap-2">
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {t('superadmin.tenants.pagination', {
                    from: (filters.page - 1) * PAGE_SIZE + 1,
                    to: Math.min(filters.page * PAGE_SIZE, tenantsData.meta.totalItems),
                    total: tenantsData.meta.totalItems
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
                    {t('superadmin.tenants.prevPage')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFilters(prev => ({ ...prev, page: Math.min(totalPages || prev.page + 1, prev.page + 1) }))
                    }
                    disabled={totalPages === 0 || filters.page >= totalPages || isLoading}
                  >
                    {t('superadmin.tenants.nextPage')}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('superadmin.tenants.empty')}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(trackingTenant)} onOpenChange={openState => (!openState ? closeTrackingDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('superadmin.tenants.trackingDialogTitle')}</DialogTitle>
            <DialogDescription>{t('superadmin.tenants.trackingDialogDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleTrackingSubmit}>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="tracking-tenant">
                {t('superadmin.tenants.trackingDialogTenant')}
              </label>
              <Input id="tracking-tenant" value={trackingTenant?.slug ?? ''} readOnly />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="tracking-event">
                {t('superadmin.tenants.trackingDialogEvent')}
              </label>
              <Select
                id="tracking-event"
                value={trackingEventId}
                onChange={event => setTrackingEventId(event.target.value)}
                disabled={trackingEventsQuery.isLoading || trackingEvents.length === 0}
              >
                <option value="">
                  {trackingEventsQuery.isLoading
                    ? t('common.loading')
                    : t('superadmin.tenants.trackingDialogEventPlaceholder')}
                </option>
                {trackingEvents.map(eventOption => (
                  <option key={eventOption.id} value={String(eventOption.id)}>
                    {eventOption.name}
                  </option>
                ))}
              </Select>
              {trackingEventsQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">{t('superadmin.tenants.trackingDialogLoading')}</p>
              ) : null}
              {!trackingEventsQuery.isLoading && trackingEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('superadmin.tenants.trackingDialogEmpty')}</p>
              ) : null}
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={closeTrackingDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">{t('superadmin.tenants.trackingDialogSubmit')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

type TenantModalProps = {
  mode: TenantModalMode;
  tenant: SuperAdminTenant | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: TenantModalSubmitPayload) => Promise<void>;
  isSubmitting: boolean;
};

function TenantModal({ mode, tenant, open, onClose, onSubmit, isSubmitting }: TenantModalProps) {
  const { t } = useTranslation();
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const getTenantFormDefaults = (currentMode: TenantModalMode, currentTenant: SuperAdminTenant | null): TenantFormSchema => {
    if (currentMode === 'edit' && currentTenant) {
      return {
        slug: currentTenant.slug,
        name: currentTenant.name,
        subdomain: currentTenant.subdomain ?? '',
        custom_domain: currentTenant.custom_domain ?? '',
        plan_type: currentTenant.plan_type,
        status: currentTenant.status,
        primary_color: currentTenant.primary_color ?? '#0ea5e9',
        secondary_color: currentTenant.secondary_color ?? '#1f2937',
        accent_color: currentTenant.accent_color ?? '#f97316',
        start_date: currentTenant.start_date ?? '',
        end_date: currentTenant.end_date ?? '',
        website_url: currentTenant.website_url ?? '',
        facebook_url: currentTenant.facebook_url ?? '',
        instagram_url: currentTenant.instagram_url ?? '',
        linkedin_url: currentTenant.linkedin_url ?? '',
        twitter_url: currentTenant.twitter_url ?? '',
        youtube_url: currentTenant.youtube_url ?? '',
        max_evaluators: currentTenant.max_evaluators ?? null,
        max_participants: currentTenant.max_participants ?? null,
        max_appointments_per_month: currentTenant.max_appointments_per_month ?? null,
        hero_content: currentTenant.hero_content ? JSON.stringify(currentTenant.hero_content, null, 2) : '',
        tenant_css: currentTenant.tenant_css ?? '',
        logo_url: currentTenant.logo_url ?? '',
        admin_email: undefined,
        admin_first_name: '',
        admin_last_name: '',
        admin_language: 'es',
        admin_password: ''
      };
    }

    return {
      slug: '',
      name: '',
      subdomain: '',
      custom_domain: '',
      plan_type: 'free',
      status: 'active',
      primary_color: '#0ea5e9',
      secondary_color: '#1f2937',
      accent_color: '#f97316',
      start_date: '',
      end_date: '',
      website_url: '',
      facebook_url: '',
      instagram_url: '',
      linkedin_url: '',
      twitter_url: '',
      youtube_url: '',
      max_evaluators: null,
      max_participants: null,
      max_appointments_per_month: null,
      hero_content: '',
      tenant_css: '',
      logo_url: '',
      admin_email: '',
      admin_first_name: '',
      admin_last_name: '',
      admin_language: 'es',
      admin_password: ''
    };
  };

  const form = useForm<TenantFormSchema>({
    resolver: zodResolver(tenantFormSchemaBase) as unknown as Resolver<TenantFormSchema>,
    defaultValues: getTenantFormDefaults(mode, tenant)
  });

  // Obtener el color primario del tenant para aplicar al tab activo
  const primaryColor = form.watch('primary_color') || tenant?.primary_color || '#0ea5e9';

  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset(getTenantFormDefaults(mode, tenant));
    setLogoBase64(null);
    setLogoError(null);
    setRemoveLogo(false);
  }, [open, mode, tenant, form]);

  const handleClose = () => {
    setLogoBase64(null);
    setLogoError(null);
    setRemoveLogo(false);
    onClose();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoBase64(null);
      setLogoError(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoError(t('superadmin.tenants.logoTooLarge'));
      setLogoBase64(null);
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setLogoBase64(base64);
      setLogoError(null);
      setRemoveLogo(false);
    } catch (error) {
      setLogoError(t('superadmin.tenants.logoReadError'));
      setLogoBase64(null);
    }
  };

  const submitForm = async (values: TenantFormSchema) => {
    let heroContent: unknown;
    try {
      heroContent = parseHeroContent(values.hero_content, form, t);
    } catch (error) {
      // El error ya se muestra en parseHeroContent mediante setError
      return;
    }

    try {
      if (mode === 'create') {
        if (!values.admin_email) {
          form.setError('admin_email', { type: 'manual', message: t('superadmin.tenants.adminEmailRequired') });
          return;
        }

        const payload = {
          slug: values.slug,
          name: values.name,
          subdomain: values.subdomain ?? undefined,
          custom_domain: values.custom_domain ?? undefined,
          plan_type: values.plan_type,
          status: values.status,
          primary_color: values.primary_color ?? undefined,
          secondary_color: values.secondary_color ?? undefined,
          accent_color: values.accent_color ?? undefined,
          start_date: values.start_date ?? undefined,
          end_date: values.end_date ?? undefined,
          website_url: values.website_url ?? undefined,
          facebook_url: values.facebook_url ?? undefined,
          instagram_url: values.instagram_url ?? undefined,
          linkedin_url: values.linkedin_url ?? undefined,
          twitter_url: values.twitter_url ?? undefined,
          youtube_url: values.youtube_url ?? undefined,
          max_evaluators: values.max_evaluators ?? undefined,
          max_participants: values.max_participants ?? undefined,
          max_appointments_per_month: values.max_appointments_per_month ?? undefined,
          hero_content: heroContent,
          tenant_css: values.tenant_css ?? undefined,
          logo_url: values.logo_url ?? undefined,
          logo: logoBase64 ?? undefined,
          admin: {
            email: values.admin_email,
            first_name: values.admin_first_name ?? undefined,
            last_name: values.admin_last_name ?? undefined,
            language: values.admin_language ?? undefined,
            password: values.admin_password ?? undefined
          }
        };

        await onSubmit({ type: 'create', body: payload });
      } else if (tenant) {
        const payload = {
          name: values.name,
          subdomain: values.subdomain ?? undefined,
          custom_domain: values.custom_domain ?? undefined,
          plan_type: values.plan_type,
          status: values.status,
          primary_color: values.primary_color ?? undefined,
          secondary_color: values.secondary_color ?? undefined,
          accent_color: values.accent_color ?? undefined,
          start_date: values.start_date ?? undefined,
          end_date: values.end_date ?? undefined,
          website_url: values.website_url ?? undefined,
          facebook_url: values.facebook_url ?? undefined,
          instagram_url: values.instagram_url ?? undefined,
          linkedin_url: values.linkedin_url ?? undefined,
          twitter_url: values.twitter_url ?? undefined,
          youtube_url: values.youtube_url ?? undefined,
          max_evaluators: values.max_evaluators ?? undefined,
          max_participants: values.max_participants ?? undefined,
          max_appointments_per_month: values.max_appointments_per_month ?? undefined,
          hero_content: heroContent,
          tenant_css: values.tenant_css ?? undefined,
          logo_url: values.logo_url ?? undefined,
          logo: removeLogo ? null : logoBase64 ?? undefined
        };

        await onSubmit({ type: 'update', tenantId: tenant.id, body: payload });
      }
    } catch (error) {
      // Los errores se manejan en las mutaciones, pero aquí capturamos cualquier error inesperado
      console.error('Error al enviar formulario:', error);
      toast.error(t('common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={openState => (!openState ? handleClose() : null)}>
      <DialogContent className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden p-0">
        <div className="flex-shrink-0 border-b border-border px-6 py-4">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create'
                ? t('superadmin.tenants.createTitle')
                : t('superadmin.tenants.editTitle', { name: tenant?.name ?? '' })}
            </DialogTitle>
          </DialogHeader>
        </div>

        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={form.handleSubmit(submitForm, errors => {
            // Mostrar errores de validación
            const firstError = Object.values(errors)[0];
            if (firstError?.message) {
              toast.error(firstError.message);
            } else {
              toast.error(t('common.error'));
            }
            // Hacer scroll al primer error
            const firstErrorField = Object.keys(errors)[0];
            if (firstErrorField) {
              const element = document.querySelector(`[name="${firstErrorField}"]`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          })}
        >
          <Tabs defaultValue="general" className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-shrink-0 border-b border-border px-6 py-4">
              <style>
                {`
                  .tenant-tab-trigger[data-state="active"] {
                    background-color: ${primaryColor} !important;
                    color: #ffffff !important;
                  }
                `}
              </style>
              <TabsList className="flex-wrap justify-start gap-2 bg-transparent">
                <TabsTrigger value="general" className="tenant-tab-trigger data-[state=active]:shadow-sm">
                  {t('superadmin.tenants.sections.general')}
                </TabsTrigger>
                <TabsTrigger value="branding" className="tenant-tab-trigger data-[state=active]:shadow-sm">
                  {t('superadmin.tenants.sections.branding')}
                </TabsTrigger>
                <TabsTrigger value="limits" className="tenant-tab-trigger data-[state=active]:shadow-sm">
                  {t('superadmin.tenants.sections.limits')}
                </TabsTrigger>
                <TabsTrigger value="dates" className="tenant-tab-trigger data-[state=active]:shadow-sm">
                  {t('superadmin.tenants.sections.dates')}
                </TabsTrigger>
                <TabsTrigger value="links" className="tenant-tab-trigger data-[state=active]:shadow-sm">
                  {t('superadmin.tenants.sections.links')}
                </TabsTrigger>
                <TabsTrigger value="content" className="tenant-tab-trigger data-[state=active]:shadow-sm">
                  {t('superadmin.tenants.sections.content')}
                </TabsTrigger>
                {mode === 'create' ? (
                  <TabsTrigger value="admin" className="tenant-tab-trigger data-[state=active]:shadow-sm">
                    {t('superadmin.tenants.sections.admin')}
                  </TabsTrigger>
                ) : null}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="general" className="mt-0 space-y-6">
                <FormGrid columns={2}>
                  <FormField label={t('superadmin.tenants.fields.slug')} required>
                    <Input
                      {...form.register('slug')}
                      disabled={mode === 'edit'}
                      className={cn(form.formState.errors.slug && 'border-destructive')}
                    />
                    {form.formState.errors.slug ? (
                      <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                    ) : null}
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.name')} required>
                    <Input
                      {...form.register('name')}
                      className={cn(form.formState.errors.name && 'border-destructive')}
                    />
                    {form.formState.errors.name ? (
                      <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                    ) : null}
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.subdomain')}>
                    <Input {...form.register('subdomain')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.customDomain')}>
                    <Input {...form.register('custom_domain')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.plan')} required>
                    <Select {...form.register('plan_type')}>
                      {TENANT_PLANS.map(plan => (
                        <option key={plan} value={plan}>
                          {t(`superadmin.tenantPlan.${plan}`)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.status')} required>
                    <Select {...form.register('status')}>
                      {TENANT_STATUS.map(status => (
                        <option key={status} value={status}>
                          {t(`superadmin.tenantStatus.${status}`)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FormGrid>
              </TabsContent>

              <TabsContent value="branding" className="mt-0 space-y-6">
                <FormGrid columns={3}>
                  <FormField label={t('superadmin.tenants.fields.primaryColor')}>
                    <Input type="color" {...form.register('primary_color')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.secondaryColor')}>
                    <Input type="color" {...form.register('secondary_color')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.accentColor')}>
                    <Input type="color" {...form.register('accent_color')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.logoUrl')}>
                    <Input {...form.register('logo_url')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.logoUpload')}>
                    <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleFileChange} />
                    {logoError ? <p className="text-xs text-destructive">{logoError}</p> : null}
                  </FormField>
                  {logoBase64 ? (
                    <FormField label={t('superadmin.tenants.fields.logoPreview')}>
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
                  {mode === 'edit' && tenant?.logo_url ? (
                    <FormField label={t('superadmin.tenants.fields.currentLogo')}>
                      <div className="flex flex-col gap-2">
                        <div
                          className="flex h-16 w-auto items-center justify-center rounded border border-border p-2"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <img
                            src={tenant.logo_url}
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
                          {t('superadmin.tenants.removeLogo')}
                        </label>
                      </div>
                    </FormField>
                  ) : null}
                </FormGrid>
              </TabsContent>

              <TabsContent value="limits" className="mt-0 space-y-6">
                <FormGrid columns={3}>
                  <FormField label={t('superadmin.tenants.fields.maxEvaluators')}>
                    <Input type="number" min={0} {...form.register('max_evaluators')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.maxParticipants')}>
                    <Input type="number" min={0} {...form.register('max_participants')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.maxAppointments')}>
                    <Input type="number" min={0} {...form.register('max_appointments_per_month')} />
                  </FormField>
                </FormGrid>
              </TabsContent>

              <TabsContent value="dates" className="mt-0 space-y-6">
                <FormGrid columns={2}>
                  <FormField label={t('superadmin.tenants.fields.startDate')}>
                    <Input type="date" {...form.register('start_date')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.endDate')}>
                    <Input type="date" {...form.register('end_date')} />
                  </FormField>
                </FormGrid>
              </TabsContent>

              <TabsContent value="links" className="mt-0 space-y-6">
                <FormGrid columns={2}>
                  <FormField label={t('superadmin.tenants.fields.website')}>
                    <Input {...form.register('website_url')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.facebook')}>
                    <Input {...form.register('facebook_url')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.instagram')}>
                    <Input {...form.register('instagram_url')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.linkedin')}>
                    <Input {...form.register('linkedin_url')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.twitter')}>
                    <Input {...form.register('twitter_url')} />
                  </FormField>
                  <FormField label={t('superadmin.tenants.fields.youtube')}>
                    <Input {...form.register('youtube_url')} />
                  </FormField>
                </FormGrid>
              </TabsContent>

              <TabsContent value="content" className="mt-0 space-y-4">
                <FormField label={t('superadmin.tenants.fields.heroContent')}>
                  <textarea
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...form.register('hero_content')}
                  />
                </FormField>
                <FormField label={t('superadmin.tenants.fields.tenantCss')}>
                  <textarea
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    {...form.register('tenant_css')}
                  />
                </FormField>
              </TabsContent>

              {mode === 'create' ? (
                <TabsContent value="admin" className="mt-0 space-y-6">
                  <FormGrid columns={2}>
                    <FormField label={t('superadmin.tenants.fields.adminEmail')} required>
                      <Input
                        type="email"
                        {...form.register('admin_email')}
                        className={cn(form.formState.errors.admin_email && 'border-destructive')}
                      />
                      {form.formState.errors.admin_email ? (
                        <p className="text-xs text-destructive">{form.formState.errors.admin_email.message}</p>
                      ) : null}
                    </FormField>
                    <FormField label={t('superadmin.tenants.fields.adminLanguage')}>
                      <Input {...form.register('admin_language')} />
                    </FormField>
                    <FormField label={t('superadmin.tenants.fields.adminFirstName')}>
                      <Input {...form.register('admin_first_name')} />
                    </FormField>
                    <FormField label={t('superadmin.tenants.fields.adminLastName')}>
                      <Input {...form.register('admin_last_name')} />
                    </FormField>
                    <FormField label={t('superadmin.tenants.fields.adminPassword')}>
                      <Input type="password" {...form.register('admin_password')} />
                    </FormField>
                  </FormGrid>
                </TabsContent>
              ) : null}
            </div>
          </Tabs>

          <div className="flex-shrink-0 border-t border-border px-6 py-4">
            <DialogFooter className="pt-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function parseHeroContent(
  value: string | null | undefined,
  form: UseFormReturn<TenantFormSchema>,
  t: ReturnType<typeof useTranslation>['t']
) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    form.setError('hero_content', { type: 'manual', message: t('superadmin.tenants.heroInvalid') });
    throw error;
  }
}

export default SuperAdminTenantsPage;

