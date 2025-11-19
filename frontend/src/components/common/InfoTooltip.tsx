import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/utils/cn';

type InfoTooltipProps = {
  content: string;
  className?: string;
  iconClassName?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
};

export function InfoTooltip({ 
  content, 
  className,
  iconClassName,
  side = 'top',
  align = 'center'
}: Readonly<InfoTooltipProps>) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex items-center cursor-help', className)}>
            <Info className={cn('h-4 w-4 text-muted-foreground', iconClassName)} aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} align={align} className="max-w-xs">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

