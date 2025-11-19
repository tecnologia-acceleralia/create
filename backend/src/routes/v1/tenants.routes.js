import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorizeRoles } from '../../middleware/authorization.middleware.js';
import { TenantStatisticsController } from '../../controllers/tenant-statistics.controller.js';

export const tenantsRouter = Router();

tenantsRouter.use(authenticate);

tenantsRouter.get('/me', (req, res) => {
  res.json({
    success: true,
    data: {
      tenant: req.tenant,
      user: req.user?.toSafeJSON()
    }
  });
});

tenantsRouter.get('/branding', (req, res) => {
  const tenant = req.tenant;
  res.json({
    success: true,
    data: {
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      secondary_color: tenant.secondary_color,
      accent_color: tenant.accent_color,
      start_date: tenant.start_date,
      end_date: tenant.end_date,
      tenant_css: tenant.tenant_css
    }
  });
});

tenantsRouter.get(
  '/overview',
  authorizeRoles('tenant_admin', 'organizer'),
  TenantStatisticsController.getOverview
);

