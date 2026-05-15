import prisma from '../config/db.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getNotifications = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        role
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return sendSuccess(res, notifications, "Notifications fetched successfully");
  } catch (error) {
    console.error('[NotificationController] Error:', error);
    return sendError(res, "Failed to fetch notifications");
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;

    const notification = await prisma.notification.findFirst({
      where: {
        id: parseInt(id),
        userId
      }
    });

    if (!notification) {
      return sendError(res, "Notification not found", 404);
    }

    const updated = await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true }
    });

    return sendSuccess(res, updated, "Notification marked as read");
  } catch (error) {
    console.error('[NotificationController] Error:', error);
    return sendError(res, "Failed to update notification");
  }
};

export const markAllRead = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    await prisma.notification.updateMany({
      where: {
        userId: userId,
        role: role,
        isRead: false
      },
      data: { isRead: true }
    });

    return sendSuccess(res, null, "All notifications marked as read");
  } catch (error) {
    console.error('[NotificationController] Error:', error);
    return sendError(res, "Failed to mark all as read");
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId } = req.user;

    const notification = await prisma.notification.findFirst({
      where: {
        id: parseInt(id),
        userId
      }
    });

    if (!notification) {
      return sendError(res, "Notification not found or access denied", 404);
    }

    await prisma.notification.delete({
      where: { id: parseInt(id) }
    });

    return sendSuccess(res, null, "Notification deleted successfully");
  } catch (error) {
    console.error('[NotificationController] Error:', error);
    return sendError(res, "Failed to delete notification");
  }
};

export const deleteAllNotifications = async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    await prisma.notification.deleteMany({
      where: {
        userId,
        role
      }
    });

    return sendSuccess(res, null, "All notifications deleted successfully");
  } catch (error) {
    console.error('[NotificationController] Error:', error);
    return sendError(res, "Failed to delete all notifications");
  }
};
