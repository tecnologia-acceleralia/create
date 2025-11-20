/**
 * Genera un color de fondo consistente basado en un string
 * @param str - String para generar el color
 * @returns Color hexadecimal
 */
function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const codePoint = str.codePointAt(i) ?? 0;
    hash = codePoint + ((hash << 5) - hash);
  }
  
  // Generar un color con buena saturación y luminosidad
  const hue = hash % 360;
  // Usar colores más vibrantes (saturación 60-80%, luminosidad 40-60%)
  const saturation = 60 + (Math.abs(hash) % 20);
  const lightness = 40 + (Math.abs(hash) % 20);
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Extrae las iniciales de un usuario
 * @param user - Objeto con información del usuario
 * @returns Iniciales (máximo 2 caracteres)
 */
function getInitials(user: { first_name?: string; last_name?: string; email?: string }): string {
  const firstName = user.first_name?.trim() ?? '';
  const lastName = user.last_name?.trim() ?? '';
  
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase();
  }
  
  if (lastName) {
    return lastName.substring(0, 2).toUpperCase();
  }
  
  // Si no hay nombre, usar email
  const email = user.email?.trim() ?? '';
  if (email) {
    const emailParts = email.split('@');
    const localPart = emailParts[0] ?? '';
    if (localPart.length >= 2) {
      return localPart.substring(0, 2).toUpperCase();
    }
    return localPart[0]?.toUpperCase() ?? 'U';
  }
  
  return 'U';
}

/**
 * Genera un SVG de avatar con iniciales localmente
 * @param initials - Iniciales a mostrar
 * @param backgroundColor - Color de fondo
 * @returns Data URL del SVG
 */
function generateAvatarSVG(initials: string, backgroundColor: string): string {
  const svg = `
    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="${backgroundColor}" rx="50"/>
      <text 
        x="50" 
        y="50" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="36" 
        font-weight="600" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="central"
      >${initials}</text>
    </svg>
  `.trim();
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Construye la URL del avatar de un usuario.
 * Prioridad: profile_image_url > generado automáticamente (localmente)
 * @param user - Objeto con información del usuario
 * @returns URL del avatar (profile_image_url o data URL del SVG generado)
 */
export function buildAvatarUrl(user: { first_name?: string; last_name?: string; email?: string; profile_image_url?: string | null }): string {
  // Si hay imagen de perfil, usarla directamente
  if (user.profile_image_url) {
    return user.profile_image_url;
  }

  // Generar iniciales
  const initials = getInitials(user);
  
  // Generar color de fondo basado en el nombre/email para consistencia
  const firstName = user.first_name?.trim() ?? '';
  const lastName = user.last_name?.trim() ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const seedSource = fullName || user.email?.trim() || 'user';
  const backgroundColor = generateColorFromString(seedSource.toLowerCase());
  
  // Generar SVG localmente
  return generateAvatarSVG(initials, backgroundColor);
}

