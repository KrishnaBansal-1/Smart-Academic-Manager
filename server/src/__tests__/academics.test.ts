import request from 'supertest';
import { createApp } from '../app';
import { User, IUser } from '../models/User';
import { Department, IDepartment } from '../models/Department';
import { Batch, IBatch } from '../models/Batch';
import { Course, ICourse } from '../models/Course';
import { AcademicTerm, IAcademicTerm } from '../models/AcademicTerm';
import { CourseOffering } from '../models/CourseOffering';
import { Timetable } from '../models/Timetable';
import { SoftConstraint } from '../models/SoftConstraint';
import { InstitutionSettings, DEFAULT_PERIOD_GRID } from '../models/InstitutionSettings';
import { seedDatabase } from '../utils/seeder';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

const app = createApp();

const generateAuthCookie = (user: IUser): string => {
  const token = jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, tokenVersion: user.tokenVersion || 0 },
    ENV.JWT_SECRET,
    { expiresIn: '15m' }
  );
  return `Bearer ${token}`;
};

describe('Academic Setup & Phase 1 Endpoints', () => {
  let adminUser: IUser;
  let professorUser: IUser;
  let studentUser: IUser;
  let adminToken: string;
  let profToken: string;
  let studentToken: string;
  let dept: IDepartment;
  let batchA: IBatch;
  let course1: ICourse;
  let term: IAcademicTerm;

  beforeEach(async () => {
    dept = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      building: 'C Block',
    });

    adminUser = await User.create({
      email: 'admin.acad@sam.edu',
      passwordHash: 'hash',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      departmentId: dept._id,
    });

    professorUser = await User.create({
      email: 'prof.acad@sam.edu',
      passwordHash: 'hash',
      firstName: 'Prof',
      lastName: 'Faculty',
      role: 'PROFESSOR',
      departmentId: dept._id,
    });

    batchA = await Batch.create({
      name: 'CSE-V-A-2026',
      departmentId: dept._id,
      semester: 5,
      academicYear: '2026-2027',
    });

    await Batch.create({
      name: 'CSE-V-B-2026',
      departmentId: dept._id,
      semester: 5,
      academicYear: '2026-2027',
    });

    studentUser = await User.create({
      email: 'student.acad@sam.edu',
      passwordHash: 'hash',
      firstName: 'Student',
      lastName: 'A',
      role: 'STUDENT',
      departmentId: dept._id,
      batchId: batchA._id,
      rollNumber: '24CSB0A01',
    });

    adminToken = generateAuthCookie(adminUser);
    profToken = generateAuthCookie(professorUser);
    studentToken = generateAuthCookie(studentUser);

    course1 = await Course.create({
      code: 'CS1301',
      title: 'Data Warehousing',
      departmentId: dept._id,
      credits: 4,
      weeklyTheoryHours: 4,
      weeklyLabHours: 0,
      professorIds: [professorUser._id],
    });

    await Course.create({
      code: 'CS1309',
      title: 'Networks Lab',
      departmentId: dept._id,
      credits: 2,
      weeklyTheoryHours: 0,
      weeklyLabHours: 2,
      professorIds: [professorUser._id],
    });

    term = await AcademicTerm.create({
      name: 'Odd Semester 2026-27',
      academicYear: '2026-27',
      semesterType: 'ODD',
      startDate: '2026-08-03',
      endDate: '2026-12-11',
      workingDays: [1, 2, 3, 4, 5],
      periods: DEFAULT_PERIOD_GRID,
      holidays: [{ dateKey: '2026-08-15', label: 'Independence Day' }],
      isActive: true,
      versions: [],
    });
  });

  describe('Institution Settings', () => {
    it('allows admin to get and update settings', async () => {
      const getRes = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', adminToken);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.timezone).toBe('Asia/Kolkata');
      expect(getRes.body.data.attendanceGood).toBe(80);

      const patchRes = await request(app)
        .patch('/api/v1/settings')
        .set('Authorization', adminToken)
        .send({ attendanceGood: 85, minorNoticeDays: 4 });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.attendanceGood).toBe(85);
      expect(patchRes.body.data.minorNoticeDays).toBe(4);
    });

    it('rejects non-admin access to settings', async () => {
      const res = await request(app)
        .get('/api/v1/settings')
        .set('Authorization', profToken);

      expect(res.status).toBe(403);
    });
  });

  describe('AcademicTerm & Period Grid Validation', () => {
    it('allows all roles to read the active term', async () => {
      const res = await request(app)
        .get('/api/v1/terms/active')
        .set('Authorization', studentToken);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Odd Semester 2026-27');
      expect(res.body.data.isActive).toBe(true);
    });

    it('rejects creation when dates are invalid or nonexistent', async () => {
      const res = await request(app)
        .post('/api/v1/terms')
        .set('Authorization', adminToken)
        .send({
          name: 'Invalid Term',
          academicYear: '2026-27',
          semesterType: 'EVEN',
          startDate: '2026-02-31', // invalid calendar date!
          endDate: '2026-05-15',
          workingDays: [1, 2, 3, 4, 5],
          periods: DEFAULT_PERIOD_GRID,
        });

      expect(res.status).toBe(400);
    });

    it('rejects creation when startDate is after endDate', async () => {
      const res = await request(app)
        .post('/api/v1/terms')
        .set('Authorization', adminToken)
        .send({
          name: 'Backwards Term',
          academicYear: '2026-27',
          semesterType: 'EVEN',
          startDate: '2026-12-01',
          endDate: '2026-08-01',
          workingDays: [1, 2, 3, 4, 5],
          periods: DEFAULT_PERIOD_GRID,
        });

      expect(res.status).toBe(400);
    });

    it('rejects overlapping period times in grid', async () => {
      const badGrid = [
        { index: 1, start: '09:00', end: '10:30', label: 'Period 1' },
        { index: 2, start: '10:00', end: '11:00', label: 'Period 2' }, // overlaps with Period 1!
      ];

      const res = await request(app)
        .post('/api/v1/terms')
        .set('Authorization', adminToken)
        .send({
          name: 'Overlap Term',
          academicYear: '2026-27',
          semesterType: 'EVEN',
          startDate: '2027-01-04',
          endDate: '2027-05-07',
          workingDays: [1, 2, 3, 4, 5],
          periods: badGrid,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('overlaps');
    });

    it('enforces grid freezing once a timetable has been published', async () => {
      // Create a published timetable for this term
      await Timetable.create({
        title: 'Published Fall 2026',
        termId: term._id,
        status: 'PUBLISHED',
        createdBy: adminUser._id,
      });

      // Try to modify periods on the term
      const res = await request(app)
        .patch(`/api/v1/terms/${term._id}`)
        .set('Authorization', adminToken)
        .send({
          periods: [
            { index: 1, start: '08:00', end: '09:00', label: 'Early Period' },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('frozen');
    });

    it('previews and adds holidays to a term', async () => {
      const previewRes = await request(app)
        .post(`/api/v1/terms/${term._id}/holidays/preview`)
        .set('Authorization', adminToken)
        .send({
          dateKey: '2026-10-02',
          label: 'Mahatma Gandhi Jayanti',
        });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.data.dateKey).toBe('2026-10-02');
      expect(previewRes.body.data.affectedClasses).toBeDefined();

      const addRes = await request(app)
        .post(`/api/v1/terms/${term._id}/holidays`)
        .set('Authorization', adminToken)
        .send({
          dateKey: '2026-10-02',
          label: 'Mahatma Gandhi Jayanti',
        });

      expect(addRes.status).toBe(201);
      expect(addRes.body.data.holidays).toHaveLength(2);

      // Duplicate holiday on same dateKey rejected
      const dupRes = await request(app)
        .post(`/api/v1/terms/${term._id}/holidays`)
        .set('Authorization', adminToken)
        .send({
          dateKey: '2026-10-02',
          label: 'Another Holiday',
        });

      expect(dupRes.status).toBe(400);
    });
  });

  describe('Course Offerings & Bulk Department Assignment', () => {
    it('creates an offering and rejects duplicate offering for same section', async () => {
      const createRes = await request(app)
        .post('/api/v1/offerings')
        .set('Authorization', adminToken)
        .send({
          termId: term._id.toString(),
          courseId: course1._id.toString(),
          batchId: batchA._id.toString(),
          professorIds: [professorUser._id.toString()],
          theoryHoursPerWeek: 4,
          labBlocksPerWeek: 0,
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.courseId.code).toBe('CS1301');

      // Duplicate creation must fail with 409
      const dupRes = await request(app)
        .post('/api/v1/offerings')
        .set('Authorization', adminToken)
        .send({
          termId: term._id.toString(),
          courseId: course1._id.toString(),
          batchId: batchA._id.toString(),
          professorIds: [professorUser._id.toString()],
        });

      expect(dupRes.status).toBe(409);
    });

    it('rejects creation if professor ID does not belong to active faculty', async () => {
      const res = await request(app)
        .post('/api/v1/offerings')
        .set('Authorization', adminToken)
        .send({
          termId: term._id.toString(),
          courseId: course1._id.toString(),
          batchId: batchA._id.toString(),
          professorIds: [studentUser._id.toString()], // student cannot teach!
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('faculty');
    });

    it('supports bulk generation from department and skips existing ones', async () => {
      const bulkRes = await request(app)
        .post('/api/v1/offerings/bulk-from-department')
        .set('Authorization', adminToken)
        .send({
          termId: term._id.toString(),
          departmentId: dept._id.toString(),
        });

      expect(bulkRes.status).toBe(200);
      expect(bulkRes.body.data.createdCount).toBe(4); // 2 courses x 2 batches

      // Second bulk run skips duplicates
      const bulkRes2 = await request(app)
        .post('/api/v1/offerings/bulk-from-department')
        .set('Authorization', adminToken)
        .send({
          termId: term._id.toString(),
          departmentId: dept._id.toString(),
        });

      expect(bulkRes2.status).toBe(200);
      expect(bulkRes2.body.data.createdCount).toBe(0);
      expect(bulkRes2.body.data.skippedCount).toBe(4);
    });

    it('allows professor to fetch their assigned offerings', async () => {
      await CourseOffering.create({
        termId: term._id,
        courseId: course1._id,
        batchId: batchA._id,
        professorIds: [professorUser._id],
        theoryHoursPerWeek: 4,
        labBlocksPerWeek: 0,
        labBlockLength: 2,
        isActive: true,
      });

      const res = await request(app)
        .get('/api/v1/professor/offerings')
        .set('Authorization', profToken);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].courseId.code).toBe('CS1301');
      expect(res.body.data.items[0].batchId.name).toBe('CSE-V-A-2026');
    });
  });

  describe('Faculty Constraints & Preferences', () => {
    it('allows professor to set and retrieve teaching preferences', async () => {
      const putRes = await request(app)
        .put('/api/v1/constraints/me')
        .set('Authorization', profToken)
        .send({
          termId: term._id.toString(),
          preferredTimeWindows: [{ dayOfWeek: 1, startSlot: 1, endSlot: 3 }],
          unavailableWindows: [{ dayOfWeek: 5, startSlot: 6, endSlot: 8 }],
          maxDailyHours: 4,
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.preferredTimeWindows).toHaveLength(1);
      expect(putRes.body.data.priorityWeight).toBe(3); // default priority preserved

      const getRes = await request(app)
        .get('/api/v1/constraints/me')
        .set('Authorization', profToken);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.unavailableWindows[0].dayOfWeek).toBe(5);
    });

    it('rejects preferences where startSlot > endSlot or slot outside grid', async () => {
      const res = await request(app)
        .put('/api/v1/constraints/me')
        .set('Authorization', profToken)
        .send({
          termId: term._id.toString(),
          preferredTimeWindows: [{ dayOfWeek: 1, startSlot: 5, endSlot: 2 }], // invalid!
        });

      expect(res.status).toBe(400);

      const resOutGrid = await request(app)
        .put('/api/v1/constraints/me')
        .set('Authorization', profToken)
        .send({
          termId: term._id.toString(),
          preferredTimeWindows: [{ dayOfWeek: 1, startSlot: 1, endSlot: 15 }], // grid has 8 periods
        });

      expect(resOutGrid.status).toBe(400);
    });

    it('allows admin to view constraints and adjust priority weight', async () => {
      const constraint = await SoftConstraint.create({
        professorId: professorUser._id,
        termId: term._id,
        preferredTimeWindows: [{ dayOfWeek: 2, startSlot: 1, endSlot: 3 }],
        maxDailyHours: 4,
        priorityWeight: 2,
      });

      const listRes = await request(app)
        .get(`/api/v1/constraints?termId=${term._id}`)
        .set('Authorization', adminToken);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.items.length).toBeGreaterThanOrEqual(1);

      const patchRes = await request(app)
        .patch(`/api/v1/constraints/${constraint._id}/priority`)
        .set('Authorization', adminToken)
        .send({ priorityWeight: 5 });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.priorityWeight).toBe(5);
    });
  });

  describe('Seed Integrity Test', () => {
    it('seeds the entire dataset with active term, offerings, 30 students per section, and constraints', async () => {
      await seedDatabase();

      // Verify active term
      const activeTerm = await AcademicTerm.findOne({ isActive: true });
      expect(activeTerm).not.toBeNull();
      expect(activeTerm!.startDate).toBe('2026-08-03');
      expect(activeTerm!.endDate).toBe('2026-12-11');
      expect(activeTerm!.periods).toHaveLength(8);

      // Verify settings
      const settings = await InstitutionSettings.findOne();
      expect(settings).not.toBeNull();
      expect(settings!.timezone).toBe('Asia/Kolkata');

      // Verify batches are semester 5
      const batches = await Batch.find();
      expect(batches).toHaveLength(3);
      batches.forEach((b) => expect(b.semester).toBe(5));

      // Verify 30 students per section (90 total)
      const students = await User.find({ role: 'STUDENT' });
      expect(students).toHaveLength(90);

      // Verify first 5 student emails preserved
      const csea01 = await User.findOne({ email: 'student.csea01@sam.edu' });
      expect(csea01).not.toBeNull();
      expect(csea01!.rollNumber).toBe('24CSB0A01');

      // Verify 30th student exists
      const csea30 = await User.findOne({ email: 'student.csea30@sam.edu' });
      expect(csea30).not.toBeNull();
      expect(csea30!.rollNumber).toBe('24CSB0A30');

      // Verify double-counted lab hours removed
      const cs1303 = await Course.findOne({ code: 'CS1303' });
      expect(cs1303!.weeklyLabHours).toBe(0);
      const cs2301 = await Course.findOne({ code: 'CS2301' });
      expect(cs2301!.weeklyLabHours).toBe(0);

      // Verify offerings
      const offerings = await CourseOffering.find({ termId: activeTerm!._id });
      expect(offerings.length).toBeGreaterThan(0);

      // Verify fractal course offering has 0 faculty and is inactive
      const fractalOfferings = await CourseOffering.find({
        termId: activeTerm!._id,
      }).populate<{ courseId: { code: string } }>('courseId');

      const cs1381Offerings = fractalOfferings.filter((o) => o.courseId.code === 'CS1381');
      expect(cs1381Offerings.length).toBe(2); // for CSE-III-A and CSE-III-B
      cs1381Offerings.forEach((o) => {
        expect(o.professorIds).toHaveLength(0);
        expect(o.isActive).toBe(false);
      });

      // Verify sample soft constraints
      const constraints = await SoftConstraint.find({ termId: activeTerm!._id });
      expect(constraints.length).toBeGreaterThanOrEqual(3);
    });
  });
});
