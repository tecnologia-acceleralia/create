import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

const SUPERADMIN_PREFIX = '/superadmin';

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

  if (path.startsWith('/tenant/')) {
    const [, , slug] = path.split('/');
    if (slug) {
      return { slug }; 
    }
  }

  if (host.includes('.')) {
    const [subdomain] = host.split('.');
    if (subdomain && subdomain !== 'www') {
      return { slug: subdomain.toLowerCase() };
    }
  }

  return null;
}

export async function tenantMiddleware(req, res, next) {
  if (req.originalUrl.startsWith(SUPERADMIN_PREFIX)) {
    return next();
  }

  try {
    const hint = extractTenantHint(req);
    if (!hint) {
      return res.status(400).json({
        success: false,
        message: 'Tenant requerido (cabeceras x-tenant-* o subdominio)'
      });
    }

    const { Tenant } = getModels();

    const tenant = hint.tenantId
      ? await Tenant.findByPk(hint.tenantId)
      : await Tenant.findOne({
          where: {
            slug: hint.slug
          }
        });

    if (!tenant || tenant.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado o inactivo'
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

