import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormGrid } from '@/components/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordField } from '@/components/common';
import { cn } from '@/utils/cn';
import { safeTranslate } from '@/utils/i18n-helpers';
import {
  createSuperAdminUser,
  updateSuperAdminUser,
  type SuperAdminTenant,
  type SuperAdminUser,
  TENANT_ROLE_SCOPES,
  type TenantRoleScope
} from '@/services/superadmin';
import type { RegistrationSchema } from '@/services/public';

const USER_STATUS = ['active', 'inactive', 'invited'] as const;

const tenantRoleEnum = z.enum([...TENANT_ROLE_SCOPES] as [TenantRoleScope, ...TenantRoleScope[]]);

type TenantRolesFormValue = Record<string, TenantRoleScope[]>;

const isValidTenantRoleScope = (scope: string): scope is TenantRoleScope =>
  TENANT_ROLE_SCOPES.includes(scope as TenantRoleScope);

const createUserFormSchema = (schemaFields: NormalizedSchemaField[]) => {
  const baseSchema = z.object({
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

  const schemaFieldsObj: Record<string, z.ZodTypeAny> = {};
  for (const field of schemaFields) {
    if (field.required) {
      schemaFieldsObj[field.id] = z.string().min(1);
    } else {
      schemaFieldsObj[field.id] = z.string().optional();
    }
  }

  return baseSchema.extend(schemaFieldsObj);
};

type UserFormSchema = z.infer<typeof userFormSchema>;

type UserModalMode = 'create' | 'edit';

type UserModalSubmitPayload =
  | { type: 'create'; body: Parameters<typeof createSuperAdminUser>[0] }
  | { type: 'update'; userId: number; body: Parameters<typeof updateSuperAdminUser>[1] };

type UserModalProps = {
  mode: UserModalMode;
  user: SuperAdminUser | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: UserModalSubmitPayload) => Promise<void>;
  isSubmitting: boolean;
  tenants: SuperAdminTenant[];
  selectedTenantId?: number;
};

type NormalizedSchemaField = {
  id: string;
  label?: Record<string, string> | string;
  required: boolean;
  options?: Array<{ value: string; label?: Record<string, string> | string }>;
  type: 'text' | 'select' | 'textarea';
};

function resolveSchemaLabel(
  label: Record<string, string> | string | undefined,
  language: string,
  fallback: string
): string {
  if (!label) {
    return fallback;
  }
  if (typeof label === 'string') {
    return label;
  }
  const normalized = language?.split('-')[0]?.toLowerCase();
  if (normalized && label[normalized]) {
    return label[normalized] ?? fallback;
  }
  return label.es ?? label.en ?? label.ca ?? fallback;
}

function normalizeSchemaFields(schema: RegistrationSchema | null, language: string): NormalizedSchemaField[] {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  const fields: NormalizedSchemaField[] = [];

  // Procesar todos los campos del nivel raíz del schema (excepto additionalFields)
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalFields') {
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const fieldValue = value as {
        label?: Record<string, string> | string;
        required?: boolean;
        options?: Array<{ value: string; label?: Record<string, string> | string }>;
      };

      const hasOptions = Array.isArray(fieldValue.options) && fieldValue.options.length > 0;
      const type: 'text' | 'select' | 'textarea' = hasOptions ? 'select' : 'text';

      fields.push({
        id: key,
        label: fieldValue.label,
        required: Boolean(fieldValue.required),
        options: hasOptions ? fieldValue.options : undefined,
        type
      });
    }
  }

  // Procesar additionalFields si existen
  if (Array.isArray(schema.additionalFields)) {
    for (const field of schema.additionalFields) {
      if (field && typeof field === 'object' && field.id) {
        fields.push({
          id: field.id.trim() || `custom_field_${fields.length + 1}`,
          label: field.label,
          required: Boolean(field.required),
          options: field.type === 'select' && Array.isArray(field.options) ? field.options : undefined,
          type: field.type || 'text'
        });
      }
    }
  }

  return fields;
}

export function UserModal({ mode, user, open, onClose, onSubmit, isSubmitting, tenants, selectedTenantId }: UserModalProps) {
  const { t, i18n } = useTranslation();
  
  // Determinar qué tenant usar para obtener el schema
  const targetTenant = useMemo(() => {
    if (selectedTenantId) {
      return tenants.find(t => t.id === selectedTenantId);
    }
    if (user && user.tenantMemberships && user.tenantMemberships.length > 0) {
      const firstTenantId = user.tenantMemberships[0]?.tenant?.id;
      if (firstTenantId) {
        return tenants.find(t => t.id === firstTenantId);
      }
    }
    return null;
  }, [selectedTenantId, user, tenants]);

  const registrationSchema = targetTenant?.registration_schema ?? null;
  const schemaFields = useMemo(
    () => normalizeSchemaFields(registrationSchema, i18n.language),
    [registrationSchema, i18n.language]
  );

  const userFormSchema = useMemo(() => createUserFormSchema(schemaFields), [schemaFields]);

  const getUserFormDefaults = (currentMode: UserModalMode, currentUser: SuperAdminUser | null): Record<string, unknown> => {
    const baseDefaults: Record<string, unknown> = {
      email: '',
      first_name: '',
      last_name: '',
      language: 'es',
      status: 'active',
      is_super_admin: false,
      tenantIds: [],
      tenantRoles: {}
    };

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

      baseDefaults.email = currentUser.email;
      baseDefaults.first_name = currentUser.first_name;
      baseDefaults.last_name = currentUser.last_name;
      baseDefaults.language = currentUser.language ?? 'es';
      baseDefaults.status = currentUser.status;
      baseDefaults.is_super_admin = currentUser.is_super_admin;
      baseDefaults.tenantIds =
        currentUser.tenantMemberships
          .map(membership => membership.tenant?.id)
          .filter((id): id is number => typeof id === 'number') ?? [];
      baseDefaults.tenantRoles = tenantRolesDefaults;

      // Agregar valores de los campos del schema desde registration_answers
      if (currentUser.registration_answers && typeof currentUser.registration_answers === 'object') {
        const answers = currentUser.registration_answers;
        for (const field of schemaFields) {
          if (answers[field.id] !== undefined) {
            baseDefaults[field.id] = String(answers[field.id]);
          }
        }
      }
    }

    // Inicializar campos del schema con valores vacíos
    for (const field of schemaFields) {
      if (!(field.id in baseDefaults)) {
        baseDefaults[field.id] = '';
      }
    }

    return baseDefaults;
  };

  const form = useForm<Record<string, unknown>>({
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

  const submitForm = async (values: Record<string, unknown>) => {
    const tenantRolesPayload = ((values.tenantIds as number[]) ?? []).reduce<Record<number, TenantRoleScope[]>>(
      (accumulator, tenantId) => {
        const scopes = (values.tenantRoles as Record<string, TenantRoleScope[]>)?.[String(tenantId)] ?? [];
        accumulator[tenantId] = scopes;
        return accumulator;
      },
      {}
    );

    // Extraer campos del schema
    const registrationAnswers: Record<string, unknown> = {};
    let grade: string | undefined = undefined;

    for (const field of schemaFields) {
      const value = values[field.id];
      if (value && typeof value === 'string' && value.trim()) {
        if (field.id === 'grade') {
          grade = value.trim();
        } else {
          registrationAnswers[field.id] = value.trim();
        }
      }
    }

    const basePayload = {
      email: values.email as string,
      first_name: values.first_name as string,
      last_name: values.last_name as string,
      language: values.language as string,
      status: values.status as 'active' | 'inactive' | 'invited',
      is_super_admin: Boolean(values.is_super_admin),
      password: values.password as string | undefined,
      tenantIds: (values.tenantIds as number[]) ?? [],
      tenantRoles: tenantRolesPayload,
      grade: grade ?? null,
      registration_answers: Object.keys(registrationAnswers).length > 0 ? registrationAnswers : undefined
    };

    if (mode === 'create') {
      await onSubmit({
        type: 'create',
        body: basePayload
      });
    } else if (user) {
      await onSubmit({
        type: 'update',
        userId: user.id,
        body: basePayload
      });
    }
    form.reset(getUserFormDefaults(mode, user));
  };

  return (
    <Dialog open={open} onOpenChange={openState => (!openState ? handleClose() : null)}>
      <DialogContent className="h-[80vh] max-w-3xl flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            {mode === 'create'
              ? safeTranslate(t, 'superadmin.users.createTitle')
              : safeTranslate(t, 'superadmin.users.editTitle', { email: user?.email ?? '' })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(submitForm)} className="flex h-full flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs defaultValue="general" className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto flex flex-col">
                <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pb-4 pt-4">
                  <TabsList>
                    <TabsTrigger value="general">{safeTranslate(t, 'superadmin.users.tabs.general')}</TabsTrigger>
                    {schemaFields.length > 0 && (
                      <TabsTrigger value="registration">{safeTranslate(t, 'superadmin.users.tabs.registration')}</TabsTrigger>
                    )}
                    <TabsTrigger value="tenants">{safeTranslate(t, 'superadmin.users.tabs.tenants')}</TabsTrigger>
                  </TabsList>
                </div>
                <div className="px-6">
              <TabsContent value="general" className="mt-0">
                <FormGrid columns={2}>
                  <FormField label={safeTranslate(t, 'superadmin.users.fields.email')} required>
                    <Input
                      type="email"
                      {...form.register('email')}
                      className={cn(form.formState.errors.email && 'border-destructive')}
                    />
                    {form.formState.errors.email ? (
                      <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                    ) : null}
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.users.fields.language')} required>
                    <Input
                      {...form.register('language')}
                      className={cn(form.formState.errors.language && 'border-destructive')}
                    />
                    {form.formState.errors.language ? (
                      <p className="text-xs text-destructive">{form.formState.errors.language.message}</p>
                    ) : null}
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.users.fields.firstName')} required>
                    <Input
                      {...form.register('first_name')}
                      className={cn(form.formState.errors.first_name && 'border-destructive')}
                    />
                    {form.formState.errors.first_name ? (
                      <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
                    ) : null}
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.users.fields.lastName')} required>
                    <Input
                      {...form.register('last_name')}
                      className={cn(form.formState.errors.last_name && 'border-destructive')}
                    />
                    {form.formState.errors.last_name ? (
                      <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>
                    ) : null}
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.users.fields.status')} required>
                    <Select {...form.register('status')}>
                      {USER_STATUS.map(status => (
                        <option key={status} value={status}>
                          {safeTranslate(t, `superadmin.userStatus.${status}`, { defaultValue: status })}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.users.fields.password')}>
                    <PasswordField
                      placeholder={mode === 'edit' ? safeTranslate(t, 'superadmin.users.passwordOptional') : undefined}
                      showGenerator
                      onPasswordGenerated={password => form.setValue('password', password, { shouldValidate: true })}
                      generatorAriaLabel={safeTranslate(t, 'superadmin.users.generatePassword')}
                      {...form.register('password')}
                    />
                    {form.formState.errors.password ? (
                      <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                    ) : null}
                  </FormField>
                  <FormField label={safeTranslate(t, 'superadmin.users.fields.isSuperAdmin')}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" {...form.register('is_super_admin')} />
                      {safeTranslate(t, 'superadmin.users.superAdminHint')}
                    </label>
                  </FormField>
                </FormGrid>
              </TabsContent>

              {schemaFields.length > 0 && (
                <TabsContent value="registration" className="mt-0">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-4">
                        {targetTenant
                          ? safeTranslate(t, 'superadmin.users.registrationFields.title', { tenant: targetTenant.name })
                          : safeTranslate(t, 'superadmin.users.registrationFields.titleDefault')}
                      </h3>
                      <FormGrid columns={2}>
                        {schemaFields.map(field => {
                          const fieldLabel = resolveSchemaLabel(field.label, i18n.language, field.id);
                          const fieldOptions = field.options
                            ? field.options.map(opt => ({
                                value: opt.value,
                                label: resolveSchemaLabel(opt.label, i18n.language, opt.value)
                              }))
                            : undefined;

                          return (
                            <FormField key={field.id} label={fieldLabel} required={field.required}>
                              {field.type === 'select' && fieldOptions ? (
                                <Controller
                                  name={field.id}
                                  control={form.control}
                                  render={({ field: formField }) => (
                                    <Select {...formField}>
                                      <option value="">{safeTranslate(t, 'common.select')}</option>
                                      {fieldOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </Select>
                                  )}
                                />
                              ) : field.type === 'textarea' ? (
                                <Controller
                                  name={field.id}
                                  control={form.control}
                                  render={({ field: formField }) => (
                                    <Textarea
                                      {...formField}
                                      className={cn(form.formState.errors[field.id] && 'border-destructive')}
                                    />
                                  )}
                                />
                              ) : (
                                <Controller
                                  name={field.id}
                                  control={form.control}
                                  render={({ field: formField }) => (
                                    <Input
                                      {...formField}
                                      className={cn(form.formState.errors[field.id] && 'border-destructive')}
                                    />
                                  )}
                                />
                              )}
                              {form.formState.errors[field.id] ? (
                                <p className="text-xs text-destructive">
                                  {String(form.formState.errors[field.id]?.message)}
                                </p>
                              ) : null}
                            </FormField>
                          );
                        })}
                      </FormGrid>
                    </div>
                  </div>
                </TabsContent>
              )}

              <TabsContent value="tenants" className="mt-0">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                    {safeTranslate(t, 'superadmin.users.tenantAccess')}
                  </h3>
                  {tenants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{safeTranslate(t, 'superadmin.users.noTenantsAvailable')}</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">{safeTranslate(t, 'superadmin.users.tenantsTab.available')}</h4>
                          <div className="rounded-md border bg-background">
                            {availableTenants.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-muted-foreground">
                                {safeTranslate(t, 'superadmin.users.tenantsTab.emptyAvailable')}
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
                                      {safeTranslate(t, 'superadmin.users.tenantsTab.add')}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">{safeTranslate(t, 'superadmin.users.tenantsTab.selected')}</h4>
                          <div className="rounded-md border bg-background">
                            {selectedTenants.length === 0 ? (
                              <p className="px-4 py-3 text-sm text-muted-foreground">
                                {safeTranslate(t, 'superadmin.users.tenantsTab.emptySelected')}
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
                                      {safeTranslate(t, 'superadmin.users.tenantsTab.remove')}
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
                          <h4 className="text-sm font-semibold">{safeTranslate(t, 'superadmin.users.roles.title')}</h4>
                          <p className="text-xs text-muted-foreground">{safeTranslate(t, 'superadmin.users.roles.description')}</p>
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
                                            <span>{safeTranslate(t, `superadmin.users.roleLabels.${scope}`, { defaultValue: scope })}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {safeTranslate(t, 'superadmin.users.roles.noOptions')}
                                    </p>
                                  )}
                                  {selectedScopes.length === 0 ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {safeTranslate(t, 'superadmin.users.roles.empty')}
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
              </div>
            </Tabs>
          </div>

          <DialogFooter className="px-6 pb-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              {safeTranslate(t, 'common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

