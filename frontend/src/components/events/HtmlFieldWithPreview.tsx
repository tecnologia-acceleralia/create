import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { RichTextEditor } from './RichTextEditor';

type HtmlFieldWithPreviewProps<T extends FieldValues> = {
  id: string;
  control: Control<T>;
  fieldName: FieldPath<T>;
  rows?: number;
  placeholder?: string;
  eventId?: number;
};

export function HtmlFieldWithPreview<T extends FieldValues>({
  id,
  control,
  fieldName,
  rows = 10,
  placeholder,
  eventId
}: HtmlFieldWithPreviewProps<T>) {
  const isFullSize = rows >= 20;
  const minHeight = isFullSize ? 'calc(90vh - 200px)' : `${rows * 24}px`;

  return (
    <Controller
      name={fieldName}
      control={control}
      render={({ field }) => (
        <RichTextEditor
          id={id}
          value={field.value || ''}
          onChange={field.onChange}
          placeholder={placeholder}
          minHeight={minHeight}
          className={isFullSize ? 'h-full flex-1' : ''}
          eventId={eventId}
        />
      )}
    />
  );
}

