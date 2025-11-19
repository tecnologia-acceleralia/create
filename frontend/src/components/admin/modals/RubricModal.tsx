import { useTranslation } from 'react-i18next';
import { UseFormReturn, UseFieldArrayReturn } from 'react-hook-form';
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
import { RubricForm, type RubricFormValues } from '@/components/events/forms';
import type { Phase, PhaseRubric } from '@/services/events';

type RubricModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<RubricFormValues>;
  onSubmit: (values: RubricFormValues) => void;
  onCancelEdit: () => void;
  isSubmitting: boolean;
  editingRubric: PhaseRubric | null;
  phases: Phase[];
  criteriaFields: UseFieldArrayReturn<RubricFormValues, 'criteria', 'fieldId'>['fields'];
  onAddCriterion: () => void;
  onRemoveCriterion: (index: number) => void;
};

export function RubricModal({
  open,
  onOpenChange,
  form,
  onSubmit,
  onCancelEdit,
  isSubmitting,
  editingRubric,
  phases,
  criteriaFields,
  onAddCriterion,
  onRemoveCriterion
}: RubricModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            {editingRubric ? t('events.editRubric') : t('events.createRubric')}
          </DialogTitle>
          <DialogDescription>
            {editingRubric
              ? t('events.editRubricDescription', { defaultValue: 'Modifica los detalles de la rúbrica' })
              : t('events.createRubricDescription', { defaultValue: 'Crea una nueva rúbrica de evaluación' })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="basic" className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="sticky top-0 z-10 bg-background border-b border-border px-6 pb-4 pt-4">
                <TabsList data-rubric-form-tabs className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">{t('common.basic', { defaultValue: 'Básico' })}</TabsTrigger>
                  <TabsTrigger value="criteria">{t('events.rubricCriteriaTitle', { defaultValue: 'Criterios' })}</TabsTrigger>
                </TabsList>
              </div>
              <div className="px-6">
            <TabsContent value="basic" className="mt-4">
              <RubricForm
                form={form}
                phases={phases}
                criteriaFields={criteriaFields}
                onAddCriterion={onAddCriterion}
                onRemoveCriterion={onRemoveCriterion}
                onSubmit={onSubmit}
                onCancelEdit={onCancelEdit}
                isSubmitting={isSubmitting}
                isEditing={Boolean(editingRubric)}
                hideSubmitButton={true}
                sections={['basic']}
              />
            </TabsContent>
            <TabsContent value="criteria" className="mt-4">
              <RubricForm
                form={form}
                phases={phases}
                criteriaFields={criteriaFields}
                onAddCriterion={onAddCriterion}
                onRemoveCriterion={onRemoveCriterion}
                onSubmit={onSubmit}
                onCancelEdit={onCancelEdit}
                isSubmitting={isSubmitting}
                isEditing={Boolean(editingRubric)}
                hideSubmitButton={true}
                sections={['criteria']}
              />
            </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t('common.loading')
              : editingRubric
                ? t('common.update')
                : t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

