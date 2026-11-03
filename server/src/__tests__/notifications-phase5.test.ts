import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { ENV } from '../config/env';
import { User, IUser } from '../models/User';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notification.service';
import { initSocketServer, getSocketIO, setSocketIO } from '../services/socket.service';

describe('Phase 5: Notification Service & Endpoints', () => {
  const app = createApp();
  let userA: IUser;
  let userB: IUser;
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    // Create User A
    userA = await User.create({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@sam.edu',
      passwordHash: 'dummyhashedpassword123',
      role: 'STUDENT',
      isActive: true,
    });

    // Create User B
    userB = await User.create({
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@sam.edu',
      passwordHash: 'dummyhashedpassword123',
      role: 'PROFESSOR',
      isActive: true,
    });

    tokenA = jwt.sign(
      { id: userA._id.toString(), role: userA.role, email: userA.email },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );

    tokenB = jwt.sign(
      { id: userB._id.toString(), role: userB.role, email: userB.email },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('1. Reliability & Transactions', () => {
    it('transaction rollback leaves no notifications in the database', async () => {
      const session = await mongoose.startSession();
      session.startTransaction();

      await NotificationService.notify(session, [userA._id], {
        type: 'CLASS_CANCELLED',
        title: 'Class Cancelled',
        body: 'Your Monday CS101 class has been cancelled',
      });

      // Notification is visible inside the session
      const inTxCount = await Notification.countDocuments({ recipientId: userA._id }).session(session);
      expect(inTxCount).toBe(1);

      // Rollback the transaction
      await session.abortTransaction();
      await session.endSession();

      // Ensure no rows persist outside
      const postAbortCount = await Notification.countDocuments({ recipientId: userA._id });
      expect(postAbortCount).toBe(0);
    });

    it('transaction commit successfully persists notifications', async () => {
      const session = await mongoose.startSession();
      session.startTransaction();

      await NotificationService.notify(session, [userA._id], {
        type: 'CLASS_RESCHEDULED',
        title: 'Class Rescheduled',
        body: 'Your class has moved to Room 102',
      });

      await session.commitTransaction();
      await session.endSession();

      const saved = await Notification.find({ recipientId: userA._id });
      expect(saved.length).toBe(1);
      expect(saved[0].type).toBe('CLASS_RESCHEDULED');
      expect(saved[0].title).toBe('Class Rescheduled');
    });

    it('dedupeKey prevents duplicate notifications on multiple attempts', async () => {
      const dedupePrefix = 'dedupe-test-session';

      // First call
      await NotificationService.notify(null, [userA._id], {
        type: 'MINOR_SCHEDULED',
        title: 'Minor Exam 1',
        body: 'Minor exam scheduled',
        dedupeKeyPrefix: dedupePrefix,
      });

      // Second call with same dedupe prefix and recipient
      await NotificationService.notify(null, [userA._id], {
        type: 'MINOR_SCHEDULED',
        title: 'Minor Exam 1',
        body: 'Minor exam scheduled',
        dedupeKeyPrefix: dedupePrefix,
      });

      const notifications = await Notification.find({ recipientId: userA._id });
      expect(notifications.length).toBe(1);
    });
  });

  describe('2. HTTP API Security & RBAC (own only)', () => {
    let notifA1: unknown;
    let notifB1: unknown;

    beforeEach(async () => {
      const docs = await Notification.insertMany([
        {
          recipientId: userA._id,
          type: 'TIMETABLE_PUBLISHED',
          title: 'Timetable Published',
          body: 'Odd semester timetable is live',
        },
        {
          recipientId: userA._id,
          type: 'CLASS_CANCELLED',
          title: 'Class Cancelled',
          body: 'CS201 cancelled',
          readAt: new Date(),
        },
        {
          recipientId: userB._id,
          type: 'ATTENDANCE_MISSED',
          title: 'Attendance Missed',
          body: 'Session unsubmitted',
        },
      ]);
      notifA1 = docs[0];
      notifB1 = docs[2];
    });

    it('GET /api/v1/notifications returns only own notifications', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.items.every((n: { recipientId: string }) => n.recipientId === userA._id.toString())).toBe(true);
    });

    it('GET /api/v1/notifications?unread=true filters to unread only', async () => {
      const res = await request(app)
        .get('/api/v1/notifications?unread=true')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].title).toBe('Timetable Published');
    });

    it('GET /api/v1/notifications/unread-count returns correct count', async () => {
      const resA = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data.count).toBe(1);

      const resB = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data.count).toBe(1);
    });

    it('PATCH /api/v1/notifications/:id/read allows user to mark own notification as read', async () => {
      const idA = (notifA1 as { _id: Types.ObjectId })._id.toString();

      const res = await request(app)
        .patch(`/api/v1/notifications/${idA}/read`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.readAt).not.toBeNull();

      // Check in DB
      const updated = await Notification.findById(idA);
      expect(updated?.readAt).not.toBeNull();
    });

    it('PATCH /api/v1/notifications/:id/read forbids marking another user’s notification (returns 404)', async () => {
      const idB = (notifB1 as { _id: Types.ObjectId })._id.toString();

      // User A attempts to mark User B's notification as read
      const res = await request(app)
        .patch(`/api/v1/notifications/${idB}/read`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      // Verify B's notification remains unread
      const unreadB = await Notification.findById(idB);
      expect(unreadB?.readAt).toBeNull();
    });

    it('POST /api/v1/notifications/read-all marks all own unread notifications as read', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.modifiedCount).toBe(1);

      const unreadA = await Notification.countDocuments({ recipientId: userA._id, readAt: null });
      expect(unreadA).toBe(0);

      // B's unread should be untouched
      const unreadB = await Notification.countDocuments({ recipientId: userB._id, readAt: null });
      expect(unreadB).toBe(1);
    });
  });

  describe('3. Socket.IO Authentication & Multi-client Pushes', () => {
    let server: http.Server;
    let port: number;

    beforeAll((done) => {
      server = http.createServer(app);
      initSocketServer(server);
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          port = addr.port;
        }
        done();
      });
    });

    afterAll((done) => {
      const ioInstance = getSocketIO();
      if (ioInstance) {
        ioInstance.close();
        setSocketIO(null);
      }
      server.close(done);
    });

    it('socket auth is rejected without a valid token', (done) => {
      const socket = ClientSocket(`http://localhost:${port}`, {
        auth: { token: 'invalid_token_xyz' },
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('connect_error', (err) => {
        expect(err.message).toMatch(/Invalid authentication token|token/);
        socket.disconnect();
        done();
      });

      socket.on('connect', () => {
        socket.disconnect();
        done(new Error('Socket should not have connected without valid token'));
      });
    });

    it('two clients receive a push when notified', async () => {
      const clientA: ClientSocketType = ClientSocket(`http://localhost:${port}`, {
        auth: { token: tokenA },
        transports: ['websocket'],
        reconnection: false,
      });

      const clientB: ClientSocketType = ClientSocket(`http://localhost:${port}`, {
        auth: { token: tokenB },
        transports: ['websocket'],
        reconnection: false,
      });

      // Wait for both sockets to connect
      await new Promise<void>((resolve) => {
        let connectedCount = 0;
        const checkDone = () => {
          connectedCount++;
          if (connectedCount === 2) resolve();
        };
        clientA.on('connect', checkDone);
        clientB.on('connect', checkDone);
      });

      // Prepare listeners
      const promiseA = new Promise<{ title: string; body: string }>((resolve) => {
        clientA.on('notification:new', (notif: { title: string; body: string }) => {
          resolve(notif);
        });
      });

      const promiseB = new Promise<{ title: string; body: string }>((resolve) => {
        clientB.on('notification:new', (notif: { title: string; body: string }) => {
          resolve(notif);
        });
      });

      // Send notifications to both users via NotificationService
      await NotificationService.notify(null, [userA._id, userB._id], {
        type: 'CLASS_RESTORED',
        title: 'Class Restored',
        body: 'Engineering Physics class restored to Thursday slot',
      });

      const [receivedA, receivedB] = await Promise.all([promiseA, promiseB]);

      expect(receivedA.title).toBe('Class Restored');
      expect(receivedA.body).toContain('Engineering Physics');

      expect(receivedB.title).toBe('Class Restored');
      expect(receivedB.body).toContain('Engineering Physics');

      clientA.disconnect();
      clientB.disconnect();
    });
  });
});
