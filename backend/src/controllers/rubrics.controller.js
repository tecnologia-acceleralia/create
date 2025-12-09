import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';

async function ensurePhase(eventId, phaseId) {
  const { Phase } = getModels();
  const phase = await Phase.findOne({ where: { id: phaseId, event_id: eventId } });
  if (!phase) {
    const error = new Error('Fase no encontrada');
    error.statusCode = 404;
    throw error;
  }
  return phase;
}

async function ensureRubric(eventId, phaseId, rubricId) {
  const { PhaseRubric } = getModels();
  const whereClause = { id: rubricId, event_id: eventId };
  if (phaseId !== null && phaseId !== undefined) {
    whereClause.phase_id = phaseId;
  } else {
    whereClause.phase_id = null;
  }
  
  const rubric = await PhaseRubric.findOne({
    where: whereClause,
    include: [{ association: 'criteria' }]
  });

  if (!rubric) {
    const error = new Error('Rúbrica no encontrada');
    error.statusCode = 404;
    throw error;
  }
  return sortCriteria(rubric);
}

async function ensureEvent(eventId) {
  const { Event } = getModels();
  const event = await Event.findOne({ where: { id: eventId } });
  if (!event) {
    const error = new Error('Evento no encontrado');
    error.statusCode = 404;
    throw error;
  }
  return event;
}

function normalizeCriteria(criteria = []) {
  return criteria.map((criterion, index) => ({
    title: criterion.title,
    description: criterion.description,
    weight: criterion.weight ?? 1,
    max_score: criterion.max_score ?? null,
    order_index: criterion.order_index ?? index + 1
  }));
}

function sortCriteria(rubric) {
  if (rubric?.criteria) {
    rubric.criteria.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }
  return rubric;
}

export class RubricsController {
  static async listByPhase(req, res, next) {
    try {
      const eventId = Number(req.params.eventId);
      const phaseId = Number(req.params.phaseId);
      const { PhaseRubric } = getModels();

      await ensurePhase(eventId, phaseId);

      const rubrics = await PhaseRubric.findAll({
        where: { event_id: eventId, phase_id: phaseId },
        order: [['created_at', 'DESC']],
        include: [{ association: 'criteria' }]
      });

      res.json({ success: true, data: rubrics.map(sortCriteria) });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const eventId = Number(req.params.eventId);
      const phaseId = req.params.phaseId ? Number(req.params.phaseId) : null;
      const { PhaseRubric, PhaseRubricCriterion } = getModels();

      await ensureEvent(eventId);
      
      const rubricScope = req.body.rubric_scope || (phaseId ? 'phase' : 'project');
      
      // Validar que si es de fase, tenga phase_id, y si es de proyecto, no lo tenga
      if (rubricScope === 'phase') {
        if (!phaseId) {
          throw Object.assign(new Error('Las rúbricas de fase requieren un phase_id'), { statusCode: 400 });
        }
        await ensurePhase(eventId, phaseId);
      } else if (rubricScope === 'project' && phaseId) {
        throw Object.assign(new Error('Las rúbricas de proyecto no deben tener phase_id'), { statusCode: 400 });
      }

      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw Object.assign(new Error('Tenant no encontrado'), { statusCode: 400 });
      }

      const rubric = await PhaseRubric.create(
        {
          tenant_id: tenantId,
          event_id: eventId,
          phase_id: rubricScope === 'phase' ? phaseId : null,
          rubric_scope: rubricScope,
          name: req.body.name,
          description: req.body.description,
          scale_min: req.body.scale_min ?? 0,
          scale_max: req.body.scale_max ?? 100,
          model_preference: req.body.model_preference,
          created_by: req.user.id
        },
        { transaction }
      );

      const criteria = normalizeCriteria(req.body.criteria);
      if (criteria.length === 0) {
        throw Object.assign(new Error('La rúbrica debe tener al menos un criterio'), { statusCode: 400 });
      }

      await Promise.all(
        criteria.map(criterion =>
          PhaseRubricCriterion.create(
            {
              tenant_id: tenantId,
              rubric_id: rubric.id,
              title: criterion.title,
              description: criterion.description,
              weight: criterion.weight,
              max_score: criterion.max_score,
              order_index: criterion.order_index
            },
            { transaction }
          )
        )
      );

      await transaction.commit();

      const createdRubric = await PhaseRubric.findOne({
        where: { id: rubric.id },
        include: [{ association: 'criteria' }]
      });

      res.status(201).json({ success: true, data: sortCriteria(createdRubric) });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async update(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const eventId = Number(req.params.eventId);
      const phaseId = req.params.phaseId ? Number(req.params.phaseId) : null;
      const rubricId = Number(req.params.rubricId);
      const { PhaseRubric, PhaseRubricCriterion, Task } = getModels();

      await ensureEvent(eventId);
      const rubric = await ensureRubric(eventId, phaseId, rubricId);
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw Object.assign(new Error('Tenant no encontrado'), { statusCode: 400 });
      }

      // Validar cambios de scope si se proporciona
      const newScope = req.body.rubric_scope;
      if (newScope && newScope !== rubric.rubric_scope) {
        if (newScope === 'phase' && !req.body.phase_id) {
          throw Object.assign(new Error('Las rúbricas de fase requieren un phase_id'), { statusCode: 400 });
        }
        if (newScope === 'project' && req.body.phase_id) {
          throw Object.assign(new Error('Las rúbricas de proyecto no deben tener phase_id'), { statusCode: 400 });
        }
      }

      const updateData = {
        name: req.body.name ?? rubric.name,
        description: req.body.description ?? rubric.description,
        scale_min: req.body.scale_min ?? rubric.scale_min,
        scale_max: req.body.scale_max ?? rubric.scale_max,
        model_preference: req.body.model_preference ?? rubric.model_preference,
        updated_by: req.user.id
      };

      if (newScope) {
        updateData.rubric_scope = newScope;
      }

      if (req.body.phase_id !== undefined) {
        updateData.phase_id = newScope === 'project' ? null : req.body.phase_id;
      }

      await rubric.update(updateData, { transaction });

      if (Array.isArray(req.body.criteria)) {
        await PhaseRubricCriterion.destroy({ where: { rubric_id: rubric.id }, transaction });

        const criteria = normalizeCriteria(req.body.criteria);
        if (criteria.length === 0) {
          throw Object.assign(new Error('La rúbrica debe tener al menos un criterio'), { statusCode: 400 });
        }

        await Promise.all(
          criteria.map(criterion =>
            PhaseRubricCriterion.create(
              {
                tenant_id: tenantId,
                rubric_id: rubric.id,
                title: criterion.title,
                description: criterion.description,
                weight: criterion.weight,
                max_score: criterion.max_score,
                order_index: criterion.order_index
              },
              { transaction }
            )
          )
        );
      }

      await transaction.commit();

      const updatedRubric = await PhaseRubric.findOne({
        where: { id: rubric.id },
        include: [{ association: 'criteria' }]
      });

      // Asegurar que tareas referenciando la rúbrica sigan apuntando correctamente
      await Task.update(
        { phase_rubric_id: updatedRubric.id },
        { where: { phase_rubric_id: updatedRubric.id }, silent: true }
      );

      res.json({ success: true, data: sortCriteria(updatedRubric) });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async delete(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const eventId = Number(req.params.eventId);
      const phaseId = req.params.phaseId ? Number(req.params.phaseId) : null;
      const rubricId = Number(req.params.rubricId);
      const { PhaseRubric, PhaseRubricCriterion, Task } = getModels();

      await ensureEvent(eventId);
      const rubric = await ensureRubric(eventId, phaseId, rubricId);

      await Task.update(
        { phase_rubric_id: null },
        { where: { phase_rubric_id: rubric.id }, transaction }
      );

      await PhaseRubricCriterion.destroy({ where: { rubric_id: rubric.id }, transaction });
      await rubric.destroy({ transaction });

      await transaction.commit();
      res.status(204).send();
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  // Métodos para rúbricas de proyecto
  static async listByProject(req, res, next) {
    try {
      const eventId = Number(req.params.eventId);
      const { PhaseRubric } = getModels();

      await ensureEvent(eventId);

      const rubrics = await PhaseRubric.findAll({
        where: { event_id: eventId, rubric_scope: 'project' },
        order: [['created_at', 'DESC']],
        include: [{ association: 'criteria' }]
      });

      res.json({ success: true, data: rubrics.map(sortCriteria) });
    } catch (error) {
      next(error);
    }
  }

  static async createProjectRubric(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const eventId = Number(req.params.eventId);
      const { PhaseRubric, PhaseRubricCriterion } = getModels();

      await ensureEvent(eventId);

      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw Object.assign(new Error('Tenant no encontrado'), { statusCode: 400 });
      }

      const rubric = await PhaseRubric.create(
        {
          tenant_id: tenantId,
          event_id: eventId,
          phase_id: null,
          rubric_scope: 'project',
          name: req.body.name,
          description: req.body.description,
          scale_min: req.body.scale_min ?? 0,
          scale_max: req.body.scale_max ?? 100,
          model_preference: req.body.model_preference,
          created_by: req.user.id
        },
        { transaction }
      );

      const criteria = normalizeCriteria(req.body.criteria);
      if (criteria.length === 0) {
        throw Object.assign(new Error('La rúbrica debe tener al menos un criterio'), { statusCode: 400 });
      }

      await Promise.all(
        criteria.map(criterion =>
          PhaseRubricCriterion.create(
            {
              tenant_id: tenantId,
              rubric_id: rubric.id,
              title: criterion.title,
              description: criterion.description,
              weight: criterion.weight,
              max_score: criterion.max_score,
              order_index: criterion.order_index
            },
            { transaction }
          )
        )
      );

      await transaction.commit();

      const createdRubric = await PhaseRubric.findOne({
        where: { id: rubric.id },
        include: [{ association: 'criteria' }]
      });

      res.status(201).json({ success: true, data: sortCriteria(createdRubric) });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async updateProjectRubric(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const eventId = Number(req.params.eventId);
      const rubricId = Number(req.params.rubricId);
      const { PhaseRubric, PhaseRubricCriterion } = getModels();

      await ensureEvent(eventId);
      const rubric = await ensureRubric(eventId, null, rubricId);
      const tenantId = req.tenant?.id;
      if (!tenantId) {
        throw Object.assign(new Error('Tenant no encontrado'), { statusCode: 400 });
      }

      if (rubric.rubric_scope !== 'project') {
        throw Object.assign(new Error('Esta rúbrica no es de proyecto'), { statusCode: 400 });
      }

      await rubric.update(
        {
          name: req.body.name ?? rubric.name,
          description: req.body.description ?? rubric.description,
          scale_min: req.body.scale_min ?? rubric.scale_min,
          scale_max: req.body.scale_max ?? rubric.scale_max,
          model_preference: req.body.model_preference ?? rubric.model_preference,
          updated_by: req.user.id
        },
        { transaction }
      );

      if (Array.isArray(req.body.criteria)) {
        await PhaseRubricCriterion.destroy({ where: { rubric_id: rubric.id }, transaction });

        const criteria = normalizeCriteria(req.body.criteria);
        if (criteria.length === 0) {
          throw Object.assign(new Error('La rúbrica debe tener al menos un criterio'), { statusCode: 400 });
        }

        await Promise.all(
          criteria.map(criterion =>
            PhaseRubricCriterion.create(
              {
                tenant_id: tenantId,
                rubric_id: rubric.id,
                title: criterion.title,
                description: criterion.description,
                weight: criterion.weight,
                max_score: criterion.max_score,
                order_index: criterion.order_index
              },
              { transaction }
            )
          )
        );
      }

      await transaction.commit();

      const updatedRubric = await PhaseRubric.findOne({
        where: { id: rubric.id },
        include: [{ association: 'criteria' }]
      });

      res.json({ success: true, data: sortCriteria(updatedRubric) });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  static async deleteProjectRubric(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const eventId = Number(req.params.eventId);
      const rubricId = Number(req.params.rubricId);
      const { PhaseRubric, PhaseRubricCriterion } = getModels();

      await ensureEvent(eventId);
      const rubric = await ensureRubric(eventId, null, rubricId);

      if (rubric.rubric_scope !== 'project') {
        throw Object.assign(new Error('Esta rúbrica no es de proyecto'), { statusCode: 400 });
      }

      await PhaseRubricCriterion.destroy({ where: { rubric_id: rubric.id }, transaction });
      await rubric.destroy({ transaction });

      await transaction.commit();
      res.status(204).send();
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }
}


