import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { safeTranslate } from '@/utils/i18n-helpers';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

export interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  buttonLabel?: string;
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  showFileName?: boolean;
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, buttonLabel, buttonVariant = 'outline', buttonSize = 'default', accept, onChange, multiple, showFileName = true, ...props }, ref) => {
    const { t } = useTranslation();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [fileNames, setFileNames] = React.useState<string[]>([]);

    // Combinar refs
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const handleButtonClick = () => {
      inputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const names = Array.from(files).map(file => file.name);
        setFileNames(names);
      } else {
        setFileNames([]);
      }
      onChange?.(e);
    };

    const displayLabel = buttonLabel ?? safeTranslate(t, 'events.selectFile', { defaultValue: 'Seleccionar archivo' });

    return (
      <div className="relative">
        <input
          type="file"
          ref={inputRef}
          accept={accept}
          onChange={handleFileChange}
          multiple={multiple}
          className="sr-only"
          {...props}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={buttonVariant}
            size={buttonSize}
            onClick={handleButtonClick}
            className={cn('cursor-pointer', className)}
          >
            <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
            {displayLabel}
          </Button>
          {showFileName && fileNames.length > 0 && (
            <span className="text-sm text-muted-foreground truncate max-w-xs" title={fileNames.join(', ')}>
              {multiple && fileNames.length > 1 
                ? `${fileNames.length} ${safeTranslate(t, 'submissions.filesSelected', { defaultValue: 'archivos seleccionados' })}`
                : fileNames[0]}
            </span>
          )}
        </div>
      </div>
    );
  }
);

FileInput.displayName = 'FileInput';

export { FileInput };

