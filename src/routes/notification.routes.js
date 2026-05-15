import express from 'express';
import { getNotifications, markAsRead, markAllRead, deleteNotification, deleteAllNotifications } from '../controllers/notification.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markAsRead);
router.delete('/', deleteAllNotifications);
router.delete('/:id', deleteNotification);

export default router;
