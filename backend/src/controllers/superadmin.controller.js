import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

const DEFAULT_ROLES = [
  { name: 'Administrador de Cliente', scope: 'tenant_admin' },
  { name: 'Organizador', scope: 'organizer' },
  { name: 'Mentor', scope: 'mentor' },
  { name: 'Participante', scope: 'participant' },
  { name: 'Capitán de equipo', scope: 'team_captain' }
];

function buildRolePayloads(tenantId) {
  return DEFAULT_ROLES.map(role => ({
    tenant_id: tenantId,
    name: role.name,
    scope: role.scope
  }));
}

function ensureAdminPayload(admin = {}) {
  if (!admin.email) {
    throw new Error('Se requiere email para el administrador del tenant');
  }

  return {
    email: admin.email,
    first_name: admin.first_name ?? 'Admin',
    last_name: admin.last_name ?? 'Tenant',
    password: admin.password ?? crypto.randomUUID()
  };
}

export class SuperAdminController {
  static async createTenant(req, res) {
    const { Tenant, Role, User } = getModels();

    const payload = req.body;
    const subdomain = payload.subdomain ?? payload.slug;

    try {
      const existing = await Tenant.findOne({ where: { slug: payload.slug } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Slug ya está en uso' });
      }

      const tenant = await Tenant.create({
        slug: payload.slug,
        name: payload.name,
        subdomain,
        plan_type: payload.plan_type ?? 'free',
        status: 'active',
        logo_url: payload.logo_url ?? null,
        primary_color: payload.primary_color ?? '#0ea5e9',
        secondary_color: payload.secondary_color ?? '#1f2937',
        accent_color: payload.accent_color ?? '#f97316'
      });

      const roles = await Role.bulkCreate(buildRolePayloads(tenant.id));

      const adminPayload = ensureAdminPayload(payload.admin);
      const adminRole = roles.find(role => role.scope === 'tenant_admin');

      const hashedPassword = await bcrypt.hash(adminPayload.password, 10);

      const adminUser = await User.create({
        tenant_id: tenant.id,
        role_id: adminRole.id,
        email: adminPayload.email,
        password: hashedPassword,
        first_name: adminPayload.first_name,
        last_name: adminPayload.last_name,
        language: payload.admin?.language ?? 'es'
      });

      logger.info('Tenant creado', { tenantId: tenant.id, slug: tenant.slug });

      return res.status(201).json({
        success: true,
        data: {
          tenant: tenant.toJSON(),
          admin: {
            ...adminUser.toSafeJSON(),
            provisionalPassword: adminPayload.password
          }
        }
      });
    } catch (error) {
      logger.error('Error creando tenant', { error: error.message });
      return res.status(500).json({ success: false, message: 'Error creando tenant' });
    }
  }

  static async listTenants(req, res) {
    const { Tenant } = getModels();
    const tenants = await Tenant.findAll({
      attributes: ['id', 'slug', 'name', 'status', 'plan_type', 'created_at']
    });
    return res.json({ success: true, data: tenants });
  }
}

