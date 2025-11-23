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
        
        // Función helper para convertir fechas a ISO string
        const toISOString = (dateValue) => {
          if (dateValue == null) {
            return null;
          }
          
          if (dateValue instanceof Date) {
            return dateValue.toISOString();
          }
          
          if (typeof dateValue === 'string' && dateValue.trim() !== '') {
            // Intentar parsear el string (puede ser formato MySQL datetime o ISO)
            const date = new Date(dateValue);
            if (!Number.isNaN(date.getTime())) {
              return date.toISOString();
            }
          }
          
          return null;
        };
        
        // Convertir created_at a ISO string
        notificationJson.created_at = toISOString(notificationJson.created_at);
        
        // Convertir updated_at a ISO string (opcional, pero útil para debugging)
        notificationJson.updated_at = toISOString(notificationJson.updated_at);
        
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

