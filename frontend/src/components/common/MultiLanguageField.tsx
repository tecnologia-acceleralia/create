import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/common';
import { translateText } from '@/services/translation';
import { Languages } from 'lucide-react';
import { toast } from 'sonner';
import { safeTranslate } from '@/utils/i18n-helpers';

type Language = 'es' | 'ca' | 'en';

interface MultiLanguageFieldProps {
  value: Record<Language, string> | null | undefined;
  onChange: (value: Record<Language, string> | null) => void;
  renderField: (value: string, onChange: (value: string) => void, language: Language) => React.ReactNode;
  isHtml?: boolean;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

const languages: { code: Language; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'ca', label: 'Català' },
  { code: 'en', label: 'English' }
];

export function MultiLanguageField({
  value,
  onChange,
  renderField,
  isHtml = false,
  label,
  required,
  error,
  className
}: MultiLanguageFieldProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Language>('es');
  const [translating, setTranslating] = useState<Language | null>(null);

  // Normalizar valor a objeto multiidioma
  const normalizedValue: Record<Language, string> = value || { es: '', ca: '', en: '' };

  const handleLanguageChange = (lang: Language, newValue: string) => {
    onChange({
      ...normalizedValue,
      [lang]: newValue
    });
  };

  const handleTranslate = async (targetLanguage: Language) => {
    const spanishText = normalizedValue.es || '';
    
    if (!spanishText.trim()) {
      toast.error(safeTranslate(t, 'translation.noSpanishText', { defaultValue: 'No hay texto en español para traducir' }));
      return;
    }

    if (normalizedValue[targetLanguage]?.trim()) {
      // Si ya hay traducción, preguntar si quiere sobrescribir
      if (!confirm(safeTranslate(t, 'translation.overwriteConfirm', { 
        defaultValue: `Ya existe una traducción en ${languages.find(l => l.code === targetLanguage)?.label}. ¿Deseas sobrescribirla?`,
        language: languages.find(l => l.code === targetLanguage)?.label
      }))) {
        return;
      }
    }

    setTranslating(targetLanguage);

    try {
      const translated = await translateText({
        text: spanishText,
        targetLanguage,
        isHtml
      });

      handleLanguageChange(targetLanguage, translated);
      toast.success(safeTranslate(t, 'translation.success', { defaultValue: 'Traducción completada' }));
    } catch (error) {
      console.error('Error al traducir:', error);
      toast.error(
        safeTranslate(t, 'translation.error', { 
          defaultValue: 'Error al traducir el texto',
          error: error instanceof Error ? error.message : String(error)
        })
      );
    } finally {
      setTranslating(null);
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium mb-2">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Language)}>
        <TabsList className="grid w-full grid-cols-3">
          {languages.map(lang => (
            <TabsTrigger key={lang.code} value={lang.code}>
              {lang.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {languages.map(lang => (
          <TabsContent key={lang.code} value={lang.code} className="mt-4">
            <div className="space-y-2">
              {lang.code !== 'es' && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTranslate(lang.code)}
                    disabled={translating === lang.code || !normalizedValue.es?.trim()}
                    className="gap-2"
                  >
                    {translating === lang.code ? (
                      <>
                        <Spinner size="sm" />
                        {safeTranslate(t, 'translation.translating', { defaultValue: 'Traduciendo...' })}
                      </>
                    ) : (
                      <>
                        <Languages className="h-4 w-4" />
                        {safeTranslate(t, 'translation.translateFromSpanish', { defaultValue: 'Traducir desde el español con IA' })}
                      </>
                    )}
                  </Button>
                </div>
              )}
              {renderField(normalizedValue[lang.code] || '', (newValue) => handleLanguageChange(lang.code, newValue), lang.code)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}

