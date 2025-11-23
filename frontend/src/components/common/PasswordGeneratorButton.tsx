import { useTranslation } from 'react-i18next';
import { Dice5 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateRandomPassword } from '@/utils/password';
import { safeTranslate } from '@/utils/i18n-helpers';

type PasswordGeneratorButtonProps = {
  readonly onGenerate: (password: string) => void;
  readonly className?: string;
  readonly 'aria-label'?: string;
};

export function PasswordGeneratorButton({ onGenerate, className, 'aria-label': ariaLabel }: PasswordGeneratorButtonProps) {
  const { t } = useTranslation();
  const defaultAriaLabel = safeTranslate(t, 'register.generatePassword', { defaultValue: 'Generar contraseña aleatoria' });
  const defaultTitle = safeTranslate(t, 'register.generatePassword', { defaultValue: 'Generar contraseña aleatoria' });

  const handleClick = () => {
    const password = generateRandomPassword();
    onGenerate(password);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      className={className}
      aria-label={ariaLabel ?? defaultAriaLabel}
      title={defaultTitle}
    >
      <Dice5 className="h-4 w-4" aria-hidden />
    </Button>
  );
}

