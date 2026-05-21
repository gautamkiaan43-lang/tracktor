import express from 'express';
import * as aiController from '../controllers/ai.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to protect AI Business Intelligence data
router.use(verifyToken);
router.use(requireRole(['admin']));

// AI Modules Endpoints
router.get('/forecast', aiController.getDemandForecast);
router.get('/seasons', aiController.getSeasons);
router.get('/revenue', aiController.getRevenue);
router.get('/location-analysis', aiController.getLocationAnalysis);
router.get('/time-analysis', aiController.getTimeAnalysis);
router.get('/heatmap', aiController.getHeatmap);

export default router;
