import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { safeTranslate } from '@/utils/i18n-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/form';

type RegistrationField = {
  key: string;
  label: {
    ca: string;
    en: string;
    es: string;
  };
  options: Array<{
    value: string;
    label?: {
      ca: string;
      en: string;
      es: string;
    };
  }>;
  required: boolean;
};

type RegistrationSchema = {
  [key: string]: {
    label: {
      ca: string;
      en: string;
      es: string;
    };
    options: Array<{
      value: string;
      label?: {
        ca: string;
        en: string;
        es: string;
      };
    }>;
    required: boolean;
  };
};

type RegistrationSchemaFormProps = {
  value: RegistrationSchema | null | undefined;
  onChange: (value: RegistrationSchema | null) => void;
  error?: string;
  id?: string;
};

const SUPPORTED_LANGUAGES = ['ca', 'en', 'es'] as const;
const LANGUAGE_LABELS: Record<typeof SUPPORTED_LANGUAGES[number], string> = {
  ca: 'Català',
  en: 'English',
  es: 'Español'
};

export function RegistrationSchemaForm({ value, onChange, error, id }: RegistrationSchemaFormProps) {
  const { t } = useTranslation();
  const [fields, setFields] = useState<RegistrationField[]>([]);
  const isInternalUpdate = useRef(false);

  // Convertir el valor JSON a estructura de campos
  useEffect(() => {
    // Si el cambio viene de una actualización interna, ignorarlo
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    if (!value || typeof value !== 'object') {
      setFields([]);
      return;
    }

    const fieldArray: RegistrationField[] = [];
    for (const [key, fieldData] of Object.entries(value)) {
      // Ignorar additionalFields si existe como campo directo
      if (key === 'additionalFields' && Array.isArray(fieldData)) {
        continue;
      }

      if (fieldData && typeof fieldData === 'object' && 'label' in fieldData && 'options' in fieldData) {
        const options = Array.isArray(fieldData.options)
          ? fieldData.options.map(opt => {
              // Si la opción ya tiene label multilingüe, mantenerla
              if (opt && typeof opt === 'object' && 'label' in opt && typeof opt.label === 'object') {
                return {
                  value: opt.value || '',
                  label: {
                    ca: opt.label?.ca || '',
                    en: opt.label?.en || '',
                    es: opt.label?.es || ''
                  }
                };
              }
              // Si solo tiene value (formato antiguo), crear label vacío
              return {
                value: typeof opt === 'object' && opt?.value ? opt.value : String(opt || ''),
                label: {
                  ca: '',
                  en: '',
                  es: ''
                }
              };
            })
          : [];
        fieldArray.push({
          key,
          label: {
            ca: fieldData.label?.ca || '',
            en: fieldData.label?.en || '',
            es: fieldData.label?.es || ''
          },
          options,
          required: Boolean(fieldData.required)
        });
      }
    }
    setFields(fieldArray);
  }, [value]);

  // Convertir campos a JSON cuando cambian
  const updateSchema = (newFields: RegistrationField[]) => {
    setFields(newFields);
    isInternalUpdate.current = true;

    if (newFields.length === 0) {
      onChange(null);
      return;
    }

    const schema: RegistrationSchema = {};
    for (const field of newFields) {
      schema[field.key] = {
        label: field.label,
        options: field.options,
        required: field.required
      };
    }

    onChange(schema);
  };

  const addField = () => {
    const newKey = `field_${Date.now()}`;
    const newField: RegistrationField = {
      key: newKey,
      label: { ca: '', en: '', es: '' },
      options: [],
      required: false
    };
    updateSchema([...fields, newField]);
  };

  const removeField = (index: number) => {
    updateSchema(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<RegistrationField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    updateSchema(newFields);
  };

  const updateFieldLabel = (index: number, lang: typeof SUPPORTED_LANGUAGES[number], value: string) => {
    const newFields = [...fields];
    newFields[index] = {
      ...newFields[index],
      label: {
        ...newFields[index].label,
        [lang]: value
      }
    };
    updateSchema(newFields);
  };

  const addOption = (fieldIndex: number) => {
    const newFields = [...fields];
    newFields[fieldIndex] = {
      ...newFields[fieldIndex],
      options: [
        ...newFields[fieldIndex].options,
        {
          value: '',
          label: {
            ca: '',
            en: '',
            es: ''
          }
        }
      ]
    };
    updateSchema(newFields);
  };

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const newFields = [...fields];
    newFields[fieldIndex] = {
      ...newFields[fieldIndex],
      options: newFields[fieldIndex].options.filter((_, i) => i !== optionIndex)
    };
    updateSchema(newFields);
  };

  const updateOptionValue = (fieldIndex: number, optionIndex: number, value: string) => {
    const newFields = [...fields];
    newFields[fieldIndex] = {
      ...newFields[fieldIndex],
      options: newFields[fieldIndex].options.map((opt, i) =>
        i === optionIndex
          ? {
              ...opt,
              value
            }
          : opt
      )
    };
    updateSchema(newFields);
  };

  const updateOptionLabel = (
    fieldIndex: number,
    optionIndex: number,
    lang: typeof SUPPORTED_LANGUAGES[number],
    value: string
  ) => {
    const newFields = [...fields];
    newFields[fieldIndex] = {
      ...newFields[fieldIndex],
      options: newFields[fieldIndex].options.map((opt, i) =>
        i === optionIndex
          ? {
              ...opt,
              label: {
                ...(opt.label || { ca: '', en: '', es: '' }),
                [lang]: value
              }
            }
          : opt
      )
    };
    updateSchema(newFields);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{safeTranslate(t, 'events.registrationSchemaHint')}</p>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="h-4 w-4 mr-2" />
          {safeTranslate(t, 'events.registrationSchemaAddField')}
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
          {safeTranslate(t, 'events.registrationSchemaEmpty')}
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, fieldIndex) => (
            <Card key={field.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{safeTranslate(t, 'events.registrationSchemaField')} {fieldIndex + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(fieldIndex)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField label={safeTranslate(t, 'events.registrationSchemaFieldKey')} required>
                  <Input
                    value={field.key}
                    onChange={e => updateField(fieldIndex, { key: e.target.value })}
                    placeholder="grade"
                  />
                </FormField>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{safeTranslate(t, 'events.registrationSchemaFieldLabel')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <Input
                        key={lang}
                        value={field.label[lang]}
                        onChange={e => updateFieldLabel(fieldIndex, lang, e.target.value)}
                        placeholder={`${LANGUAGE_LABELS[lang]}...`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{safeTranslate(t, 'events.registrationSchemaFieldOptions')}</label>
                    <Button type="button" variant="outline" size="sm" onClick={() => addOption(fieldIndex)}>
                      <Plus className="h-4 w-4 mr-1" />
                      {safeTranslate(t, 'common.add')}
                    </Button>
                  </div>
                  {field.options.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{safeTranslate(t, 'events.registrationSchemaNoOptions')}</p>
                  ) : (
                    <div className="space-y-4">
                      {field.options.map((option, optionIndex) => (
                        <Card key={optionIndex} className="bg-muted/30">
                          <CardContent className="pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-muted-foreground">
                                {safeTranslate(t, 'events.registrationSchemaOption')} {optionIndex + 1}
                              </label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOption(fieldIndex, optionIndex)}
                                className="text-destructive hover:text-destructive h-6 w-6"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <FormField label={safeTranslate(t, 'events.registrationSchemaOptionValue')} required>
                              <Input
                                value={option.value}
                                onChange={e => updateOptionValue(fieldIndex, optionIndex, e.target.value)}
                                placeholder={safeTranslate(t, 'events.registrationSchemaOptionValuePlaceholder')}
                              />
                            </FormField>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">
                                {safeTranslate(t, 'events.registrationSchemaOptionLabels')}
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {SUPPORTED_LANGUAGES.map(lang => (
                                  <Input
                                    key={lang}
                                    value={option.label?.[lang] || ''}
                                    onChange={e => updateOptionLabel(fieldIndex, optionIndex, lang, e.target.value)}
                                    placeholder={`${LANGUAGE_LABELS[lang]}...`}
                                  />
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`${id}-field-${fieldIndex}-required`}
                    checked={field.required}
                    onChange={e => updateField(fieldIndex, { required: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor={`${id}-field-${fieldIndex}-required`} className="text-sm font-medium">
                    {safeTranslate(t, 'events.registrationSchemaFieldRequired')}
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

