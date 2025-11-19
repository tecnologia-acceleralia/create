import type { ReactNode, FormEventHandler } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SuperAdminToolbar } from '@/components/superadmin';

type FilterCardProps = {
  title: string;
  children: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onReset?: () => void;
  className?: string;
  applyLabel?: string;
  resetLabel?: string;
};

export function FilterCard({
  title,
  children,
  onSubmit,
  onReset,
  className,
  applyLabel,
  resetLabel
}: FilterCardProps) {
  const { t } = useTranslation();

  const defaultApplyLabel = applyLabel ?? t('common.applyFilters', { defaultValue: 'Aplicar filtros' });
  const defaultResetLabel = resetLabel ?? t('common.resetFilters', { defaultValue: 'Resetear filtros' });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <SuperAdminToolbar
            start={children}
            end={
              <>
                <Button
                  type="submit"
                  variant="outline"
                  size="icon"
                  aria-label={defaultApplyLabel}
                  title={defaultApplyLabel}
                >
                  <Filter className="h-4 w-4" aria-hidden />
                </Button>
                {onReset ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onReset}
                    aria-label={defaultResetLabel}
                    title={defaultResetLabel}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </>
            }
          />
        </form>
      </CardContent>
    </Card>
  );
}

