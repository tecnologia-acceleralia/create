import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import {
  createTenantSuperAdmin,
  deleteTenantSuperAdmin,
  listSuperAdminTenants,
  updateTenantSuperAdmin,
  type SuperAdminTenant,
  type TenantsListResponse
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
import { fileToBase64 } from '@/utils/files';
import { useForm, type UseFormReturn } from 'react-hook-form';
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
  admin_email: z.string().email({ message: 'Correo inválido' }).optional(),
  admin_first_name: nullableString(),
  admin_last_name: nullableString(),
  admin_language: nullableString(),
  admin_password: nullableString()
});

type TenantFormSchema = z.infer<typeof tenantFormSchemaBase>;

type TenantModalMode = 'create' | 'edit';

type TenantModalState = {
  mode: TenantModalMode;
  tenant: SuperAdminTenant | null;
  open: boolean;
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

  const tenantsQuery = useQuery({
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
    keepPreviousData: true
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

  const handleModalSubmit = async (payload: TenantModalSubmitPayload) => {
    if (payload.type === 'create') {
      await createTenantMutation.mutateAsync(payload.body);
    } else {
      await updateTenantMutation.mutateAsync({
        tenantId: payload.tenantId,
        payload: payload.body
      });
    }
    closeModal();
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
                  <Button type="submit" variant="outline">
                    {t('superadmin.tenants.applyFilters')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleResetFilters}>
                    {t('superadmin.tenants.resetFilters')}
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
                      <TableCell>
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/superadmin/users?tenantId=${tenant.id}`)}
                        >
                          <Users className="mr-1 h-4 w-4" aria-hidden />
                          {t('superadmin.tenants.manageUsers')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(tenant)}
                        >
                          <Pencil className="mr-1 h-4 w-4" aria-hidden />
                          {t('common.edit')}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setPendingDelete(tenant)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                              {t('common.remove')}
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
        admin_email: '',
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
    resolver: zodResolver(tenantFormSchemaBase),
    defaultValues: getTenantFormDefaults(mode, tenant)
  });

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
    } catch {
      return;
    }

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
  };

  return (
    <Dialog open={open} onOpenChange={openState => (!openState ? handleClose() : null)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('superadmin.tenants.createTitle')
              : t('superadmin.tenants.editTitle', { name: tenant?.name ?? '' })}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={form.handleSubmit(submitForm)}
        >
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              {t('superadmin.tenants.sections.general')}
            </h3>
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
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              {t('superadmin.tenants.sections.branding')}
            </h3>
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
              {mode === 'edit' && tenant?.logo_url ? (
                <FormField label={t('superadmin.tenants.fields.currentLogo')}>
                  <div className="flex flex-col gap-2">
                    <img
                      src={tenant.logo_url}
                      alt=""
                      className="h-16 w-auto rounded border border-border bg-white p-2"
                    />
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
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              {t('superadmin.tenants.sections.limits')}
            </h3>
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
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              {t('superadmin.tenants.sections.dates')}
            </h3>
            <FormGrid columns={2}>
              <FormField label={t('superadmin.tenants.fields.startDate')}>
                <Input type="date" {...form.register('start_date')} />
              </FormField>
              <FormField label={t('superadmin.tenants.fields.endDate')}>
                <Input type="date" {...form.register('end_date')} />
              </FormField>
            </FormGrid>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              {t('superadmin.tenants.sections.links')}
            </h3>
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
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              {t('superadmin.tenants.sections.content')}
            </h3>
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
          </section>

          {mode === 'create' ? (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                {t('superadmin.tenants.sections.admin')}
              </h3>
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
            </section>
          ) : null}

          <DialogFooter className="pt-2">
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

