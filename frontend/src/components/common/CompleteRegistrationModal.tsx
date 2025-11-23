import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/form';
import { safeTranslate } from '@/utils/i18n-helpers';
import { completeRegistration } from '@/services/auth';
import { ErrorDisplay } from '@/components/common';

type MissingField = {
  id: string;
  label: Record<string, string> | string;
  type: string;
  required: boolean;
  options: Array<{ value: string; label?: Record<string, string> | string }>;
};

type CompleteRegistrationModalProps = {
  open: boolean;
  missingFields: MissingField[];
  schema: unknown;
  eventId?: number;
  onComplete: () => void;
  onCancel?: () => void;
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

function processFieldOptions(
  options: Array<{ value: string; label?: Record<string, string> | string }> | undefined,
  language: string
): Array<{ value: string; label: string }> {
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
    .filter((option): option is { value: string; label: string } => option !== null);
}

export function CompleteRegistrationModal({
  open,
  missingFields,
  schema,
  eventId,
  onComplete,
  onCancel
}: CompleteRegistrationModalProps) {
  const { t, i18n } = useTranslation();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Crear schema de validación dinámico
  const validationSchema = useMemo(() => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    for (const field of missingFields) {
      if (field.required) {
        if (field.type === 'select') {
          schemaFields[field.id] = z.string().min(1, {
            message: 'register.dynamicFieldRequired'
          });
        } else {
          schemaFields[field.id] = z.string().min(1, {
            message: 'register.dynamicFieldRequired'
          });
        }
      } else {
        schemaFields[field.id] = z.string().optional();
      }
    }

    return z.object(schemaFields);
  }, [missingFields]);

  const form = useForm<Record<string, string>>({
    resolver: zodResolver(validationSchema),
    defaultValues: {}
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    trigger,
    reset
  } = form;

  useEffect(() => {
    if (open) {
      reset({});
      setSubmissionError(null);
    }
  }, [open, reset]);

  const onSubmit = async (values: Record<string, string>) => {
    try {
      setIsSubmitting(true);
      setSubmissionError(null);

      const answersPayload: Record<string, string> = {};
      let grade: string | undefined;

      for (const field of missingFields) {
        const value = values[field.id];
        if (value && typeof value === 'string' && value.trim()) {
          if (field.id === 'grade') {
            grade = value.trim();
          } else {
            answersPayload[field.id] = value.trim();
          }
        }
      }

      await completeRegistration({
        grade,
        registration_answers: Object.keys(answersPayload).length > 0 ? answersPayload : undefined,
        event_id: eventId
      });

      onComplete();
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        const message = axiosError.response?.data?.message;
        if (message) {
          setSubmissionError(safeTranslate(t, message, { defaultValue: message }));
        } else {
          setSubmissionError(safeTranslate(t, 'common.error'));
        }
      } else {
        setSubmissionError(safeTranslate(t, 'common.error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (missingFields.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel?.()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{safeTranslate(t, 'auth.completeRegistration.title', { defaultValue: 'Completar registro' })}</DialogTitle>
          <DialogDescription>
            {safeTranslate(t, 'auth.completeRegistration.description', {
              defaultValue: 'Por favor, completa los siguientes campos requeridos para continuar.'
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {missingFields.map(field => {
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
                      const currentValue = typeof controllerField.value === 'string' ? controllerField.value : '';
                      return (
                        <Select
                          id={field.id}
                          name={controllerField.name}
                          value={currentValue}
                          onValueChange={(value) => {
                            controllerField.onChange(value);
                            setValue(field.id, value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                            trigger(field.id);
                          }}
                          onChange={(e) => {
                            const value = e.target.value;
                            controllerField.onChange(value);
                            setValue(field.id, value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                            trigger(field.id);
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

          <ErrorDisplay error={submissionError} />

          <DialogFooter>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                {safeTranslate(t, 'common.cancel')}
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'auth.completeRegistration.submit', { defaultValue: 'Completar' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

