/**
 * Utilidades para gestión de roles de usuario en tenants
 */

import { getModels } from '../models/index.js';
import { logger } from './logger.js';

/**
 * Asegura que un usuario tenga el rol participant asignado en un tenant
 * @param {number} userId - ID del usuario
 * @param {number} tenantId - ID del tenant
 * @param {object} options - Opciones adicionales (transaction, etc.)
 * @returns {Promise<boolean>} true si se asignó el rol, false si ya lo tenía
 */
export async function ensureParticipantRole(userId, tenantId, options = {}) {
  const { UserTenant, Role, UserTenantRole } = getModels();
  const transaction = options.transaction;

  try {
    // Obtener o crear la membresía del usuario en el tenant
    let membership = await UserTenant.findOne({
      where: { user_id: userId, tenant_id: tenantId },
      transaction
    });

    if (!membership) {
      membership = await UserTenant.create(
        {
          user_id: userId,
          tenant_id: tenantId,
          status: 'active'
        },
        { transaction }
      );
    }

    // Buscar el rol participant
    const participantRole = await Role.findOne({
      where: {
        tenant_id: tenantId,
        scope: 'participant'
      },
      transaction
    });

    if (!participantRole) {
      logger.warn('Rol participant no encontrado para el tenant', { tenantId });
      return false;
    }

    // Verificar si ya tiene el rol asignado
    const existingRole = await UserTenantRole.findOne({
      where: {
        user_tenant_id: membership.id,
        role_id: participantRole.id
      },
      transaction
    });

    if (existingRole) {
      return false; // Ya tiene el rol
    }

    // Asignar el rol
    await UserTenantRole.create(
      {
        tenant_id: tenantId,
        user_tenant_id: membership.id,
        role_id: participantRole.id
      },
      { transaction }
    );

    logger.info('Rol participant asignado al usuario', {
      userId,
      tenantId,
      membershipId: membership.id
    });

    return true;
  } catch (error) {
    logger.error('Error al asegurar rol participant', {
      userId,
      tenantId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Asegura que un usuario tenga el rol team_captain asignado en un tenant
 * También asegura que tenga el rol participant si no lo tiene
 * @param {number} userId - ID del usuario
 * @param {number} tenantId - ID del tenant
 * @param {object} options - Opciones adicionales (transaction, etc.)
 * @returns {Promise<boolean>} true si se asignó el rol, false si ya lo tenía
 */
export async function ensureTeamCaptainRole(userId, tenantId, options = {}) {
  const { UserTenant, Role, UserTenantRole } = getModels();
  const transaction = options.transaction;

  try {
    // Primero asegurar que tenga el rol participant
    await ensureParticipantRole(userId, tenantId, options);

    // Obtener la membresía del usuario en el tenant
    const membership = await UserTenant.findOne({
      where: { user_id: userId, tenant_id: tenantId },
      transaction
    });

    if (!membership) {
      throw new Error('Membresía no encontrada después de asegurar participant');
    }

    // Buscar el rol team_captain
    const teamCaptainRole = await Role.findOne({
      where: {
        tenant_id: tenantId,
        scope: 'team_captain'
      },
      transaction
    });

    if (!teamCaptainRole) {
      logger.warn('Rol team_captain no encontrado para el tenant', { tenantId });
      return false;
    }

    // Verificar si ya tiene el rol asignado
    const existingRole = await UserTenantRole.findOne({
      where: {
        user_tenant_id: membership.id,
        role_id: teamCaptainRole.id
      },
      transaction
    });

    if (existingRole) {
      return false; // Ya tiene el rol
    }

    // Asignar el rol
    await UserTenantRole.create(
      {
        tenant_id: tenantId,
        user_tenant_id: membership.id,
        role_id: teamCaptainRole.id
      },
      { transaction }
    );

    logger.info('Rol team_captain asignado al usuario', {
      userId,
      tenantId,
      membershipId: membership.id
    });

    return true;
  } catch (error) {
    logger.error('Error al asegurar rol team_captain', {
      userId,
      tenantId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Remueve el rol team_captain de un usuario en un tenant
 * No remueve el rol participant
 * @param {number} userId - ID del usuario
 * @param {number} tenantId - ID del tenant
 * @param {object} options - Opciones adicionales (transaction, etc.)
 * @returns {Promise<boolean>} true si se removió el rol, false si no lo tenía
 */
export async function removeTeamCaptainRole(userId, tenantId, options = {}) {
  const { UserTenant, Role, UserTenantRole } = getModels();
  const transaction = options.transaction;

  try {
    // Obtener la membresía del usuario en el tenant
    const membership = await UserTenant.findOne({
      where: { user_id: userId, tenant_id: tenantId },
      transaction
    });

    if (!membership) {
      return false; // No tiene membresía, no hay rol que remover
    }

    // Buscar el rol team_captain
    const teamCaptainRole = await Role.findOne({
      where: {
        tenant_id: tenantId,
        scope: 'team_captain'
      },
      transaction
    });

    if (!teamCaptainRole) {
      return false; // No existe el rol
    }

    // Buscar y remover el rol asignado
    const existingRole = await UserTenantRole.findOne({
      where: {
        user_tenant_id: membership.id,
        role_id: teamCaptainRole.id
      },
      transaction
    });

    if (!existingRole) {
      return false; // No tiene el rol
    }

    await existingRole.destroy({ transaction });

    logger.info('Rol team_captain removido del usuario', {
      userId,
      tenantId,
      membershipId: membership.id
    });

    return true;
  } catch (error) {
    logger.error('Error al remover rol team_captain', {
      userId,
      tenantId,
      error: error.message
    });
    throw error;
  }
}

