import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { User } from '../../../models/User';

let ioInstance: SocketIOServer | null = null;

/**
 * Initializes the Socket.io server connection and registers connection events.
 */
export const initSocketServer = (server: http.Server) => {
  ioInstance = new SocketIOServer(server, {
    cors: {
      origin: '*', // Allow all client portals to connect
      credentials: true
    }
  });

  ioInstance.on('connection', (socket: Socket) => {
    console.log(`[WebSocket] New socket client connected: ${socket.id}`);

    // Auth verification & Room Assignment
    socket.on('auth:init', async (data: { token?: string }) => {
      try {
        const token = data.token;
        if (!token) {
          socket.emit('auth:error', { message: 'Token is required' });
          return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        const user = await User.findById(decoded.id);

        if (!user) {
          socket.emit('auth:error', { message: 'User not found' });
          return;
        }

        const userId = user._id.toString();

        // 1. Join user individual room
        socket.join(`user:${userId}`);

        // 2. Join role rooms
        if (user.roles && user.roles.length > 0) {
          user.roles.forEach((role) => {
            socket.join(`role:${role}`);
          });
        }

        // 3. Join territory rooms if mapped
        if (user.territory) {
          if (user.territory.state) {
            socket.join(`territory:state:${user.territory.state}`);
          }
          if (user.territory.district) {
            socket.join(`territory:district:${user.territory.district}`);
          }
          if (user.territory.mandal) {
            socket.join(`territory:mandal:${user.territory.mandal}`);
          }
        }

        // 4. Join vendor or franchise business-specific rooms
        if (user.roles.includes('vendor')) {
          socket.join(`vendor:${userId}`);
        }

        socket.emit('auth:success', {
          message: 'Authenticated and joined real-time notification rooms.',
          rooms: Array.from(socket.rooms)
        });

        console.log(`[WebSocket] Client authenticated user: ${user.name} (${userId})`);
      } catch (err: any) {
        socket.emit('auth:error', { message: 'Authentication failed', error: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
};

/**
 * Sends a real-time event notification directly to a specific user room.
 */
export const sendRealtimeNotification = (userId: string, notification: any) => {
  if (!ioInstance) {
    console.warn('[WebSocket] Cannot send notification, server not initialized.');
    return;
  }
  ioInstance.to(`user:${userId}`).emit('notification:new', notification);
};

/**
 * Broadcasts a real-time notification to a specific room (admin, role:vendor, territory:district:Nellore, etc.)
 */
export const broadcastRoomNotification = (room: string, notification: any) => {
  if (!ioInstance) {
    console.warn('[WebSocket] Cannot broadcast notification, server not initialized.');
    return;
  }
  ioInstance.to(room).emit('notification:new', notification);
};

export default initSocketServer;
