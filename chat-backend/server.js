require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// MONGODB CONNECTION
// ============================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://gurwindercto:vxULMNjUCzXtOs8J@ld01.einvpqx.mongodb.net/?appName=LD017';

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

// ============================================
// MONGODB SCHEMAS & MODELS
// ============================================

// User Schema
const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, unique: true, sparse: true }, // Firebase UID for mobile app users
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, default: '' }, // Made optional with default
    avatar: { type: String, default: '' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    socketId: { type: String, default: '' },
  },
  { timestamps: true }
);
userSchema.index({ firebaseUid: 1 }); // Index for faster lookups

// Conversation Schema
const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastMessageTime: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
conversationSchema.index({ participants: 1 });

// Message Schema
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    messageType: { type: String, enum: ['text', 'image'], default: 'text' },
    text: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Create Models
const User = mongoose.model('User', userSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);

// ============================================
// SOCKET.IO SETUP
// ============================================
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Store online users: userId -> socketId
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // ============================================
  // EVENT: USER CONNECTED
  // ============================================
  socket.on('user_connected', async (userId) => {
    try {
      console.log(`👤 User ${userId} connected`);
      
      // Find user by firebaseUid or ObjectId
      let user = null;
      if (/^[0-9a-fA-F]{24}$/.test(userId)) {
        user = await User.findById(userId);
      } else {
        user = await User.findOne({ firebaseUid: userId });
      }

      if (!user) {
        console.error(`❌ User not found: ${userId}`);
        return;
      }

      // Store using MongoDB _id for consistency
      onlineUsers.set(user._id.toString(), socket.id);

      await User.findByIdAndUpdate(user._id, {
        isOnline: true,
        socketId: socket.id,
        lastSeen: new Date(),
      });

      io.emit('user_status', {
        userId: user._id.toString(),
        firebaseUid: user.firebaseUid,
        isOnline: true,
      });
    } catch (error) {
      console.error('❌ Error in user_connected:', error);
    }
  });


  socket.on('send_message', async (data) => {
    try {
      const { conversationId, senderId, receiverId, text, messageType, imageUrl, tempId } = data;

      console.log('📤 Sending message:', { senderId, receiverId });

      // Find users by firebaseUid or ObjectId
      const findUser = async (userId) => {
        if (/^[0-9a-fA-F]{24}$/.test(userId)) {
          return await User.findById(userId);
        } else {
          return await User.findOne({ firebaseUid: userId });
        }
      };

      const sender = await findUser(senderId);
      const receiver = await findUser(receiverId);

      if (!sender || !receiver) {
        return socket.emit('message_error', { error: 'Sender or receiver not found' });
      }

      // Find or create conversation
      let conversation;
      if (conversationId) {
        conversation = await Conversation.findById(conversationId);
      }

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [sender._id, receiver._id],
        });
      }

      // Create message
      const newMessage = await Message.create({
        conversationId: conversation._id,
        sender: sender._id,
        receiver: receiver._id,
        messageType: messageType || 'text',
        text: text || '',
        imageUrl: imageUrl || '',
        isDelivered: false,
        isRead: false,
      });

      // Populate sender info
      await newMessage.populate('sender', 'name avatar');

      // Update conversation
      await Conversation.findByIdAndUpdate(conversation._id, {
        lastMessage: newMessage._id,
        lastMessageTime: new Date(),
      });

      // Send to receiver if online (use receiver._id for socket lookup)
      const receiverSocketId = onlineUsers.get(receiver._id.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive_message', {
          message: {
            _id: newMessage._id,
            conversationId: conversation._id,
            sender: newMessage.sender,
            text: newMessage.text,
            imageUrl: newMessage.imageUrl,
            messageType: newMessage.messageType,
            createdAt: newMessage.createdAt,
          },
        });

        // Mark as delivered
        await Message.findByIdAndUpdate(newMessage._id, {
          isDelivered: true,
          deliveredAt: new Date(),
        });
      }

      // Send confirmation to sender
      socket.emit('message_sent', {
        message: {
          _id: newMessage._id,
          conversationId: conversation._id,
          tempId: tempId,
          text: newMessage.text,
          imageUrl: newMessage.imageUrl,
          messageType: newMessage.messageType,
          createdAt: newMessage.createdAt,
          isDelivered: receiverSocketId ? true : false,
        },
      });

      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('❌ Error in send_message:', error);
      socket.emit('message_error', { error: error.message });
    }
  });

  // ============================================
  // EVENT: MESSAGE DELIVERED
  // ============================================
  socket.on('message_delivered', async (messageId) => {
    try {
      const message = await Message.findByIdAndUpdate(
        messageId,
        { isDelivered: true, deliveredAt: new Date() },
        { new: true }
      );

      if (message) {
        const senderSocketId = onlineUsers.get(message.sender.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit('message_status_update', {
            messageId,
            isDelivered: true,
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in message_delivered:', error);
    }
  });

  // ============================================
  // EVENT: MESSAGE READ
  // ============================================
  socket.on('message_read', async (data) => {
    try {
      const { messageId, conversationId, userId } = data;

      // Find user by firebaseUid or ObjectId
      let user = null;
      if (/^[0-9a-fA-F]{24}$/.test(userId)) {
        user = await User.findById(userId);
      } else {
        user = await User.findOne({ firebaseUid: userId });
      }

      if (!user) {
        console.error(`❌ User not found in message_read: ${userId}`);
        return;
      }

      await Message.findByIdAndUpdate(messageId, {
        isRead: true,
        readAt: new Date(),
      });

      // Mark all messages in conversation as read (use MongoDB ObjectId)
      await Message.updateMany(
        { conversationId, receiver: user._id, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      const message = await Message.findById(messageId);
      if (message) {
        const senderSocketId = onlineUsers.get(message.sender.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit('message_status_update', {
            messageId,
            conversationId,
            isRead: true,
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in message_read:', error);
    }
  });

  // ============================================
  // EVENT: TYPING INDICATOR
  // ============================================
  socket.on('typing', (data) => {
    const { receiverId, isTyping, userId } = data;
    const receiverSocketId = onlineUsers.get(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user_typing', {
        userId,
        isTyping,
      });
    }
  });

  // ============================================
  // EVENT: DISCONNECT
  // ============================================
  socket.on('disconnect', async () => {
    console.log('❌ Client disconnected:', socket.id);

    let disconnectedUserId = null;
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        disconnectedUserId = userId;
        onlineUsers.delete(userId);
        break;
      }
    }

    if (disconnectedUserId) {
      try {
        await User.findByIdAndUpdate(disconnectedUserId, {
          isOnline: false,
          lastSeen: new Date(),
          socketId: '',
        });

        io.emit('user_status', {
          userId: disconnectedUserId,
          isOnline: false,
        });
      } catch (error) {
        console.error('❌ Error updating user status:', error);
      }
    }
  });
});

// ============================================
// REST API ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    message: 'Chat API Server',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    onlineUsers: onlineUsers.size
  });
});

// ============================================
// USER ROUTES
// ============================================

// Create/Register User
app.post('/api/users/register', async (req, res) => {
  try {
    const { firebaseUid, name, email, phone, avatar } = req.body;

    // Check if user exists by email or firebaseUid
    let user = await User.findOne({ 
      $or: [
        { email },
        ...(firebaseUid ? [{ firebaseUid }] : [])
      ]
    });
    
    if (user) {
      // Update existing user if firebaseUid is provided
      if (firebaseUid && !user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        await user.save();
      }
      return res.status(200).json({
        success: true,
        user: {
          _id: user._id,
          firebaseUid: user.firebaseUid,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
        },
      });
    }

    user = await User.create({
      firebaseUid: firebaseUid || undefined,
      name,
      email,
      phone: phone || '',
      avatar: avatar || '',
    });

    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID (supports both MongoDB ObjectId and Firebase UID)
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Try to find by MongoDB ObjectId first, then by firebaseUid
    let user = null;
    
    // Check if it's a valid MongoDB ObjectId (24 hex characters)
    if (/^[0-9a-fA-F]{24}$/.test(userId)) {
      user = await User.findById(userId).select('-socketId');
    }
    
    // If not found by ObjectId, try firebaseUid
    if (!user) {
      user = await User.findOne({ firebaseUid: userId }).select('-socketId');
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users (for user list)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-socketId').sort({ name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CONVERSATION ROUTES
// ============================================

// Get user's conversations
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('🔍 Fetching conversations for userId:', userId);

    // Find user by firebaseUid or ObjectId
    let user = null;
    if (/^[0-9a-fA-F]{24}$/.test(userId)) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ firebaseUid: userId });
    }

    if (!user) {
      console.error('❌ User not found:', userId);
      // Return empty array instead of error if user doesn't exist yet
      return res.json([]);
    }

    if (!user._id) {
      console.error('❌ User has no _id:', user);
      return res.json([]);
    }

    console.log('✅ Found user:', user._id.toString(), 'firebaseUid:', user.firebaseUid);

    // Use user._id (MongoDB ObjectId) for the query - ensure it's a valid ObjectId
    const userIdObjectId = user._id;
    
    // Validate it's actually an ObjectId
    if (!userIdObjectId || typeof userIdObjectId.toString !== 'function') {
      console.error('❌ Invalid user._id:', userIdObjectId);
      return res.json([]);
    }

    const conversations = await Conversation.find({
      participants: userIdObjectId,
    })
      .populate('participants', 'name avatar isOnline lastSeen firebaseUid')
      .populate('lastMessage')
      .sort({ lastMessageTime: -1 });

    console.log('📋 Found conversations:', conversations.length);
    res.json(conversations);
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create or get conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;

    // Find users by firebaseUid or ObjectId
    const findUser = async (userId) => {
      if (/^[0-9a-fA-F]{24}$/.test(userId)) {
        return await User.findById(userId);
      } else {
        return await User.findOne({ firebaseUid: userId });
      }
    };

    const user1 = await findUser(userId1);
    const user2 = await findUser(userId2);

    if (!user1 || !user2) {
      return res.status(404).json({ error: 'One or both users not found' });
    }

    // Check if conversation exists
    let conversation = await Conversation.findOne({
      participants: { $all: [user1._id, user2._id] },
    }).populate('participants', 'name avatar isOnline lastSeen');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [user1._id, user2._id],
      });

      await conversation.populate('participants', 'name avatar isOnline lastSeen');
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MESSAGE ROUTES
// ============================================

// Get messages for a conversation
app.get('/api/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find({ conversationId })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark messages as read
app.post('/api/messages/mark-read', async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    // Find user by firebaseUid or ObjectId
    let user = null;
    if (/^[0-9a-fA-F]{24}$/.test(userId)) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ firebaseUid: userId });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await Message.updateMany(
      {
        conversationId,
        receiver: user._id,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread message count
app.get('/api/messages/unread/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user by firebaseUid or ObjectId
    let user = null;
    if (/^[0-9a-fA-F]{24}$/.test(userId)) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ firebaseUid: userId });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const unreadCount = await Message.countDocuments({
      receiver: user._id,
      isRead: false,
    });

    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// IMAGE UPLOAD (Simple Base64 Storage)
// ============================================
app.post('/api/upload', async (req, res) => {
  try {
    const { image, filename } = req.body;
    
    // In production, upload to Cloudinary/AWS S3
    // For now, we'll just return a placeholder
    // You can store base64 directly in MongoDB or use cloud storage
    
    const imageUrl = `data:image/jpeg;base64,${image}`;
    
    res.json({ 
      success: true,
      url: imageUrl 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT;

server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   🚀 Chat Server Running               ║
  ║   📡 Port: ${PORT}                       ║
  ║   🌐 http://localhost:${PORT}            ║
  ║   💾 MongoDB: Connected                ║
  ║   ⚡ Socket.IO: Active                 ║
  ╚════════════════════════════════════════╝
  `);
});