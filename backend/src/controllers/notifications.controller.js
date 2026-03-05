import { getModels } from '../models/index.js';

export class NotificationsController {
  static async list(req, res, next) {
    try {
      const { Notification } = getModels();
      const notifications = await Notification.findAll({
        where: { user_id: req.user.id },
        order: [['created_at', 'DESC']]
      });
      
      // Serializar notificaciones y asegurar que las fechas estén en formato ISO
      const serializedNotifications = notifications.map(notification => {
        const notificationJson = notification.toJSON();
        
        // Función helper para convertir fechas a ISO string (maneja null, Date inválidos y strings MySQL)
        const toISOString = (dateValue) => {
          if (dateValue == null) return null;
          if (dateValue instanceof Date) {
            if (Number.isNaN(dateValue.getTime())) return null;
            return dateValue.toISOString();
          }
          if (typeof dateValue === 'string' && dateValue.trim() !== '') {
            const date = new Date(dateValue);
            if (!Number.isNaN(date.getTime())) return date.toISOString();
          }
          return null;
        };

        const createdAtIso = toISOString(notificationJson.created_at);
        const updatedAtIso = toISOString(notificationJson.updated_at);
        // Mostrar siempre una fecha: created_at, o updated_at, o fecha actual como último recurso
        notificationJson.created_at = createdAtIso ?? updatedAtIso ?? new Date().toISOString();
        notificationJson.updated_at = updatedAtIso ?? new Date().toISOString();
        
        return notificationJson;
      });
      
      res.json({ success: true, data: serializedNotifications });
    } catch (error) {
      next(error);
    }
  }

  static async markRead(req, res, next) {
    try {
      const { Notification } = getModels();
      const notification = await Notification.findOne({
        where: { id: req.params.notificationId, user_id: req.user.id }
      });

      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
      }

      await notification.update({ is_read: true });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

