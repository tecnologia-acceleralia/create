import jwt from 'jsonwebtoken';
import { appConfig } from '../config/env.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

const SUPERADMIN_PREFIX = '/superadmin';

/**
 * Verifica si el usuario autenticado es superadmin sin requerir autenticación completa
 * Esto permite que superadmin acceda a rutas de tenant sin validar tenant
 */
async function isSuperAdminFromToken(req) {
  try {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return false;
    }

    const payload = jwt.verify(token, appConfig.jwtSecret);
    
    // Verificar en la BD si el usuario es superadmin
    // Esto funciona incluso si el token no tiene isSuperAdmin en el payload
    const { User } = getModels();
    const user = await User.findOne({
      where: { id: payload.sub },
      attributes: ['id', 'is_super_admin']
    });
    
    return Boolean(user?.is_super_admin);
  } catch {
    return false;
  }
}

function extractTenantHint(req) {
  const headers = req.headers;
  const host = headers.host ?? '';
  const path = req.originalUrl ?? '';

  const headerTenantId = headers['x-tenant-id'];
  const headerTenantSlug = headers['x-tenant-slug'];

  if (headerTenantId) {
    return { tenantId: Number(headerTenantId) };
  }

  if (headerTenantSlug) {
    return { slug: headerTenantSlug.toString().toLowerCase() };
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length > 0) {
    const firstSegment = segments[0].toLowerCase();
    if (!['api', 'superadmin', 'public'].includes(firstSegment)) {
      return { slug: firstSegment };
    }
  }

  if (host.includes('.')) {
    // Primero intentar buscar por custom_domain (host completo)
    const normalizedHost = host.toLowerCase().split(':')[0]; // Remover puerto si existe
    return { customDomain: normalizedHost };
  }

  return null;
}

export async function tenantMiddleware(req, res, next) {
  if (req.originalUrl.startsWith(SUPERADMIN_PREFIX)) {
    return next();
  }

  try {
    const hint = extractTenantHint(req);
    
    // Si no hay hint de tenant, verificar si es superadmin
    if (!hint) {
      const isSuperAdmin = await isSuperAdminFromToken(req);
      if (isSuperAdmin) {
        // Superadmin puede acceder sin tenant válido
        return next();
      }
      
      return res.status(400).json({
        success: false,
        message: 'Tenant requerido (cabeceras x-tenant-*, subdominio o dominio personalizado)'
      });
    }

    const { Tenant } = getModels();

    let tenant;
    if (hint.tenantId) {
      tenant = await Tenant.findByPk(hint.tenantId);
    } else if (hint.customDomain) {
      // Buscar por custom_domain primero
      tenant = await Tenant.findOne({
        where: {
          custom_domain: hint.customDomain
        }
      });
      // Si no se encuentra por custom_domain, intentar por subdominio (slug)
      if (!tenant) {
        const [subdomain] = hint.customDomain.split('.');
        if (subdomain && subdomain !== 'www') {
          tenant = await Tenant.findOne({
            where: {
              slug: subdomain.toLowerCase()
            }
          });
        }
      }
    } else if (hint.slug) {
      tenant = await Tenant.findOne({
        where: {
          slug: hint.slug
        }
      });
    }

    // Si el tenant no existe o no está activo/en prueba, verificar si es superadmin
    if (!tenant || !['active', 'trial'].includes(tenant.status)) {
      const isSuperAdmin = await isSuperAdminFromToken(req);
      if (isSuperAdmin) {
        // Superadmin puede acceder incluso si el tenant no existe o está inactivo
        // Establecer el tenant si existe (aunque esté inactivo) para que los controladores puedan usarlo
        if (tenant) {
          req.tenant = tenant;
        }
        return next();
      }
      
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado o inactivo'
      });
    }

    const now = new Date();
    const startDate = tenant.start_date ? new Date(`${tenant.start_date}T00:00:00Z`) : null;
    const endDate = tenant.end_date ? new Date(`${tenant.end_date}T23:59:59Z`) : null;

    // Si el tenant está fuera del periodo activo, verificar si es superadmin
    if (
      (startDate && now < startDate) ||
      (endDate && now > endDate)
    ) {
      const isSuperAdmin = await isSuperAdminFromToken(req);
      if (isSuperAdmin) {
        // Superadmin puede acceder incluso si el tenant está fuera del periodo activo
        req.tenant = tenant;
        return next();
      }
      
      return res.status(403).json({
        success: false,
        message: 'Tenant fuera de periodo activo'
      });
    }

    req.tenant = tenant;
    return next();
  } catch (error) {
    logger.error('Error en tenantMiddleware', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error validando tenant'
    });
  }
}

