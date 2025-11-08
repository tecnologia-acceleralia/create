import { getModels } from '../models/index.js';

export class PublicController {
  static async getBranding(req, res) {
    const slug = req.query.slug;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'slug requerido' });
    }

    const { Tenant } = getModels();
    const tenant = await Tenant.findOne({
      where: { slug },
      attributes: ['id', 'slug', 'name', 'logo_url', 'primary_color', 'secondary_color', 'accent_color']
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    }

    return res.json({ success: true, data: tenant });
  }

  static async listEvents(req, res) {
    const slug = req.query.slug;

    if (!slug) {
      return res.status(400).json({ success: false, message: 'slug requerido' });
    }

    const { Tenant, Event } = getModels();
    const tenant = await Tenant.findOne({ where: { slug } });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant no encontrado' });
    }

    const events = await Event.findAll({
      where: { tenant_id: tenant.id },
      order: [['start_date', 'ASC']],
      attributes: ['id', 'name', 'description', 'start_date', 'end_date', 'status']
    });

    return res.json({ success: true, data: events });
  }
}

