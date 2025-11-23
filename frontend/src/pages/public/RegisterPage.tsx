import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { Link, Navigate, useNavigate } from 'react-router';

import { PageContainer, ErrorDisplay, PasswordField } from '@/components/common';
import { AuthCard } from '@/components/common/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/form';
import { useTenant } from '@/context/TenantContext';
import { useTenantPath } from '@/hooks/useTenantPath';
import { safeTranslate } from '@/utils/i18n-helpers';
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
    language: z.enum(['es', 'ca', 'en']),
    acceptPrivacyPolicy: z.boolean().refine(val => val === true, {
      message: 'register.privacyPolicyRequired'
    })
  })
  .refine(values => values.password === values.confirmPassword, {
    message: 'register.passwordMismatch',
    path: ['confirmPassword']
  });

type BaseFormValues = z.infer<typeof baseSchema>;
type FormValues = BaseFormValues & Record<string, string | boolean | undefined> & {
  language: 'es' | 'ca' | 'en';
};

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
  const { hydrateSession, user, activeMembership, loading: authLoading } = useAuth();

  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const schemaFieldsRef = useRef<NormalizedSchemaField[]>([]);

  const { registrationSchema: tenantRegistrationSchema } = useTenant();
  
  // El schema de registro siempre viene del tenant, no del evento
  const registrationSchema = tenantRegistrationSchema;

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

  // Actualizar la referencia cuando cambien los campos del schema
  useEffect(() => {
    schemaFieldsRef.current = schemaFields;
  }, [schemaFields]);

  // Crear schema de validación dinámico que incluya explícitamente los campos obligatorios
  const schema = useMemo(() => {
    console.log('[RegisterPage] Creando schema de validación con campos:', schemaFields);
    return baseSchema.superRefine((values, ctx) => {
      console.log('[RegisterPage] Iniciando validación superRefine');
      console.log('[RegisterPage] Valores del formulario:', values);
      console.log('[RegisterPage] Campos del schema a validar:', schemaFields);
      
      // Validar todos los campos obligatorios del esquema de registro
      for (const field of schemaFields) {
        console.log(`[RegisterPage] Validando campo: ${field.id}, requerido: ${field.required}`);
        
        if (!field.required) {
          console.log(`[RegisterPage] Campo ${field.id} no es requerido, saltando`);
          continue;
        }

        let rawValue = (values as Record<string, unknown>)[field.id];
        console.log(`[RegisterPage] Valor crudo para ${field.id}:`, rawValue, typeof rawValue);
        let stringValue = typeof rawValue === 'string' ? rawValue.trim() : '';
        
        // Si el valor no está en react-hook-form, intentar leerlo del DOM directamente
        // Esto puede ocurrir cuando el componente Select no sincroniza correctamente con react-hook-form
        if (!stringValue && globalThis.window !== undefined) {
          console.log(`[RegisterPage] Valor vacío para ${field.id}, intentando leer del DOM`);
          try {
            // Buscar el select oculto por name o id
            const selectElement = document.querySelector<HTMLSelectElement>(`select[name="${field.id}"], select#${field.id}`);
            if (selectElement?.value) {
              stringValue = selectElement.value.trim();
              console.log(`[RegisterPage] Valor encontrado en select DOM para ${field.id}:`, stringValue);
            } else {
              // Fallback: leer del FormData
              const formElement = document.querySelector<HTMLFormElement>('form');
              if (formElement) {
                const formData = new FormData(formElement);
                const formDataValue = formData.get(field.id);
                if (formDataValue && typeof formDataValue === 'string') {
                  stringValue = formDataValue.trim();
                  console.log(`[RegisterPage] Valor encontrado en FormData para ${field.id}:`, stringValue);
                }
              }
            }
          } catch (error) {
            // Si hay un error accediendo al DOM, continuar con la validación normal
            console.warn('[RegisterPage] Error reading select value in validation:', error);
          }
        }

        console.log(`[RegisterPage] Valor final para ${field.id}:`, stringValue);

        // Validar que el campo obligatorio tenga un valor
        if (!stringValue) {
          console.log(`[RegisterPage] ❌ Campo obligatorio ${field.id} está vacío, añadiendo error`);
          ctx.addIssue({
            code: 'custom',
            path: [field.id],
            message: 'register.dynamicFieldRequired'
          });
          continue;
        }

        // Si el campo tiene opciones definidas, validar que el valor sea una de ellas
        if (field.options && field.options.length > 0) {
          const validValuesSet = new Set(field.options.map(opt => opt.value));
          console.log(`[RegisterPage] Validando valor ${stringValue} contra opciones válidas:`, Array.from(validValuesSet));
          if (!validValuesSet.has(stringValue)) {
            console.log(`[RegisterPage] ❌ Valor ${stringValue} no es válido para campo ${field.id}`);
            ctx.addIssue({
              code: 'custom',
              path: [field.id],
              message: 'register.dynamicFieldInvalid'
            });
          } else {
            console.log(`[RegisterPage] ✅ Valor ${stringValue} es válido para campo ${field.id}`);
          }
        } else {
          console.log(`[RegisterPage] ✅ Campo ${field.id} tiene valor válido:`, stringValue);
        }
      }
      
      console.log('[RegisterPage] Validación superRefine completada');
    });
  }, [schemaFields]);

  // Determinar idioma inicial basado en i18n o navegador
  const initialLanguage = useMemo(() => {
    const currentLang = i18n.language?.split('-')[0]?.toLowerCase();
    if (currentLang === 'es' || currentLang === 'ca' || currentLang === 'en') {
      return currentLang;
    }
    return 'es';
  }, [i18n.language]);

  // Calcular valores por defecto para campos del schema (campos obligatorios con opciones)
  const schemaDefaultValues = useMemo(() => {
    const defaults: Record<string, string> = {};
    for (const field of schemaFields) {
      if (field.required && field.type === 'select' && field.options && field.options.length > 0) {
        const firstOption = field.options[0];
        const defaultValue = firstOption?.value || '';
        if (defaultValue && defaultValue.trim() !== '') {
          defaults[field.id] = defaultValue.trim();
          console.log(`[RegisterPage] Valor por defecto calculado para ${field.id}:`, defaultValue);
        }
      }
    }
    return defaults;
  }, [schemaFields]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      acceptPrivacyPolicy: false,
      language: initialLanguage,
      ...schemaDefaultValues
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

  useEffect(() => {
    schemaFieldsRef.current = schemaFields;

    const currentValues = getValues();
    const nextValues: FormValues = {
      firstName: currentValues.firstName ?? '',
      lastName: currentValues.lastName ?? '',
      email: currentValues.email ?? '',
      password: currentValues.password ?? '',
      confirmPassword: currentValues.confirmPassword ?? '',
      language: currentValues.language ?? initialLanguage,
      acceptPrivacyPolicy: currentValues.acceptPrivacyPolicy ?? false
    };

    // Inicializar todos los campos del schema
    // Para campos obligatorios con opciones, establecer el primer valor por defecto
    for (const field of schemaFields) {
      let fieldValue: string | undefined = undefined;
      
      // Primero verificar si hay un valor en react-hook-form
      const hasExistingValue = field.id in currentValues && 
        currentValues[field.id] !== undefined && 
        currentValues[field.id] !== null &&
        String(currentValues[field.id]).trim() !== '';

      if (hasExistingValue) {
        // Preservar el valor existente si el usuario ya ha interactuado con el formulario
        fieldValue = String(currentValues[field.id]).trim();
        console.log(`[RegisterPage] useEffect - Preservando valor existente para ${field.id}:`, fieldValue);
      } else if (field.required && field.type === 'select' && field.options && field.options.length > 0) {
        // Para campos obligatorios con opciones, establecer el primer valor por defecto
        // Esto fuerza al usuario a cambiar explícitamente el valor si no quiere el primero
        const firstOption = field.options[0];
        // field.options es un array de objetos { value: string, label?: ... }
        const defaultValue = firstOption?.value || '';
        
        if (defaultValue && defaultValue.trim() !== '') {
          fieldValue = defaultValue.trim();
          console.log(`[RegisterPage] useEffect - Estableciendo primer valor por defecto para ${field.id}:`, fieldValue, '(de opciones:', field.options.map(opt => opt.value).join(', '), ')');
        } else {
          console.warn(`[RegisterPage] useEffect - No se pudo obtener valor por defecto para ${field.id}, primera opción:`, firstOption);
        }
      } else if (globalThis.window !== undefined && field.type === 'select') {
        // Si no hay valor en react-hook-form pero es un select, intentar leerlo del DOM
        try {
          const selectElement = document.querySelector<HTMLSelectElement>(`select[name="${field.id}"], select#${field.id}`);
          if (selectElement?.value && selectElement.value.trim() !== '') {
            fieldValue = selectElement.value.trim();
            console.log(`[RegisterPage] useEffect - Valor encontrado en DOM para ${field.id}:`, fieldValue);
          }
        } catch (error) {
          console.warn(`[RegisterPage] Error leyendo valor del DOM para ${field.id}:`, error);
        }
      }
      
      // Establecer el valor (o string vacío si no hay valor)
      nextValues[field.id] = fieldValue ?? '';
    }

    console.log('[RegisterPage] useEffect - Valores a establecer:', nextValues);

    // Solo resetear si hay cambios en los campos del schema, pero preservar valores existentes
    // No usar keepDirtyValues: false porque puede causar que se pierdan los valores por defecto
    reset(nextValues, {
      keepDirtyValues: true, // Preservar valores que el usuario haya modificado
      keepErrors: false,
      keepTouched: false // Resetear touched para que los valores por defecto se muestren correctamente
    });
  }, [schemaFields, getValues, reset, initialLanguage]);

  // Efecto adicional para sincronizar valores del DOM con react-hook-form cuando el usuario selecciona valores
  useEffect(() => {
    if (globalThis.window === undefined) {
      return;
    }

    // Sincronizar valores de selects del DOM con react-hook-form
    for (const field of schemaFields) {
      if (field.type !== 'select') {
        continue;
      }

      try {
        const selectElement = document.querySelector<HTMLSelectElement>(`select[name="${field.id}"], select#${field.id}`);
        if (selectElement) {
          const domValue = selectElement.value?.trim() || '';
          const formValue = getValues(field.id);
          const formValueStr = typeof formValue === 'string' ? formValue.trim() : '';
          
          // Si el valor en el DOM es diferente al valor en el formulario, sincronizar
          if (domValue !== formValueStr && domValue !== '') {
            console.log(`[RegisterPage] Sincronizando valor del DOM para ${field.id}:`, domValue, '-> react-hook-form');
            setValue(field.id, domValue, { 
              shouldValidate: true, 
              shouldDirty: true, 
              shouldTouch: true 
            });
          }
        }
      } catch (error) {
        console.warn(`[RegisterPage] Error sincronizando valor del DOM para ${field.id}:`, error);
      }
    }
  }, [schemaFields, getValues, setValue]);

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmissionError(null);
      
      console.log('[RegisterPage] onSubmit - Valores del formulario:', values);
      console.log('[RegisterPage] onSubmit - Campos del schema:', schemaFields);
      
      // Validar explícitamente que todos los campos obligatorios del esquema tengan valor
      const missingRequiredFields: string[] = [];
      const formElement = document.querySelector<HTMLFormElement>('form');
      const formData = formElement ? new FormData(formElement) : null;
      
      for (const field of schemaFields) {
        console.log(`[RegisterPage] onSubmit - Verificando campo ${field.id}, requerido: ${field.required}`);
        
        if (!field.required) {
          continue;
        }
        
        let value = values[field.id];
        console.log(`[RegisterPage] onSubmit - Valor inicial para ${field.id}:`, value);
        
        // Si el valor no está en react-hook-form, leerlo del FormData como fallback
        if ((!value || (typeof value === 'string' && !value.trim())) && formData) {
          const formDataValue = formData.get(field.id);
          console.log(`[RegisterPage] onSubmit - Valor en FormData para ${field.id}:`, formDataValue);
          if (formDataValue && typeof formDataValue === 'string') {
            value = formDataValue;
          }
        }
        
        // Validar que el campo tenga un valor válido
        const stringValue = typeof value === 'string' ? value.trim() : '';
        console.log(`[RegisterPage] onSubmit - Valor final para ${field.id}:`, stringValue);
        
        if (!stringValue) {
          const fieldLabel = resolveSchemaLabel(
            field.label,
            i18n.language ?? 'es',
            field.id
          );
          console.log(`[RegisterPage] ❌ Campo obligatorio ${field.id} (${fieldLabel}) está vacío`);
          missingRequiredFields.push(fieldLabel);
          
          // Marcar el campo como error en el formulario
          trigger(field.id);
        } else {
          console.log(`[RegisterPage] ✅ Campo ${field.id} tiene valor:`, stringValue);
        }
      }
      
      // Si faltan campos obligatorios, cancelar el proceso y mostrar errores
      if (missingRequiredFields.length > 0) {
        console.log('[RegisterPage] ❌ Faltan campos obligatorios:', missingRequiredFields);
        const fieldsList = missingRequiredFields.join(', ');
        setSubmissionError(
          safeTranslate(
            t,
            'register.missingRequiredFields',
            { fields: fieldsList, defaultValue: `Por favor, completa los siguientes campos obligatorios: ${fieldsList}` }
          )
        );
        return;
      }
      
      // Obtener el idioma del formulario
      const selectedLanguage = values.language || initialLanguage;
      console.log('[RegisterPage] Idioma seleccionado:', selectedLanguage);
      const answersPayload: Record<string, string> = {};

      // Procesar todos los campos del schema dinámicamente
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

      const registrationPayload = {
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        email: values.email.toLowerCase(),
        password: values.password,
        language: (selectedLanguage === 'es' || selectedLanguage === 'en' || selectedLanguage === 'ca') 
          ? selectedLanguage 
          : 'es',
        registration_answers: Object.keys(answersPayload).length > 0 ? answersPayload : undefined
      };
      
      console.log('[RegisterPage] Enviando payload de registro:', {
        ...registrationPayload,
        password: '***'
      });
      
      const response = await registerUser(registrationPayload);

      const payload = response.data?.data;
      if (payload) {
        hydrateSession(payload);
        navigate(tenantPath('dashboard'));
        return;
      }

      setSubmissionError(safeTranslate(t, 'register.genericError'));
    } catch (error) {
      if (isAxiosError(error)) {
        const message = error.response?.data?.message;
        if (message) {
          setSubmissionError(safeTranslate(t, message, { defaultValue: message }));
        } else {
          setSubmissionError(safeTranslate(t, 'register.genericError'));
        }
      } else {
        setSubmissionError(safeTranslate(t, 'register.genericError'));
      }
    }
  };

  if (!tenantSlug) {
    return (
      <PageContainer className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{safeTranslate(t, 'register.missingTenant')}</p>
        <Button asChild>
          <Link to="/">{safeTranslate(t, 'register.goToPublicHub')}</Link>
        </Button>
      </PageContainer>
    );
  }

  // Mostrar spinner mientras se verifica la autenticación
  if (authLoading) {
    return null;
  }

  // Redirigir a la home del tenant si el usuario ya está logueado
  if (user && activeMembership) {
    return <Navigate to={tenantPath('')} replace />;
  }

  return (
    <AuthCard
      maxWidth="xl"
      title={safeTranslate(t, 'register.title')}
      subtitle={safeTranslate(t, 'register.subtitle')}
      footer={
        <div className="flex flex-col items-center gap-2">
          <p>{safeTranslate(t, 'register.alreadyHaveAccount')}</p>
          <Button variant="ghost" size="sm" className="p-0 text-[color:var(--tenant-primary)]" asChild>
            <Link to={tenantPath('login')}>{safeTranslate(t, 'register.goToLogin')}</Link>
          </Button>
        </div>
      }
    >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label={safeTranslate(t, 'register.firstName')}
                htmlFor="firstName"
                error={
                  errors.firstName
                    ? safeTranslate(t, errors.firstName.message ?? '', { defaultValue: errors.firstName.message })
                    : undefined
                }
                required
              >
                <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
              </FormField>
              <FormField
                label={safeTranslate(t, 'register.lastName')}
                htmlFor="lastName"
                error={
                  errors.lastName
                    ? safeTranslate(t, errors.lastName.message ?? '', { defaultValue: errors.lastName.message })
                    : undefined
                }
                required
              >
                <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
              </FormField>
            </div>

            <FormField
              label={safeTranslate(t, 'register.email')}
              htmlFor="email"
              error={
                errors.email
                  ? safeTranslate(t, errors.email.message ?? '', { defaultValue: errors.email.message })
                  : undefined
              }
              required
            >
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
            </FormField>

            <FormField
              label={safeTranslate(t, 'register.language', { defaultValue: 'Idioma' })}
              htmlFor="language"
              error={
                errors.language
                  ? safeTranslate(t, errors.language.message ?? '', { defaultValue: errors.language.message })
                  : undefined
              }
              required
            >
              <Controller
                name="language"
                control={form.control}
                render={({ field: controllerField }) => (
                  <Select
                    id="language"
                    name={controllerField.name}
                    value={controllerField.value || initialLanguage}
                    onValueChange={(value) => {
                      const langValue = value === 'es' || value === 'ca' || value === 'en' ? value : 'es';
                      controllerField.onChange(langValue);
                      setValue('language', langValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                      trigger('language');
                    }}
                    onChange={(e) => {
                      const value = e.target.value;
                      const langValue = value === 'es' || value === 'ca' || value === 'en' ? value : 'es';
                      controllerField.onChange(langValue);
                      setValue('language', langValue, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                      trigger('language');
                    }}
                    onBlur={controllerField.onBlur}
                    ref={controllerField.ref}
                  >
                    <option value="es">{safeTranslate(t, 'common.languages.es', { defaultValue: 'Español' })}</option>
                    <option value="ca">{safeTranslate(t, 'common.languages.ca', { defaultValue: 'Català' })}</option>
                    <option value="en">{safeTranslate(t, 'common.languages.en', { defaultValue: 'English' })}</option>
                  </Select>
                )}
              />
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
                    ? safeTranslate(t, errors[field.id]?.message ?? '', { defaultValue: errors[field.id]?.message })
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
                              ? safeTranslate(t, 'register.dynamicFieldRequired', { defaultValue: 'Este campo es obligatorio' })
                              : false
                          }}
                          render={({ field: controllerField }) => {
                            // Obtener el valor actual del formulario, con fallback a string vacío
                            const currentValue = typeof controllerField.value === 'string' && controllerField.value.trim() !== '' 
                              ? controllerField.value 
                              : '';
                            
                            console.log(`[RegisterPage] Renderizando Select para ${field.id}, valor actual en react-hook-form:`, currentValue);
                            
                            // Si no hay valor pero el campo es obligatorio con opciones, usar el primer valor como defaultValue
                            const defaultValue = !currentValue && field.required && field.options && field.options.length > 0
                              ? field.options[0]?.value || ''
                              : undefined;
                            
                            return (
                              <Select
                                id={field.id}
                                name={controllerField.name}
                                value={currentValue || defaultValue || ''}
                                defaultValue={defaultValue}
                                onValueChange={(value) => {
                                  console.log(`[RegisterPage] onValueChange para ${field.id}, nuevo valor:`, value);
                                  // Establecer el valor directamente en react-hook-form usando controllerField.onChange
                                  // Esto es lo más importante para mantener la sincronización
                                  controllerField.onChange(value);
                                  // También usar setValue para asegurar sincronización completa
                                  setValue(field.id, value, { 
                                    shouldValidate: true, 
                                    shouldDirty: true, 
                                    shouldTouch: true 
                                  });
                                  // Disparar validación
                                  setTimeout(() => {
                                    trigger(field.id);
                                  }, 0);
                                }}
                                onChange={(e) => {
                                  // Manejar también el onChange del select oculto (fallback)
                                  const value = e.target.value;
                                  console.log(`[RegisterPage] onChange (fallback) para ${field.id}, valor:`, value);
                                  if (value !== currentValue) {
                                    controllerField.onChange(value);
                                    setValue(field.id, value, { 
                                      shouldValidate: true, 
                                      shouldDirty: true, 
                                      shouldTouch: true 
                                    });
                                    setTimeout(() => {
                                      trigger(field.id);
                                    }, 0);
                                  }
                                }}
                                onBlur={controllerField.onBlur}
                                ref={controllerField.ref}
                                placeholder={safeTranslate(t, 'register.selectPlaceholder', { defaultValue: 'Selecciona una opción' })}
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
              label={safeTranslate(t, 'register.password')}
              htmlFor="password"
              description={safeTranslate(t, 'register.passwordHelper')}
              error={
                errors.password
                  ? safeTranslate(t, errors.password.message ?? '', { defaultValue: errors.password.message })
                  : undefined
              }
              required
            >
              <PasswordField
                id="password"
                autoComplete="new-password"
                showGenerator
                onPasswordGenerated={password => {
                  setValue('password', password, { shouldValidate: true });
                  setValue('confirmPassword', password, { shouldValidate: true });
                }}
                generatorAriaLabel={safeTranslate(t, 'register.generatePassword')}
                {...register('password')}
              />
            </FormField>

            <FormField
              label={safeTranslate(t, 'register.confirmPassword')}
              htmlFor="confirmPassword"
              error={
                errors.confirmPassword
                  ? safeTranslate(t, errors.confirmPassword.message ?? '', {
                      defaultValue: errors.confirmPassword.message
                    })
                  : undefined
              }
              required
            >
              <div className="flex gap-2">
                <PasswordField
                  id="confirmPassword"
                  autoComplete="new-password"
                  className="flex-1"
                  {...register('confirmPassword')}
                />
                <div className="w-10" aria-hidden="true" />
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
                  {safeTranslate(t, 'register.acceptPrivacyPolicy', {
                    defaultValue: 'Acepto la '
                  })}
                  <a
                    href={tenantPath('legal/privacy')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[color:var(--tenant-primary)] underline hover:text-[color:var(--tenant-primary)]/80"
                    onClick={e => e.stopPropagation()}
                  >
                    {safeTranslate(t, 'register.privacyPolicy', { defaultValue: 'Política de Privacidad' })}
                  </a>
                </label>
              </div>
              {errors.acceptPrivacyPolicy ? (
                <p className="text-sm text-destructive">
                  {safeTranslate(t, errors.acceptPrivacyPolicy.message ?? '', { defaultValue: errors.acceptPrivacyPolicy.message })}
                </p>
              ) : null}
            </div>

            <ErrorDisplay error={submissionError} />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'register.submit')}
            </Button>
          </form>
    </AuthCard>
  );
}


