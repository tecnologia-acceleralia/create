import { Router } from 'express';
import { PublicController } from '../controllers/public.controller.js';

export const publicRouter = Router();

publicRouter.get('/tenant/branding', (req, res, next) => PublicController.getBranding(req, res, next));
publicRouter.get('/events', (req, res, next) => PublicController.listEvents(req, res, next));

