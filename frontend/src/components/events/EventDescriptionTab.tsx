import { useTranslation } from 'react-i18next';
import type { Event } from '@/services/events';
import { getMultilingualText } from '@/utils/multilingual';

type EventDescriptionTabProps = {
  event: Event & { phases?: unknown[]; tasks?: unknown[]; rubrics?: unknown[] };
};

export function EventDescriptionTab({ event }: EventDescriptionTabProps) {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language?.split('-')[0] || 'es') as 'es' | 'ca' | 'en';
  
  const descriptionHtml = event.description_html 
    ? getMultilingualText(event.description_html, currentLang)
    : null;

  if (!descriptionHtml) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
          <p className="text-muted-foreground">No hay descripción disponible para este evento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="rounded-2xl border border-border/70 bg-card/80 p-6">
        <div 
          className="html-content"
          dangerouslySetInnerHTML={{ __html: descriptionHtml }} 
        />
      </div>
    </div>
  );
}

