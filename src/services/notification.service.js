import prisma from '../config/db.js';

/**
 * Service to handle system-wide notifications and real-time broadcasts.
 */
class NotificationService {
  /**
   * Notifies all Admin users of a specific event.
   * 
   * @param {object} io - The Socket.io instance.
   * @param {object} payload - Notification data { message, type, metadata }.
   */
  async notifyAdmins(io, { message, type = 'general', metadata = {} }) {
    try {
      // 1. Find all active Admin users
      const admins = await prisma.user.findMany({
        where: {
          role: 'admin',
          status: 'active'
        },
        select: { id: true }
      });

      if (admins.length === 0) return [];

      // 2. Clear out any potential undefined metadata
      const cleanMetadata = metadata || {};

      // 3. Persist notifications for all admins in bulk
      const notificationData = admins.map(admin => ({
        userId: admin.id,
        role: 'admin',
        message,
        type,
        isRead: false
      }));

      // Prisma doesn't support bulk create with relations easily in all versions, 
      // but createMany is available in modern Prisma.
      await prisma.notification.createMany({
        data: notificationData
      });

      // 4. Broadcast to Admin tracking/notification room if IO exists
      if (io) {
        // We emit to the 'admin-tracking' room which all admins join by default
        io.to('admin-tracking').emit('notification:new', {
          message,
          type,
          metadata: cleanMetadata,
          createdAt: new Date()
        });
      }

      console.log(`[NotificationService] Notified ${admins.length} admins: ${message}`);
      return admins;
    } catch (error) {
      console.error('[NotificationService] Error notifying admins:', error);
      return [];
    }
  }

  /**
   * Notifies a specific user of an event.
   * 
   * @param {object} io - The Socket.io instance.
   * @param {number} userId - The target user ID.
   * @param {string} role - The user's role (farmer/operator).
   * @param {object} payload - Notification data { message, type, metadata }.
   */
  async notifyUser(io, userId, role, { message, type = 'general', metadata = {} }) {
    try {
      if (!userId) return null;

      const cleanMetadata = metadata || {};

      // 1. Persist notification in DB
      const notification = await prisma.notification.create({
        data: {
          userId: parseInt(userId),
          role,
          message,
          type,
          isRead: false
        }
      });

      // 2. Broadcast to user-specific room if IO exists
      if (io) {
        io.to(`user-${userId}`).emit('notification:new', {
          id: notification.id,
          message,
          type,
          metadata: cleanMetadata,
          createdAt: notification.createdAt
        });
      }

      console.log(`[NotificationService] Notified user ${userId} (${role}): ${message}`);
      return notification;
    } catch (error) {
      console.error(`[NotificationService] Error notifying user ${userId}:`, error);
      return null;
    }
  }
}

export default new NotificationService();
