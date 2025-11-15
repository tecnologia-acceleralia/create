import multer from 'multer';
import { getModels } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { uploadEventAsset, deleteObjectByKey } from '../services/tenant-assets.service.js';

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

      const assets = await EventAsset.findAll({
        where: {
          tenant_id: tenant.id,
          event_id: eventId
        },
        order: [['created_at', 'DESC']]
      });

      return res.json({
        success: true,
        data: assets.map(asset => asset.toJSON())
      });
    } catch (error) {
      logger.error('Error al listar assets del evento', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Error al listar los archivos del evento'
      });
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
        return res.status(400).json({
          success: false,
          message: 'No se proporcionó ningún archivo'
        });
      }

      let { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        // Si no se proporciona nombre, usar el nombre del archivo normalizado
        name = file.originalname
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9.\-_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');
      } else {
        // Normalizar el nombre proporcionado (eliminar acentos)
        name = name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9.\-_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');
      }

      // Validar formato del nombre (solo letras, números, guiones, puntos y guiones bajos)
      const nameRegex = /^[a-zA-Z0-9._-]+$/;
      if (!nameRegex.test(name.trim())) {
        return res.status(400).json({
          success: false,
          message: 'El nombre del recurso solo puede contener letras, números, guiones, puntos y guiones bajos'
        });
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
        return res.status(404).json({
          success: false,
          message: 'Evento no encontrado'
        });
      }

      // Verificar si ya existe un asset con ese nombre para este evento
      const existingAsset = await EventAsset.findOne({
        where: {
          tenant_id: tenant.id,
          event_id: eventId,
          name: name.trim()
        }
      });

      if (existingAsset) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un recurso con ese nombre para este evento'
        });
      }

      // Subir el archivo a S3
      const { url, key } = await uploadEventAsset({
        tenantId: tenant.id,
        eventId: Number(eventId),
        fileName: file.originalname,
        buffer: file.buffer,
        contentType: file.mimetype
      });

      // Normalizar el nombre del archivo original también
      const normalizedOriginalName = file.originalname
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.\-_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

      // Guardar en la base de datos
      const asset = await EventAsset.create({
        tenant_id: tenant.id,
        event_id: eventId,
        name: name.trim(), // Nombre normalizado sin acentos (usado en marcadores)
        original_filename: normalizedOriginalName, // Nombre original también normalizado
        s3_key: key,
        url,
        mime_type: file.mimetype,
        file_size: file.size,
        uploaded_by: req.user.id
      });

      return res.status(201).json({
        success: true,
        data: asset.toJSON()
      });
    } catch (error) {
      logger.error('Error al subir asset del evento', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Error al subir el archivo'
      });
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
        return res.status(404).json({
          success: false,
          message: 'Recurso no encontrado'
        });
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
        message: 'Recurso eliminado correctamente'
      });
    } catch (error) {
      logger.error('Error al eliminar asset del evento', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar el archivo'
      });
    }
  }
}

// Middleware para manejar la subida de archivos
export const uploadMiddleware = upload.single('file');

