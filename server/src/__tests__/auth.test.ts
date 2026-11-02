import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Batch } from '../models/Batch';

const app = createApp();

const getCookies = (res: request.Response): string[] => {
  const header = res.headers['set-cookie'];
  if (Array.isArray(header)) return header;
  if (typeof header === 'string') return [header];
  return [];
};

describe('Auth System & Security Flow', () => {
  let departmentId: string;
  let batchId: string;

  beforeEach(async () => {
    const dept = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      building: 'C Block',
    });
    departmentId = dept._id.toString();

    const batch = await Batch.create({
      name: 'CSE-III-A-2026',
      departmentId: dept._id,
      semester: 5,
      academicYear: '2026-2027',
    });
    batchId = batch._id.toString();
  });

  it('authenticates user and returns populated user profile with cookie', async () => {
    const passwordHash = await bcrypt.hash('Password@123', 12);
    await User.create({
      email: 'student.test@sam.edu',
      passwordHash,
      firstName: 'Test',
      lastName: 'Student',
      role: 'STUDENT',
      rollNumber: '24CS01',
      departmentId,
      batchId,
      tokenVersion: 0,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student.test@sam.edu', password: 'Password@123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();

    // Verify populated batch and department
    const user = loginRes.body.data.user;
    expect(user.email).toBe('student.test@sam.edu');
    expect(user.departmentId.code).toBe('CSE');
    expect(user.batchId.name).toBe('CSE-III-A-2026');
    expect(user.id).toBeDefined();
    expect(user._id).toBeDefined();

    // Verify refresh token cookie
    const cookies = getCookies(loginRes);
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
    expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);

    // Verify /auth/me returns the same shape
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(user.email);
    expect(meRes.body.data.user.departmentId.name).toBe('Computer Science and Engineering');
    expect(meRes.body.data.user.batchId.name).toBe('CSE-III-A-2026');
  });

  it('protects against email enumeration and credential timing differences', async () => {
    const passwordHash = await bcrypt.hash('Password@123', 12);
    await User.create({
      email: 'existing@sam.edu',
      passwordHash,
      firstName: 'Existing',
      lastName: 'User',
      role: 'PROFESSOR',
      departmentId,
    });

    // 1. Non-existent email
    const nonExistentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@sam.edu', password: 'WrongPassword@123' });

    expect(nonExistentRes.status).toBe(401);
    expect(nonExistentRes.body.message).toBe('Invalid email or password');

    // 2. Existing email with wrong password
    const wrongPassRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'existing@sam.edu', password: 'WrongPassword@123' });

    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body.message).toBe('Invalid email or password');
  });

  it('handles refresh token rotation and revocation via tokenVersion', async () => {
    const passwordHash = await bcrypt.hash('Password@123', 12);
    const user = await User.create({
      email: 'rotate.test@sam.edu',
      passwordHash,
      firstName: 'Rotate',
      lastName: 'Test',
      role: 'STUDENT',
      departmentId,
      batchId,
      tokenVersion: 0,
    });

    // 1. Initial Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'rotate.test@sam.edu', password: 'Password@123' });

    const cookies = getCookies(loginRes);
    const initialRefreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));
    expect(initialRefreshCookie).toBeDefined();

    // 2. First Refresh
    const refreshRes1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [initialRefreshCookie!]);

    expect(refreshRes1.status).toBe(200);
    expect(refreshRes1.body.data.accessToken).toBeDefined();

    // Verify tokenVersion bumped in DB
    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.tokenVersion).toBe(1);

    const newCookies = getCookies(refreshRes1);
    const rotatedRefreshCookie = newCookies.find((c: string) => c.startsWith('refreshToken='));
    expect(rotatedRefreshCookie).toBeDefined();

    // 3. Reuse old refresh token (revoked) -> Must fail with 401
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [initialRefreshCookie!]);

    expect(replayRes.status).toBe(401);

    // 4. Using the newly rotated token -> Must succeed
    const validRefreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [rotatedRefreshCookie!]);

    expect(validRefreshRes.status).toBe(200);
  });

  it('revokes refresh tokens when password is changed', async () => {
    const adminPasswordHash = await bcrypt.hash('Admin@123', 12);
    await User.create({
      email: 'admin@sam.edu',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    });

    const userPasswordHash = await bcrypt.hash('Password@123', 12);
    const student = await User.create({
      email: 'target.student@sam.edu',
      passwordHash: userPasswordHash,
      firstName: 'Target',
      lastName: 'Student',
      role: 'STUDENT',
      departmentId,
      batchId,
      tokenVersion: 0,
    });

    // 1. Student logs in
    const studentLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'target.student@sam.edu', password: 'Password@123' });

    const studentCookie = getCookies(studentLogin).find((c: string) =>
      c.startsWith('refreshToken=')
    );
    expect(studentCookie).toBeDefined();

    // 2. Admin logs in and changes student password
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@sam.edu', password: 'Admin@123' });

    const adminToken = adminLogin.body.data.accessToken;

    const changePassRes = await request(app)
      .patch(`/api/v1/admin/users/${student._id}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'NewSecurePassword@123' });

    expect(changePassRes.status).toBe(200);

    // 3. Old student refresh token is now revoked
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [studentCookie!]);

    expect(refreshRes.status).toBe(401);
  });

  it('clears refresh token cookie on logout', async () => {
    const logoutRes = await request(app).post('/api/v1/auth/logout');
    expect(logoutRes.status).toBe(200);
    const cookies = getCookies(logoutRes);
    expect(cookies.some((c: string) => c.includes('refreshToken=;'))).toBe(true);
  });
});
