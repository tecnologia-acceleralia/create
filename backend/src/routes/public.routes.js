import { Router } from 'express';
import { PublicController } from '../controllers/public.controller.js';

export const publicRouter = Router();

publicRouter.get('/branding', (req, res, next) => PublicController.getBranding(req, res, next));
publicRouter.get('/events', (req, res, next) => PublicController.listEvents(req, res, next));
publicRouter.get('/events/all', (req, res, next) => PublicController.listAllEvents(req, res, next));
publicRouter.get('/phases', (req, res, next) => PublicController.listPhases(req, res, next));
