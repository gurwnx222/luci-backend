import { Server } from "socket.io";
import { createServer } from "http";

let io = null;
let httpServer = null;

/**
 * Initialize SocketIO server
 */
export const initializeSocketServer = (app) => {
  // Create HTTP server from Express app
  httpServer = createServer(app);

  // Initialize SocketIO
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Store online users: userId -> socketId
  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log("🔌 New client connected:", socket.id);

    // User connects
    socket.on("user_connected", (userId) => {
      console.log(`👤 User ${userId} connected`);
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;

      // Broadcast user online status
      io.emit("user_status", {
        userId,
        isOnline: true,
      });
    });

    // User disconnects
    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);

      if (socket.userId) {
        onlineUsers.delete(socket.userId);

        // Broadcast user offline status
        io.emit("user_status", {
          userId: socket.userId,
          isOnline: false,
        });
      }
    });
  });

  // Make io and onlineUsers available globally
  io.onlineUsers = onlineUsers;

  return { io, httpServer };
};

/**
 * Get SocketIO instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error("SocketIO not initialized. Call initializeSocketServer first.");
  }
  return io;
};

/**
 * Get HTTP server
 */
export const getHttpServer = () => {
  return httpServer;
};

/**
 * Emit booking notification to user
 */
export const emitBookingNotification = (userId, notificationData) => {
  if (!io) return;

  const socketId = io.onlineUsers?.get(userId);
  if (socketId) {
    io.to(socketId).emit("booking_notification", notificationData);
    console.log(`📤 Booking notification sent to user ${userId}`);
  } else {
    console.log(`💤 User ${userId} offline - notification will be stored in DB`);
  }
};

/**
 * Emit booking status update
 */
export const emitBookingStatusUpdate = (userId, bookingData) => {
  if (!io) return;

  const socketId = io.onlineUsers?.get(userId);
  if (socketId) {
    io.to(socketId).emit("booking_status_update", bookingData);
    console.log(`📤 Booking status update sent to user ${userId}`);
  }
};

/**
 * Emit chat room created notification
 */
export const emitChatRoomCreated = (userId, chatRoomData) => {
  if (!io) return;

  const socketId = io.onlineUsers?.get(userId);
  if (socketId) {
    io.to(socketId).emit("chat_room_created", chatRoomData);
    console.log(`📤 Chat room created notification sent to user ${userId}`);
  }
};

