import { useCallback, useState } from 'react';
import type { Task } from '@/services/events';

type FetchEventDetail<TTasks extends Task = Task> = (eventId: number) => Promise<{
  tasks?: TTasks[] | null;
}>;

type UseExpandableEventTasksResult<TTasks extends Task = Task> = {
  expandedEventId: number | null;
  tasksByEvent: Record<number, TTasks[]>;
  toggle: (eventId: number) => Promise<void>;
  isExpanded: (eventId: number) => boolean;
};

export function useExpandableEventTasks<TTasks extends Task = Task>(
  fetchEventDetail: FetchEventDetail<TTasks>
): UseExpandableEventTasksResult<TTasks> {
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [tasksByEvent, setTasksByEvent] = useState<Record<number, TTasks[]>>({});

  const toggle = useCallback(
    async (eventId: number) => {
      if (expandedEventId === eventId) {
        setExpandedEventId(null);
        return;
      }

      if (!tasksByEvent[eventId]) {
        const detail = await fetchEventDetail(eventId);
        const tasks = detail.tasks ?? [];
        setTasksByEvent(prev => ({
          ...prev,
          [eventId]: tasks
        }));
      }

      setExpandedEventId(eventId);
    },
    [expandedEventId, fetchEventDetail, tasksByEvent]
  );

  const isExpanded = useCallback(
    (eventId: number) => expandedEventId === eventId,
    [expandedEventId]
  );

  return {
    expandedEventId,
    tasksByEvent,
    toggle,
    isExpanded
  };
}


