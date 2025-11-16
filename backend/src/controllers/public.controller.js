import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config/env.js';
import { getModels } from "../models/index.js";

/**
 * Verifica opcionalmente si hay un usuario autenticado y si es administrador
 * @param {import('express').Request} req
 * @param {number} tenantId - ID del tenant de la petición
 * @returns {{ isAdmin: boolean, user: any | null }}
 */
async function checkOptionalAuth(req, tenantId) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return { isAdmin: false, user: null };
  }

  try {
    const payload = jwt.verify(token, appConfig.jwtSecret);
    const { User, UserTenant, Role } = getModels();
    const user = await User.findOne({
      where: { id: payload.sub }
    });

    if (!user) {
      return { isAdmin: false, user: null };
    }

    const isSuperAdmin = Boolean(user.is_super_admin);
    
    let roleScopes = [];
    let membershipTenantId = null;
    
    if (payload.membershipId) {
      const membership = await UserTenant.findOne({
        where: {
          id: payload.membershipId,
          user_id: user.id,
          status: 'active'
        },
        include: [
          {
            model: Role,
            as: 'assignedRoles',
            attributes: ['scope'],
            through: { attributes: [] }
          }
        ]
      });

      if (membership) {
        roleScopes = membership.assignedRoles?.map(role => role.scope) ?? [];
        membershipTenantId = membership.tenant_id;
      }
    } else {
      roleScopes = payload.roleScopes ?? [];
      // Si hay tenantId en el payload, usarlo para verificar
      if (payload.tenantId) {
        membershipTenantId = payload.tenantId;
      }
    }

    // Verificar que el tenant del usuario coincida con el tenant de la petición
    // (excepto para super admins que pueden ver todos los tenants)
    if (!isSuperAdmin && membershipTenantId && Number(membershipTenantId) !== Number(tenantId)) {
      return { isAdmin: false, user: null };
    }

    const isAdmin = isSuperAdmin || roleScopes.includes('tenant_admin') || roleScopes.includes('organizer');
    
    return { isAdmin, user };
  } catch (error) {
    return { isAdmin: false, user: null };
  }
}

export class PublicController {
  static async getBranding(req, res) {
    const slug = req.query.slug;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'slug requerido' });
    }

    const { Tenant } = getModels();
    const tenant = await Tenant.findOne({
      where: { slug },
      attributes: [
        'id',
        'slug',
        'name',
        'logo_url',
        'primary_color',
        'secondary_color',
        'accent_color',
        'hero_content',
        'start_date',
        'end_date',
        'tenant_css',
        'website_url',
        'facebook_url',
        'instagram_url',
        'linkedin_url',
        'twitter_url',
        'youtube_url'
      ]
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    }

    const now = new Date();
    const startDate = tenant.start_date ? new Date(`${tenant.start_date}T00:00:00Z`) : null;
    const endDate = tenant.end_date ? new Date(`${tenant.end_date}T23:59:59Z`) : null;

    const isActiveNow =
      (!startDate || now >= startDate) &&
      (!endDate || now <= endDate);

    return res.json({
      success: true,
      data: {
        ...tenant.toJSON(),
        is_active_now: isActiveNow
      }
    });
  }

  static async listEvents(req, res) {
    const slug = req.query.slug;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'slug requerido' });
    }

    const { Tenant, Event } = getModels();
    const tenant = await Tenant.findOne({ where: { slug } });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    }

    const now = new Date();
    const events = await Event.findAll({
      where: {
        tenant_id: tenant.id,
        is_public: true,
        status: 'published',
        [Op.and]: [
          {
            [Op.or]: [
              { publish_start_at: { [Op.is]: null } },
              { publish_start_at: { [Op.lte]: now } }
            ]
          },
          {
            [Op.or]: [
              { publish_end_at: { [Op.is]: null } },
              { publish_end_at: { [Op.gte]: now } }
            ]
          }
        ]
      },
      order: [['start_date', 'ASC']],
      attributes: [
        'id',
        'name',
        'description',
        'description_html',
        'start_date',
        'end_date',
        'status',
        'video_url',
        'allow_open_registration',
        'registration_schema'
      ]
    });

    return res.json({ success: true, data: events });
  }

  static async listAllEvents(req, res) {
    const { Tenant, Event } = getModels();
    const now = new Date();

    const events = await Event.findAll({
      skipTenant: true,
      where: {
        is_public: true,
        status: 'published',
        [Op.and]: [
          {
            [Op.or]: [
              { publish_start_at: { [Op.is]: null } },
              { publish_start_at: { [Op.lte]: now } }
            ]
          },
          {
            [Op.or]: [
              { publish_end_at: { [Op.is]: null } },
              { publish_end_at: { [Op.gte]: now } }
            ]
          }
        ]
      },
      order: [['start_date', 'ASC']],
      attributes: ['id', 'name', 'description', 'start_date', 'end_date', 'status', 'video_url', 'tenant_id'],
      attributes: [
        'id',
        'name',
        'description',
        'start_date',
        'end_date',
        'status',
        'video_url',
        'allow_open_registration',
        'tenant_id'
      ],
      include: [
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['id', 'name', 'slug', 'logo_url', 'primary_color', 'secondary_color']
        }
      ]
    });

    const payload = events.map(event => {
      const plain = event.get({ plain: true });
      const tenant = plain.tenant
        ? {
            id: plain.tenant.id,
            name: plain.tenant.name,
            slug: plain.tenant.slug,
            logo_url: plain.tenant.logo_url,
            primary_color: plain.tenant.primary_color,
            secondary_color: plain.tenant.secondary_color
          }
        : null;

      return {
        id: plain.id,
        name: plain.name,
        description: plain.description,
        start_date: plain.start_date,
        end_date: plain.end_date,
        status: plain.status,
        video_url: plain.video_url,
        allow_open_registration: plain.allow_open_registration,
        tenant
      };
    });

    return res.json({ success: true, data: payload });
  }

static async listPhases(req, res) {
    const slug = req.query.slug;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'slug requerido' });
    }

    const { Tenant, Phase, Event } = getModels();
    const tenant = await Tenant.findOne({ where: { slug } });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    }

    // Verificar si el usuario es administrador (opcional)
    const { isAdmin } = await checkOptionalAuth(req, tenant.id);

    const now = new Date();
    
    // Si es administrador, no filtrar por fechas; si no, aplicar el filtro normal
    const whereClause = isAdmin
      ? { tenant_id: tenant.id }
      : {
          tenant_id: tenant.id,
          [Op.and]: [
            {
              [Op.or]: [
                { view_start_date: null },
                { view_start_date: { [Op.lte]: now } }
              ]
            },
            {
              [Op.or]: [
                { view_end_date: null },
                { view_end_date: { [Op.gte]: now } }
              ]
            }
          ]
        };

    const phases = await Phase.findAll({
      where: whereClause,
      include: [
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'status']
        }
      ],
      order: [
        ['event_id', 'ASC'],
        ['order_index', 'ASC'],
        ['name', 'ASC']
      ],
      attributes: ['id', 'name', 'description', 'order_index', 'event_id', 'view_start_date', 'view_end_date']
    });

    const payload = phases.map(phase => {
      const viewStart = phase.view_start_date ? new Date(phase.view_start_date) : null;
      const viewEnd = phase.view_end_date ? new Date(phase.view_end_date) : null;
      // Si es admin, siempre marcar como visible; si no, verificar fechas
      const isVisible = isAdmin
        ? true
        : ((!viewStart || viewStart <= now) && (!viewEnd || viewEnd >= now));

      return {
        id: phase.id,
        name: phase.name,
        description: phase.description ?? null,
        orderIndex: phase.order_index,
        eventId: phase.event_id,
        eventName: phase.event?.name ?? null,
        eventStatus: phase.event?.status ?? null,
        viewStartDate: phase.view_start_date,
        viewEndDate: phase.view_end_date,
        isVisibleNow: isVisible
      };
    });

    return res.json({ success: true, data: payload });
  }
}
