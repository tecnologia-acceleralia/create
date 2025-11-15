import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';

type HtmlPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  htmlContent: string;
  title?: string;
};

export function HtmlPreviewDialog({ open, onOpenChange, htmlContent, title }: HtmlPreviewDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || t('events.htmlPreview')}</DialogTitle>
          <DialogDescription>{t('events.htmlPreviewDescription')}</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {htmlContent ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('events.htmlPreviewEmpty')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

