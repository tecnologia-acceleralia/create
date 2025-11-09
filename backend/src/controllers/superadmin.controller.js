import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import OpenAI from 'openai';
import { Op } from 'sequelize';
import { appConfig } from '../config/env.js';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import {
  decodeBase64Image,
  deleteObjectByUrl,
  uploadTenantLogo,
  validateSpacesConfiguration,
  probeSpacesConnection
} from '../services/tenant-assets.service.js';

const DEFAULT_ROLES = [
  { name: 'Administrador de Cliente', scope: 'tenant_admin' },
  { name: 'Organizador', scope: 'organizer' },
  { name: 'Evaluador', scope: 'evaluator' },
  { name: 'Participante', scope: 'participant' },
  { name: 'Capitán de equipo', scope: 'team_captain' }
];

const DEFAULT_TENANT_PRIMARY = '#0ea5e9';
const DEFAULT_TENANT_SECONDARY = '#1f2937';
const DEFAULT_TENANT_ACCENT = '#f97316';

const TENANT_SORT_MAP = {
  name: 'name',
  slug: 'slug',
  plan: 'plan_type',
  plan_type: 'plan_type',
  status: 'status',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

const USER_SORT_MAP = {
  email: 'email',
  first_name: 'first_name',
  last_name: 'last_name',
  status: 'status',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

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
    first_name: admin.first_name?.trim() || 'Admin',
    last_name: admin.last_name?.trim() || 'Tenant',
    password: admin.password ?? crypto.randomUUID(),
    profile_image_url: admin.profile_image_url ?? null,
    language: admin.language ?? 'es'
  };
}

function parseCsvParam(value) {
  if (!value) {
    return [];
  }

  const source = Array.isArray(value) ? value.join(',') : value;
  return source
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parsePageParam(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parsePageSizeParam(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  if (typeof max === 'number' && parsed > max) {
    return max;
  }
  return parsed;
}

function normalizeSort(sortField, sortOrder, map, defaultField) {
  const resolvedField = map[sortField] ?? map[defaultField] ?? defaultField;
  const normalizedOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
  return [resolvedField, normalizedOrder];
}

function mapGroupedCount(results, key = 'status') {
  if (!Array.isArray(results)) {
    return {};
  }

  return results.reduce((accumulator, entry) => {
    if (!entry || !Object.prototype.hasOwnProperty.call(entry, key)) {
      return accumulator;
    }
    const value = entry[key];
    const count = Number(entry.count ?? entry?.dataValues?.count ?? 0);
    accumulator[value] = count;
    return accumulator;
  }, {});
}

function buildPaginationMeta({ page, pageSize, totalItems }) {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages
  };
}

function coerceNullableInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function coerceNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function parseHeroContent(payload) {
  if (payload === null || payload === undefined || payload === '') {
    return null;
  }

  if (typeof payload === 'object') {
    return payload;
  }

  try {
    return JSON.parse(payload);
  } catch {
    throw new Error('El contenido del hero debe ser un JSON válido');
  }
}

function formatTenantResponse(tenant, extras = {}) {
  const json = tenant.toJSON();
  return {
    ...json,
    user_count: extras.userCount ?? 0
  };
}

function formatUserResponse(userInstance) {
  const user = userInstance.toJSON();
  const memberships = Array.isArray(user.tenantMemberships) ? user.tenantMemberships : [];

  return {
    ...user,
    tenantMemberships: memberships.map(membership => ({
      id: membership.id,
      status: membership.status,
      tenant: membership.tenant
        ? {
            id: membership.tenant.id,
            name: membership.tenant.name,
            slug: membership.tenant.slug,
            status: membership.tenant.status,
            plan_type: membership.tenant.plan_type
          }
        : null
    }))
  };
}

function buildHealthcheckStatus({ status, message, details }) {
  return {
    status,
    message,
    details
  };
}

export class SuperAdminController {
  static async overview(req, res) {
    const { Tenant, User } = getModels();

    try {
      const [tenantTotal, tenantActive, tenantsByStatusRaw, userTotal, usersByStatusRaw] = await Promise.all([
        Tenant.count(),
        Tenant.count({ where: { status: 'active' } }),
        Tenant.count({ group: ['status'] }),
        User.count(),
        User.count({ group: ['status'] })
      ]);

      return res.json({
        success: true,
        data: {
          tenants: {
            total: tenantTotal,
            active: tenantActive,
            byStatus: mapGroupedCount(tenantsByStatusRaw)
          },
          users: {
            total: userTotal,
            byStatus: mapGroupedCount(usersByStatusRaw)
          }
        }
      });
    } catch (error) {
      logger.error('Error obteniendo el resumen de superadmin', { error: error.message });
      return res.status(500).json({ success: false, message: 'No se pudo obtener el resumen' });
    }
  }

  static async createTenant(req, res) {
    const { Tenant, Role, User, UserTenant, UserTenantRole } = getModels();
    const payload = req.body;

    const slug = payload.slug?.trim().toLowerCase();
    const requestedSubdomain = payload.subdomain?.trim().toLowerCase();
    const subdomain = requestedSubdomain || slug;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Slug inválido' });
    }

    try {
      const existing = await Tenant.findOne({
        where: {
          [Op.or]: [{ slug }, { subdomain }]
        }
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Slug o subdominio ya están en uso' });
      }

      const heroContent = payload.hero_content ? parseHeroContent(payload.hero_content) : null;

      const tenant = await Tenant.create({
        slug,
        name: payload.name?.trim() ?? slug,
        subdomain,
        custom_domain: coerceNullableString(payload.custom_domain),
        logo_url: coerceNullableString(payload.logo_url),
        primary_color: coerceNullableString(payload.primary_color) ?? DEFAULT_TENANT_PRIMARY,
        secondary_color: coerceNullableString(payload.secondary_color) ?? DEFAULT_TENANT_SECONDARY,
        accent_color: coerceNullableString(payload.accent_color) ?? DEFAULT_TENANT_ACCENT,
        website_url: coerceNullableString(payload.website_url),
        facebook_url: coerceNullableString(payload.facebook_url),
        instagram_url: coerceNullableString(payload.instagram_url),
        linkedin_url: coerceNullableString(payload.linkedin_url),
        twitter_url: coerceNullableString(payload.twitter_url),
        youtube_url: coerceNullableString(payload.youtube_url),
        plan_type: payload.plan_type ?? 'free',
        status: payload.status ?? 'active',
        max_evaluators: coerceNullableInteger(payload.max_evaluators),
        max_participants: coerceNullableInteger(payload.max_participants),
        max_appointments_per_month: coerceNullableInteger(payload.max_appointments_per_month),
        start_date: payload.start_date ?? new Date().toISOString().slice(0, 10),
        end_date: payload.end_date ?? '2099-12-31',
        hero_content: heroContent,
        tenant_css: coerceNullableString(payload.tenant_css)
      });

      if (typeof payload.logo === 'string' && payload.logo.startsWith('data:')) {
        try {
          const { buffer, mimeType, extension } = decodeBase64Image(payload.logo);
          const uploadResult = await uploadTenantLogo({
            tenantSlug: slug,
            buffer,
            contentType: mimeType,
            extension
          });
          await tenant.update({ logo_url: uploadResult.url });
        } catch (uploadError) {
          logger.warn('No se pudo subir el logo durante la creación del tenant', {
            error: uploadError.message,
            slug
          });
        }
      }

      const roles = await Role.bulkCreate(buildRolePayloads(tenant.id));

      const adminPayload = ensureAdminPayload(payload.admin);
      const adminRole = roles.find(role => role.scope === 'tenant_admin');

      let adminUser = await User.scope('withPassword').findOne({ where: { email: adminPayload.email } });
      let provisionalPassword = null;

      if (!adminUser) {
        const hashedPassword = await bcrypt.hash(adminPayload.password, 10);

        adminUser = await User.create({
          email: adminPayload.email,
          password: hashedPassword,
          first_name: adminPayload.first_name,
          last_name: adminPayload.last_name,
          language: adminPayload.language,
          status: 'active',
          profile_image_url: adminPayload.profile_image_url,
          is_super_admin: false
        });

        provisionalPassword = adminPayload.password;
      }

      const [adminMembership] = await UserTenant.findOrCreate({
        where: {
          user_id: adminUser.id,
          tenant_id: tenant.id
        },
        defaults: {
          status: 'active'
        },
        skipTenant: true
      });

      if (adminRole) {
        await UserTenantRole.findOrCreate({
          where: {
            user_tenant_id: adminMembership.id,
            role_id: adminRole.id
          },
          defaults: {
            tenant_id: tenant.id
          },
          skipTenant: true
        });
      }

      logger.info('Tenant creado', { tenantId: tenant.id, slug: tenant.slug });

      return res.status(201).json({
        success: true,
        data: {
          tenant: formatTenantResponse(tenant, { userCount: 1 }),
          admin: {
            ...adminUser.toSafeJSON(),
            provisionalPassword
          }
        }
      });
    } catch (error) {
      logger.error('Error creando tenant', { error: error.message });
      return res.status(500).json({ success: false, message: 'Error creando tenant' });
    }
  }

  static async listTenants(req, res) {
    const { Tenant, UserTenant } = getModels();
    const {
      page: pageParam,
      pageSize: pageSizeParam,
      search,
      status,
      plan,
      sortField,
      sortOrder
    } = req.query;

    const page = parsePageParam(pageParam, 1);
    const pageSize = parsePageSizeParam(pageSizeParam, 20, 100);
    const offset = (page - 1) * pageSize;

    const where = {};
    const statuses = parseCsvParam(status);
    const plans = parseCsvParam(plan);

    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { slug: { [Op.like]: term } },
        { subdomain: { [Op.like]: term } },
        { custom_domain: { [Op.like]: term } }
      ];
    }

    if (statuses.length > 0) {
      where.status = { [Op.in]: statuses };
    }

    if (plans.length > 0) {
      where.plan_type = { [Op.in]: plans };
    }

    const [orderField, orderDirection] = normalizeSort(sortField, sortOrder, TENANT_SORT_MAP, 'created_at');

    try {
      const { rows, count } = await Tenant.findAndCountAll({
        where,
        limit: pageSize,
        offset,
        order: [[orderField, orderDirection]]
      });

      const tenantIds = rows.map(tenant => tenant.id);
      let userCountsByTenantId = {};

      if (tenantIds.length > 0) {
        const rawCounts = await UserTenant.count({
          where: { tenant_id: { [Op.in]: tenantIds } },
          group: ['tenant_id'],
          skipTenant: true
        });

        if (Array.isArray(rawCounts)) {
          userCountsByTenantId = rawCounts.reduce((accumulator, entry) => {
            const tenantId = Number(entry.tenant_id ?? entry?.dataValues?.tenant_id);
            const membershipCount = Number(entry.count ?? entry?.dataValues?.count ?? 0);
            if (!Number.isNaN(tenantId)) {
              accumulator[tenantId] = membershipCount;
            }
            return accumulator;
          }, {});
        }
      }

      return res.json({
        success: true,
        data: {
          items: rows.map(tenant => formatTenantResponse(tenant, { userCount: userCountsByTenantId[tenant.id] ?? 0 })),
          meta: buildPaginationMeta({
            page,
            pageSize,
            totalItems: typeof count === 'number' ? count : count.length
          }),
          appliedFilters: {
            search: search?.trim() ?? '',
            status: statuses,
            plan: plans
          },
          sort: {
            field: sortField ?? 'created_at',
            order: orderDirection.toLowerCase()
          }
        }
      });
    } catch (error) {
      logger.error('Error listando tenants', { error: error.message });
      return res.status(500).json({ success: false, message: 'No se pudieron obtener los tenants' });
    }
  }

  static async updateTenant(req, res) {
    const { Tenant } = getModels();
    const { tenantId } = req.params;
    const payload = req.body;

    try {
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
      }

      const updates = {};
      const allowedFields = [
        'name',
        'plan_type',
        'status',
        'primary_color',
        'secondary_color',
        'accent_color',
        'custom_domain',
        'subdomain',
        'website_url',
        'facebook_url',
        'instagram_url',
        'linkedin_url',
        'twitter_url',
        'youtube_url',
        'tenant_css',
        'start_date',
        'end_date'
      ];

      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
          const value = payload[field];
          if (['max_evaluators', 'max_participants', 'max_appointments_per_month'].includes(field)) {
            updates[field] = coerceNullableInteger(value);
          } else {
            updates[field] = value;
          }
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'max_evaluators')) {
        updates.max_evaluators = coerceNullableInteger(payload.max_evaluators);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'max_participants')) {
        updates.max_participants = coerceNullableInteger(payload.max_participants);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'max_appointments_per_month')) {
        updates.max_appointments_per_month = coerceNullableInteger(payload.max_appointments_per_month);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'hero_content')) {
        updates.hero_content = payload.hero_content ? parseHeroContent(payload.hero_content) : null;
      }

      const wantsToRemoveLogo =
        Object.prototype.hasOwnProperty.call(payload, 'logo') && payload.logo === null;

      let uploadResult = null;
      const previousLogoUrl = tenant.logo_url;

      if (typeof payload.logo === 'string' && payload.logo.startsWith('data:')) {
        try {
          const { buffer, mimeType, extension } = decodeBase64Image(payload.logo);
          uploadResult = await uploadTenantLogo({
            tenantSlug: tenant.slug,
            buffer,
            contentType: mimeType,
            extension
          });
          updates.logo_url = uploadResult.url;
        } catch (uploadError) {
          return res.status(400).json({ success: false, message: uploadError.message });
        }
      } else if (wantsToRemoveLogo) {
        updates.logo_url = null;
      } else if (Object.prototype.hasOwnProperty.call(payload, 'logo_url')) {
        updates.logo_url = coerceNullableString(payload.logo_url);
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'subdomain') && updates.subdomain) {
        updates.subdomain = updates.subdomain.trim().toLowerCase();
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'custom_domain') && updates.custom_domain) {
        updates.custom_domain = updates.custom_domain.trim().toLowerCase();
      }

      try {
        await tenant.update(updates);
      } catch (error) {
        if (uploadResult) {
          await deleteObjectByUrl(uploadResult.url).catch(cleanError => {
            logger.warn('No se pudo revertir el logo subido tras un fallo en la actualización', {
              error: cleanError.message,
              tenantId
            });
          });
        }
        throw error;
      }

      if (wantsToRemoveLogo && previousLogoUrl && !uploadResult) {
        await deleteObjectByUrl(previousLogoUrl).catch(error => {
          logger.warn('No se pudo eliminar el logo anterior del tenant', {
            error: error.message,
            tenantId
          });
        });
      }

      if (uploadResult && previousLogoUrl && previousLogoUrl !== uploadResult.url) {
        await deleteObjectByUrl(previousLogoUrl).catch(error => {
          logger.warn('No se pudo eliminar el logo anterior tras actualizarlo', {
            error: error.message,
            tenantId
          });
        });
      }

      await tenant.reload();

      return res.json({ success: true, data: formatTenantResponse(tenant) });
    } catch (error) {
      logger.error('Error actualizando tenant', { error: error.message, tenantId });
      return res.status(500).json({ success: false, message: 'Error actualizando tenant' });
    }
  }

  static async deleteTenant(req, res) {
    const { Tenant } = getModels();
    const { tenantId } = req.params;

    try {
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
      }

      await tenant.destroy();
      logger.info('Tenant eliminado', { tenantId: tenant.id, slug: tenant.slug });

      return res.json({ success: true });
    } catch (error) {
      logger.error('Error eliminando tenant', { error: error.message, tenantId });
      return res.status(500).json({ success: false, message: 'Error eliminando tenant' });
    }
  }

  static async listUsers(req, res) {
    const { User, UserTenant, Tenant } = getModels();
    const {
      page: pageParam,
      pageSize: pageSizeParam,
      search,
      status,
      tenantId: tenantIdParam,
      isSuperAdmin,
      sortField,
      sortOrder
    } = req.query;

    const page = parsePageParam(pageParam, 1);
    const pageSize = parsePageSizeParam(pageSizeParam, 20, 100);
    const offset = (page - 1) * pageSize;

    const where = {};
    const statuses = parseCsvParam(status);

    if (statuses.length > 0) {
      where.status = { [Op.in]: statuses };
    }

    if (typeof isSuperAdmin === 'string') {
      if (isSuperAdmin === 'true') {
        where.is_super_admin = true;
      } else if (isSuperAdmin === 'false') {
        where.is_super_admin = false;
      }
    }

    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { email: { [Op.like]: term } },
        { first_name: { [Op.like]: term } },
        { last_name: { [Op.like]: term } }
      ];
    }

    if (tenantIdParam) {
      const tenantId = Number.parseInt(tenantIdParam, 10);
      if (!Number.isNaN(tenantId)) {
        const memberships = await UserTenant.findAll({
          attributes: ['user_id'],
          where: { tenant_id: tenantId },
          skipTenant: true
        });
        const userIds = memberships.map(membership => membership.user_id);
        if (userIds.length === 0) {
          return res.json({
            success: true,
            data: {
              items: [],
              meta: buildPaginationMeta({ page, pageSize, totalItems: 0 }),
              appliedFilters: {
                search: search?.trim() ?? '',
                status: statuses,
                tenantId,
                isSuperAdmin: typeof where.is_super_admin === 'boolean' ? where.is_super_admin : undefined
              }
            }
          });
        }
        where.id = { [Op.in]: userIds };
      }
    }

    const [orderField, orderDirection] = normalizeSort(sortField, sortOrder, USER_SORT_MAP, 'created_at');

    try {
      const { rows, count } = await User.findAndCountAll({
        where,
        limit: pageSize,
        offset,
        order: [[orderField, orderDirection]],
        distinct: true,
        include: [
          {
            model: UserTenant,
            as: 'tenantMemberships',
            attributes: ['id', 'tenant_id', 'status'],
            include: [
              {
                model: Tenant,
                as: 'tenant',
                attributes: ['id', 'name', 'slug', 'status', 'plan_type']
              }
            ],
            separate: true,
            skipTenant: true
          }
        ]
      });

      return res.json({
        success: true,
        data: {
          items: rows.map(formatUserResponse),
          meta: buildPaginationMeta({
            page,
            pageSize,
            totalItems: typeof count === 'number' ? count : count.length
          }),
          appliedFilters: {
            search: search?.trim() ?? '',
            status: statuses,
            tenantId: tenantIdParam ? Number.parseInt(tenantIdParam, 10) : undefined,
            isSuperAdmin: typeof where.is_super_admin === 'boolean' ? where.is_super_admin : undefined
          },
          sort: {
            field: sortField ?? 'created_at',
            order: orderDirection.toLowerCase()
          }
        }
      });
    } catch (error) {
      logger.error('Error listando usuarios (superadmin)', { error: error.message });
      return res.status(500).json({ success: false, message: 'No se pudieron obtener los usuarios' });
    }
  }

  static async createUser(req, res) {
    const { User, UserTenant, Tenant } = getModels();
    const payload = req.body;

    try {
      const existing = await User.scope('withPassword').findOne({ where: { email: payload.email } });
      if (existing) {
        return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese email' });
      }

      const rawPassword = payload.password?.trim() || crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      const user = await User.create({
        email: payload.email,
        password: hashedPassword,
        first_name: payload.first_name,
        last_name: payload.last_name,
        language: payload.language ?? 'es',
        status: payload.status ?? 'active',
        is_super_admin: Boolean(payload.is_super_admin),
        profile_image_url: coerceNullableString(payload.profile_image_url)
      });

      const tenantIds = Array.isArray(payload.tenantIds)
        ? payload.tenantIds.map(id => Number.parseInt(id, 10)).filter(id => !Number.isNaN(id))
        : [];

      if (tenantIds.length > 0) {
        const tenants = await Tenant.findAll({
          where: { id: { [Op.in]: tenantIds } },
          attributes: ['id']
        });
        const validTenantIds = tenants.map(tenant => tenant.id);

        await Promise.all(
          validTenantIds.map(id =>
            UserTenant.findOrCreate({
              where: { user_id: user.id, tenant_id: id },
              defaults: { status: 'active' },
              skipTenant: true
            })
          )
        );
      }

      const createdUser = await User.findByPk(user.id, {
        include: [
          {
            model: UserTenant,
            as: 'tenantMemberships',
            attributes: ['id', 'tenant_id', 'status'],
            include: [
              {
                model: Tenant,
                as: 'tenant',
                attributes: ['id', 'name', 'slug', 'status', 'plan_type']
              }
            ],
            separate: true,
            skipTenant: true
          }
        ]
      });

      return res.status(201).json({
        success: true,
        data: {
          user: formatUserResponse(createdUser),
          provisionalPassword: payload.password ? null : rawPassword
        }
      });
    } catch (error) {
      logger.error('Error creando usuario (superadmin)', { error: error.message });
      return res.status(500).json({ success: false, message: 'No se pudo crear el usuario' });
    }
  }

  static async updateUser(req, res) {
    const { User, UserTenant, Tenant } = getModels();
    const { userId } = req.params;
    const payload = req.body;

    try {
      const user = await User.scope('withPassword').findByPk(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      const updates = {};
      const allowedFields = ['email', 'first_name', 'last_name', 'language', 'status', 'is_super_admin', 'profile_image_url'];

      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
          if (field === 'is_super_admin') {
            updates[field] = Boolean(payload[field]);
          } else if (field === 'profile_image_url') {
            updates[field] = coerceNullableString(payload[field]);
          } else {
            updates[field] = payload[field];
          }
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'email')) {
        const existing = await User.findOne({
          where: { email: updates.email, id: { [Op.ne]: user.id } }
        });
        if (existing) {
          return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese email' });
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'password') && payload.password) {
        updates.password = await bcrypt.hash(payload.password, 10);
      }

      await user.update(updates);

      if (Array.isArray(payload.tenantIds)) {
        const desiredTenantIds = payload.tenantIds
          .map(id => Number.parseInt(id, 10))
          .filter(id => !Number.isNaN(id));

        const currentMemberships = await UserTenant.findAll({
          where: { user_id: user.id },
          attributes: ['id', 'tenant_id'],
          skipTenant: true
        });

        const currentTenantIds = currentMemberships.map(membership => membership.tenant_id);

        const toCreate = desiredTenantIds.filter(id => !currentTenantIds.includes(id));
        const toRemove = currentMemberships.filter(membership => !desiredTenantIds.includes(membership.tenant_id));

        if (toRemove.length > 0) {
          await UserTenant.destroy({
            where: { id: toRemove.map(membership => membership.id) },
            skipTenant: true
          });
        }

        if (toCreate.length > 0) {
          const validTenants = await Tenant.findAll({
            where: { id: { [Op.in]: toCreate } },
            attributes: ['id']
          });
          await Promise.all(
            validTenants.map(tenant =>
              UserTenant.create(
                {
                  user_id: user.id,
                  tenant_id: tenant.id,
                  status: 'active'
                },
                { skipTenant: true }
              )
            )
          );
        }
      }

      const updatedUser = await User.findByPk(user.id, {
        include: [
          {
            model: UserTenant,
            as: 'tenantMemberships',
            attributes: ['id', 'tenant_id', 'status'],
            include: [
              {
                model: Tenant,
                as: 'tenant',
                attributes: ['id', 'name', 'slug', 'status', 'plan_type']
              }
            ],
            separate: true,
            skipTenant: true
          }
        ]
      });

      return res.json({ success: true, data: formatUserResponse(updatedUser) });
    } catch (error) {
      logger.error('Error actualizando usuario (superadmin)', { error: error.message, userId });
      return res.status(500).json({ success: false, message: 'No se pudo actualizar el usuario' });
    }
  }

  static async deleteUser(req, res) {
    const { User, UserTenant } = getModels();
    const { userId } = req.params;

    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      await UserTenant.destroy({
        where: { user_id: user.id },
        skipTenant: true
      });

      await user.destroy();

      return res.json({ success: true });
    } catch (error) {
      logger.error('Error eliminando usuario (superadmin)', { error: error.message, userId });
      return res.status(500).json({ success: false, message: 'No se pudo eliminar el usuario' });
    }
  }

  static async healthcheck(req, res) {
    try {
      const mailersendStatus = SuperAdminController.checkMailersend();
      const openaiStatus = SuperAdminController.checkOpenAI();
      const spacesStatus = SuperAdminController.checkSpaces();

      return res.json({
        success: true,
        data: {
          mailersend: mailersendStatus,
          openai: openaiStatus,
          spaces: spacesStatus
        }
      });
    } catch (error) {
      logger.error('Error ejecutando healthcheck (superadmin)', { error: error.message });
      return res.status(500).json({ success: false, message: 'No se pudo obtener el estado de los servicios' });
    }
  }

  static async healthcheckServiceTest(req, res) {
    const { service } = req.params;

    try {
      let status;

      switch (service) {
        case 'mailersend':
          status = await SuperAdminController.testMailersend();
          break;
        case 'openai':
          status = await SuperAdminController.testOpenAI();
          break;
        case 'spaces':
          status = await SuperAdminController.testSpaces();
          break;
        default:
          return res.status(400).json({ success: false, message: 'Servicio no soportado' });
      }

      return res.json({
        success: true,
        data: {
          service,
          status
        }
      });
    } catch (error) {
      logger.error('Error ejecutando prueba de servicio (superadmin)', { error: error.message, service });
      return res.status(500).json({ success: false, message: 'No se pudo ejecutar la prueba del servicio' });
    }
  }

  static checkMailersend() {
    const { apiKey, senderEmail } = appConfig.mailersend;

    if (!apiKey) {
      return buildHealthcheckStatus({
        status: 'warning',
        message: 'MAILERSEND_API_KEY no configurada'
      });
    }

    if (!senderEmail) {
      return buildHealthcheckStatus({
        status: 'warning',
        message: 'MAILERSEND_SENDER_EMAIL no configurado'
      });
    }

    return buildHealthcheckStatus({
      status: 'ok',
      message: 'Mailersend configurado'
    });
  }

  static checkOpenAI() {
    if (!appConfig.openai.apiKey) {
      return buildHealthcheckStatus({
        status: 'warning',
        message: 'OPENAI_API_KEY no configurada'
      });
    }

    try {
      const client = new OpenAI({ apiKey: appConfig.openai.apiKey });
      const model = appConfig.openai.model;

      return buildHealthcheckStatus({
        status: 'ok',
        message: 'OpenAI configurado',
        details: {
          model
        }
      });
    } catch (error) {
      return buildHealthcheckStatus({
        status: 'error',
        message: 'Error inicializando el cliente de OpenAI',
        details: {
          error: error.message
        }
      });
    }
  }

  static checkSpaces() {
    const result = validateSpacesConfiguration();

    if (!result.configured) {
      return buildHealthcheckStatus({
        status: 'warning',
        message: result.message ?? 'Spaces no está configurado'
      });
    }

    return buildHealthcheckStatus({
      status: 'ok',
      message: 'Spaces configurado',
      details: {
        endpoint: result.endpoint,
        bucket: result.bucket
      }
    });
  }

  static async testMailersend() {
    const baseStatus = SuperAdminController.checkMailersend();
    if (baseStatus.status !== 'ok') {
      return baseStatus;
    }

    const { apiKey } = appConfig.mailersend;

    try {
      const response = await fetch('https://api.mailersend.com/v1/domains?page=1&limit=1', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const payload = await response.text();
        return buildHealthcheckStatus({
          status: 'error',
          message: `Mailersend respondió ${response.status}`,
          details: {
            status: response.status,
            body: payload?.slice(0, 500)
          }
        });
      }

      return buildHealthcheckStatus({
        status: 'ok',
        message: 'Mailersend respondió correctamente',
        details: {
          status: response.status
        }
      });
    } catch (error) {
      return buildHealthcheckStatus({
        status: 'error',
        message: 'No se pudo contactar a Mailersend',
        details: {
          error: error.message
        }
      });
    }
  }

  static async testOpenAI() {
    const baseStatus = SuperAdminController.checkOpenAI();
    if (baseStatus.status !== 'ok') {
      return baseStatus;
    }

    try {
      const client = new OpenAI({ apiKey: appConfig.openai.apiKey });
      const response = await client.models.list();

      return buildHealthcheckStatus({
        status: 'ok',
        message: 'OpenAI respondió correctamente',
        details: {
          total: response.data?.length ?? 0
        }
      });
    } catch (error) {
      return buildHealthcheckStatus({
        status: 'error',
        message: 'No se pudo contactar a OpenAI',
        details: {
          error: error.message
        }
      });
    }
  }

  static async testSpaces() {
    const baseStatus = SuperAdminController.checkSpaces();
    if (baseStatus.status !== 'ok') {
      return baseStatus;
    }

    try {
      const connection = await probeSpacesConnection();
      return buildHealthcheckStatus({
        status: 'ok',
        message: 'Spaces respondió correctamente',
        details: connection
      });
    } catch (error) {
      return buildHealthcheckStatus({
        status: 'error',
        message: 'No se pudo contactar a Spaces',
        details: {
          error: error.message
        }
      });
    }
  }
}

