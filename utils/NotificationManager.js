import NotificationModel from "../models/Notification.model.js";

class NotificationManager {
  constructor() {
    this.clients = new Map(); // Still keep for real-time SSE
  }

  addClient(userId, res) {
    console.log(`Client connected: ${userId}`);
    this.clients.set(userId, res);

    // Send unread notifications immediately on connect
    this.sendUnreadNotifications(userId);
  }

  removeClient(userId) {
    console.log(`❌ Client disconnected: ${userId}`);
    this.clients.delete(userId);
  }

  /**
   * Send notification - Save to DB + Send via SSE if online
   */
  async notify(userId, notificationData) {
    try {
      // STEP 1: Save to database (persistent)
      const notification = await NotificationModel.create({
        userId,
        type: notificationData.type,
        title: notificationData.title || notificationData.message,
        message: notificationData.message,
        data: notificationData.booking || notificationData.data || {},
        bookingId: notificationData.booking?.id || null,
        read: false,
      });

      console.log(`💾 Notification saved to DB: ${notification._id}`);

      // STEP 2: Send via SSE if user is online
      const client = this.clients.get(userId);
      if (client) {
        this.sendToClient(userId, {
          id: notification._id.toString(),
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          bookingId: notification.bookingId,
          read: notification.read,
          createdAt: notification.createdAt,
          timestamp: notification.createdAt.toISOString(),
        });
        console.log(`📤 Notification sent via SSE to: ${userId}`);
      } else {
        console.log(`💤 User ${userId} offline - notification stored in DB`);
      }

      return notification;
    } catch (error) {
      console.error("Error saving notification:", error);
      throw error;
    }
  }

  /**
   * Send all unread notifications to newly connected client
   */
  async sendUnreadNotifications(userId) {
    try {
      const unreadNotifications = await NotificationModel.find({
        userId,
        read: false,
      })
        .sort({ createdAt: -1 })
        .limit(50) // Last 50 unread
        .lean();

      console.log(
        `📬 Sending ${unreadNotifications.length} unread notifications to ${userId}`
      );

      unreadNotifications.forEach((notif) => {
        this.sendToClient(userId, {
          id: notif._id.toString(),
          type: notif.type,
          title: notif.title,
          message: notif.message,
          data: notif.data,
          bookingId: notif.bookingId,
          read: notif.read,
          createdAt: notif.createdAt,
          timestamp: notif.createdAt.toISOString(),
        });
      });
    } catch (error) {
      console.error("Error sending unread notifications:", error);
    }
  }

  sendToClient(userId, notification) {
    const client = this.clients.get(userId);
    if (client) {
      try {
        client.write(`data: ${JSON.stringify(notification)}\n\n`);
      } catch (error) {
        console.error(`Error sending to client ${userId}:`, error);
        this.removeClient(userId);
      }
    }
  }

  /**
   * Get unread count from database
   */
  async getUnreadCount(userId) {
    try {
      return await NotificationModel.countDocuments({
        userId,
        read: false,
      });
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId, notificationId) {
    try {
      const notification = await NotificationModel.findOneAndUpdate(
        { _id: notificationId, userId }, // Verify ownership
        {
          read: true,
          readAt: new Date(),
        },
        { new: true }
      );

      if (notification) {
        console.log(`✓ Notification ${notificationId} marked as read`);
      }

      return notification;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId) {
    try {
      const result = await NotificationModel.updateMany(
        { userId, read: false },
        {
          read: true,
          readAt: new Date(),
        }
      );

      console.log(
        `✓ Marked ${result.modifiedCount} notifications as read for ${userId}`
      );
      return result.modifiedCount;
    } catch (error) {
      console.error("Error marking all as read:", error);
      throw error;
    }
  }

  getStats() {
    return {
      activeConnections: this.clients.size,
      connectedUsers: Array.from(this.clients.keys()),
    };
  }
}

export default new NotificationManager();
