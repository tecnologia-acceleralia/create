import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { resolveAssetMarkers } from '../utils/asset-markers.js';
import { toInt, toDateOrNull, toHtmlOrNull } from '../utils/parsers.js';
import { findEventOr404 } from '../utils/finders.js';
import { successResponse, badRequestResponse, notFoundResponse } from '../utils/response.js';

function normalizeEventPayload(body) {
  const payload = { ...body };

  if (Object.prototype.hasOwnProperty.call(payload, 'description_html')) {
    payload.description_html = toHtmlOrNull(payload.description_html);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'video_url')) {
    if (!payload.video_url || (typeof payload.video_url === 'string' && payload.video_url.trim() === '')) {
      payload.video_url = null;
    } else if (typeof payload.video_url === 'string') {
      payload.video_url = payload.video_url.trim();
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'publish_start_at')) {
    if (!payload.publish_start_at) {
      payload.publish_start_at = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'publish_end_at')) {
    if (!payload.publish_end_at) {
      payload.publish_end_at = null;
    }
  }

  if (payload.is_public === false) {
    payload.publish_start_at = null;
    payload.publish_end_at = null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'registration_schema')) {
    const rawSchema = payload.registration_schema;
    if (rawSchema === undefined) {
      delete payload.registration_schema;
    } else if (rawSchema === null || rawSchema === '') {
      payload.registration_schema = null;
    } else if (typeof rawSchema === 'string') {
      try {
        const parsed = JSON.parse(rawSchema);
        payload.registration_schema = parsed;
      } catch (error) {
        const parseError = new Error('El esquema de registro debe ser un JSON válido');
        parseError.statusCode = 400;
        throw parseError;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'allow_open_registration')) {
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
      return successResponse(res, events);
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
    const registrations = await EventRegistration.findAll({
      attributes: ['event_id', 'status'],
      where: { user_id: req.user.id },
      raw: true
    });
    const registeredIds = Array.from(new Set(registrations.map(registration => registration.event_id)));

    const whereClauses = [];
    if (registeredIds.length) {
      whereClauses.push({ id: { [Op.in]: registeredIds } });
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
          where: { user_id: req.user.id },
          required: false
        }
      ]
    });

    // Obtener información de equipos del usuario para todos los eventos
    const eventIds = events.map(event => event.id);
    const teamMemberships = eventIds.length > 0 ? await TeamMember.findAll({
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
    teamMemberships.forEach(membership => {
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
      return {
        ...eventJson,
        is_registered: Boolean(firstRegistration),
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
        created_by: req.user.id
      });

      logger.info('Evento creado', { eventId: event.id, tenantId: req.tenant.id });
      return successResponse(res, event, 201);
    } catch (error) {
      logger.error('Error creando evento', { error: error.message });
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

      // Resolver marcadores de assets en HTML
      const eventJson = event.toJSON();
      if (eventJson.description_html) {
        eventJson.description_html = await resolveAssetMarkers(
          eventJson.description_html,
          event.id,
          req.tenant.id
        );
      }

      // Resolver marcadores en intro_html de fases
      if (Array.isArray(eventJson.phases)) {
        for (const phase of eventJson.phases) {
          if (phase.intro_html) {
            phase.intro_html = await resolveAssetMarkers(phase.intro_html, event.id, req.tenant.id);
          }
        }
      }

      // Resolver marcadores en intro_html de tareas
      if (Array.isArray(eventJson.tasks)) {
        for (const task of eventJson.tasks) {
          if (task.intro_html) {
            task.intro_html = await resolveAssetMarkers(task.intro_html, event.id, req.tenant.id);
          }
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
      await findEventOr404(req.params.eventId);
      const { Phase } = getModels();
      const phases = await Phase.findAll({
        where: { event_id: req.params.eventId },
        order: [['order_index', 'ASC']]
      });
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
        order_index: req.body.order_index ?? count + 1
      };
      payload.intro_html = toHtmlOrNull(req.body.intro_html);
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
      if (Object.prototype.hasOwnProperty.call(payload, 'intro_html')) {
        payload.intro_html = toHtmlOrNull(payload.intro_html);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'start_date')) {
        payload.start_date = toDateOrNull(payload.start_date);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'end_date')) {
        payload.end_date = toDateOrNull(payload.end_date);
      }
      const eventStartAt = toDateOrNull(event.start_date);
      const eventEndAt = toDateOrNull(event.end_date);

      if (Object.prototype.hasOwnProperty.call(payload, 'view_start_date')) {
        payload.view_start_date =
          payload.view_start_date === null
            ? eventStartAt ?? toDateOrNull(phase.start_date) ?? null
            : toDateOrNull(payload.view_start_date);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'view_end_date')) {
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
      const { Phase } = getModels();
      const phase = await Phase.findOne({
        where: { id: toInt(req.params.phaseId), event_id: toInt(req.params.eventId) }
      });

      if (!phase) {
        return notFoundResponse(res, 'Fase no encontrada');
      }

      await phase.destroy();
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async listTasks(req, res, next) {
    try {
      await findEventOr404(req.params.eventId);
      const { Task } = getModels();
      const tasks = await Task.findAll({
        where: { event_id: req.params.eventId },
        order: [['created_at', 'ASC']]
      });
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
      taskPayload.intro_html = toHtmlOrNull(req.body.intro_html);

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
      if (Object.prototype.hasOwnProperty.call(req.body, 'intro_html')) {
        updates.intro_html = toHtmlOrNull(req.body.intro_html);
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'phase_rubric_id')) {
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

      if (Object.prototype.hasOwnProperty.call(req.body, 'allowed_mime_types')) {
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
}

