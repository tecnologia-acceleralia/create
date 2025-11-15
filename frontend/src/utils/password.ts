/**
 * Genera una contraseña aleatoria de 12 caracteres con letras (mayúsculas y minúsculas),
 * números y símbolos.
 * @returns {string} Contraseña aleatoria de 12 caracteres
 */
export function generateRandomPassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  // Aseguramos que tenga al menos un carácter de cada tipo
  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Completamos hasta 12 caracteres con caracteres aleatorios
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Mezclamos los caracteres para que no estén siempre en el mismo orden
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

