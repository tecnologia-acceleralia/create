import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export class TenantStatisticsController {
  static async getOverview(req, res) {
    try {
      const tenant = req.tenant;
      if (!tenant) {
        return res.status(400).json({ success: false, message: 'Tenant no encontrado' });
      }

      const {
        Event,
        Team,
        Project,
        Submission,
        Evaluation,
        UserTenant,
        EventRegistration
      } = getModels();

      const tenantId = tenant.id;

      // Contar eventos por estado
      const eventsByStatus = await Event.findAll({
        where: { tenant_id: tenantId },
        attributes: ['status', [Event.sequelize.fn('COUNT', Event.sequelize.col('id')), 'count']],
        group: ['status'],
        raw: true
      });

      const eventsStats = {
        total: 0,
        draft: 0,
        published: 0,
        archived: 0
      };

      eventsByStatus.forEach(row => {
        const count = Number(row.count);
        eventsStats.total += count;
        eventsStats[row.status] = count;
      });

      // Contar equipos
      const teamsCount = await Team.count({
        where: { tenant_id: tenantId }
      });

      // Contar proyectos
      const projectsCount = await Project.count({
        where: { tenant_id: tenantId }
      });

      // Contar envíos (submissions)
      const submissionsCount = await Submission.count({
        where: { tenant_id: tenantId }
      });

      // Contar evaluaciones
      const evaluationsCount = await Evaluation.count({
        where: { tenant_id: tenantId }
      });

      // Contar usuarios del tenant (membresías activas)
      const usersCount = await UserTenant.count({
        where: {
          tenant_id: tenantId,
          status: 'active'
        }
      });

      // Contar registros de eventos
      const registrationsCount = await EventRegistration.count({
        where: { tenant_id: tenantId }
      });

      // Obtener eventos recientes (últimos 5)
      const recentEvents = await Event.findAll({
        where: { tenant_id: tenantId },
        attributes: ['id', 'name', 'status', 'start_date', 'end_date', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 5
      });

      // Obtener eventos próximos (próximos 5)
      const now = new Date();
      const upcomingEvents = await Event.findAll({
        where: {
          tenant_id: tenantId,
          start_date: {
            [Op.gte]: now
          },
          status: {
            [Op.in]: ['draft', 'published']
          }
        },
        attributes: ['id', 'name', 'status', 'start_date', 'end_date'],
        order: [['start_date', 'ASC']],
        limit: 5
      });

      return successResponse(res, {
        statistics: {
          events: eventsStats,
          teams: teamsCount,
          projects: projectsCount,
          submissions: submissionsCount,
          evaluations: evaluationsCount,
          users: usersCount,
          registrations: registrationsCount
        },
        recentEvents: recentEvents.map(event => ({
          id: event.id,
          name: event.name,
          status: event.status,
          start_date: event.start_date,
          end_date: event.end_date,
          created_at: event.created_at
        })),
        upcomingEvents: upcomingEvents.map(event => ({
          id: event.id,
          name: event.name,
          status: event.status,
          start_date: event.start_date,
          end_date: event.end_date
        }))
      });
    } catch (error) {
      logger.error('Error obteniendo estadísticas del tenant', {
        error: error.message,
        stack: error.stack,
        tenantId: req.tenant?.id
      });
      return errorResponse(res, 'Error obteniendo estadísticas del tenant', 500);
    }
  }
}


