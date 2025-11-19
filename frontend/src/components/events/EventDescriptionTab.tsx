import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveAssetMarkers } from '@/utils/asset-markers';
import { getEventAssets } from '@/services/event-assets';
import type { Event } from '@/services/events';

type EventDescriptionTabProps = {
  event: Event & { phases?: unknown[]; tasks?: unknown[]; rubrics?: unknown[] };
};

export function EventDescriptionTab({ event }: EventDescriptionTabProps) {
  // Cargar assets del evento para resolver marcadores
  const { data: assets = [] } = useQuery({
    queryKey: ['eventAssets', event.id],
    queryFn: () => getEventAssets(event.id),
    enabled: Boolean(event.id && event.description_html)
  });

  // Resolver marcadores de assets en el HTML antes de renderizar
  const resolvedDescriptionHtml = useMemo(() => {
    if (!event.description_html || !assets.length) {
      return event.description_html;
    }
    return resolveAssetMarkers(event.description_html, assets);
  }, [event.description_html, assets]);

  if (!resolvedDescriptionHtml) {
    return (
      <div className="prose prose-sm max-w-none">
        <p className="text-muted-foreground">No hay descripción disponible para este evento.</p>
      </div>
    );
  }

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: resolvedDescriptionHtml }}
    />
  );
}

