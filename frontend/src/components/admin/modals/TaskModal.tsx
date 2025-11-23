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
import { TaskForm, type TaskFormValues } from '@/components/events/forms';
import type { Phase, PhaseRubric } from '@/services/events';

type TaskModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<TaskFormValues>;
  onSubmit: (values: TaskFormValues) => void;
  isSubmitting: boolean;
  editingTask: any | null;
  phases: Phase[];
  availableRubrics: PhaseRubric[];
  eventId: number;
};

export function TaskModal({
  open,
  onOpenChange,
  form,
  onSubmit,
  isSubmitting,
  editingTask,
  phases,
  availableRubrics,
  eventId
}: TaskModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            {editingTask ? safeTranslate(t, 'events.editTask') : safeTranslate(t, 'events.createTask')}
          </DialogTitle>
          <DialogDescription>
            {editingTask
              ? safeTranslate(t, 'events.editTaskDescription', { defaultValue: 'Modifica los detalles de la tarea' })
              : safeTranslate(t, 'events.createTaskDescription', { defaultValue: 'Crea una nueva tarea para la fase' })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="basic" className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pb-4 pt-4">
                <TabsList data-task-form-tabs className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">{safeTranslate(t, 'common.basic', { defaultValue: 'Básico' })}</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                </TabsList>
              </div>
              <div className="px-6">
            <TabsContent value="basic" className="mt-4">
              <TaskForm
                form={form as any}
                phases={phases}
                availableRubrics={availableRubrics}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                hideSubmitButton={true}
                sections={['basic']}
                eventId={eventId}
              />
            </TabsContent>
            <TabsContent value="html" className="mt-4 h-[calc(90vh-200px)]">
              <TaskForm
                form={form as any}
                phases={phases}
                availableRubrics={availableRubrics}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                hideSubmitButton={true}
                sections={['html']}
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
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? safeTranslate(t, 'common.loading')
              : editingTask
                ? safeTranslate(t, 'common.update')
                : safeTranslate(t, 'common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

