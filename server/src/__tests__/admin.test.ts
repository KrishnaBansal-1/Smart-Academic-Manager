import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Batch } from '../models/Batch';
import { Classroom } from '../models/Classroom';
import { Course } from '../models/Course';
import { Timetable } from '../models/Timetable';
import { ScheduleSlot } from '../models/ScheduleSlot';

const app = createApp();

describe('Admin Management Endpoints', () => {
  let adminToken: string;
  let departmentId: string;
  let batchId: string;
  let professorId: string;

  beforeEach(async () => {
    // 1. Create Admin
    const adminHash = await bcrypt.hash('Admin@123', 12);
    await User.create({
      email: 'admin.manage@sam.edu',
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'Manager',
      role: 'ADMIN',
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin.manage@sam.edu', password: 'Admin@123' });
    adminToken = loginRes.body.data.accessToken;

    // 2. Base records
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

    const profHash = await bcrypt.hash('Password@123', 12);
    const prof = await User.create({
      email: 'prof.smith@sam.edu',
      passwordHash: profHash,
      firstName: 'John',
      lastName: 'Smith',
      role: 'PROFESSOR',
      departmentId: dept._id,
    });
    professorId = prof._id.toString();
  });

  it('provides precise per-entity field validation errors instead of collapsing into union error', async () => {
    const res = await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email', // invalid email
        password: 'pass', // too short
        departmentId,
        batchId,
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toContain('email');
    expect(fields).toContain('password');
  });

  it('rejects creation when referenced foreign entities do not exist', async () => {
    const fakeId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Alex',
        lastName: 'Ray',
        email: 'alex.ray@sam.edu',
        password: 'Password@123',
        departmentId: fakeId,
        batchId,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('department does not exist');
  });

  it('enforces student roll number uniqueness', async () => {
    await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'First',
        lastName: 'Student',
        email: 'first@sam.edu',
        password: 'Password@123',
        departmentId,
        batchId,
        rollNumber: '24CS01',
      });

    const duplicateRes = await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Second',
        lastName: 'Student',
        email: 'second@sam.edu',
        password: 'Password@123',
        departmentId,
        batchId,
        rollNumber: '24CS01',
      });

    expect(duplicateRes.status).toBe(409);
  });

  it('supports department CRUD and reactivate lifecycle', async () => {
    // 1. Create department
    const createRes = await request(app)
      .post('/api/v1/admin/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mechanical Engineering', code: 'ME', building: 'M Block' });

    expect(createRes.status).toBe(201);
    const deptId = createRes.body.data.item._id;

    // 2. Deactivate
    const deleteRes = await request(app)
      .delete(`/api/v1/admin/departments/${deptId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.item.isActive).toBe(false);

    // 3. Reactivate
    const reactivateRes = await request(app)
      .patch(`/api/v1/admin/departments/${deptId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.item.isActive).toBe(true);
  });

  it('warns when deactivating a resource referenced in a published timetable', async () => {
    const admin = await User.findOne({ role: 'ADMIN' });
    const timetable = await Timetable.create({
      title: 'Active Odd Term 2026',
      academicYear: '2026-2027',
      semester: 5,
      status: 'PUBLISHED',
      createdBy: admin!._id,
    });

    const course = await Course.create({
      code: 'CS1301',
      title: 'Operating Systems',
      departmentId,
      credits: 3,
      weeklyTheoryHours: 3,
      weeklyLabHours: 0,
    });

    const room = await Classroom.create({
      name: 'C302',
      building: 'C Block',
      capacity: 40,
      type: 'THEORY',
      hasProjector: true,
    });

    await ScheduleSlot.create({
      timetableId: timetable._id,
      dayOfWeek: 1,
      slotIndex: 1,
      durationSlots: 1,
      courseId: course._id,
      professorId,
      batchId,
      classroomId: room._id,
    });

    // Deactivating the assigned professor should trigger a timetable warning
    const deactivateRes = await request(app)
      .delete(`/api/v1/admin/professors/${professorId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.warning).toBeDefined();
    expect(deactivateRes.body.data.warning).toContain('published timetable');
  });

  it('imports student roster via CSV successfully', async () => {
    const csvData = `firstName,lastName,email,rollNumber,departmentCode,batchName,password
Arjun,Sharma,arjun@sam.edu,24CS91,CSE,CSE-III-A-2026,Pass@12345
Kavita,Rao,kavita@sam.edu,24CS92,CSE,CSE-III-A-2026,Pass@12345`;

    const importRes = await request(app)
      .post('/api/v1/admin/students/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ csv: csvData });

    expect(importRes.status).toBe(200);
    expect(importRes.body.data.importedCount).toBe(2);
    expect(importRes.body.data.failedCount).toBe(0);

    const arjun = await User.findOne({ email: 'arjun@sam.edu' });
    expect(arjun).not.toBeNull();
    expect(arjun?.rollNumber).toBe('24CS91');
    expect(arjun?.departmentId?.toString()).toBe(departmentId);
    expect(arjun?.batchId?.toString()).toBe(batchId);
  });
});
