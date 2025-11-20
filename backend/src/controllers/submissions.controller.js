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
      const requiresFiles = ['file', 'zip', 'audio', 'video'].includes(task.delivery_type);
      
      // Validar que se proporcione al menos un archivo si el tipo de entrega lo requiere
      if (requiresFiles && filesPayload.length === 0) {
        throw Object.assign(new Error('Debes subir al menos un archivo para esta entrega'), { statusCode: 400 });
      }
      
      // Validar que no se suban archivos si el tipo de entrega no lo permite
      if (filesPayload.length > 0 && !requiresFiles && task.delivery_type !== 'none') {
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
        tenant_id: req.tenant.id,
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

          let buffer, mimeType;
          try {
            const decoded = decodeBase64File(rawFile.base64);
            buffer = decoded.buffer;
            mimeType = decoded.mimeType;
          } catch (decodeError) {
            logger.error('Error decodificando archivo base64', { 
              error: decodeError.message, 
              stack: decodeError.stack,
              fileIndex: index 
            });
            throw Object.assign(new Error('Error al procesar el archivo: ' + decodeError.message), { statusCode: 400 });
          }

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

          let key, url;
          try {
            const uploadResult = await uploadSubmissionFile({
              tenantId: req.tenant.id,
              submissionId: submission.id,
              fileName,
              buffer,
              contentType: mimeType
            });
            key = uploadResult.key;
            url = uploadResult.url;
          } catch (uploadError) {
            logger.error('Error subiendo archivo a S3', { 
              error: uploadError.message, 
              stack: uploadError.stack,
              fileName,
              sizeBytes 
            });
            throw Object.assign(new Error('Error al subir el archivo: ' + uploadError.message), { statusCode: 500 });
          }

          uploadedFiles.push({ key });

          try {
            const record = await SubmissionFile.create({
              tenant_id: req.tenant.id,
              submission_id: submission.id,
              url,
              storage_key: key,
              mime_type: mimeType,
              size_bytes: sizeBytes,
              original_name: fileName,
              checksum
            }, { transaction });

            uploadedFiles[uploadedFiles.length - 1].recordId = record.id;
          } catch (dbError) {
            logger.error('Error guardando SubmissionFile en BD', { 
              error: dbError.message, 
              stack: dbError.stack,
              fileName,
              key 
            });
            throw Object.assign(new Error('Error al guardar el archivo: ' + dbError.message), { statusCode: 500 });
          }
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
        logger.error('Error registrando entrega', { 
          error: error.message, 
          stack: error.stack,
          taskId: req.params.taskId,
          userId: req.user?.id,
          tenantId: req.tenant?.id
        });
      }
      next(error);
    }
  }

  static async listByTask(req, res, next) {
    try {
      const { Submission, Team, User, Task, SubmissionFile, Evaluation } = getModels();
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

      const { Project } = getModels();
      const submissions = await Submission.findAll({
        where: whereClause,
        order: [['submitted_at', 'DESC']],
        include: [
          { 
            model: Team, 
            as: 'team',
            include: [
              { model: Project, as: 'project' }
            ]
          },
          { model: User, as: 'submitter', attributes: ['id', 'email', 'first_name', 'last_name'] },
          { model: SubmissionFile, as: 'files' }
        ]
      });

      // Agregar información de evaluaciones finales para cada entrega
      const submissionsWithEvaluationStatus = await Promise.all(
        submissions.map(async (submission) => {
          const finalEvaluation = await Evaluation.findOne({
            where: {
              submission_id: submission.id,
              status: 'final'
            },
            order: [['created_at', 'DESC']]
          });

          const pendingEvaluation = await Evaluation.findOne({
            where: {
              submission_id: submission.id,
              status: 'draft'
            },
            order: [['created_at', 'DESC']]
          });

          const submissionData = submission.toJSON();
          submissionData.has_final_evaluation = !!finalEvaluation;
          submissionData.has_pending_evaluation = !!pendingEvaluation;
          submissionData.final_evaluation_id = finalEvaluation?.id || null;
          return submissionData;
        })
      );

      return successResponse(res, submissionsWithEvaluationStatus);
    } catch (error) {
      next(error);
    }
  }

  static async detail(req, res, next) {
    try {
      const { Submission, Evaluation, SubmissionFile, Team, Project } = getModels();
      const submission = await Submission.findOne({
        where: { id: req.params.submissionId },
        include: [
          { model: Evaluation, as: 'evaluations' },
          { model: SubmissionFile, as: 'files' },
          {
            model: Team,
            as: 'team',
            include: [
              { model: Project, as: 'project' }
            ]
          }
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

