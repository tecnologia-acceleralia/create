import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

type FileUploadListProps = {
  files: File[];
  onRemove: (index: number) => void;
  className?: string;
};

export function FileUploadList({ files, onRemove, className }: FileUploadListProps) {
  const { t } = useTranslation();

  if (files.length === 0) {
    return null;
  }

  return (
    <ul className={`mt-2 space-y-2 rounded-md border border-dashed border-border/60 p-3 text-sm ${className ?? ''}`}>
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-medium">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || t('submissions.unknownType')}
            </span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(index)}>
            {t('common.remove')}
          </Button>
        </li>
      ))}
    </ul>
  );
}

