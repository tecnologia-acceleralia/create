import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { toInt, toDateOrNull } from '../utils/parsers.js';
import { findEventOr404 } from '../utils/finders.js';
import { successResponse, badRequestResponse, notFoundResponse, conflictResponse } from '../utils/response.js';
import { resolveAssetMarkers, resolveYouTubeUrls } from '../services/content.service.js';
import { copyEventAsset } from '../services/tenant-assets.service.js';

/**
 * Normaliza un campo multiidioma (name, title)
 * Convierte strings a objetos JSON con estructura { "es": "...", "ca": "...", "en": "..." }
 */
function normalizeMultilingualField(value, fieldName = 'campo') {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    return { es: value.trim() };
  }
  if (value && typeof value === 'object') {
    // Asegurar que siempre tenga al menos español
    const normalized = { ...value };
    if (!normalized.es) {
      normalized.es = '';
    }
    return normalized;
  }
  return value;
}

/**
 * Normaliza un campo multiidioma de texto (description)
 */
function normalizeMultilingualText(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim() ? { es: value.trim() } : null;
  }
  if (value && typeof value === 'object') {
    const cleaned = {};
    for (const [lang, val] of Object.entries(value)) {
      if (val && typeof val === 'string' && val.trim()) {
        cleaned[lang] = val.trim();
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  return value;
}

/**
 * Normaliza un campo multiidioma HTML (description_html, intro_html)
 * Guarda el HTML tal cual sin sanitizar
 */
function normalizeMultilingualHtml(value) {
  // Guardar el HTML tal cual sin sanitizar
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? { es: trimmed } : null;
  }
  
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const cleaned = {};
    for (const [lang, val] of Object.entries(value)) {
      if (val && typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.length > 0) {
          cleaned[lang] = trimmed;
        }
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  
  return null;
}

function normalizeEventPayload(body) {
  const payload = { ...body };

  // Normalizar campos multiidioma (name, description, description_html)
  if (Object.hasOwn(payload, 'name')) {
    payload.name = normalizeMultilingualField(payload.name);
  }

  if (Object.hasOwn(payload, 'description')) {
    payload.description = normalizeMultilingualText(payload.description);
  }

  if (Object.hasOwn(payload, 'description_html')) {
    payload.description_html = normalizeMultilingualHtml(payload.description_html);
  }

  // Convertir fechas a objetos Date (Sequelize requiere Date para campos DATE)
  if (Object.hasOwn(payload, 'start_date')) {
    payload.start_date = toDateOrNull(payload.start_date);
    if (!payload.start_date) {
      const error = new Error('La fecha de inicio es obligatoria y debe ser válida');
      error.statusCode = 400;
      throw error;
    }
  }

  if (Object.hasOwn(payload, 'end_date')) {
    payload.end_date = toDateOrNull(payload.end_date);
    if (!payload.end_date) {
      const error = new Error('La fecha de fin es obligatoria y debe ser válida');
      error.statusCode = 400;
      throw error;
    }
  }

  if (Object.hasOwn(payload, 'video_url')) {
    if (!payload.video_url || (typeof payload.video_url === 'string' && payload.video_url.trim() === '')) {
      payload.video_url = null;
    } else if (typeof payload.video_url === 'string') {
      payload.video_url = payload.video_url.trim();
    }
  }

  if (Object.hasOwn(payload, 'publish_start_at')) {
    payload.publish_start_at = toDateOrNull(payload.publish_start_at);
  }

  if (Object.hasOwn(payload, 'publish_end_at')) {
    payload.publish_end_at = toDateOrNull(payload.publish_end_at);
  }

  if (payload.is_public === false) {
    payload.publish_start_at = null;
    payload.publish_end_at = null;
  }

  if (Object.hasOwn(payload, 'registration_schema')) {
    const rawSchema = payload.registration_schema;
    if (rawSchema === undefined) {
      delete payload.registration_schema;
    } else if (rawSchema === null || rawSchema === '') {
      payload.registration_schema = null;
    } else if (typeof rawSchema === 'string') {
      try {
        const parsed = JSON.parse(rawSchema);
        // Si el objeto parseado está vacío, establecer a null
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length === 0) {
          payload.registration_schema = null;
        } else {
          payload.registration_schema = parsed;
        }
      } catch (error) {
        const parseError = new Error('El esquema de registro debe ser un JSON válido');
        parseError.statusCode = 400;
        throw parseError;
      }
    } else if (typeof rawSchema === 'object' && rawSchema !== null) {
      // Si el objeto está vacío, establecer a null
      if (Object.keys(rawSchema).length === 0) {
        payload.registration_schema = null;
      } else {
        payload.registration_schema = rawSchema;
      }
    }
  }

  if (Object.hasOwn(payload, 'ai_evaluation_prompt')) {
    if (payload.ai_evaluation_prompt === undefined) {
      delete payload.ai_evaluation_prompt;
    } else if (payload.ai_evaluation_prompt === null || (typeof payload.ai_evaluation_prompt === 'string' && payload.ai_evaluation_prompt.trim() === '')) {
      payload.ai_evaluation_prompt = null;
    } else if (typeof payload.ai_evaluation_prompt === 'string') {
      payload.ai_evaluation_prompt = payload.ai_evaluation_prompt.trim();
    }
  }

  if (Object.hasOwn(payload, 'ai_evaluation_model')) {
    if (payload.ai_evaluation_model === undefined) {
      delete payload.ai_evaluation_model;
    } else if (payload.ai_evaluation_model === null || (typeof payload.ai_evaluation_model === 'string' && payload.ai_evaluation_model.trim() === '')) {
      payload.ai_evaluation_model = null;
    } else if (typeof payload.ai_evaluation_model === 'string') {
      payload.ai_evaluation_model = payload.ai_evaluation_model.trim();
    }
  }

  if (Object.hasOwn(payload, 'ai_evaluation_temperature')) {
    if (payload.ai_evaluation_temperature === undefined) {
      delete payload.ai_evaluation_temperature;
    } else if (payload.ai_evaluation_temperature === null || payload.ai_evaluation_temperature === '') {
      payload.ai_evaluation_temperature = null;
    } else {
      const temp = Number(payload.ai_evaluation_temperature);
      if (!Number.isNaN(temp)) {
        // Validar que esté en el rango 0-2
        if (temp < 0 || temp > 2) {
          const error = new Error('La temperatura debe estar entre 0 y 2');
          error.statusCode = 400;
          throw error;
        }
        payload.ai_evaluation_temperature = temp;
      } else {
        payload.ai_evaluation_temperature = null;
      }
    }
  }

  if (Object.hasOwn(payload, 'ai_evaluation_max_tokens')) {
    if (payload.ai_evaluation_max_tokens === undefined) {
      delete payload.ai_evaluation_max_tokens;
    } else if (payload.ai_evaluation_max_tokens === null || payload.ai_evaluation_max_tokens === '') {
      payload.ai_evaluation_max_tokens = null;
    } else {
      const maxTokens = Number(payload.ai_evaluation_max_tokens);
      if (!Number.isNaN(maxTokens) && maxTokens > 0) {
        payload.ai_evaluation_max_tokens = Math.floor(maxTokens);
      } else {
        payload.ai_evaluation_max_tokens = null;
      }
    }
  }

  if (Object.hasOwn(payload, 'ai_evaluation_top_p')) {
    if (payload.ai_evaluation_top_p === undefined) {
      delete payload.ai_evaluation_top_p;
    } else if (payload.ai_evaluation_top_p === null || payload.ai_evaluation_top_p === '') {
      payload.ai_evaluation_top_p = null;
    } else {
      const topP = Number(payload.ai_evaluation_top_p);
      if (!Number.isNaN(topP)) {
        // Validar que esté en el rango 0-1
        if (topP < 0 || topP > 1) {
          const error = new Error('Top-p debe estar entre 0 y 1');
          error.statusCode = 400;
          throw error;
        }
        payload.ai_evaluation_top_p = topP;
      } else {
        payload.ai_evaluation_top_p = null;
      }
    }
  }

  if (Object.hasOwn(payload, 'ai_evaluation_frequency_penalty')) {
    if (payload.ai_evaluation_frequency_penalty === undefined) {
      delete payload.ai_evaluation_frequency_penalty;
    } else if (payload.ai_evaluation_frequency_penalty === null || payload.ai_evaluation_frequency_penalty === '') {
      payload.ai_evaluation_frequency_penalty = null;
    } else {
      const freqPenalty = Number(payload.ai_evaluation_frequency_penalty);
      if (!Number.isNaN(freqPenalty)) {
        // Validar que esté en el rango -2.0 a 2.0
        if (freqPenalty < -2 || freqPenalty > 2) {
          const error = new Error('Frequency penalty debe estar entre -2.0 y 2.0');
          error.statusCode = 400;
          throw error;
        }
        payload.ai_evaluation_frequency_penalty = freqPenalty;
      } else {
        payload.ai_evaluation_frequency_penalty = null;
      }
    }
  }

  if (Object.hasOwn(payload, 'ai_evaluation_presence_penalty')) {
    if (payload.ai_evaluation_presence_penalty === undefined) {
      delete payload.ai_evaluation_presence_penalty;
    } else if (payload.ai_evaluation_presence_penalty === null || payload.ai_evaluation_presence_penalty === '') {
      payload.ai_evaluation_presence_penalty = null;
    } else {
      const presPenalty = Number(payload.ai_evaluation_presence_penalty);
      if (!Number.isNaN(presPenalty)) {
        // Validar que esté en el rango -2.0 a 2.0
        if (presPenalty < -2 || presPenalty > 2) {
          const error = new Error('Presence penalty debe estar entre -2.0 y 2.0');
          error.statusCode = 400;
          throw error;
        }
        payload.ai_evaluation_presence_penalty = presPenalty;
      } else {
        payload.ai_evaluation_presence_penalty = null;
      }
    }
  }

  if (Object.hasOwn(payload, 'allow_open_registration')) {
    const value = payload.allow_open_registration;
    if (typeof value === 'string') {
      payload.allow_open_registration = value === 'true' || value === '1';
    } else {
      payload.allow_open_registration = Boolean(value);
    }
  }

  if (
    payload.publish_start_at &&
    payload.publish_end_at &&
    new Date(payload.publish_start_at).getTime() > new Date(payload.publish_end_at).getTime()
  ) {
    const error = new Error('La fecha de publicación final debe ser posterior a la inicial');
    error.statusCode = 400;
    throw error;
  }

  if (payload.is_public && (!payload.publish_start_at || !payload.publish_end_at)) {
    const error = new Error('Las fechas de publicación son obligatorias para eventos públicos');
    error.statusCode = 400;
    throw error;
  }

  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  }

  return payload;
}

export class EventsController {
  static async list(req, res) {
    const { Event, EventRegistration } = getModels();
    const roleScopes = new Set(req.auth?.roleScopes ?? req.user?.roleScopes ?? []);
    const isSuperAdmin = Boolean(req.auth?.isSuperAdmin ?? req.user?.is_super_admin);
    const isManagement =
      isSuperAdmin || roleScopes.has('tenant_admin') || roleScopes.has('organizer') || roleScopes.has('evaluator');

    // Para usuarios no administradores, verificar que el tenant esté activo o en prueba
    if (!isManagement && req.tenant && !['active', 'trial'].includes(req.tenant.status)) {
      return res.json({ success: true, data: [] });
    }

    if (isManagement) {
      const events = await Event.findAll({ order: [['created_at', 'DESC']] });
      // Asegurar que las fechas se serialicen correctamente
      const payload = events.map(event => {
        const eventJson = event.toJSON();
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
      });
      return successResponse(res, payload);
    }

    const now = new Date();
    const publicVisibilityClause = {
      is_public: true,
      [Op.and]: [
        {
          [Op.or]: [{ publish_start_at: null }, { publish_start_at: { [Op.lte]: now } }]
        },
        {
          [Op.or]: [{ publish_end_at: null }, { publish_end_at: { [Op.gte]: now } }]
        }
      ]
    };

    const { TeamMember, Team } = getModels();
    
    // Buscar registros de eventos del usuario (el scoping del tenant se aplica automáticamente)
    const registrations = await EventRegistration.findAll({
      attributes: ['event_id', 'status'],
      where: { user_id: req.user.id }
    });
    const registeredIds = Array.from(new Set(registrations.map(registration => registration.event_id)));

    // Buscar eventos donde el usuario está en un equipo
    const teamMemberships = await TeamMember.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'event_id'],
          required: true
        }
      ],
      attributes: ['id', 'team_id', 'role']
    });
    const eventIdsFromTeams = Array.from(new Set(
      teamMemberships
        .map(membership => membership.team?.event_id)
        .filter(Boolean)
    ));

    // Construir cláusulas WHERE: eventos registrados, eventos públicos, o eventos donde está en equipo
    const whereClauses = [];
    if (registeredIds.length) {
      whereClauses.push({ id: { [Op.in]: registeredIds } });
    }
    if (eventIdsFromTeams.length) {
      whereClauses.push({ id: { [Op.in]: eventIdsFromTeams } });
    }
    whereClauses.push(publicVisibilityClause);

    const events = await Event.findAll({
      where: whereClauses.length === 1 ? whereClauses[0] : { [Op.or]: whereClauses },
      order: [
        ['start_date', 'ASC'],
        ['created_at', 'DESC']
      ],
      include: [
        {
          model: EventRegistration,
          as: 'registrations',
          attributes: ['id', 'status'],
          where: { 
            user_id: req.user.id,
            tenant_id: req.tenant.id
          },
          required: false
        }
      ]
    });

    // Obtener información de equipos del usuario para todos los eventos encontrados
    const eventIds = events.map(event => event.id);
    const teamMembershipsForEvents = eventIds.length > 0 ? await TeamMember.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'event_id'],
          where: { event_id: { [Op.in]: eventIds } },
          required: true
        }
      ],
      attributes: ['id', 'team_id', 'role']
    }) : [];

    // Crear un mapa de event_id -> team
    const teamByEventId = new Map();
    teamMembershipsForEvents.forEach(membership => {
      const team = membership.team;
      if (team) {
        teamByEventId.set(team.event_id, {
          id: team.id,
          name: team.name,
          role: membership.role
        });
      }
    });

    const payload = events.map(eventInstance => {
      const eventJson = eventInstance.toJSON();
      const registrationsForUser = Array.isArray(eventJson.registrations) ? eventJson.registrations : [];
      const firstRegistration = registrationsForUser[0] ?? null;
      delete eventJson.registrations;
      const teamInfo = teamByEventId.get(eventInstance.id);
      
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
      
      // Un usuario está "registrado" si tiene registro O está en un equipo del evento
      const isRegistered = Boolean(firstRegistration) || Boolean(teamInfo);
      
      return {
        ...eventJson,
        is_registered: isRegistered,
        registration_status: firstRegistration?.status ?? null,
        has_team: Boolean(teamInfo),
        team_id: teamInfo?.id ?? null,
        team_name: teamInfo?.name ?? null,
        team_role: teamInfo?.role ?? null
      };
    });

    res.json({ success: true, data: payload });
  }

  static async create(req, res) {
    try {
      const { Event } = getModels();
      const payload = normalizeEventPayload(req.body);
      const event = await Event.create({
        ...payload,
        tenant_id: req.tenant.id,
        created_by: req.user.id
      });

      logger.info('Evento creado', { eventId: event.id, tenantId: req.tenant.id });
      return successResponse(res, event, 201);
    } catch (error) {
      logger.error('Error creando evento', { error: error.message, stack: error.stack });
      const statusCode = error.statusCode ?? 500;
      return res.status(statusCode).json({
        success: false,
        message: error.statusCode ? error.message : 'Error creando evento'
      });
    }
  }

  static async detail(req, res, next) {
    try {
      const roleScopes = new Set(req.auth?.roleScopes ?? req.user?.roleScopes ?? []);
      const isSuperAdmin = Boolean(req.auth?.isSuperAdmin ?? req.user?.is_super_admin);
      const isManagement =
        isSuperAdmin || roleScopes.has('tenant_admin') || roleScopes.has('organizer') || roleScopes.has('evaluator');

      // Para usuarios no administradores, verificar que el tenant esté activo o en prueba
      if (!isManagement && req.tenant && !['active', 'trial'].includes(req.tenant.status)) {
        return res.status(403).json({
          success: false,
          message: 'El tenant no está activo'
        });
      }

      const event = await findEventOr404(req.params.eventId);
      if (Array.isArray(event.rubrics)) {
        event.rubrics.forEach(rubric => {
          if (Array.isArray(rubric.criteria)) {
            rubric.criteria.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
          }
        });
      }

      const eventJson = event.toJSON();
      
      // Resolver marcadores de assets antes de devolver
      // Solo si no se solicita HTML crudo (para edición)
      const rawHtml = req.query.raw === 'true';
      if (!rawHtml && event.id && req.tenant?.id) {
        // Resolver marcadores en description_html del evento
        if (eventJson.description_html) {
          let processedHtml = eventJson.description_html;
          
          // Si es objeto multiidioma, procesar cada idioma por separado
          if (typeof processedHtml === 'object' && processedHtml !== null && !Array.isArray(processedHtml)) {
            const processed = {};
            for (const [lang, content] of Object.entries(processedHtml)) {
              if (content && typeof content === 'string') {
                let langHtml = await resolveAssetMarkers(content, event.id, req.tenant.id);
                langHtml = resolveYouTubeUrls(langHtml);
                if (langHtml) {
                  processed[lang] = langHtml;
                }
              } else {
                processed[lang] = content;
              }
            }
            eventJson.description_html = Object.keys(processed).length > 0 ? processed : null;
          } else if (typeof processedHtml === 'string') {
            processedHtml = await resolveAssetMarkers(processedHtml, event.id, req.tenant.id);
            processedHtml = resolveYouTubeUrls(processedHtml);
            eventJson.description_html = processedHtml;
          }
        }
        
        // Resolver marcadores en description e intro_html de cada fase
        if (Array.isArray(eventJson.phases)) {
          for (const phaseJson of eventJson.phases) {
            // Procesar description si contiene HTML
            if (phaseJson.description) {
              let processedDesc = phaseJson.description;
              
              if (typeof processedDesc === 'object' && processedDesc !== null && !Array.isArray(processedDesc)) {
                const processed = {};
                for (const [lang, content] of Object.entries(processedDesc)) {
                  if (content && typeof content === 'string') {
                    // Si el contenido parece HTML (contiene tags), procesarlo
                    if (/<[a-z][\s\S]*>/i.test(content)) {
                      let langHtml = await resolveAssetMarkers(content, event.id, req.tenant.id);
                      langHtml = resolveYouTubeUrls(langHtml);
                      if (langHtml) {
                        processed[lang] = langHtml;
                      }
                    } else {
                      // Si es texto plano, dejarlo tal cual
                      processed[lang] = content;
                    }
                  } else {
                    processed[lang] = content;
                  }
                }
                phaseJson.description = Object.keys(processed).length > 0 ? processed : null;
              } else if (typeof processedDesc === 'string' && /<[a-z][\s\S]*>/i.test(processedDesc)) {
                // Si es string HTML, procesarlo
                processedDesc = await resolveAssetMarkers(processedDesc, event.id, req.tenant.id);
                processedDesc = resolveYouTubeUrls(processedDesc);
                phaseJson.description = processedDesc;
              }
            }
            
            // Procesar intro_html
            if (phaseJson.intro_html) {
              let processedHtml = phaseJson.intro_html;
              
              if (typeof processedHtml === 'object' && processedHtml !== null && !Array.isArray(processedHtml)) {
                const processed = {};
                for (const [lang, content] of Object.entries(processedHtml)) {
                  if (content && typeof content === 'string') {
                    let langHtml = await resolveAssetMarkers(content, event.id, req.tenant.id);
                    langHtml = resolveYouTubeUrls(langHtml);
                    if (langHtml) {
                      processed[lang] = langHtml;
                    }
                  } else {
                    processed[lang] = content;
                  }
                }
                phaseJson.intro_html = Object.keys(processed).length > 0 ? processed : null;
              } else if (typeof processedHtml === 'string') {
                processedHtml = await resolveAssetMarkers(processedHtml, event.id, req.tenant.id);
                processedHtml = resolveYouTubeUrls(processedHtml);
                phaseJson.intro_html = processedHtml;
              }
            }
          }
        }
        
        // Resolver marcadores en description e intro_html de cada tarea
        if (Array.isArray(eventJson.tasks)) {
          for (const taskJson of eventJson.tasks) {
            // Procesar description si contiene HTML
            if (taskJson.description) {
              let processedDesc = taskJson.description;
              
              if (typeof processedDesc === 'object' && processedDesc !== null && !Array.isArray(processedDesc)) {
                const processed = {};
                for (const [lang, content] of Object.entries(processedDesc)) {
                  if (content && typeof content === 'string') {
                    // Si el contenido parece HTML (contiene tags), procesarlo
                    if (/<[a-z][\s\S]*>/i.test(content)) {
                      let langHtml = await resolveAssetMarkers(content, event.id, req.tenant.id);
                      langHtml = resolveYouTubeUrls(langHtml);
                      if (langHtml) {
                        processed[lang] = langHtml;
                      }
                    } else {
                      // Si es texto plano, dejarlo tal cual
                      processed[lang] = content;
                    }
                  } else {
                    processed[lang] = content;
                  }
                }
                taskJson.description = Object.keys(processed).length > 0 ? processed : null;
              } else if (typeof processedDesc === 'string' && /<[a-z][\s\S]*>/i.test(processedDesc)) {
                // Si es string HTML, procesarlo
                processedDesc = await resolveAssetMarkers(processedDesc, event.id, req.tenant.id);
                processedDesc = resolveYouTubeUrls(processedDesc);
                taskJson.description = processedDesc;
              }
            }
            
            // Procesar intro_html
            if (taskJson.intro_html) {
              let processedHtml = taskJson.intro_html;
              
              if (typeof processedHtml === 'object' && processedHtml !== null && !Array.isArray(processedHtml)) {
                const processed = {};
                for (const [lang, content] of Object.entries(processedHtml)) {
                  if (content && typeof content === 'string') {
                    let langHtml = await resolveAssetMarkers(content, event.id, req.tenant.id);
                    langHtml = resolveYouTubeUrls(langHtml);
                    if (langHtml) {
                      processed[lang] = langHtml;
                    }
                  } else {
                    processed[lang] = content;
                  }
                }
                taskJson.intro_html = Object.keys(processed).length > 0 ? processed : null;
              } else if (typeof processedHtml === 'string') {
                processedHtml = await resolveAssetMarkers(processedHtml, event.id, req.tenant.id);
                processedHtml = resolveYouTubeUrls(processedHtml);
                
                // Log para debug: verificar HTML antes de sanitizar
                logger.debug('HTML de task intro_html antes de sanitizar', {
                  eventId: event.id,
                  taskId: taskJson.id,
                  htmlLength: processedHtml.length,
                  hasSvg: processedHtml.includes('<svg'),
                  htmlSample: processedHtml.substring(0, 500)
                });
                
                taskJson.intro_html = processedHtml;
              }
            }
          }
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

      return successResponse(res, eventJson);
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const event = await findEventOr404(req.params.eventId);
      const payload = normalizeEventPayload({ ...req.body });
      await event.update(payload);
      return successResponse(res, event);
    } catch (error) {
      next(error);
    }
  }

  static async archive(req, res, next) {
    try {
      const event = await findEventOr404(req.params.eventId);
      await event.update({ status: 'archived' });
      return successResponse(res, event);
    } catch (error) {
      next(error);
    }
  }

  static async listPhases(req, res, next) {
    try {
      const event = await findEventOr404(req.params.eventId);
      const { Phase } = getModels();
      const phases = await Phase.findAll({
        where: { event_id: req.params.eventId },
        order: [['order_index', 'ASC']]
      });
      
      // Resolver marcadores de assets en description e intro_html de cada fase antes de devolver
      // Solo si no se solicita HTML crudo (para edición)
      const rawHtml = req.query.raw === 'true';
      if (!rawHtml && req.tenant?.id) {
        const phasesJson = phases.map(phase => phase.toJSON());
        for (const phaseJson of phasesJson) {
          // Procesar description si contiene HTML
          if (phaseJson.description) {
            let processedDesc = phaseJson.description;
            
            if (typeof processedDesc === 'object' && processedDesc !== null && !Array.isArray(processedDesc)) {
              const processed = {};
              for (const [lang, content] of Object.entries(processedDesc)) {
                if (content && typeof content === 'string') {
                  // Si el contenido parece HTML (contiene tags), procesarlo
                  if (/<[a-z][\s\S]*>/i.test(content)) {
                    let langHtml = await resolveAssetMarkers(content, event.id, req.tenant.id);
                    langHtml = resolveYouTubeUrls(langHtml);
                    if (langHtml) {
                      processed[lang] = langHtml;
                    }
                  } else {
                    // Si es texto plano, dejarlo tal cual
                    processed[lang] = content;
                  }
                } else {
                  processed[lang] = content;
                }
              }
              phaseJson.description = Object.keys(processed).length > 0 ? processed : null;
            } else if (typeof processedDesc === 'string' && /<[a-z][\s\S]*>/i.test(processedDesc)) {
              // Si es string HTML, procesarlo
              processedDesc = await resolveAssetMarkers(processedDesc, event.id, req.tenant.id);
              processedDesc = resolveYouTubeUrls(processedDesc);
              phaseJson.description = processedDesc;
            }
          }
          
          // Procesar intro_html
          if (phaseJson.intro_html) {
            let processedHtml = phaseJson.intro_html;
            
            if (typeof processedHtml === 'object' && processedHtml !== null && !Array.isArray(processedHtml)) {
              const processed = {};
              for (const [lang, content] of Object.entries(processedHtml)) {
                if (content && typeof content === 'string') {
                  let langHtml = await resolveAssetMarkers(content, event.id, req.tenant.id);
                  langHtml = resolveYouTubeUrls(langHtml);
                  if (langHtml) {
                    processed[lang] = langHtml;
                  }
                } else {
                  processed[lang] = content;
                }
              }
              phaseJson.intro_html = Object.keys(processed).length > 0 ? processed : null;
            } else if (typeof processedHtml === 'string') {
              processedHtml = await resolveAssetMarkers(processedHtml, event.id, req.tenant.id);
              processedHtml = resolveYouTubeUrls(processedHtml);
              phaseJson.intro_html = processedHtml;
            }
          }
        }
        return successResponse(res, phasesJson);
      }
      
      return successResponse(res, phases);
    } catch (error) {
      next(error);
    }
  }

  static async createPhase(req, res, next) {
    try {
      const { Phase } = getModels();
      const event = await findEventOr404(req.params.eventId);

      const count = await Phase.count({ where: { event_id: event.id } });
      const eventStartAt = toDateOrNull(event.start_date);
      const eventEndAt = toDateOrNull(event.end_date);

      const payload = {
        ...req.body,
        event_id: event.id,
        tenant_id: req.tenant?.id ?? null,
        order_index: req.body.order_index ?? count + 1
      };
      // Normalizar campos multiidioma
      payload.name = normalizeMultilingualField(req.body.name);
      payload.description = normalizeMultilingualText(req.body.description);
      payload.intro_html = normalizeMultilingualHtml(req.body.intro_html);
      payload.start_date = toDateOrNull(payload.start_date);
      payload.end_date = toDateOrNull(payload.end_date);

      const resolvedViewStart =
        toDateOrNull(payload.view_start_date) ??
        eventStartAt ??
        toDateOrNull(payload.start_date) ??
        null;
      const resolvedViewEnd =
        toDateOrNull(payload.view_end_date) ??
        eventEndAt ??
        toDateOrNull(payload.end_date) ??
        null;

      if (resolvedViewStart && resolvedViewEnd && resolvedViewStart > resolvedViewEnd) {
        return badRequestResponse(
          res,
          'La fecha fin de visualización debe ser posterior o igual a la fecha de inicio de visualización'
        );
      }

      payload.view_start_date = resolvedViewStart;
      payload.view_end_date = resolvedViewEnd;

      const phase = await Phase.create(payload);

      return successResponse(res, phase, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updatePhase(req, res, next) {
    try {
      const { Phase } = getModels();
      const event = await findEventOr404(req.params.eventId);
      const phase = await Phase.findOne({
        where: { id: toInt(req.params.phaseId), event_id: toInt(req.params.eventId) }
      });

      if (!phase) {
        return notFoundResponse(res, 'Fase no encontrada');
      }

      const payload = { ...req.body };
      // Normalizar campos multiidioma
      if (Object.hasOwn(req.body, 'name')) {
        payload.name = normalizeMultilingualField(req.body.name);
      }
      if (Object.hasOwn(req.body, 'description')) {
        payload.description = normalizeMultilingualText(req.body.description);
      }
      if (Object.hasOwn(req.body, 'intro_html')) {
        payload.intro_html = normalizeMultilingualHtml(req.body.intro_html);
      }
      if (Object.hasOwn(payload, 'start_date')) {
        payload.start_date = toDateOrNull(payload.start_date);
      }
      if (Object.hasOwn(payload, 'end_date')) {
        payload.end_date = toDateOrNull(payload.end_date);
      }
      const eventStartAt = toDateOrNull(event.start_date);
      const eventEndAt = toDateOrNull(event.end_date);

      if (Object.hasOwn(payload, 'view_start_date')) {
        payload.view_start_date =
          payload.view_start_date === null
            ? eventStartAt ?? toDateOrNull(phase.start_date) ?? null
            : toDateOrNull(payload.view_start_date);
      }

      if (Object.hasOwn(payload, 'view_end_date')) {
        payload.view_end_date =
          payload.view_end_date === null
            ? eventEndAt ?? toDateOrNull(phase.end_date) ?? null
            : toDateOrNull(payload.view_end_date);
      }

      if (
        payload.view_start_date &&
        payload.view_end_date &&
        payload.view_start_date > payload.view_end_date
      ) {
        return badRequestResponse(
          res,
          'La fecha fin de visualización debe ser posterior o igual a la fecha de inicio de visualización'
        );
      }

      await phase.update(payload);
      return successResponse(res, phase);
    } catch (error) {
      next(error);
    }
  }

  static async deletePhase(req, res, next) {
    try {
      const { Phase, Task } = getModels();
      const phase = await Phase.findOne({
        where: { id: toInt(req.params.phaseId), event_id: toInt(req.params.eventId) }
      });

      if (!phase) {
        return notFoundResponse(res, 'Fase no encontrada');
      }

      // Verificar si hay tareas asociadas
      const taskCount = await Task.count({
        where: { phase_id: phase.id }
      });

      if (taskCount > 0) {
        return conflictResponse(
          res,
          'No se puede eliminar la fase porque tiene tareas asociadas. Por favor, elimina primero las tareas.'
        );
      }

      await phase.destroy();
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async listTasks(req, res, next) {
    try {
      const event = await findEventOr404(req.params.eventId);
      const { Task } = getModels();
      const tasks = await Task.findAll({
        where: { event_id: req.params.eventId },
        order: [['created_at', 'ASC']]
      });
      
      // Resolver marcadores de assets en intro_html de cada tarea antes de devolver
      // Solo si no se solicita HTML crudo (para edición)
      const rawHtml = req.query.raw === 'true';
      if (!rawHtml && req.tenant?.id) {
        const tasksJson = tasks.map(task => task.toJSON());
        for (const taskJson of tasksJson) {
          if (taskJson.intro_html) {
            let processedHtml = taskJson.intro_html;
            
            if (typeof processedHtml === 'object' && processedHtml !== null && !Array.isArray(processedHtml)) {
              const processed = {};
              for (const [lang, content] of Object.entries(processedHtml)) {
                if (content && typeof content === 'string') {
                  let langHtml = await resolveAssetMarkers(content, event.id, req.tenant.id);
                  langHtml = resolveYouTubeUrls(langHtml);
                  if (langHtml) {
                    processed[lang] = langHtml;
                  }
                } else {
                  processed[lang] = content;
                }
              }
              taskJson.intro_html = Object.keys(processed).length > 0 ? processed : null;
            } else if (typeof processedHtml === 'string') {
              processedHtml = await resolveAssetMarkers(processedHtml, event.id, req.tenant.id);
              processedHtml = resolveYouTubeUrls(processedHtml);
              taskJson.intro_html = processedHtml;
            }
          }
        }
        return successResponse(res, tasksJson);
      }
      
      return successResponse(res, tasks);
    } catch (error) {
      next(error);
    }
  }

  static async createTask(req, res, next) {
    try {
      const { Task, Phase, PhaseRubric } = getModels();
      const event = await findEventOr404(req.params.eventId);
      const phaseId = toInt(req.body.phase_id);
      const phase = await Phase.findOne({
        where: { id: phaseId, event_id: event.id }
      });

      if (!phase) {
        return notFoundResponse(res, 'Fase inválida');
      }

      let phaseRubricId = req.body.phase_rubric_id ?? null;

      if (phaseRubricId) {
        const rubric = await PhaseRubric.findOne({
          where: { id: phaseRubricId, event_id: event.id, phase_id: phase.id }
        });
        if (!rubric) {
          return badRequestResponse(res, 'Rúbrica inválida para la fase');
        }
      }

      const taskPayload = {
        ...req.body,
        event_id: event.id,
        phase_id: phase.id,
        phase_rubric_id: phaseRubricId,
        allowed_mime_types: Array.isArray(req.body.allowed_mime_types) ? req.body.allowed_mime_types : null
      };
      // Normalizar campos multiidioma
      taskPayload.title = normalizeMultilingualField(req.body.title);
      taskPayload.description = normalizeMultilingualText(req.body.description);
      taskPayload.intro_html = normalizeMultilingualHtml(req.body.intro_html);

      const task = await Task.create(taskPayload);

      return successResponse(res, task, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateTask(req, res, next) {
    try {
      const { Task, PhaseRubric } = getModels();
      const task = await Task.findOne({
        where: { id: toInt(req.params.taskId), event_id: toInt(req.params.eventId) }
      });

      if (!task) {
        return notFoundResponse(res, 'Tarea no encontrada');
      }

      let updates = { ...req.body };
      // Normalizar campos multiidioma
      if (Object.hasOwn(req.body, 'title')) {
        updates.title = normalizeMultilingualField(req.body.title);
      }
      if (Object.hasOwn(req.body, 'description')) {
        updates.description = normalizeMultilingualText(req.body.description);
      }
      if (Object.hasOwn(req.body, 'intro_html')) {
        updates.intro_html = normalizeMultilingualHtml(req.body.intro_html);
      }

      if (Object.hasOwn(req.body, 'phase_rubric_id')) {
        if (req.body.phase_rubric_id === null) {
          updates.phase_rubric_id = null;
        } else {
          const rubric = await PhaseRubric.findOne({
            where: {
              id: Number(req.body.phase_rubric_id),
              event_id: task.event_id,
              phase_id: task.phase_id
            }
          });
          if (!rubric) {
            return badRequestResponse(res, 'Rúbrica inválida para la fase');
          }
          updates.phase_rubric_id = Number(req.body.phase_rubric_id);
        }
      }

      if (Object.hasOwn(req.body, 'allowed_mime_types')) {
        updates.allowed_mime_types = Array.isArray(req.body.allowed_mime_types)
          ? req.body.allowed_mime_types
          : null;
      }

      await task.update(updates);
      return successResponse(res, task);
    } catch (error) {
      next(error);
    }
  }

  static async deleteTask(req, res, next) {
    try {
      const { Task } = getModels();
      const task = await Task.findOne({
        where: { id: toInt(req.params.taskId), event_id: toInt(req.params.eventId) }
      });

      if (!task) {
        return notFoundResponse(res, 'Tarea no encontrada');
      }

      await task.destroy();
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async exportPhasesAndTasks(req, res, next) {
    try {
      const event = await findEventOr404(req.params.eventId);
      const { Phase, Task } = getModels();
      
      // Obtener todas las fases del evento con sus tareas
      const phases = await Phase.findAll({
        where: { event_id: event.id },
        order: [['order_index', 'ASC']],
        include: [
          {
            model: Task,
            as: 'tasks',
            required: false,
            order: [['order_index', 'ASC']]
          }
        ]
      });

      // Preparar datos para exportación (sin IDs ni tenant_id)
      const exportData = {
        version: '1.0',
        event_name: event.name,
        exported_at: new Date().toISOString(),
        phases: phases.map(phase => {
          const phaseJson = phase.toJSON();
          const tasks = phaseJson.tasks || [];
          
          return {
            name: phaseJson.name,
            description: phaseJson.description || null,
            intro_html: phaseJson.intro_html || null,
            start_date: phaseJson.start_date ? new Date(phaseJson.start_date).toISOString() : null,
            end_date: phaseJson.end_date ? new Date(phaseJson.end_date).toISOString() : null,
            view_start_date: phaseJson.view_start_date ? new Date(phaseJson.view_start_date).toISOString() : null,
            view_end_date: phaseJson.view_end_date ? new Date(phaseJson.view_end_date).toISOString() : null,
            order_index: phaseJson.order_index,
            is_elimination: phaseJson.is_elimination,
            tasks: tasks.map(task => ({
              title: task.title,
              description: task.description || null,
              intro_html: task.intro_html || null,
              delivery_type: task.delivery_type,
              is_required: task.is_required,
              due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
              status: task.status,
              order_index: task.order_index || 1,
              max_files: task.max_files || 1,
              max_file_size_mb: task.max_file_size_mb || null,
              allowed_mime_types: task.allowed_mime_types || null
            }))
          };
        })
      };

      // Devolver JSON directamente (el frontend se encargará de la descarga)
      return successResponse(res, exportData);
    } catch (error) {
      next(error);
    }
  }

  static async importPhasesAndTasks(req, res, next) {
    try {
      const event = await findEventOr404(req.params.eventId);
      const { Phase, Task } = getModels();
      
      if (!req.body || !Array.isArray(req.body.phases)) {
        return badRequestResponse(res, 'Formato de datos inválido. Se espera un objeto con un array "phases"');
      }

      const replace = Boolean(req.body.replace);
      
      // Si replace es true, eliminar todas las fases y tareas existentes del evento
      if (replace) {
        // Eliminar todas las tareas primero (por las foreign keys)
        await Task.destroy({
          where: { event_id: event.id }
        });
        
        // Luego eliminar todas las fases
        await Phase.destroy({
          where: { event_id: event.id }
        });
      }

      const importedPhases = [];
      const importedTasks = [];
      const errors = [];

      // Obtener el número actual de fases para calcular order_index
      const currentPhaseCount = replace ? 0 : await Phase.count({ where: { event_id: event.id } });

      for (let i = 0; i < req.body.phases.length; i++) {
        const phaseData = req.body.phases[i];
        
        try {
          // Validar datos básicos de la fase
          if (!phaseData.name || typeof phaseData.name !== 'string') {
            errors.push(`Fase ${i + 1}: nombre requerido`);
            continue;
          }

          // Preparar payload de la fase
          const phasePayload = {
            tenant_id: event.tenant_id, // Agregar tenant_id del evento
            event_id: event.id,
            name: normalizeMultilingualField(phaseData.name),
            description: normalizeMultilingualText(phaseData.description),
            intro_html: normalizeMultilingualHtml(phaseData.intro_html),
            start_date: phaseData.start_date ? toDateOrNull(phaseData.start_date) : null,
            end_date: phaseData.end_date ? toDateOrNull(phaseData.end_date) : null,
            view_start_date: phaseData.view_start_date ? toDateOrNull(phaseData.view_start_date) : null,
            view_end_date: phaseData.view_end_date ? toDateOrNull(phaseData.view_end_date) : null,
            order_index: phaseData.order_index !== undefined ? Number(phaseData.order_index) : (currentPhaseCount + i + 1),
            is_elimination: Boolean(phaseData.is_elimination)
          };

          // Validar fechas
          if (phasePayload.start_date && phasePayload.end_date && phasePayload.start_date > phasePayload.end_date) {
            errors.push(`Fase "${phaseData.name}": la fecha de fin debe ser posterior o igual a la fecha de inicio`);
            continue;
          }

          // Crear la fase
          const phase = await Phase.create(phasePayload);
          importedPhases.push(phase);

          // Importar tareas de la fase
          if (Array.isArray(phaseData.tasks)) {
            for (let j = 0; j < phaseData.tasks.length; j++) {
              const taskData = phaseData.tasks[j];
              
              try {
                if (!taskData.title || typeof taskData.title !== 'string') {
                  errors.push(`Fase "${phaseData.name}", Tarea ${j + 1}: título requerido`);
                  continue;
                }

                const taskPayload = {
                  tenant_id: event.tenant_id, // Agregar tenant_id del evento
                  event_id: event.id,
                  phase_id: phase.id,
                  title: normalizeMultilingualField(taskData.title),
                  description: normalizeMultilingualText(taskData.description),
                  intro_html: normalizeMultilingualHtml(taskData.intro_html),
                  delivery_type: taskData.delivery_type || 'file',
                  is_required: taskData.is_required !== undefined ? Boolean(taskData.is_required) : true,
                  due_date: taskData.due_date ? toDateOrNull(taskData.due_date) : null,
                  status: taskData.status || 'draft',
                  order_index: taskData.order_index !== undefined ? Number(taskData.order_index) : (j + 1),
                  max_files: taskData.max_files !== undefined ? Number(taskData.max_files) : 1,
                  max_file_size_mb: taskData.max_file_size_mb ? Number(taskData.max_file_size_mb) : null,
                  allowed_mime_types: Array.isArray(taskData.allowed_mime_types) ? taskData.allowed_mime_types : null
                };

                const task = await Task.create(taskPayload);
                importedTasks.push(task);
              } catch (taskError) {
                errors.push(`Fase "${phaseData.name}", Tarea "${taskData.title || j + 1}": ${taskError.message}`);
              }
            }
          }
        } catch (phaseError) {
          errors.push(`Fase "${phaseData.name || i + 1}": ${phaseError.message}`);
        }
      }

      // Respuesta con resumen de importación
      const response = {
        success: errors.length === 0,
        imported: {
          phases: importedPhases.length,
          tasks: importedTasks.length
        },
        errors: errors.length > 0 ? errors : undefined
      };

      if (errors.length > 0) {
        return res.status(207).json(response); // 207 Multi-Status para indicar éxito parcial
      }

      return successResponse(res, response, 201);
    } catch (error) {
      next(error);
    }
  }

  static async clone(req, res, next) {
    try {
      const { Event, Phase, Task, PhaseRubric, PhaseRubricCriterion, EventAsset } = getModels();
      const originalEvent = await findEventOr404(req.params.eventId);

      // Obtener todas las relaciones del evento original
      const originalPhases = await Phase.findAll({
        where: { event_id: originalEvent.id },
        order: [['order_index', 'ASC']],
        include: [
          {
            model: Task,
            as: 'tasks',
            required: false,
            order: [['order_index', 'ASC']]
          }
        ]
      });

      const originalRubrics = await PhaseRubric.findAll({
        where: { event_id: originalEvent.id },
        include: [
          {
            model: PhaseRubricCriterion,
            as: 'criteria',
            required: false,
            order: [['order_index', 'ASC']]
          }
        ]
      });

      // Obtener todos los recursos (assets) del evento original
      const originalAssets = await EventAsset.findAll({
        where: { event_id: originalEvent.id }
      });

      // Preparar nombre del evento clonado (multiidioma)
      const originalName = typeof originalEvent.name === 'string' 
        ? { es: originalEvent.name } 
        : originalEvent.name;
      
      const clonedName = {};
      for (const [lang, value] of Object.entries(originalName)) {
        clonedName[lang] = `${value} Copia`;
      }

      // Crear el evento clonado
      const eventData = originalEvent.toJSON();
      delete eventData.id;
      delete eventData.created_at;
      delete eventData.updated_at;
      
      const clonedEvent = await Event.create({
        ...eventData,
        name: clonedName,
        status: 'draft', // Los eventos clonados empiezan como draft
        created_by: req.user.id
      });

      // Mapa para relacionar fases originales con clonadas
      const phaseMap = new Map();

      // Clonar fases
      for (const originalPhase of originalPhases) {
        const phaseData = originalPhase.toJSON();
        delete phaseData.id;
        delete phaseData.created_at;
        delete phaseData.updated_at;
        delete phaseData.tasks;

        const clonedPhase = await Phase.create({
          ...phaseData,
          event_id: clonedEvent.id
        });

        phaseMap.set(originalPhase.id, clonedPhase);

        // Clonar tareas de la fase
        const originalTasks = originalPhase.tasks || [];
        for (const originalTask of originalTasks) {
          const taskData = originalTask.toJSON();
          delete taskData.id;
          delete taskData.created_at;
          delete taskData.updated_at;

          await Task.create({
            ...taskData,
            event_id: clonedEvent.id,
            phase_id: clonedPhase.id,
            phase_rubric_id: null // Se actualizará después de clonar las rúbricas
          });
        }
      }

      // Mapa para relacionar rúbricas originales con clonadas
      const rubricMap = new Map();

      // Clonar rúbricas
      for (const originalRubric of originalRubrics) {
        const rubricData = originalRubric.toJSON();
        delete rubricData.id;
        delete rubricData.created_at;
        delete rubricData.updated_at;
        delete rubricData.criteria;

        // Actualizar phase_id si existe
        const newPhaseId = originalRubric.phase_id 
          ? phaseMap.get(originalRubric.phase_id)?.id 
          : null;

        const clonedRubric = await PhaseRubric.create({
          ...rubricData,
          event_id: clonedEvent.id,
          phase_id: newPhaseId,
          created_by: req.user.id
        });

        rubricMap.set(originalRubric.id, clonedRubric);

        // Clonar criterios de la rúbrica
        const originalCriteria = originalRubric.criteria || [];
        for (const originalCriterion of originalCriteria) {
          const criterionData = originalCriterion.toJSON();
          delete criterionData.id;
          delete criterionData.created_at;
          delete criterionData.updated_at;

          await PhaseRubricCriterion.create({
            ...criterionData,
            rubric_id: clonedRubric.id
          });
        }
      }

      // Actualizar phase_rubric_id en las tareas clonadas
      // Necesitamos mapear las rúbricas originales a las clonadas
      for (const originalPhase of originalPhases) {
        const clonedPhase = phaseMap.get(originalPhase.id);
        if (!clonedPhase) continue;

        const originalTasks = originalPhase.tasks || [];
        const clonedPhaseTasks = await Task.findAll({
          where: { event_id: clonedEvent.id, phase_id: clonedPhase.id },
          order: [['order_index', 'ASC']]
        });

        // Actualizar phase_rubric_id en las tareas clonadas basándonos en el orden
        for (let i = 0; i < originalTasks.length && i < clonedPhaseTasks.length; i++) {
          const originalTask = originalTasks[i];
          const clonedTask = clonedPhaseTasks[i];

          if (originalTask.phase_rubric_id) {
            const clonedRubric = rubricMap.get(originalTask.phase_rubric_id);
            if (clonedRubric) {
              await clonedTask.update({ phase_rubric_id: clonedRubric.id });
            }
          }
        }
      }

      // Clonar recursos (assets) del evento
      for (const originalAsset of originalAssets) {
        try {
          // Copiar el archivo en S3
          const { key: newS3Key, url: newUrl } = await copyEventAsset({
            tenantId: req.tenant.id,
            originalEventId: originalEvent.id,
            clonedEventId: clonedEvent.id,
            originalS3Key: originalAsset.s3_key,
            fileName: originalAsset.original_filename || originalAsset.name,
            contentType: originalAsset.mime_type
          });

          // Crear el registro del asset clonado
          await EventAsset.create({
            tenant_id: req.tenant.id,
            event_id: clonedEvent.id,
            name: originalAsset.name,
            original_filename: originalAsset.original_filename,
            s3_key: newS3Key,
            url: newUrl,
            mime_type: originalAsset.mime_type,
            file_size: originalAsset.file_size,
            uploaded_by: req.user.id,
            description: originalAsset.description
          });
        } catch (assetError) {
          // Si falla la copia de un asset, loguear el error pero continuar con el resto
          logger.warn('Error al clonar asset del evento', {
            error: assetError.message,
            assetId: originalAsset.id,
            assetName: originalAsset.name,
            originalEventId: originalEvent.id,
            clonedEventId: clonedEvent.id
          });
        }
      }

      logger.info('Evento clonado', { 
        originalEventId: originalEvent.id, 
        clonedEventId: clonedEvent.id, 
        tenantId: req.tenant.id,
        assetsCloned: originalAssets.length
      });

      return successResponse(res, clonedEvent, 201);
    } catch (error) {
      logger.error('Error clonando evento', { error: error.message, stack: error.stack });
      next(error);
    }
  }
}

