import { Router } from "express";
import notificationManager from "../utils/NotificationManager.js";
import NotificationModel from "../models/Notification.model.js";

const router = Router();

/**
 * SSE Stream endpoint
 */
router.get("/stream", (req, res) => {
  const salonOwnerId = req.query.ownerId || req.user?.id;

  if (!salonOwnerId) {
    return res.status(400).json({
      success: false,
      error: "Salon owner ID is required",
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");

  notificationManager.addClient(salonOwnerId, res);

  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      message: "Successfully connected to notification stream",
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  const heartbeatInterval = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeatInterval);
    notificationManager.removeClient(salonOwnerId);
  });
});

/**
 * Get notification history with pagination
 * GET /api/v1/notifications/history
 */
router.get("/history", async (req, res) => {
  try {
    const salonOwnerId = req.query.ownerId || req.user?.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const read = req.query.read; // 'true', 'false', or undefined (all)

    if (!salonOwnerId) {
      return res.status(400).json({
        success: false,
        error: "Salon owner ID is required",
      });
    }

    const query = { userId: salonOwnerId };
    if (read !== undefined) {
      query.read = read === "true";
    }

    const notifications = await NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await NotificationModel.countDocuments(query);

    res.json({
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching notification history:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get unread count
 */
router.get("/unread-count", async (req, res) => {
  try {
    const salonOwnerId = req.query.ownerId || req.user?.id;

    if (!salonOwnerId) {
      return res.status(400).json({
        success: false,
        error: "Salon owner ID is required",
      });
    }

    const count = await notificationManager.getUnreadCount(salonOwnerId);

    res.json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Mark single notification as read
 */
router.patch("/mark-read/:notificationId", async (req, res) => {
  try {
    const { notificationId } = req.params;
    const salonOwnerId = req.body.ownerId || req.user?.id;

    if (!salonOwnerId) {
      return res.status(400).json({
        success: false,
        error: "Owner ID is required",
      });
    }

    const notification = await notificationManager.markAsRead(
      salonOwnerId,
      notificationId
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Mark all notifications as read
 */
router.patch("/mark-all-read", async (req, res) => {
  try {
    const salonOwnerId = req.body.ownerId || req.user?.id;

    if (!salonOwnerId) {
      return res.status(400).json({
        success: false,
        error: "Owner ID is required",
      });
    }

    const count = await notificationManager.markAllAsRead(salonOwnerId);

    res.json({
      success: true,
      message: `Marked ${count} notifications as read`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Delete notification
 */
router.delete("/:notificationId", async (req, res) => {
  try {
    const { notificationId } = req.params;
    const salonOwnerId = req.body.ownerId || req.user?.id;

    if (!salonOwnerId) {
      return res.status(400).json({
        success: false,
        error: "Owner ID is required",
      });
    }

    const notification = await NotificationModel.findOneAndDelete({
      _id: notificationId,
      userId: salonOwnerId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Debug stats
 */
router.get("/stats", (req, res) => {
  const stats = notificationManager.getStats();
  res.json(stats);
});

export default router;
