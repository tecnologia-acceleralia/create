import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDice } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/ui/button';
import { generateRandomPassword } from '@/utils/password';
import type { UseFormSetValue } from 'react-hook-form';

type PasswordGeneratorButtonProps = {
  onGenerate: (password: string) => void;
  className?: string;
  'aria-label'?: string;
};

export function PasswordGeneratorButton({ onGenerate, className, 'aria-label': ariaLabel }: PasswordGeneratorButtonProps) {
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
      aria-label={ariaLabel ?? 'Generar contraseña aleatoria'}
      title="Generar contraseña aleatoria"
    >
      <FontAwesomeIcon icon={faDice} className="h-4 w-4" aria-hidden />
    </Button>
  );
}

