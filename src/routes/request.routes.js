import express from 'express';
import { requireRole, verifyToken } from '../middleware/auth.middleware.js';
import { acceptRequest, createRequest, listRequests } from '../controllers/request.controller.js';

const router = express.Router();

router.use(verifyToken);

router.post('/create', requireRole(['farmer']), createRequest);
router.get('/all', requireRole(['admin']), listRequests);
router.patch('/:id/accept', requireRole(['admin']), acceptRequest);

export default router;
