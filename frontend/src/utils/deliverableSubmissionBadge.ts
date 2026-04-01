import type { DeliverableSubmissionStatus } from '@/services/events';

/** Presentación de la etiqueta de estado de la entrega más reciente en tablas de seguimiento */
export function deliverableSubmissionBadgePresentation(
  status: DeliverableSubmissionStatus | null | undefined
): { badgeClassName: string; translationKey: string; accentClassName: string } {
  if (status === 'draft') {
    return {
      badgeClassName: 'bg-orange-50 text-orange-800 border-orange-200',
      translationKey: 'events.deliverablesTracking.submittedDraft',
      accentClassName: 'text-orange-600'
    };
  }
  return {
    badgeClassName: 'bg-green-50 text-green-700 border-green-300',
    translationKey: 'events.deliverablesTracking.submittedFinal',
    accentClassName: 'text-green-600'
  };
}

/** Clave i18n para CSV / textos planos según el estado de la entrega más reciente */
export function deliverableSubmissionStatusLabelKey(
  status: DeliverableSubmissionStatus | null | undefined
): 'events.deliverablesTracking.submittedDraft' | 'events.deliverablesTracking.submittedFinal' {
  return status === 'draft' ? 'events.deliverablesTracking.submittedDraft' : 'events.deliverablesTracking.submittedFinal';
}
