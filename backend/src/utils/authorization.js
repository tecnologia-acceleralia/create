/**
 * Utilidades para autorización y verificación de permisos
 */

/**
 * Extrae los scopes de roles de un usuario
 * @param {any} user - Objeto usuario
 * @returns {string[]} Array de scopes de roles
 */
export function getRoleScopes(user) {
  const scopes = user?.roleScopes;
  if (!Array.isArray(scopes)) {
    return [];
  }
  return scopes;
}

/**
 * Verifica si el usuario es superadmin o tenant_admin
 * @param {import('express').Request} req - Request de Express
 * @returns {boolean} true si es superadmin o tenant_admin
 */
export function isTenantAdmin(req) {
  if (req.auth?.isSuperAdmin) {
    return true;
  }
  const roleScopes = getRoleScopes(req.user);
  return roleScopes.includes('tenant_admin');
}

/**
 * Verifica si el usuario es manager (tenant_admin u organizer)
 * @param {import('express').Request} req - Request de Express
 * @returns {boolean} true si es superadmin, tenant_admin u organizer
 */
export function isManager(req) {
  if (req.auth?.isSuperAdmin) {
    return true;
  }
  const roleScopes = getRoleScopes(req.user);
  return roleScopes.some(scope => scope === 'tenant_admin' || scope === 'organizer');
}

/**
 * Verifica si el usuario es reviewer (tenant_admin, organizer o evaluator)
 * @param {import('express').Request} req - Request de Express
 * @returns {boolean} true si es superadmin, tenant_admin, organizer o evaluator
 */
export function isReviewer(req) {
  if (req.auth?.isSuperAdmin) {
    return true;
  }
  const roleScopes = getRoleScopes(req.user);
  return roleScopes.some(scope => ['tenant_admin', 'organizer', 'evaluator'].includes(scope));
}

/**
 * Verifica si el usuario puede editar un proyecto
 * @param {any} user - Objeto usuario
 * @param {any} team - Objeto equipo
 * @returns {boolean} true si puede editar
 */
export function canEditProject(user, team) {
  if (!user || !team) return false;
  
  const roleScopes = getRoleScopes(user);

  // Administradores y organizadores siempre pueden editar
  if (roleScopes.includes('tenant_admin') || roleScopes.includes('organizer')) return true;

  // Verificar si el usuario es el capitán del equipo
  const isCaptain = team.captain_id != null && user.id != null 
    ? Number(team.captain_id) === Number(user.id)
    : false;

  // Si el usuario es capitán del equipo, puede editar (incluso sin scopes asignados)
  // Ser capitán es una condición suficiente para editar el proyecto del equipo
  if (isCaptain) {
    return true;
  }

  // Si tiene scope team_captain o participant pero no es capitán, no puede editar
  // Solo los capitanes pueden editar proyectos
  return false;
}

/**
 * Verifica si el usuario puede ver un proyecto
 * @param {any} user - Objeto usuario
 * @param {any} team - Objeto equipo
 * @returns {boolean} true si puede ver
 */
export function canViewProject(user, team) {
  const roleScopes = getRoleScopes(user);
  if (!roleScopes.length) return false;

  if (roleScopes.some(scope => ['tenant_admin', 'organizer', 'evaluator'].includes(scope))) {
    return true;
  }

  if (roleScopes.some(scope => scope === 'team_captain' || scope === 'participant')) {
    if (team.captain_id === user.id) return true;
    return team.members?.some(member => member.user_id === user.id);
  }
  return false;
}

/**
 * Verifica si el usuario puede gestionar un equipo
 * @param {import('express').Request} req - Request de Express
 * @param {any} team - Objeto equipo
 * @returns {boolean} true si puede gestionar
 */
export function canManageTeam(req, team) {
  if (req.auth?.isSuperAdmin) {
    return true;
  }
  if (isTenantAdmin(req)) {
    return true;
  }
  return team.captain_id === req.user.id;
}

