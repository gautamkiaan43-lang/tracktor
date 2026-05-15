import express from 'express';
import * as ussdController from '../controllers/ussd/ussd.controller.js';

const router = express.Router();

// GET /api/ussd/locations
router.get('/locations', ussdController.getUssdLocations);

// POST /api/ussd
router.post('/', ussdController.handleUssd);

export default router;
