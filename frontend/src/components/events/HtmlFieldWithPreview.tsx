import { Textarea } from '@/components/ui/textarea';
import { AssetMarkerSelector } from './AssetMarkerSelector';
import type { UseFormRegisterReturn } from 'react-hook-form';

type HtmlFieldWithPreviewProps = {
  id: string;
  register: UseFormRegisterReturn;
  fieldName: string;
  rows?: number;
  placeholder?: string;
  eventId?: number;
};

export function HtmlFieldWithPreview({
  id,
  register,
  fieldName,
  rows = 10,
  placeholder,
  eventId
}: HtmlFieldWithPreviewProps) {
  const isFullSize = rows >= 20;

  return (
    <div className={`space-y-2 ${isFullSize ? 'h-full flex flex-col' : ''}`}>
      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        className={`${isFullSize ? 'flex-1 min-h-[calc(90vh-200px)] resize-none' : ''}`}
        {...register}
      />
      {eventId && (
        <AssetMarkerSelector eventId={eventId} />
      )}
    </div>
  );
}

