import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { HtmlPreviewDialog } from './HtmlPreviewDialog';
import { AssetMarkerSelector } from './AssetMarkerSelector';
import type { UseFormRegisterReturn, UseFormWatch } from 'react-hook-form';

type HtmlFieldWithPreviewProps = {
  id: string;
  register: UseFormRegisterReturn;
  watch: UseFormWatch<any>;
  fieldName: string;
  rows?: number;
  placeholder?: string;
  previewTitle?: string;
  eventId?: number;
};

export function HtmlFieldWithPreview({
  id,
  register,
  watch,
  fieldName,
  rows = 10,
  placeholder,
  previewTitle,
  eventId
}: HtmlFieldWithPreviewProps) {
  const { t } = useTranslation();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const htmlContent = watch(fieldName) || '';
  const isFullSize = rows >= 20;

  const handlePreview = () => {
    setIsPreviewOpen(true);
  };

  return (
    <div className={`space-y-2 ${isFullSize ? 'h-full flex flex-col' : ''}`}>
      <div className={`flex gap-2 ${isFullSize ? 'flex-1 flex-col' : ''}`}>
        <Textarea
          id={id}
          rows={rows}
          placeholder={placeholder}
          className={`flex-1 ${isFullSize ? 'min-h-[calc(90vh-200px)] resize-none' : ''}`}
          {...register}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handlePreview}
          className={`shrink-0 ${isFullSize ? 'self-start' : ''}`}
          title={t('events.previewHtml')}
          aria-label={t('events.previewHtml')}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {eventId && (
        <AssetMarkerSelector eventId={eventId} />
      )}
      <HtmlPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        htmlContent={htmlContent}
        title={previewTitle}
      />
    </div>
  );
}

