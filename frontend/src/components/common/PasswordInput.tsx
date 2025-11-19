import { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import type { InputHTMLAttributes } from 'react';

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const { t } = useTranslation();
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative">
        <Input
          {...props}
          type={showPassword ? 'text' : 'password'}
          className={cn('pr-10', className)}
          ref={ref}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? t('common.hidePassword', { defaultValue: 'Ocultar contraseña' }) : t('common.showPassword', { defaultValue: 'Mostrar contraseña' })}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </Button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

