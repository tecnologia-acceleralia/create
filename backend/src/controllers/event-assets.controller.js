import multer from 'multer';
import { Op } from 'sequelize';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { uploadEventAsset, deleteObjectByKey, checkObjectExists, getSettings, extractKeyFromUrl } from '../services/tenant-assets.service.js';
import { normalizeFileName, sanitizeLogicalAssetName } from '../utils/s3-utils.js';
import { extractAssetNames } from '../utils/asset-markers.js';
import { t } from '../utils/i18n.js';
import {
  badRequestResponse,
  conflictResponse,
  errorResponse,
  notFoundResponse
} from '../utils/response.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB
  }
});

export class EventAssetsController {
  /**
   * Lista todos los assets de un evento
   */
  static async list(req, res) {
    try {
      const { eventId } = req.params;
      const { tenant } = req;

      const { EventAsset } = getModels();
      const { sequelize } = EventAsset;

      const assets = await EventAsset.findAll({
        where: {
          tenant_id: tenant.id,
          event_id: eventId
        },
        order: [
          // Ordenar alfabéticamente por el campo que se muestra en el combo: original_filename || name
          // Maneja tanto NULL como cadenas vacías para coincidir con el comportamiento del frontend
          [sequelize.literal('LOWER(COALESCE(NULLIF(original_filename, ""), name))'), 'ASC']
        ]
      });

      return res.json({
        success: true,
        data: assets.map(asset => asset.toJSON())
      });
    } catch (error) {
      logger.error('Error al listar assets del evento', { error: error.message, stack: error.stack });
      return errorResponse(res, t(req, 'eventAssets.listError'), 500);
    }
  }

  /**
   * Sube un nuevo asset para un evento
   */
  static async upload(req, res) {
    try {
      const { eventId } = req.params;
      const { tenant } = req;
      const file = req.file;

      if (!file) {
        return badRequestResponse(res, t(req, 'eventAssets.noFileProvided'));
      }

      let { name, description } = req.body;

      const safeOriginalFileName = normalizeFileName(file.originalname);

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        name = safeOriginalFileName;
      } else {
        name = sanitizeLogicalAssetName(name);
      }

      if (!name || !name.trim()) {
        name = safeOriginalFileName;
      }

      // Normalizar description si se proporciona
      if (description && typeof description === 'string') {
        description = description.trim() || null;
      } else {
        description = null;
      }

      const { EventAsset, Event } = getModels();

      // Verificar que el evento existe y pertenece al tenant
      const event = await Event.findOne({
        where: {
          id: eventId,
          tenant_id: tenant.id
        }
      });

      if (!event) {
        return notFoundResponse(res, t(req, 'eventAssets.eventNotFound'));
      }

      // Verificar si ya existe un asset con ese nombre para este evento
      const existingAsset = await EventAsset.findOne({
        where: {
          tenant_id: tenant.id,
          event_id: eventId,
          name: name.trim()
        }
      });

      // Si existe y no se solicita sobreescribir, retornar error
      const overwrite = req.body.overwrite === 'true' || req.body.overwrite === true;
      if (existingAsset && !overwrite) {
        return conflictResponse(res, t(req, 'eventAssets.duplicateResourceName'));
      }

      // Si existe y se solicita sobreescribir, eliminar el asset anterior
      if (existingAsset && overwrite) {
        // Eliminar de S3
        try {
          await deleteObjectByKey(existingAsset.s3_key);
        } catch (error) {
          logger.warn('Error al eliminar archivo anterior de S3 (continuando con sobreescritura)', {
            error: error.message,
            s3_key: existingAsset.s3_key
          });
        }
        // Eliminar de la base de datos
        await existingAsset.destroy();
      }

      // Subir el archivo a S3 (nombre sanitizado para la clave del objeto)
      const { url, key } = await uploadEventAsset({
        tenantId: tenant.id,
        eventId: Number(eventId),
        fileName: safeOriginalFileName,
        buffer: file.buffer,
        contentType: file.mimetype
      });

      // Guardar en la base de datos
      const asset = await EventAsset.create({
        tenant_id: tenant.id,
        event_id: eventId,
        name: name.trim(), // Nombre normalizado sin acentos (usado en marcadores)
        original_filename: safeOriginalFileName,
        s3_key: key,
        url,
        mime_type: file.mimetype,
        file_size: file.size,
        uploaded_by: req.user.id,
        description: description || null
      });

      return res.status(201).json({
        success: true,
        data: asset.toJSON()
      });
    } catch (error) {
      logger.error('Error al subir asset del evento', { error: error.message, stack: error.stack });
      return errorResponse(res, t(req, 'eventAssets.uploadError'), 500);
    }
  }

  /**
   * Valida que todos los assets de un evento existan en S3
   */
  static async validate(req, res) {
    try {
      const { eventId } = req.params;
      const { tenant } = req;

      const { EventAsset } = getModels();

      const assets = await EventAsset.findAll({
        where: {
          tenant_id: tenant.id,
          event_id: eventId
        }
      });

      // Obtener configuración de S3 para extraer keys de URLs si es necesario
      const settings = getSettings();

      // Verificar existencia de cada asset en S3
      const validationResults = await Promise.all(
        assets.map(async (asset) => {
          let exists = false;
          let checkedKey = asset.s3_key;
          const keysToCheck = [];

          // Agregar el s3_key almacenado si existe
          if (asset.s3_key) {
            keysToCheck.push({ key: asset.s3_key, source: 's3_key' });
          }

          // Extraer el key de la URL si existe y es diferente
          if (asset.url) {
            const keyFromUrl = extractKeyFromUrl(asset.url, settings);
            if (keyFromUrl && keyFromUrl !== asset.s3_key) {
              keysToCheck.push({ key: keyFromUrl, source: 'url' });
            }
          }

          // Verificar cada key hasta encontrar uno que exista
          for (const { key, source } of keysToCheck) {
            const keyExists = await checkObjectExists(key);
            if (keyExists) {
              exists = true;
              checkedKey = key;
              // Si el key que funciona viene de la URL y no del s3_key, loguear advertencia
              if (source === 'url' && asset.s3_key && key !== asset.s3_key) {
                logger.warn('s3_key no coincide con la URL, pero el archivo existe con el key de la URL', {
                  assetId: asset.id,
                  assetName: asset.name,
                  storedS3Key: asset.s3_key,
                  urlKey: key,
                  url: asset.url
                });
              }
              break;
            }
          }

          // Si ningún key funciona, loguear para depuración
          if (!exists && keysToCheck.length > 0) {
            logger.warn('Asset no encontrado en S3 con ningún key', {
              assetId: asset.id,
              assetName: asset.name,
              s3_key: asset.s3_key,
              url: asset.url,
              keysChecked: keysToCheck.map(k => k.key)
            });
          }

          return {
            id: asset.id,
            name: asset.name,
            s3_key: asset.s3_key,
            url: asset.url,
            checkedKey,
            exists
          };
        })
      );

      return res.json({
        success: true,
        data: validationResults
      });
    } catch (error) {
      logger.error('Error al validar assets del evento', { error: error.message, stack: error.stack });
      return errorResponse(res, t(req, 'eventAssets.validateError'), 500);
    }
  }

  /**
   * Comprueba marcadores de assets en campos HTML de fases y tareas
   */
  static async checkMarkers(req, res) {
    try {
      const { eventId } = req.params;
      const { tenant } = req;

      const { EventAsset, Phase, Task, Event } = getModels();

      // Verificar que el evento existe y pertenece al tenant
      const event = await Event.findOne({
        where: {
          id: eventId,
          tenant_id: tenant.id
        }
      });

      if (!event) {
        return notFoundResponse(res, t(req, 'eventAssets.eventNotFound'));
      }

      // Obtener todos los assets del evento
      const assets = await EventAsset.findAll({
        where: {
          tenant_id: tenant.id,
          event_id: eventId
        }
      });

      const assetNames = new Set(assets.map(a => a.name));

      // Buscar marcadores en fases
      const phases = await Phase.findAll({
        where: {
          tenant_id: tenant.id,
          event_id: eventId
        },
        attributes: ['id', 'name', 'intro_html']
      });

      // Buscar marcadores en tareas
      const tasks = await Task.findAll({
        where: {
          tenant_id: tenant.id,
          event_id: eventId
        },
        include: [
          {
            model: Phase,
            as: 'phase',
            attributes: ['id', 'name']
          }
        ],
        attributes: ['id', 'title', 'intro_html', 'phase_id']
      });

      // Buscar marcadores en description_html del evento
      const eventMarkers = extractAssetNames(event.description_html || '');

      const invalidMarkers = [];

      // Verificar marcadores en fases
      for (const phase of phases) {
        if (phase.intro_html) {
          const markers = extractAssetNames(phase.intro_html);
          for (const marker of markers) {
            if (!assetNames.has(marker)) {
              invalidMarkers.push({
                type: 'phase',
                id: phase.id,
                name: phase.name,
                marker: `{{asset:${marker}}}`,
                assetName: marker
              });
            }
          }
        }
      }

      // Verificar marcadores en tareas
      for (const task of tasks) {
        if (task.intro_html) {
          const markers = extractAssetNames(task.intro_html);
          for (const marker of markers) {
            if (!assetNames.has(marker)) {
              invalidMarkers.push({
                type: 'task',
                id: task.id,
                title: task.title,
                phaseId: task.phase_id,
                phaseName: task.phase?.name || t(req, 'eventAssets.unknownPhase'),
                marker: `{{asset:${marker}}}`,
                assetName: marker
              });
            }
          }
        }
      }

      // Verificar marcadores en el evento
      for (const marker of eventMarkers) {
        if (!assetNames.has(marker)) {
          invalidMarkers.push({
            type: 'event',
            id: event.id,
            name: event.name,
            marker: `{{asset:${marker}}}`,
            assetName: marker
          });
        }
      }

      return res.json({
        success: true,
        data: {
          invalidMarkers,
          totalInvalid: invalidMarkers.length,
          totalAssets: assets.length
        }
      });
    } catch (error) {
      logger.error('Error al comprobar marcadores', { error: error.message, stack: error.stack });
      return errorResponse(res, t(req, 'eventAssets.checkMarkersError'), 500);
    }
  }

  /**
   * Actualiza un asset de un evento (nombre y/o descripción)
   */
  static async update(req, res) {
    try {
      const { eventId, assetId } = req.params;
      const { tenant } = req;
      const { name, description } = req.body;

      const { EventAsset } = getModels();

      const asset = await EventAsset.findOne({
        where: {
          id: assetId,
          tenant_id: tenant.id,
          event_id: eventId
        }
      });

      if (!asset) {
        return notFoundResponse(res, t(req, 'eventAssets.resourceNotFound'));
      }

      // Si se proporciona un nombre nuevo, sanitizarlo (misma lógica que en upload)
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return badRequestResponse(res, t(req, 'eventAssets.nameCannotBeEmpty'));
        }

        const normalizedName = sanitizeLogicalAssetName(name);
        if (!normalizedName) {
          return badRequestResponse(res, t(req, 'eventAssets.nameInvalid'));
        }

        // Verificar si ya existe otro asset con ese nombre (excluyendo el actual)
        const existingAsset = await EventAsset.findOne({
          where: {
            tenant_id: tenant.id,
            event_id: eventId,
            name: normalizedName,
            id: { [Op.ne]: assetId }
          }
        });

        if (existingAsset) {
          return conflictResponse(res, t(req, 'eventAssets.duplicateResourceName'));
        }

        asset.name = normalizedName;
      }

      // Si se proporciona una descripción, normalizarla
      if (description !== undefined) {
        if (typeof description === 'string') {
          asset.description = description.trim() || null;
        } else if (description === null) {
          asset.description = null;
        }
      }

      await asset.save();

      return res.json({
        success: true,
        data: asset.toJSON()
      });
    } catch (error) {
      logger.error('Error al actualizar asset del evento', { error: error.message, stack: error.stack });
      return errorResponse(res, t(req, 'eventAssets.updateError'), 500);
    }
  }

  /**
   * Elimina un asset de un evento
   */
  static async delete(req, res) {
    try {
      const { eventId, assetId } = req.params;
      const { tenant } = req;

      const { EventAsset } = getModels();

      const asset = await EventAsset.findOne({
        where: {
          id: assetId,
          tenant_id: tenant.id,
          event_id: eventId
        }
      });

      if (!asset) {
        return notFoundResponse(res, t(req, 'eventAssets.resourceNotFound'));
      }

      // Eliminar de S3
      try {
        await deleteObjectByKey(asset.s3_key);
      } catch (error) {
        logger.warn('Error al eliminar archivo de S3 (continuando con eliminación de BD)', {
          error: error.message,
          s3_key: asset.s3_key
        });
      }

      // Eliminar de la base de datos
      await asset.destroy();

      return res.json({
        success: true,
        message: t(req, 'eventAssets.deleteSuccess')
      });
    } catch (error) {
      logger.error('Error al eliminar asset del evento', { error: error.message, stack: error.stack });
      return errorResponse(res, t(req, 'eventAssets.deleteError'), 500);
    }
  }
}

// Middleware para manejar la subida de archivos
export const uploadMiddleware = upload.single('file');

