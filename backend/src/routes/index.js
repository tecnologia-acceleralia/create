import { Router } from 'express';
import { authRouter } from './v1/auth.routes.js';
import { usersRouter } from './v1/users.routes.js';
import { tenantsRouter } from './v1/tenants.routes.js';
import { eventsRouter } from './v1/events.routes.js';
import { teamsRouter } from './v1/teams.routes.js';
import { projectsRouter } from './v1/projects.routes.js';
import { submissionsRouter } from './v1/submissions.routes.js';
import { evaluationsRouter } from './v1/evaluations.routes.js';
import { notificationsRouter } from './v1/notifications.routes.js';
import { rubricsRouter } from './v1/rubrics.routes.js';
import { translationRouter } from './v1/translation.routes.js';

export const router = Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ok',
    tenant: req.tenant ? { id: req.tenant.id, slug: req.tenant.slug } : null
  });
});

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/tenants', tenantsRouter);
router.use('/events', eventsRouter);
router.use('/teams', teamsRouter);
router.use('/projects', projectsRouter);
router.use('/', submissionsRouter);
router.use('/', evaluationsRouter);
router.use('/', rubricsRouter);
router.use('/notifications', notificationsRouter);
router.use('/translation', translationRouter);

