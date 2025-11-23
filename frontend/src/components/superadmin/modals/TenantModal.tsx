import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, type UseFormReturn, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileInput } from '@/components/ui/file-input';
import { Select } from '@/components/ui/select';
import { FormField, FormGrid } from '@/components/form';
import { InfoTooltip } from '@/components/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/utils/cn';
import { fileToBase64 } from '@/utils/files';
import { safeTranslate } from '@/utils/i18n-helpers';
import { RegistrationSchemaForm } from '@/components/events/forms/RegistrationSchemaForm';
import { HeroContentField } from '@/components/common/HeroContentField';
import {
  createTenantSuperAdmin,
  updateTenantSuperAdmin,
  type SuperAdminTenant
} from '@/services/superadmin';

const TENANT_STATUS = ['active', 'trial', 'suspended', 'cancelled'] as const;
const TENANT_PLANS = ['free', 'basic', 'professional', 'enterprise'] as const;

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
  hero_content: z.preprocess(
    value => {
      if (value === '' || value === undefined || value === null) {
        return null;
      }
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return value;
    },
    z.any().nullable()
  ),
  tenant_css: nullableString(),
  logo_url: nullableString(),
  registration_schema: z.preprocess(
    value => {
      if (value === '' || value === undefined || value === null) {
        return null;
      }
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    },
    z.any().nullable()
  ),
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
  hero_content: Record<string, { title: string; subtitle: string }> | null;
  tenant_css: string | null;
  logo_url: string | null;
  registration_schema: import('@/services/public').RegistrationSchema | null;
  admin_email?: string;
  admin_first_name: string | null;
  admin_last_name: string | null;
  admin_language: string | null;
  admin_password: string | null;
};

type TenantModalMode = 'create' | 'edit';

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

// Función para convertir hero_content a formato JSON para el backend
function prepareHeroContent(
  value: Record<string, { title: string; subtitle: string }> | null | undefined
): unknown {
  if (!value || Object.keys(value).length === 0) {
    return undefined;
  }
  return value;
}

export function TenantModal({ mode, tenant, open, onClose, onSubmit, isSubmitting }: TenantModalProps) {
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
        hero_content: currentTenant.hero_content || null,
        tenant_css: currentTenant.tenant_css ?? '',
        logo_url: currentTenant.logo_url ?? '',
        registration_schema: currentTenant.registration_schema ?? null,
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
      hero_content: null,
      tenant_css: '',
      logo_url: '',
      registration_schema: null,
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
      setLogoError(safeTranslate(t, 'superadmin.tenants.logoTooLarge'));
      setLogoBase64(null);
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setLogoBase64(base64);
      setLogoError(null);
      setRemoveLogo(false);
    } catch (error) {
      setLogoError(safeTranslate(t, 'superadmin.tenants.logoReadError'));
      setLogoBase64(null);
    }
  };

  const submitForm = async (values: TenantFormSchema) => {
    const heroContent = prepareHeroContent(values.hero_content);

    try {
      if (mode === 'create') {
        if (!values.admin_email) {
          form.setError('admin_email', { type: 'manual', message: safeTranslate(t, 'superadmin.tenants.adminEmailRequired') });
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
          registration_schema: values.registration_schema !== undefined ? values.registration_schema : undefined,
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
          logo: removeLogo ? null : logoBase64 ?? undefined,
          registration_schema: values.registration_schema ?? undefined
        };

        await onSubmit({ type: 'update', tenantId: tenant.id, body: payload });
      }
    } catch (error) {
      // Los errores se manejan en las mutaciones, pero aquí capturamos cualquier error inesperado
      console.error('Error al enviar formulario:', error);
      toast.error(safeTranslate(t, 'common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={openState => (!openState ? handleClose() : null)}>
      <DialogContent className="flex h-[80vh] w-full max-w-7xl flex-col overflow-hidden p-0">
        <div className="flex-shrink-0 border-b border-border px-6 py-4">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create'
                ? safeTranslate(t, 'superadmin.tenants.createTitle')
                : safeTranslate(t, 'superadmin.tenants.editTitle', { name: tenant?.name ?? '' })}
            </DialogTitle>
          </DialogHeader>
        </div>

        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={form.handleSubmit(submitForm, errors => {
            // Mostrar errores de validación
            const firstError = Object.values(errors)[0];
            const errorMessage = typeof firstError?.message === 'string' 
              ? firstError.message 
              : firstError?.message?.message || safeTranslate(t, 'common.error');
            toast.error(errorMessage);
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
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs defaultValue="general" className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4">
                  <TabsList className="flex-wrap justify-start gap-2 bg-transparent">
                <TabsTrigger value="general">
                  {safeTranslate(t, 'superadmin.tenants.sections.general')}
                </TabsTrigger>
                <TabsTrigger value="branding">
                  {safeTranslate(t, 'superadmin.tenants.sections.branding')}
                </TabsTrigger>
                <TabsTrigger value="limits">
                  {safeTranslate(t, 'superadmin.tenants.sections.limits')}
                </TabsTrigger>
                <TabsTrigger value="dates">
                  {safeTranslate(t, 'superadmin.tenants.sections.dates')}
                </TabsTrigger>
                <TabsTrigger value="links">
                  {safeTranslate(t, 'superadmin.tenants.sections.links')}
                </TabsTrigger>
                <TabsTrigger value="content">
                  {safeTranslate(t, 'superadmin.tenants.sections.content')}
                </TabsTrigger>
                <TabsTrigger value="registration">
                  {safeTranslate(t, 'superadmin.tenants.sections.registration')}
                </TabsTrigger>
                {mode === 'create' ? (
                  <TabsTrigger value="admin">
                    {safeTranslate(t, 'superadmin.tenants.sections.admin')}
                  </TabsTrigger>
                ) : null}
                  </TabsList>
                </div>
                <div className="px-6 py-4 flex-1 flex flex-col min-h-0">
              <TabsContent value="general" className="mt-0 space-y-6">
                <FormGrid columns={2}>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.slug')} required>
                    <Input
                      {...form.register('slug')}
                      disabled={mode === 'edit'}
                      className={cn(form.formState.errors.slug && 'border-destructive')}
                    />
                    {form.formState.errors.slug ? (
                      <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                    ) : null}
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.name')} required>
                    <Input
                      {...form.register('name')}
                      className={cn(form.formState.errors.name && 'border-destructive')}
                    />
                    {form.formState.errors.name ? (
                      <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                    ) : null}
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.subdomain')}>
                    <Input {...form.register('subdomain')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.customDomain')}>
                    <Input {...form.register('custom_domain')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.plan')} required>
                    <Select {...form.register('plan_type')}>
                      {TENANT_PLANS.map(plan => (
                        <option key={plan} value={plan}>
                          {safeTranslate(t, `superadmin.tenantPlan.${plan}`, { defaultValue: plan })}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.status')} required>
                    <Select {...form.register('status')}>
                      {TENANT_STATUS.map(status => (
                        <option key={status} value={status}>
                          {safeTranslate(t, `superadmin.tenantStatus.${status}`, { defaultValue: status })}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FormGrid>
              </TabsContent>

              <TabsContent value="branding" className="mt-0 space-y-6">
                <FormGrid columns={3}>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.primaryColor')}>
                    <Input type="color" {...form.register('primary_color')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.secondaryColor')}>
                    <Input type="color" {...form.register('secondary_color')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.accentColor')}>
                    <Input type="color" {...form.register('accent_color')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.logoUrl')}>
                    <Input {...form.register('logo_url')} />
                  </FormField>
                  <FormField
                    label={
                      <div className="flex items-center gap-2">
                        <span>{safeTranslate(t, 'superadmin.tenants.fields.logoUpload')}</span>
                        <InfoTooltip content={safeTranslate(t, 'superadmin.tenants.fields.logoUploadInfo')} />
                      </div>
                    }
                  >
                    <FileInput accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleFileChange} />
                    {logoError ? <p className="text-xs text-destructive">{logoError}</p> : null}
                  </FormField>
                  {logoBase64 ? (
                    <FormField label={safeTranslate(t, 'superadmin.tenants.fields.logoPreview')}>
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
                    <FormField label={safeTranslate(t, 'superadmin.tenants.fields.currentLogo')}>
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
                          {safeTranslate(t, 'superadmin.tenants.removeLogo')}
                        </label>
                      </div>
                    </FormField>
                  ) : null}
                </FormGrid>
              </TabsContent>

              <TabsContent value="limits" className="mt-0 space-y-6">
                <FormGrid columns={3}>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.maxEvaluators')}>
                    <Input type="number" min={0} disabled {...form.register('max_evaluators')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.maxParticipants')}>
                    <Input type="number" min={0} disabled {...form.register('max_participants')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.maxAppointments')}>
                    <Input type="number" min={0} disabled {...form.register('max_appointments_per_month')} />
                  </FormField>
                </FormGrid>
              </TabsContent>

              <TabsContent value="dates" className="mt-0 space-y-6">
                <FormGrid columns={2}>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.startDate')}>
                    <Input type="date" {...form.register('start_date')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.endDate')}>
                    <Input type="date" {...form.register('end_date')} />
                  </FormField>
                </FormGrid>
              </TabsContent>

              <TabsContent value="links" className="mt-0 space-y-6">
                <FormGrid columns={2}>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.website')}>
                    <Input {...form.register('website_url')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.facebook')}>
                    <Input {...form.register('facebook_url')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.instagram')}>
                    <Input {...form.register('instagram_url')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.linkedin')}>
                    <Input {...form.register('linkedin_url')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.twitter')}>
                    <Input {...form.register('twitter_url')} />
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.tenants.fields.youtube')}>
                    <Input {...form.register('youtube_url')} />
                  </FormField>
                </FormGrid>
              </TabsContent>

              <TabsContent value="content" className="mt-0 flex flex-col flex-1 min-h-0 gap-4">
                <HeroContentField
                  control={form.control}
                  name="hero_content"
                  label={safeTranslate(t, 'superadmin.tenants.fields.heroContent')}
                  error={
                    typeof form.formState.errors.hero_content?.message === 'string'
                      ? form.formState.errors.hero_content.message
                      : undefined
                  }
                  className="h-full flex flex-col"
                />
                <FormField label={safeTranslate(t, 'superadmin.tenants.fields.tenantCss')} className="h-full flex flex-col">
                  <textarea
                    className="w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    style={{ minHeight: 'calc(90vh - 200px)' }}
                    {...form.register('tenant_css')}
                  />
                </FormField>
              </TabsContent>

              <TabsContent value="registration" className="mt-0 space-y-4">
                <FormField
                  label={safeTranslate(t, 'events.registrationSchema')}
                  htmlFor="tenant-registration-schema"
                  error={
                    typeof form.formState.errors.registration_schema?.message === 'string'
                      ? form.formState.errors.registration_schema.message
                      : undefined
                  }
                >
                  <RegistrationSchemaForm
                    id="tenant-registration-schema"
                    value={form.watch('registration_schema') === null ? undefined : (form.watch('registration_schema') as any)}
                    onChange={value => {
                      form.setValue('registration_schema', value as any, { shouldValidate: true });
                    }}
                    error={
                      typeof form.formState.errors.registration_schema?.message === 'string'
                        ? form.formState.errors.registration_schema.message
                        : undefined
                    }
                  />
                </FormField>
              </TabsContent>

              {mode === 'create' ? (
                <TabsContent value="admin" className="mt-0 space-y-6">
                  <FormGrid columns={2}>
                    <FormField label={safeTranslate(t, 'superadmin.tenants.fields.adminEmail')} required>
                      <Input
                        type="email"
                        {...form.register('admin_email')}
                        className={cn(form.formState.errors.admin_email && 'border-destructive')}
                      />
                      {form.formState.errors.admin_email ? (
                        <p className="text-xs text-destructive">{form.formState.errors.admin_email.message}</p>
                      ) : null}
                    </FormField>
                    <FormField label={safeTranslate(t, 'superadmin.tenants.fields.adminLanguage')}>
                      <Input {...form.register('admin_language')} />
                    </FormField>
                    <FormField label={safeTranslate(t, 'superadmin.tenants.fields.adminFirstName')}>
                      <Input {...form.register('admin_first_name')} />
                    </FormField>
                    <FormField label={safeTranslate(t, 'superadmin.tenants.fields.adminLastName')}>
                      <Input {...form.register('admin_last_name')} />
                    </FormField>
                    <FormField label={safeTranslate(t, 'superadmin.tenants.fields.adminPassword')}>
                      <Input type="password" {...form.register('admin_password')} />
                    </FormField>
                  </FormGrid>
                </TabsContent>
              ) : null}
                </div>
              </div>
            </Tabs>
          </div>

          <div className="flex-shrink-0 border-t border-border px-6 py-4">
            <DialogFooter className="pt-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                {safeTranslate(t, 'common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'common.save')}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

