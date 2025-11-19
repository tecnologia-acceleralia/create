import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { Link, useNavigate } from 'react-router';

import { PageContainer, AuthCard, ErrorDisplay, PasswordInput } from '@/components/common';
import { PasswordGeneratorButton } from '@/components/common/PasswordGeneratorButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/form';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { type RegistrationSchema } from '@/services/public';
import { registerUser } from '@/services/auth';
import { useAuth } from '@/context/AuthContext';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const baseSchema = z
  .object({
    firstName: z.string().trim().min(1).max(150),
    lastName: z.string().trim().min(1).max(150),
    email: z
      .string()
      .trim()
      .refine((value) => emailPattern.test(value), {
        message: 'register.invalidEmail'
      }),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    acceptPrivacyPolicy: z.boolean().refine(val => val === true, {
      message: 'register.privacyPolicyRequired'
    })
  })
  .refine(values => values.password === values.confirmPassword, {
    message: 'register.passwordMismatch',
    path: ['confirmPassword']
  });

type BaseFormValues = z.infer<typeof baseSchema>;
type FormValues = BaseFormValues & Record<string, string | boolean | undefined>;

type NormalizedSchemaField = {
  id: string;
  label?: Record<string, string> | string;
  required: boolean;
  options?: Array<{ value: string; label?: Record<string, string> | string }>;
  type: 'text' | 'select' | 'textarea';
};

type SchemaFieldOption = {
  value: string;
  label: string;
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

/**
 * Normaliza todos los campos del schema dinámicamente, sin asumir nombres específicos
 */
function normalizeSchemaFields(schema: RegistrationSchema | null, language: string): NormalizedSchemaField[] {
  if (!schema || typeof schema !== 'object') {
    return [];
  }

  const fields: NormalizedSchemaField[] = [];

  // Procesar todos los campos del nivel raíz del schema (excepto additionalFields)
  for (const [key, value] of Object.entries(schema)) {
    // Ignorar additionalFields, lo procesaremos por separado
    if (key === 'additionalFields') {
      continue;
    }

    // Verificar que el valor sea un objeto con estructura de campo
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const fieldValue = value as {
        label?: Record<string, string> | string;
        required?: boolean;
        options?: Array<{ value: string; label?: Record<string, string> | string }>;
      };

      // Determinar el tipo basado en si tiene opciones
      const hasOptions = Array.isArray(fieldValue.options) && fieldValue.options.length > 0;
      const type: 'text' | 'select' | 'textarea' = hasOptions ? 'select' : 'text';

      fields.push({
        id: key,
        label: fieldValue.label,
        required: Boolean(fieldValue.required),
        options: hasOptions ? (fieldValue.options as Array<{ value: string; label?: Record<string, string> | string }>) : undefined,
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

/**
 * Procesa las opciones de un campo para el renderizado
 */
function processFieldOptions(
  options: Array<{ value: string; label?: Record<string, string> | string }> | undefined,
  language: string
): SchemaFieldOption[] {
  if (!options || !Array.isArray(options)) {
    return [];
  }

  return options
    .map(option => {
      if (!option?.value) {
        return null;
      }
      return {
        value: option.value,
        label: resolveSchemaLabel(option.label, language, option.value)
      };
    })
    .filter((option): option is SchemaFieldOption => option !== null);
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { tenantSlug } = useTenant();
  const tenantPath = useTenantPath();
  const navigate = useNavigate();
  const { hydrateSession } = useAuth();

  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const schemaFieldsRef = useRef<NormalizedSchemaField[]>([]);

  const { registrationSchema: tenantRegistrationSchema } = useTenant();
  
  // El schema de registro siempre viene del tenant, no del evento
  const registrationSchema = tenantRegistrationSchema;

  const schema = useMemo(
    () =>
      baseSchema.superRefine((values, ctx) => {
        // Validar todos los campos del schema dinámicamente
        const fields = schemaFieldsRef.current;
        for (const field of fields) {
          if (!field.required) {
            continue;
          }

          let rawValue = (values as Record<string, unknown>)[field.id];
          let stringValue = typeof rawValue === 'string' ? rawValue.trim() : '';
          
          // Si el valor no está en react-hook-form, intentar leerlo del select oculto directamente
          // Esto puede ocurrir cuando el componente Select no sincroniza correctamente con react-hook-form
          if (!stringValue && typeof globalThis.window !== 'undefined') {
            try {
              // Buscar el select oculto por name o id
              const selectElement = document.querySelector<HTMLSelectElement>(`select[name="${field.id}"], select#${field.id}`);
              if (selectElement?.value) {
                stringValue = selectElement.value.trim();
              } else {
                // Fallback: leer del FormData
                const formElement = document.querySelector<HTMLFormElement>('form');
                if (formElement) {
                  const formData = new FormData(formElement);
                  const formDataValue = formData.get(field.id);
                  if (formDataValue && typeof formDataValue === 'string') {
                    stringValue = formDataValue.trim();
                  }
                }
              }
            } catch (error) {
              // Si hay un error accediendo al DOM, continuar con la validación normal
              console.warn('Error reading select value in validation:', error);
            }
          }

          if (!stringValue) {
            ctx.addIssue({
              code: 'custom',
              path: [field.id],
              message: 'register.dynamicFieldRequired'
            });
            continue;
          }

          // Si el campo tiene opciones definidas, validar que el valor sea una de ellas
          if (field.options && field.options.length > 0) {
            const validValues = field.options.map(opt => opt.value);
            if (!validValues.includes(stringValue)) {
              ctx.addIssue({
                code: 'custom',
                path: [field.id],
                message: 'register.dynamicFieldInvalid'
              });
            }
          }
        }
      }),
    [registrationSchema, i18n.language]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      acceptPrivacyPolicy: false
    }
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
    reset,
    setValue,
    trigger
  } = form;

  // Normalizar todos los campos del schema dinámicamente
  const schemaFields = useMemo(() => {
    // Si el schema viene como string (JSON sin parsear), parsearlo
    let parsedSchema = registrationSchema;
    if (typeof registrationSchema === 'string') {
      try {
        parsedSchema = JSON.parse(registrationSchema);
      } catch {
        parsedSchema = null;
      }
    }
    return normalizeSchemaFields(parsedSchema, i18n.language ?? 'es');
  }, [registrationSchema, i18n.language]);

  useEffect(() => {
    schemaFieldsRef.current = schemaFields;

    const currentValues = getValues();
    const nextValues: FormValues = {
      firstName: currentValues.firstName ?? '',
      lastName: currentValues.lastName ?? '',
      email: currentValues.email ?? '',
      password: currentValues.password ?? '',
      confirmPassword: currentValues.confirmPassword ?? '',
      acceptPrivacyPolicy: currentValues.acceptPrivacyPolicy ?? false
    };

    // Inicializar todos los campos del schema con valores vacíos solo si no tienen valor
    // Mantener los valores existentes si el usuario ya ha interactuado con el formulario
    for (const field of schemaFields) {
      if (!(field.id in currentValues) || currentValues[field.id] === undefined || currentValues[field.id] === null) {
        nextValues[field.id] = '';
      } else {
        // Preservar el valor existente, incluso si es una cadena vacía (para mantener el estado del formulario)
        nextValues[field.id] = currentValues[field.id];
      }
    }

    // Solo resetear si hay cambios en los campos del schema, pero preservar valores existentes
    reset(nextValues, {
      keepDirtyValues: true,
      keepErrors: false,
      keepTouched: true // Mantener el estado touched para no perder la interacción del usuario
    });
  }, [schemaFields, getValues, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmissionError(null);
      
      const language = i18n.language?.split('-')[0]?.toLowerCase();
      const answersPayload: Record<string, string> = {};

      // Procesar todos los campos del schema dinámicamente
      // Leer valores de react-hook-form, con fallback al FormData si no están disponibles
      const formElement = document.querySelector<HTMLFormElement>('form');
      const formData = formElement ? new FormData(formElement) : null;
      
      for (const field of schemaFields) {
        let value = values[field.id];
        
        // Si el valor no está en react-hook-form, leerlo del FormData como fallback
        if ((!value || (typeof value === 'string' && !value.trim())) && formData) {
          const formDataValue = formData.get(field.id);
          if (formDataValue && typeof formDataValue === 'string') {
            value = formDataValue;
          }
        }
        
        if (typeof value === 'string') {
          const trimmedValue = value.trim();
          if (trimmedValue) {
            answersPayload[field.id] = trimmedValue;
          }
        }
      }

      const response = await registerUser({
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        email: values.email.toLowerCase(),
        password: values.password,
        language: language === 'es' || language === 'en' || language === 'ca' ? language : 'es',
        registration_answers: Object.keys(answersPayload).length ? answersPayload : undefined
      });

      const payload = response.data?.data;
      if (payload) {
        hydrateSession(payload);
        navigate(tenantPath('dashboard'));
        return;
      }

      setSubmissionError(t('register.genericError'));
    } catch (error) {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message;
        if (message) {
          setSubmissionError(t(message, { defaultValue: message }));
        } else {
          setSubmissionError(t('register.genericError'));
        }
      } else {
        setSubmissionError(t('register.genericError'));
      }
    }
  };

  if (!tenantSlug) {
    return (
      <PageContainer className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{t('register.missingTenant')}</p>
        <Button asChild>
          <Link to="/">{t('register.goToPublicHub')}</Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <AuthCard
      maxWidth="xl"
      title={t('register.title')}
      subtitle={t('register.subtitle')}
      footer={
        <div className="flex flex-col items-center gap-2">
          <p>{t('register.alreadyHaveAccount')}</p>
          <Button variant="ghost" size="sm" className="p-0 text-[color:var(--tenant-primary)]" asChild>
            <Link to={tenantPath('login')}>{t('register.goToLogin')}</Link>
          </Button>
        </div>
      }
    >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label={t('register.firstName')}
                htmlFor="firstName"
                error={
                  errors.firstName
                    ? t(errors.firstName.message ?? '', { defaultValue: errors.firstName.message })
                    : undefined
                }
                required
              >
                <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
              </FormField>
              <FormField
                label={t('register.lastName')}
                htmlFor="lastName"
                error={
                  errors.lastName
                    ? t(errors.lastName.message ?? '', { defaultValue: errors.lastName.message })
                    : undefined
                }
                required
              >
                <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
              </FormField>
            </div>

            <FormField
              label={t('register.email')}
              htmlFor="email"
              error={
                errors.email
                  ? t(errors.email.message ?? '', { defaultValue: errors.email.message })
                  : undefined
              }
              required
            >
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
            </FormField>

            {/* Renderizar todos los campos del schema dinámicamente */}
            {schemaFields.length > 0 ? (
              <div className="space-y-4">
                {schemaFields.map(field => {
                  const fieldLabel = resolveSchemaLabel(
                    field.label,
                    i18n.language ?? 'es',
                    field.id
                  );
                  const errorMessage = errors[field.id]?.message
                    ? t(errors[field.id]?.message ?? '', { defaultValue: errors[field.id]?.message })
                    : undefined;

                  const processedOptions = processFieldOptions(field.options, i18n.language ?? 'es');

                  const renderFieldInput = () => {
                    if (field.type === 'textarea') {
                      return <Textarea id={field.id} {...register(field.id)} />;
                    }
                    if (field.type === 'select' && processedOptions.length > 0) {
                      // Usar Controller con el componente Select para asegurar sincronización correcta
                      return (
                        <Controller
                          name={field.id}
                          control={form.control}
                          rules={{
                            required: field.required
                              ? t('register.dynamicFieldRequired', { defaultValue: 'Este campo es obligatorio' })
                              : false
                          }}
                          render={({ field: controllerField }) => {
                            const currentValue = typeof controllerField.value === 'string' ? controllerField.value : '';
                            return (
                              <Select
                                id={field.id}
                                name={controllerField.name}
                                value={currentValue}
                                onValueChange={(value) => {
                                  // Establecer el valor directamente en react-hook-form
                                  controllerField.onChange(value);
                                  // Forzar validación después de establecer el valor
                                  setValue(field.id, value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                                  trigger(field.id);
                                }}
                                onChange={(e) => {
                                  // Manejar también el onChange del select oculto
                                  const value = e.target.value;
                                  controllerField.onChange(value);
                                  // Asegurar que react-hook-form detecte el cambio
                                  setValue(field.id, value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                                  trigger(field.id);
                                }}
                                onBlur={controllerField.onBlur}
                                ref={controllerField.ref}
                                placeholder={t('register.selectPlaceholder', { defaultValue: 'Selecciona una opción' })}
                              >
                                {processedOptions.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </Select>
                            );
                          }}
                        />
                      );
                    }
                    return <Input id={field.id} {...register(field.id)} />;
                  };

                  return (
                    <FormField
                      key={field.id}
                      label={fieldLabel}
                      htmlFor={field.id}
                      error={errorMessage}
                      required={field.required}
                    >
                      {renderFieldInput()}
                    </FormField>
                  );
                })}
              </div>
            ) : null}

            <FormField
              label={t('register.password')}
              htmlFor="password"
              description={t('register.passwordHelper')}
              error={
                errors.password
                  ? t(errors.password.message ?? '', { defaultValue: errors.password.message })
                  : undefined
              }
              required
            >
              <div className="flex gap-2">
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  className="flex-1"
                  {...register('password')}
                />
                <PasswordGeneratorButton
                  onGenerate={password => {
                    setValue('password', password, { shouldValidate: true });
                    setValue('confirmPassword', password, { shouldValidate: true });
                  }}
                  aria-label={t('register.generatePassword')}
                />
              </div>
            </FormField>

            <FormField
              label={t('register.confirmPassword')}
              htmlFor="confirmPassword"
              error={
                errors.confirmPassword
                  ? t(errors.confirmPassword.message ?? '', {
                      defaultValue: errors.confirmPassword.message
                    })
                  : undefined
              }
              required
            >
              <div className="flex gap-2">
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  className="flex-1"
                  {...register('confirmPassword')}
                />
              </div>
            </FormField>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="acceptPrivacyPolicy"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[color:var(--tenant-primary)] focus:ring-2 focus:ring-[color:var(--tenant-primary)] focus:ring-offset-2"
                  {...register('acceptPrivacyPolicy', { required: true })}
                />
                <label htmlFor="acceptPrivacyPolicy" className="text-sm leading-relaxed text-foreground">
                  {t('register.acceptPrivacyPolicy', {
                    defaultValue: 'Acepto la '
                  })}
                  <a
                    href={tenantPath('legal/privacy')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[color:var(--tenant-primary)] underline hover:text-[color:var(--tenant-primary)]/80"
                    onClick={e => e.stopPropagation()}
                  >
                    {t('register.privacyPolicy', { defaultValue: 'Política de Privacidad' })}
                  </a>
                </label>
              </div>
              {errors.acceptPrivacyPolicy ? (
                <p className="text-sm text-destructive">
                  {t(errors.acceptPrivacyPolicy.message ?? '', { defaultValue: errors.acceptPrivacyPolicy.message })}
                </p>
              ) : null}
            </div>

            <ErrorDisplay error={submissionError} />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('register.submit')}
            </Button>
          </form>
    </AuthCard>
  );
}


