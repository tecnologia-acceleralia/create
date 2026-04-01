import { getMultilingualText } from '@/utils/multilingual';
import type { EventDeliverablesTracking, MultilingualText } from '@/services/events';

type Lang = 'es' | 'ca' | 'en';

/**
 * Columna de la fase de inscripción / descripción de la idea: no hay entregable formal;
 * el alta del equipo cumple la fase. Usado en tablas de seguimiento de entregables.
 */
export function isRegistrationIdeaDeliverableColumn(input: {
  phaseOrderIndex: number;
  phaseName: unknown;
  taskTitle: unknown;
  lang: Lang;
}): boolean {
  const phaseStr = getMultilingualText(input.phaseName as MultilingualText | string | null | undefined, input.lang);
  const taskStr = getMultilingualText(input.taskTitle as MultilingualText | string | null | undefined, input.lang);
  const phaseLower = phaseStr.toLowerCase();
  const taskLower = taskStr.toLowerCase();

  const phaseMatches =
    (/inscripci|inscription|registration|registro/.test(phaseLower) &&
      /idea|descripci|descripción|description/.test(phaseLower)) ||
    /\bfase\s*0\b/.test(phaseLower) ||
    /\bphase\s*0\b/.test(phaseLower);

  const taskMatches =
    taskLower.includes('inscripción') ||
    taskLower.includes('inscription') ||
    taskLower.includes('inscripció') ||
    taskLower.includes('descripción de la idea') ||
    taskLower.includes('description of the idea') ||
    taskLower.includes('descripció de la idea');

  if (phaseMatches) {
    return true;
  }
  if (input.phaseOrderIndex === 0 && taskMatches) {
    return true;
  }
  return false;
}

export function isRegistrationIdeaTaskInTracking(
  trackingData: EventDeliverablesTracking,
  taskId: number,
  lang: Lang
): boolean {
  const col = trackingData.columns.find(c => c.taskId === taskId);
  if (!col) {
    return false;
  }
  const phase = trackingData.phases.find(p => p.id === col.phaseId);
  if (!phase) {
    return false;
  }
  return isRegistrationIdeaDeliverableColumn({
    phaseOrderIndex: phase.orderIndex,
    phaseName: phase.name,
    taskTitle: col.taskTitle,
    lang
  });
}
