import { useTranslation } from 'react-i18next';
import { UseFormReturn } from 'react-hook-form';
import { safeTranslate } from '@/utils/i18n-helpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EventForm, type EventFormValues } from '@/components/events/forms';

type EventEditModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<EventFormValues>;
  onSubmit: (values: EventFormValues) => void;
  isSubmitting: boolean;
  eventId: number;
};

export function EventEditModal({
  open,
  onOpenChange,
  form,
  onSubmit,
  isSubmitting,
  eventId
}: EventEditModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{safeTranslate(t, 'events.editEvent')}</DialogTitle>
          <DialogDescription>
            {safeTranslate(t, 'events.editEventDescription', { defaultValue: 'Modifica los detalles del evento' })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="basic" className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pb-4 pt-4">
                <TabsList data-event-form-tabs className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">{safeTranslate(t, 'common.basic', { defaultValue: 'Básico' })}</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                  <TabsTrigger value="registration">{safeTranslate(t, 'events.registrationSchema', { defaultValue: 'Esquema de Registro' })}</TabsTrigger>
                  <TabsTrigger value="ai_evaluation">{safeTranslate(t, 'events.aiEvaluation', { defaultValue: 'Evaluación IA' })}</TabsTrigger>
                </TabsList>
              </div>
              <div className="px-6">
            <TabsContent value="basic" className="mt-4">
              <EventForm
                form={form}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                hideSubmitButton
                idPrefix="event"
                sections={['basic']}
                eventId={eventId}
              />
            </TabsContent>
            <TabsContent value="html" className="mt-4 h-[calc(90vh-200px)]">
              <EventForm
                form={form}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                hideSubmitButton
                idPrefix="event"
                sections={['html']}
                eventId={eventId}
              />
            </TabsContent>
            <TabsContent value="registration" className="mt-4">
              <EventForm
                form={form}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                hideSubmitButton
                idPrefix="event"
                sections={['registration']}
                eventId={eventId}
              />
            </TabsContent>
            <TabsContent value="ai_evaluation" className="mt-4">
              <EventForm
                form={form}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                hideSubmitButton
                idPrefix="event"
                sections={['ai_evaluation']}
                eventId={eventId}
              />
            </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {safeTranslate(t, 'common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? safeTranslate(t, 'common.loading') : safeTranslate(t, 'common.update')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

