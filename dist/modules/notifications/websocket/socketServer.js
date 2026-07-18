"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastRoomNotification = exports.sendRealtimeNotification = exports.initSocketServer = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../../../models/User");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("../../../config/redis");
const env_1 = require("../../../config/env");
let ioInstance = null;
/**
 * Initializes the Socket.io server connection and registers connection events.
 */
const initSocketServer = (server) => {
    ioInstance = new socket_io_1.Server(server, {
        cors: {
            origin: '*', // Allow all client portals to connect
            credentials: true
        }
    });
    if (env_1.env.ENABLE_SOCKET_REDIS) {
        const pubClient = (0, redis_1.getRedisClient)();
        const isMock = !(pubClient.status === 'ready' || pubClient.status === 'connecting');
        if (!isMock) {
            const Redis = require('ioredis');
            const subClient = new Redis(env_1.env.REDIS_URI || 'redis://127.0.0.1:6379');
            ioInstance.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
            console.log('[WebSocket] Mounted Redis Adapter for horizontal scaling.');
        }
        else {
            console.warn('[WebSocket] Running in Mock Redis mode. Skipping Redis adapter adapter configuration.');
        }
    }
    ioInstance.on('connection', (socket) => {
        console.log(`[WebSocket] New socket client connected: ${socket.id}`);
        // Auth verification & Room Assignment
        socket.on('auth:init', async (data) => {
            try {
                const token = data.token;
                if (!token) {
                    socket.emit('auth:error', { message: 'Token is required' });
                    return;
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
                const user = await User_1.User.findById(decoded.id);
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
            }
            catch (err) {
                socket.emit('auth:error', { message: 'Authentication failed', error: err.message });
            }
        });
        socket.on('disconnect', () => {
            console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        });
    });
    return ioInstance;
};
exports.initSocketServer = initSocketServer;
/**
 * Sends a real-time event notification directly to a specific user room.
 */
const sendRealtimeNotification = (userId, notification) => {
    if (!ioInstance) {
        console.warn('[WebSocket] Cannot send notification, server not initialized.');
        return;
    }
    ioInstance.to(`user:${userId}`).emit('notification:new', notification);
};
exports.sendRealtimeNotification = sendRealtimeNotification;
/**
 * Broadcasts a real-time notification to a specific room (admin, role:vendor, territory:district:Nellore, etc.)
 */
const broadcastRoomNotification = (room, notification) => {
    if (!ioInstance) {
        console.warn('[WebSocket] Cannot broadcast notification, server not initialized.');
        return;
    }
    ioInstance.to(room).emit('notification:new', notification);
};
exports.broadcastRoomNotification = broadcastRoomNotification;
exports.default = exports.initSocketServer;
