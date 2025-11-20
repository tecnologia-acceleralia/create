import { Op } from 'sequelize';
import { getModels } from '../models/index.js';

export class EventDeliverablesController {
  static async getDeliverablesTracking(req, res, next) {
    try {
      const eventId = Number(req.params.eventId);
      if (Number.isNaN(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Evento inválido' });
      }

      const {
        Event,
        Task,
        Team,
        Phase,
        Submission,
        Evaluation
      } = getModels();

      const event = await Event.findOne({ where: { id: eventId } });
      if (!event) {
        return res.status(404).json({ success: false, message: 'Evento no encontrado' });
      }

      // Obtener equipos del evento ordenados por nombre
      const teams = await Team.findAll({
        where: { event_id: eventId },
        order: [['name', 'ASC']],
        attributes: ['id', 'name']
      });

      // Obtener fases del evento ordenadas
      const phases = await Phase.findAll({
        where: { event_id: eventId },
        order: [['order_index', 'ASC']],
        attributes: ['id', 'name', 'order_index']
      });

      // Obtener tareas agrupadas por fase
      const tasks = await Task.findAll({
        where: { event_id: eventId },
        order: [['phase_id', 'ASC'], ['order_index', 'ASC']],
        attributes: ['id', 'title', 'phase_id', 'order_index']
      });

      // Obtener todas las entregas del evento (solo finales, no drafts)
      const submissions = await Submission.findAll({
        where: {
          event_id: eventId,
          status: 'final'
        },
        attributes: ['id', 'team_id', 'task_id', 'attachment_url', 'content', 'submitted_at'],
        order: [['submitted_at', 'DESC']]
      });

      // Crear un mapa de entregas por equipo y tarea
      // Usamos el más reciente si hay múltiples entregas
      const submissionMap = new Map();
      submissions.forEach(submission => {
        const key = `${submission.team_id}:${submission.task_id}`;
        if (!submissionMap.has(key)) {
          submissionMap.set(key, submission);
        }
      });

      // Obtener todas las evaluaciones finales y pendientes para las entregas
      const submissionIds = Array.from(submissionMap.values()).map(s => s.id);
      const evaluations = submissionIds.length > 0 ? await Evaluation.findAll({
        where: {
          submission_id: { [Op.in]: submissionIds }
        },
        attributes: ['id', 'submission_id', 'status'],
        order: [['created_at', 'DESC']]
      }) : [];

      // Crear mapas de evaluaciones por submission_id
      const finalEvaluationsMap = new Map();
      const pendingEvaluationsMap = new Map();
      for (const evaluation of evaluations) {
        const submissionId = evaluation.submission_id;
        if (evaluation.status === 'final' && !finalEvaluationsMap.has(submissionId)) {
          finalEvaluationsMap.set(submissionId, evaluation.id);
        }
        if (evaluation.status === 'draft' && !pendingEvaluationsMap.has(submissionId)) {
          pendingEvaluationsMap.set(submissionId, evaluation.id);
        }
      }

      // Organizar tareas por fase
      const tasksByPhase = new Map();
      phases.forEach(phase => {
        tasksByPhase.set(phase.id, []);
      });
      tasks.forEach(task => {
        const phaseTasks = tasksByPhase.get(task.phase_id) || [];
        phaseTasks.push(task);
        tasksByPhase.set(task.phase_id, phaseTasks);
      });

      // Construir la estructura de datos para la tabla
      const teamsData = teams.map(team => {
        const deliverables = [];
        
        phases.forEach(phase => {
          const phaseTasks = tasksByPhase.get(phase.id) || [];
          phaseTasks.forEach(task => {
            const key = `${team.id}:${task.id}`;
            const submission = submissionMap.get(key);
            
            const submissionId = submission?.id ?? null;
            deliverables.push({
              taskId: task.id,
              taskTitle: task.title,
              phaseId: phase.id,
              phaseName: phase.name,
              submitted: Boolean(submission),
              submissionId,
              attachmentUrl: submission?.attachment_url ?? null,
              content: submission?.content ?? null,
              submittedAt: submission?.submitted_at ?? null,
              hasFinalEvaluation: submissionId ? finalEvaluationsMap.has(submissionId) : false,
              hasPendingEvaluation: submissionId ? pendingEvaluationsMap.has(submissionId) : false,
              finalEvaluationId: submissionId ? finalEvaluationsMap.get(submissionId) ?? null : null
            });
          });
        });

        return {
          id: team.id,
          name: team.name,
          deliverables
        };
      });

      // Construir las columnas (fases y tareas) ordenadas por order_index
      const columns = [];
      phases.forEach(phase => {
        const phaseTasks = tasksByPhase.get(phase.id) || [];
        // Ordenar tareas por order_index dentro de cada fase
        phaseTasks.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        phaseTasks.forEach(task => {
          columns.push({
            phaseId: phase.id,
            phaseName: phase.name,
            taskId: task.id,
            taskTitle: task.title,
            orderIndex: task.order_index ?? 0
          });
        });
      });

      return res.json({
        success: true,
        data: {
          teams: teamsData,
          columns,
          phases: phases.map(p => ({ id: p.id, name: p.name, orderIndex: p.order_index })),
          tasks: tasks.map(t => ({ id: t.id, title: t.title, phaseId: t.phase_id }))
        }
      });
    } catch (error) {
      return next(error);
    }
  }
}


