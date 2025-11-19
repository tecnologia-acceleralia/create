import { useState, type ReactNode } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

type ExpandableSectionProps = {
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  contentClassName?: string;
  header?: ReactNode;
  onToggle?: (expanded: boolean) => void;
};

export function ExpandableSection({
  children,
  defaultExpanded = false,
  className,
  contentClassName,
  header,
  onToggle
}: ExpandableSectionProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {header && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1">{header}</div>
          <button
            onClick={handleToggle}
            className="mt-0.5 flex-shrink-0 rounded-md border border-border/60 bg-background p-1.5 text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--tenant-primary)]"
            aria-label={isExpanded ? t('common.collapse') : t('common.expand')}
          >
            {isExpanded ? (
              <Minus className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
      {isExpanded && <div className={contentClassName}>{children}</div>}
    </div>
  );
}

