import type { Location } from "react-router";

/**
 * Determina si una fase está activa comparando la URL actual con el target
 */
export function isActivePhase(target: string, location: Location): boolean {
  if (!target) {
    return false;
  }

  try {
    const url = new URL(target, window.location.origin);
    const path = url.pathname;
    const searchParams = url.searchParams;
    const phaseId = searchParams.get('phase');
    
    // Si hay un phaseId, comparar por fase
    // Las rutas /dashboard/events/:eventId y /dashboard/events/:eventId/view son equivalentes
    if (phaseId) {
      const currentPhaseId = new URLSearchParams(location.search).get('phase');
      if (currentPhaseId !== phaseId) {
        return false;
      }
      
      // Verificar que estamos en una ruta válida del evento
      const currentPath = location.pathname;
      const isTargetAdminPath = path.includes(`/events/`) && !path.includes('/view') && !path.includes('/home') && !path.includes('/team') && !path.includes('/tasks/');
      const isTargetParticipantPath = path.includes(`/events/`) && path.includes('/view');
      const isCurrentAdminPath = currentPath.includes(`/events/`) && !currentPath.includes('/view') && !currentPath.includes('/home') && !currentPath.includes('/team') && !currentPath.includes('/tasks/');
      const isCurrentParticipantPath = currentPath.includes(`/events/`) && currentPath.includes('/view');
      
      // Si el target es ruta admin, aceptar si estamos en ruta admin
      if (isTargetAdminPath && isCurrentAdminPath) return true;
      // Si el target es ruta participante, aceptar si estamos en ruta participante
      if (isTargetParticipantPath && isCurrentParticipantPath) return true;
      
      return false;
    }
    
    // Si no hay phaseId, comparar path exacto
    return location.pathname === path;
  } catch (error) {
    return false;
  }
}

