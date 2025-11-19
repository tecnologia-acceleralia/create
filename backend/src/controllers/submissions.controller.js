import crypto from 'node:crypto';
import { getSequelize } from '../database/database.js';
import { getModels } from '../models/index.js';
import { decodeBase64File, deleteObjectByKey, uploadSubmissionFile } from '../services/tenant-assets.service.js';
import { logger } from '../utils/logger.js';
import { isManager, isReviewer } from '../utils/authorization.js';
import { findMembership } from '../utils/finders.js';
import { successResponse, notFoundResponse, forbiddenResponse } from '../utils/response.js';

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

      // Validar que el proyecto del equipo esté activo
      if (teamId) {
        const { Project } = getModels();
        const project = await Project.findOne({ where: { team_id: teamId } });
        if (project && project.status !== 'active') {
          throw Object.assign(new Error('No se pueden hacer entregas en proyectos inactivos'), { statusCode: 409 });
        }
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
      return successResponse(res, result, 201);
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
        return notFoundResponse(res, 'Tarea no encontrada');
      }

      let whereClause = { task_id: taskId };

      if (!isReviewer(req)) {
        const membership = await findMembership(req.user.id, task.event_id);
        if (!membership) {
          // Participantes sin equipo no deberían ver entregas ajenas,
          // pero devolver 403 rompía la UI del participante.
          // Retornamos lista vacía para mantener la experiencia coherente.
          return successResponse(res, []);
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

      return successResponse(res, submissions);
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
        return notFoundResponse(res, 'Entrega no encontrada');
      }

      if (!isReviewer(req)) {
        const membership = await findMembership(req.user.id, submission.event_id);
        if (!membership || membership.team.id !== submission.team_id) {
          return forbiddenResponse(res);
        }
      }

      return successResponse(res, submission);
    } catch (error) {
      next(error);
    }
  }
}

