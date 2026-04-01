import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectViewModal } from '@/components/projects/ProjectViewModal';
import { safeTranslate } from '@/utils/i18n-helpers';
import { deliverableSubmissionBadgePresentation } from '@/utils/deliverableSubmissionBadge';
import type { ProjectCard } from '@/services/projects';

type RegistrationIdeaPhaseTrackingCellProps = Readonly<{
  project: ProjectCard | null | undefined;
  /** Si true, muestra icono de éxito como en la tabla admin */
  showSuccessIcon?: boolean;
  SuccessIcon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}>;

export function RegistrationIdeaPhaseTrackingCell({
  project,
  showSuccessIcon = false,
  SuccessIcon
}: RegistrationIdeaPhaseTrackingCellProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const pres = deliverableSubmissionBadgePresentation('final');

  const handleOpen = () => {
    if (!project) {
      toast.error(safeTranslate(t, 'events.deliverablesTracking.projectDetailUnavailable'));
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        {showSuccessIcon && SuccessIcon ? (
          <div className="flex items-center gap-2">
            <SuccessIcon className={`h-5 w-5 ${pres.accentClassName}`} aria-hidden />
            <Badge variant="outline" className={pres.badgeClassName}>
              {safeTranslate(t, pres.translationKey)}
            </Badge>
          </div>
        ) : (
          <Badge variant="outline" className={pres.badgeClassName}>
            {safeTranslate(t, pres.translationKey)}
          </Badge>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={handleOpen}
        >
          <Eye className="h-3 w-3 mr-1" />
          {safeTranslate(t, 'events.deliverablesTracking.viewProjectDetail')}
        </Button>
      </div>
      <ProjectViewModal project={project ?? null} open={open} onOpenChange={setOpen} />
    </>
  );
}
