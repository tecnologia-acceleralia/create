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
  const rubric = await PhaseRubric.findOne({
    where: { id: rubricId, event_id: eventId, phase_id: phaseId },
    include: [{ association: 'criteria' }]
  });

  if (!rubric) {
    const error = new Error('Rúbrica no encontrada');
    error.statusCode = 404;
    throw error;
  }
  return sortCriteria(rubric);
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
      const phaseId = Number(req.params.phaseId);
      const { PhaseRubric, PhaseRubricCriterion } = getModels();

      await ensurePhase(eventId, phaseId);

      const rubric = await PhaseRubric.create(
        {
          event_id: eventId,
          phase_id: phaseId,
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
      const phaseId = Number(req.params.phaseId);
      const rubricId = Number(req.params.rubricId);
      const { PhaseRubric, PhaseRubricCriterion, Task } = getModels();

      await ensurePhase(eventId, phaseId);
      const rubric = await ensureRubric(eventId, phaseId, rubricId);

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
      const phaseId = Number(req.params.phaseId);
      const rubricId = Number(req.params.rubricId);
      const { PhaseRubric, PhaseRubricCriterion, Task } = getModels();

      await ensurePhase(eventId, phaseId);
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
}


