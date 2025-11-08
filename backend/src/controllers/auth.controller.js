import { AuthService } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

export class AuthController {
  static async login(req, res) {
    try {
      const tenant = req.tenant;
      if (!tenant) {
        return res.status(400).json({ success: false, message: 'Tenant no resuelto' });
      }

      const { email, password } = req.body;
      const user = await AuthService.validateCredentials(email, password);

      if (!user) {
        return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
      }

      const tokens = AuthService.generateTokens(user, tenant);

      return res.json({
        success: true,
        data: {
          tokens,
          user: user.toSafeJSON(),
          tenant: tenant.toJSON()
        }
      });
    } catch (error) {
      logger.error('Error en login', { error: error.message });
      return res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
    }
  }

  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const tokens = AuthService.refreshToken(refreshToken);
      return res.json({ success: true, data: tokens });
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Refresh token inválido' });
    }
  }
}

