import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { JwtPayload } from '../middlewares/auth.middleware';

let io: SocketIOServer | null = null;

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  const allowedOrigins =
    ENV.NODE_ENV === 'production'
      ? [ENV.CLIENT_URL]
      : [
          ENV.CLIENT_URL,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ];

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // JWT Authentication middleware on connection handshake
  io.use((socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers?.authorization?.replace('Bearer ', '') as string | undefined);

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(token, ENV.JWT_SECRET, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      socket.data.user = decoded;
      return next();
    } catch {
      return next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload | undefined;
    if (user?.id) {
      const room = `user:${user.id}`;
      void socket.join(room);
    }

    socket.on('disconnect', () => {
      // Disconnected cleanly
    });
  });

  return io;
};

export const getSocketIO = (): SocketIOServer | null => {
  return io;
};

export const setSocketIO = (socketServer: SocketIOServer | null): void => {
  io = socketServer;
};

/**
 * Emit an event to a specific user's room `user:<userId>`
 */
export const emitToUser = (userId: string, event: string, data: unknown): void => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit an event to all connected sockets
 */
export const emitToAll = (event: string, data: unknown): void => {
  if (!io) return;
  io.emit(event, data);
};
