import { forwardRef } from 'react';
import { PasswordInput } from './PasswordInput';
import { PasswordGeneratorButton } from './PasswordGeneratorButton';
import { cn } from '@/utils/cn';
import type { InputHTMLAttributes } from 'react';

type PasswordFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
  showGenerator?: boolean;
  onPasswordGenerated?: (password: string) => void;
  generatorAriaLabel?: string;
};

/**
 * Componente reutilizable para campos de contraseña que incluye:
 * - Input de contraseña con botón para mostrar/ocultar (ojo)
 * - Botón opcional para generar contraseña aleatoria (dados)
 * 
 * Compatible con react-hook-form mediante forwardRef
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, showGenerator = false, onPasswordGenerated, generatorAriaLabel, ...props }, ref) => {
    if (showGenerator && onPasswordGenerated) {
      // Extraer clases de error del className si existen
      const hasError = className?.includes('border-destructive');
      const containerClassName = hasError ? 'flex w-full gap-2' : 'flex w-full gap-2';
      
      return (
        <div className={containerClassName}>
          <PasswordInput
            {...props}
            ref={ref}
            className={cn('flex-1', className)}
          />
          <PasswordGeneratorButton
            onGenerate={onPasswordGenerated}
            aria-label={generatorAriaLabel}
          />
        </div>
      );
    }

    return (
      <PasswordInput
        {...props}
        ref={ref}
        className={className}
      />
    );
  }
);

PasswordField.displayName = 'PasswordField';

