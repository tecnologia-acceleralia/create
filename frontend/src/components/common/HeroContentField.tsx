import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/form';
import { MultiLanguageField } from './MultiLanguageField';
import { safeTranslate } from '@/utils/i18n-helpers';

type HeroContentValue = {
  title?: { es: string; ca?: string; en?: string } | null;
  subtitle?: { es: string; ca?: string; en?: string } | null;
} | null;

interface HeroContentFieldProps {
  control: Control<any>;
  name: string;
  label?: string;
  error?: string;
  className?: string;
}

/**
 * Componente para editar hero_content que tiene estructura:
 * {
 *   es: { title: string | MultilingualText, subtitle: string | MultilingualText },
 *   ca: { title: string | MultilingualText, subtitle: string | MultilingualText },
 *   en: { title: string | MultilingualText, subtitle: string | MultilingualText }
 * }
 * 
 * Se muestra como campos separados por idioma para title y subtitle
 */
export function HeroContentField({
  control,
  name,
  label,
  error,
  className
}: HeroContentFieldProps) {
  const { t } = useTranslation();

  // Normalizar hero_content a formato interno: { title: { es, ca, en }, subtitle: { es, ca, en } }
  // La estructura de entrada es: { es: { title: string|MultilingualText, subtitle: string|MultilingualText }, ... }
  const normalizeHeroContent = (value: unknown): HeroContentValue => {
    if (!value || typeof value !== 'object') {
      return { title: { es: '', ca: '', en: '' }, subtitle: { es: '', ca: '', en: '' } };
    }

    const obj = value as Record<string, any>;
    const result: HeroContentValue = {
      title: { es: '', ca: '', en: '' },
      subtitle: { es: '', ca: '', en: '' }
    };

    // Extraer title y subtitle de cada idioma
    for (const lang of ['es', 'ca', 'en'] as const) {
      const langData = obj[lang];
      if (langData && typeof langData === 'object') {
        // Title puede ser string o objeto multiidioma
        if (langData.title !== undefined && langData.title !== null) {
          if (typeof langData.title === 'string') {
            // Si es string, asignarlo directamente al idioma correspondiente
            result.title![lang] = langData.title;
          } else if (typeof langData.title === 'object') {
            // Si es objeto multiidioma, extraer el valor del idioma correspondiente o español como fallback
            result.title![lang] = langData.title[lang] || langData.title.es || '';
          }
        }

        // Subtitle puede ser string o objeto multiidioma
        if (langData.subtitle !== undefined && langData.subtitle !== null) {
          if (typeof langData.subtitle === 'string') {
            // Si es string, asignarlo directamente al idioma correspondiente
            result.subtitle![lang] = langData.subtitle;
          } else if (typeof langData.subtitle === 'object') {
            // Si es objeto multiidioma, extraer el valor del idioma correspondiente o español como fallback
            result.subtitle![lang] = langData.subtitle[lang] || langData.subtitle.es || '';
          }
        }
      }
    }

    return result;
  };

  // Convertir formato interno a formato JSON para guardar
  const denormalizeHeroContent = (value: HeroContentValue): Record<string, { title: string; subtitle: string }> | null => {
    if (!value || (!value.title && !value.subtitle)) {
      return null;
    }

    const result: Record<string, { title: string; subtitle: string }> = {};

    for (const lang of ['es', 'ca', 'en'] as const) {
      const title = value.title?.[lang]?.trim() || '';
      const subtitle = value.subtitle?.[lang]?.trim() || '';

      // Solo agregar el idioma si tiene al menos title o subtitle
      if (title || subtitle) {
        result[lang] = {
          title: title || '',
          subtitle: subtitle || ''
        };
      }
    }

    // Si no hay ningún contenido, retornar null
    if (Object.keys(result).length === 0) {
      return null;
    }

    return result;
  };

  return (
    <div className={className}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const normalized = normalizeHeroContent(field.value);
          const safeNormalized = normalized || { title: { es: '', ca: '', en: '' }, subtitle: { es: '', ca: '', en: '' } };

          return (
            <div className="space-y-6">
              <FormField
                label={label || safeTranslate(t, 'superadmin.tenants.fields.heroContent')}
                error={error}
                className="space-y-4"
              >
                <div className="space-y-6">
                  <MultiLanguageField
                    value={safeNormalized.title || { es: '', ca: '', en: '' }}
                    onChange={(value) => {
                      const updated = {
                        ...safeNormalized,
                        title: value
                      };
                      field.onChange(denormalizeHeroContent(updated));
                    }}
                    renderField={(value, onChange) => (
                      <Input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={safeTranslate(t, 'superadmin.tenants.heroTitlePlaceholder', { defaultValue: 'Título del hero' })}
                      />
                    )}
                    label={safeTranslate(t, 'superadmin.tenants.heroTitle', { defaultValue: 'Título' })}
                  />
                  <MultiLanguageField
                    value={safeNormalized.subtitle || { es: '', ca: '', en: '' }}
                    onChange={(value) => {
                      const updated = {
                        ...safeNormalized,
                        subtitle: value
                      };
                      field.onChange(denormalizeHeroContent(updated));
                    }}
                    renderField={(value, onChange) => (
                      <Input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={safeTranslate(t, 'superadmin.tenants.heroSubtitlePlaceholder', { defaultValue: 'Subtítulo del hero' })}
                      />
                    )}
                    label={safeTranslate(t, 'superadmin.tenants.heroSubtitle', { defaultValue: 'Subtítulo' })}
                  />
                </div>
              </FormField>
            </div>
          );
        }}
      />
    </div>
  );
}

