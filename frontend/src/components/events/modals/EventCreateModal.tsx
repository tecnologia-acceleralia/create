import { useTranslation } from 'react-i18next';
import { UseFormReturn } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EventForm, type EventFormValues } from '@/components/events/forms';

type EventCreateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<EventFormValues>;
  onSubmit: (values: EventFormValues) => void;
  isSubmitting: boolean;
};

export function EventCreateModal({
  open,
  onOpenChange,
  form,
  onSubmit,
  isSubmitting
}: EventCreateModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{t('events.formTitle')}</DialogTitle>
          <DialogDescription>
            {t('events.createEventDescription', { defaultValue: 'Crea un nuevo evento' })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6">
          <EventForm form={form} onSubmit={onSubmit} isSubmitting={isSubmitting} hideSubmitButton />
        </div>
        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('common.loading') : t('events.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

