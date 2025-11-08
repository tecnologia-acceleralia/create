import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';

function toInt(value) {
  return Number.parseInt(value, 10);
}

async function findEventOr404(eventId) {
  const id = toInt(eventId);
  const { Event, Phase, Task } = getModels();
  const event = await Event.findOne({
    where: { id },
    include: [
      { model: Phase, as: 'phases', separate: true, order: [['order_index', 'ASC']] },
      { model: Task, as: 'tasks', separate: true }
    ]
  });

  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }

  return event;
}

export class EventsController {
  static async list(req, res) {
    const { Event } = getModels();
    const events = await Event.findAll({ order: [['created_at', 'DESC']] });
    res.json({ success: true, data: events });
  }

  static async create(req, res) {
    try {
      const { Event } = getModels();
      const event = await Event.create({
        ...req.body,
        created_by: req.user.id
      });

      logger.info('Evento creado', { eventId: event.id, tenantId: req.tenant.id });
      res.status(201).json({ success: true, data: event });
    } catch (error) {
      logger.error('Error creando evento', { error: error.message });
      res.status(500).json({ success: false, message: 'Error creando evento' });
    }
  }

  static async detail(req, res, next) {
    try {
      const event = await findEventOr404(req.params.eventId);
      res.json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const event = await findEventOr404(req.params.eventId);
      await event.update(req.body);
      res.json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  }

  static async archive(req, res, next) {
    try {
      const event = await findEventOr404(req.params.eventId);
      await event.update({ status: 'archived' });
      res.json({ success: true, data: event });
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
      res.json({ success: true, data: phases });
    } catch (error) {
      next(error);
    }
  }

  static async createPhase(req, res, next) {
    try {
      const { Phase } = getModels();
      const event = await findEventOr404(req.params.eventId);

      const count = await Phase.count({ where: { event_id: event.id } });
      const phase = await Phase.create({
        ...req.body,
        event_id: event.id,
        order_index: req.body.order_index ?? count + 1
      });

      res.status(201).json({ success: true, data: phase });
    } catch (error) {
      next(error);
    }
  }

  static async updatePhase(req, res, next) {
    try {
      const { Phase } = getModels();
      const phase = await Phase.findOne({
        where: { id: toInt(req.params.phaseId), event_id: toInt(req.params.eventId) }
      });

      if (!phase) {
        return res.status(404).json({ success: false, message: 'Fase no encontrada' });
      }

      await phase.update(req.body);
      res.json({ success: true, data: phase });
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
        return res.status(404).json({ success: false, message: 'Fase no encontrada' });
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
      res.json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }

  static async createTask(req, res, next) {
    try {
      const { Task, Phase } = getModels();
      const event = await findEventOr404(req.params.eventId);
      const phaseId = toInt(req.body.phase_id);
      const phase = await Phase.findOne({
        where: { id: phaseId, event_id: event.id }
      });

      if (!phase) {
        return res.status(404).json({ success: false, message: 'Fase inválida' });
      }

      const task = await Task.create({
        ...req.body,
        event_id: event.id,
        phase_id: phase.id
      });

      res.status(201).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  static async updateTask(req, res, next) {
    try {
      const { Task } = getModels();
      const task = await Task.findOne({
        where: { id: toInt(req.params.taskId), event_id: toInt(req.params.eventId) }
      });

      if (!task) {
        return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
      }

      await task.update(req.body);
      res.json({ success: true, data: task });
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
        return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
      }

      await task.destroy();
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

