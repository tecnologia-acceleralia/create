import type { Event } from '@/services/events';

type EventDescriptionTabProps = {
  event: Event & { phases?: unknown[]; tasks?: unknown[]; rubrics?: unknown[] };
};

export function EventDescriptionTab({ event }: EventDescriptionTabProps) {
  if (!event.description_html) {
    return (
      <div className="prose prose-sm max-w-none">
        <p className="text-muted-foreground">No hay descripción disponible para este evento.</p>
      </div>
    );
  }

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: event.description_html }}
    />
  );
}

