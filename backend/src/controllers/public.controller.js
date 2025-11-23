import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config/env.js';
import { getModels } from "../models/index.js";
import { resolveAssetMarkers, resolveYouTubeUrls } from '../services/content.service.js';
import { sanitizeHtmlContent } from '../utils/html-sanitizer.js';

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
        'youtube_url',
        'registration_schema'
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

    // Verificar que el tenant esté activo o en prueba
    if (!['active', 'trial'].includes(tenant.status)) {
      return res.json({ success: true, data: [] });
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

    // Asegurar que las fechas se serialicen correctamente y resolver marcadores
    const payload = await Promise.all(events.map(async (event) => {
      // Obtener description_html directamente del modelo (usa el getter)
      const descriptionHtml = event.description_html;
      const eventJson = event.toJSON();
      
      // Resolver marcadores de assets en description_html antes de devolver
      if (descriptionHtml) {
        // Procesar description_html: puede ser string o objeto multiidioma
        // Usar el valor del getter del modelo en lugar del JSON serializado
        let processedHtml = descriptionHtml;
        
        // Si es objeto multiidioma, procesar cada idioma por separado
        if (typeof processedHtml === 'object' && processedHtml !== null && !Array.isArray(processedHtml)) {
          const processed = {};
          for (const [lang, content] of Object.entries(processedHtml)) {
            if (content && typeof content === 'string') {
              // Si el contenido parece ser JSON escapado (doble serialización), parsearlo recursivamente
              let langHtml = content;
              
              // Intentar parsear múltiples veces si es necesario (hasta 3 niveles de anidación)
              for (let i = 0; i < 3; i++) {
                if (langHtml.trim().startsWith('{') && (langHtml.includes('"es"') || langHtml.includes('"ca"') || langHtml.includes('"en"'))) {
                  try {
                    const parsed = JSON.parse(langHtml);
                    // Si el parseado es un objeto multiidioma, tomar el idioma actual
                    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                      const extracted = parsed[lang] || parsed.es;
                      if (extracted && typeof extracted === 'string') {
                        langHtml = extracted;
                        continue; // Intentar parsear de nuevo si sigue siendo JSON
                      } else {
                        break; // Si no es string, usar el objeto parseado directamente
                      }
                    } else if (typeof parsed === 'string') {
                      langHtml = parsed;
                      continue; // Intentar parsear de nuevo si sigue siendo JSON
                    } else {
                      break; // Si no es string ni objeto, usar el parseado
                    }
                  } catch (e) {
                    // Si falla el parse, usar el contenido actual
                    break;
                  }
                } else {
                  // Si no parece JSON, usar el contenido tal cual
                  break;
                }
              }
              
              // Resolver marcadores de assets
              langHtml = await resolveAssetMarkers(langHtml, event.id, tenant.id);
              // Resolver URLs de YouTube
              langHtml = resolveYouTubeUrls(langHtml);
              // Sanitizar antes de enviar al frontend
              langHtml = sanitizeHtmlContent(langHtml);
              if (langHtml) {
                processed[lang] = langHtml;
              }
            } else {
              processed[lang] = content;
            }
          }
          eventJson.description_html = Object.keys(processed).length > 0 ? processed : null;
        } else if (typeof processedHtml === 'string') {
          // Si es string, procesar directamente
          processedHtml = await resolveAssetMarkers(processedHtml, event.id, tenant.id);
          processedHtml = resolveYouTubeUrls(processedHtml);
          // Sanitizar antes de enviar al frontend
          eventJson.description_html = sanitizeHtmlContent(processedHtml);
        }
      }
      
      // Convertir fechas a ISO string si existen
      if (eventJson.start_date) {
        if (eventJson.start_date instanceof Date) {
          eventJson.start_date = eventJson.start_date.toISOString();
        } else if (typeof eventJson.start_date === 'string' && eventJson.start_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Si es un string en formato YYYY-MM-DD, agregar hora para convertirlo a ISO
          eventJson.start_date = `${eventJson.start_date}T00:00:00.000Z`;
        }
      }
      if (eventJson.end_date) {
        if (eventJson.end_date instanceof Date) {
          eventJson.end_date = eventJson.end_date.toISOString();
        } else if (typeof eventJson.end_date === 'string' && eventJson.end_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Si es un string en formato YYYY-MM-DD, agregar hora para convertirlo a ISO
          eventJson.end_date = `${eventJson.end_date}T23:59:59.999Z`;
        }
      }
      return eventJson;
    }));

    return res.json({ success: true, data: payload });
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
          attributes: ['id', 'name', 'slug', 'logo_url', 'primary_color', 'secondary_color', 'status']
        }
      ]
    });

    // Filtrar eventos de tenants activos o en prueba
    const payload = events
      .filter(event => {
        const plain = event.get({ plain: true });
        return plain.tenant && ['active', 'trial'].includes(plain.tenant.status);
      })
      .map(event => {
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

    // Verificar que el tenant esté activo o en prueba
    if (!['active', 'trial'].includes(tenant.status)) {
      return res.json({ success: true, data: [] });
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
