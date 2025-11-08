import { getModels } from '../models/index.js';

export class NotificationsController {
  static async list(req, res, next) {
    try {
      const { Notification } = getModels();
      const notifications = await Notification.findAll({
        where: { user_id: req.user.id },
        order: [['created_at', 'DESC']]
      });
      res.json({ success: true, data: notifications });
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

