import crypto from 'node:crypto';
import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { decodeBase64File, deleteObjectByKey, uploadSubmissionFile } from '../services/tenant-assets.service.js';
import { logger } from '../utils/logger.js';

function getRoleScopes(user) {
  const scopes = user?.roleScopes;
  if (!Array.isArray(scopes)) {
    return [];
  }
  return scopes;
}

function isManager(req) {
  if (req.auth?.isSuperAdmin) {
    return true;
  }
  const roleScopes = getRoleScopes(req.user);
  return roleScopes.some(scope => scope === 'tenant_admin' || scope === 'organizer');
}

function isReviewer(req) {
  if (req.auth?.isSuperAdmin) {
    return true;
  }
  const roleScopes = getRoleScopes(req.user);
  return roleScopes.some(scope => ['tenant_admin', 'organizer', 'evaluator'].includes(scope));
}

async function findMembership(userId, eventId) {
  const { TeamMember, Team } = getModels();
  return TeamMember.findOne({
    where: { user_id: userId },
    include: [{ model: Team, as: 'team', where: { event_id: eventId } }]
  });
}

export class SubmissionsController {
  static async create(req, res, next) {
    const transaction = await getSequelize().transaction();
    try {
      const { Task, Submission, TeamMember, SubmissionFile } = getModels();
      const taskId = Number(req.params.taskId ?? req.body.task_id);
      const task = await Task.findOne({ where: { id: taskId } });
      if (!task) {
        throw Object.assign(new Error('Tarea no encontrada'), { statusCode: 404 });
      }

      const filesPayload = Array.isArray(req.body.files) ? req.body.files : [];
      if (filesPayload.length > 0 && !['file', 'zip', 'audio', 'video'].includes(task.delivery_type)) {
        throw Object.assign(new Error('La tarea no permite archivos adjuntos'), { statusCode: 400 });
      }

      if (filesPayload.length > (task.max_files ?? 1)) {
        throw Object.assign(new Error('Se excede el número máximo de archivos permitidos'), { statusCode: 400 });
      }

      const allowedMimeTypes = Array.isArray(task.allowed_mime_types) ? task.allowed_mime_types : [];

      let teamId = req.body.team_id ? Number(req.body.team_id) : null;

      if (isManager(req) && !teamId) {
        throw Object.assign(new Error('team_id requerido para administradores'), { statusCode: 400 });
      }

      if (!isManager(req)) {
        const membership = await findMembership(req.user.id, task.event_id);
        if (!membership) {
          throw Object.assign(new Error('No perteneces a un equipo en este evento'), { statusCode: 403 });
        }
        if (membership.role !== 'captain') {
          throw Object.assign(new Error('Solo el capitán del equipo puede hacer entregas'), { statusCode: 403 });
        }
        teamId = membership.team.id;
      }

      const submission = await Submission.create({
        task_id: task.id,
        event_id: task.event_id,
        team_id: teamId,
        submitted_by: req.user.id,
        status: req.body.status ?? 'draft',
        type: req.body.type ?? 'provisional',
        content: req.body.content,
        attachment_url: req.body.attachment_url
      }, { transaction });

      // Ensure membership exists for submitter in team
      const membership = await TeamMember.findOne({ where: { team_id: teamId, user_id: req.user.id } });
      if (!membership && !isManager(req)) {
        throw Object.assign(new Error('No autorizado para registrar entregas de este equipo'), { statusCode: 403 });
      }

      const uploadedFiles = [];
      try {
        for (const [index, rawFile] of filesPayload.entries()) {
          if (!rawFile?.base64) {
            throw Object.assign(new Error('Archivo inválido'), { statusCode: 400 });
          }

          const { buffer, mimeType } = decodeBase64File(rawFile.base64);
          if (!mimeType) {
            throw Object.assign(new Error('No se pudo determinar el tipo MIME del archivo'), { statusCode: 400 });
          }

          if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(mimeType)) {
            throw Object.assign(new Error(`Tipo de archivo no permitido (${mimeType})`), { statusCode: 400 });
          }

          const sizeBytes = buffer.byteLength;
          if (task.max_file_size_mb && sizeBytes > task.max_file_size_mb * 1024 * 1024) {
            throw Object.assign(new Error('Archivo excede el tamaño máximo permitido'), { statusCode: 400 });
          }

          const fileName = rawFile.name || `archivo-${index + 1}`;
          const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

          const { key, url } = await uploadSubmissionFile({
            tenantSlug: req.tenant.slug,
            submissionId: submission.id,
            fileName,
            buffer,
            contentType: mimeType
          });

          uploadedFiles.push({ key });

          const record = await SubmissionFile.create({
            submission_id: submission.id,
            url,
            storage_key: key,
            mime_type: mimeType,
            size_bytes: sizeBytes,
            original_name: fileName,
            checksum
          }, { transaction });

          uploadedFiles[uploadedFiles.length - 1].recordId = record.id;
        }
      } catch (fileError) {
        fileError.uploadedFiles = uploadedFiles;
        throw fileError;
      }

      await transaction.commit();
      const result = await Submission.findOne({
        where: { id: submission.id },
        include: ['task', 'team', { model: SubmissionFile, as: 'files' }]
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      await transaction.rollback();
      if (Array.isArray(error?.uploadedFiles) && error.uploadedFiles.length > 0) {
        await Promise.all(
          error.uploadedFiles.map(file => deleteObjectByKey(file.key).catch(() => {}))
        );
      }
      if (!error.statusCode || error.statusCode >= 500) {
        logger.error('Error registrando entrega', { error: error.message });
      }
      next(error);
    }
  }

  static async listByTask(req, res, next) {
    try {
      const { Submission, Team, User, Task, SubmissionFile } = getModels();
      const taskId = Number(req.params.taskId);

      const task = await Task.findOne({ where: { id: taskId } });
      if (!task) {
        return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
      }

      let whereClause = { task_id: taskId };

      if (!isReviewer(req)) {
        const membership = await findMembership(req.user.id, task.event_id);
        if (!membership) {
          // Participantes sin equipo no deberían ver entregas ajenas,
          // pero devolver 403 rompía la UI del participante.
          // Retornamos lista vacía para mantener la experiencia coherente.
          return res.json({ success: true, data: [] });
        }
        whereClause = { ...whereClause, team_id: membership.team.id };
      }

      const submissions = await Submission.findAll({
        where: whereClause,
        order: [['submitted_at', 'DESC']],
        include: [
          { model: Team, as: 'team' },
          { model: User, as: 'submitter', attributes: ['id', 'email', 'first_name', 'last_name'] },
          { model: SubmissionFile, as: 'files' }
        ]
      });

      res.json({ success: true, data: submissions });
    } catch (error) {
      next(error);
    }
  }

  static async detail(req, res, next) {
    try {
      const { Submission, Evaluation, SubmissionFile } = getModels();
      const submission = await Submission.findOne({
        where: { id: req.params.submissionId },
        include: [
          { model: Evaluation, as: 'evaluations' },
          { model: SubmissionFile, as: 'files' }
        ]
      });

      if (!submission) {
        return res.status(404).json({ success: false, message: 'Entrega no encontrada' });
      }

      if (!isReviewer(req)) {
        const membership = await findMembership(req.user.id, submission.event_id);
        if (!membership || membership.team.id !== submission.team_id) {
          return res.status(403).json({ success: false, message: 'No autorizado' });
        }
      }

      res.json({ success: true, data: submission });
    } catch (error) {
      next(error);
    }
  }
}

