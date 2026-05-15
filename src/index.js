import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes.js';
import farmerRoutes from './routes/farmer.routes.js';
import adminRoutes from './routes/admin.routes.js';
import operatorRoutes from './routes/operator.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import requestRoutes from './routes/request.routes.js';
import ussdRoutes from './routes/ussd.routes.js';
import { sendError } from './utils/response.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

/**
 * In-memory state for tracking rooms.
 * Each room key can be:
 *   - 'track-booking-{bookingId}' — private channel for a specific job
 *   - 'admin-tracking' — admin overview (receives all operator updates)
 *   - 'default-room' — legacy fallback
 */
const roomsState = new Map();
app.set('io', io);

const broadcastFarmerDestination = (lat, lng, roomId = 'default-room') => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return;
  const prev = roomsState.get(roomId) || {};
  const nextState = {
    ...prev,
    farmerLocation: { lat, lng },
  };
  roomsState.set(roomId, nextState);
  io.to(roomId).emit('farmer:destination:update', { lat, lng });
};
app.set('broadcastFarmerDestination', broadcastFarmerDestination);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/request', requestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ussd', ussdRoutes);

// Root Route
app.get('/', (req, res) => {
  res.json({ message: "TractorLink Backend API is running..." });
});

// 404 Handler
app.use((req, res) => {
  return sendError(res, "Route not found", 404, "NOT_FOUND");
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  return sendError(res, err.message || "Internal Server Error", err.status || 500);
});

const PORT = process.env.PORT || 5000;

io.on('connection', (socket) => {
  /**
   * Join a tracking room.
   * Clients send: { roomId, role, bookingId, operatorId }
   * - Operator joins: 'track-booking-{bookingId}'
   * - Farmer joins:  'track-booking-{bookingId}'
   * - Admin joins:   'admin-tracking' (sees all)
   * - Legacy:        'default-room'
   */
  socket.on('tracking:join', (data = {}) => {
    const { roomId = 'default-room', role, bookingId, operatorId, userId, farmerId } = data;
    
    // Build the actual room name
    let actualRoom = roomId;
    if (bookingId) {
      actualRoom = `track-booking-${bookingId}`;
    }
    
    if (role === 'admin') {
      // Admin always joins the admin-tracking room
      socket.join('admin-tracking');
    }

    // Join personal user room for targeted notifications
    // We prioritize operatorId, then userId, then farmerId
    const personalId = operatorId || userId || farmerId;
    
    if (personalId) {
      socket.join(`user-${personalId}`);
      console.log(`[Socket] User ${personalId} joined personal room: user-${personalId}`);
    }

    socket.join(actualRoom);

    // Send current state back to the newly joined client
    const state = roomsState.get(actualRoom) || {};
    socket.emit('tracking:state', state);

    console.log(`[Socket] ${role || 'unknown'} joined room: ${actualRoom}`);
  });

  /**
   * Operator sends location updates.
   * Payload: { roomId, bookingId, operatorId, lat, lng, timestamp }
   *
   * Broadcasts to:
   *  - The booking-specific room (so farmer sees it)
   *  - The admin-tracking room (so admin sees all operators)
   *  - Legacy default-room (backward compatibility)
   */
  socket.on('location:update', ({ roomId = 'default-room', bookingId, operatorId, lat, lng, timestamp } = {}) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const ts = timestamp || Date.now();

    // 1. Update booking-specific room
    if (bookingId) {
      const bookingRoom = `track-booking-${bookingId}`;
      const prev = roomsState.get(bookingRoom) || {};
      const nextState = {
        ...prev,
        operatorLocation: { lat, lng, timestamp: ts, operatorId, bookingId },
      };
      roomsState.set(bookingRoom, nextState);
      io.to(bookingRoom).emit('location:update', { lat, lng, timestamp: ts, operatorId, bookingId });
    }

    // 2. Always forward to admin-tracking room with metadata
    io.to('admin-tracking').emit('location:update', {
      lat, lng, timestamp: ts, operatorId, bookingId
    });

    // 3. Legacy default-room support
    const prev = roomsState.get(roomId) || {};
    const nextState = {
      ...prev,
      operatorLocation: { lat, lng, timestamp: ts },
    };
    roomsState.set(roomId, nextState);
    io.to(roomId).emit('location:update', { lat, lng, timestamp: ts });
  });

  socket.on('farmer:destination:update', ({ roomId = 'default-room', bookingId, lat, lng } = {}) => {
    if (bookingId) {
      const bookingRoom = `track-booking-${bookingId}`;
      broadcastFarmerDestination(lat, lng, bookingRoom);
    }
    broadcastFarmerDestination(lat, lng, roomId);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
