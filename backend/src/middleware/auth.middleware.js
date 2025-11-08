import jwt from 'jsonwebtoken';
import { appConfig } from '../config/env.js';
import { getModels } from '../models/index.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, appConfig.jwtSecret);

    if (req.tenant && Number(payload.tenantId) !== Number(req.tenant.id)) {
      return res.status(403).json({ success: false, message: 'Tenant inválido' });
    }

    const { User, Role } = getModels();
    const user = await User.findOne({
      where: { id: payload.sub },
      include: [{ model: Role, as: 'role' }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
}

