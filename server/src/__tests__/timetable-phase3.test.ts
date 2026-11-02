import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { AcademicTerm, IAcademicTerm } from '../models/AcademicTerm';
import { Timetable, ITimetable } from '../models/Timetable';
import { ScheduleSlot, IScheduleSlot } from '../models/ScheduleSlot';
import { Booking } from '../models/Booking';
import { Notification } from '../models/Notification';
import { Classroom, IClassroom } from '../models/Classroom';
import { Batch, IBatch } from '../models/Batch';
import { Course, ICourse } from '../models/Course';
import { CourseOffering } from '../models/CourseOffering';
import { Department } from '../models/Department';
import { User, IUser } from '../models/User';
import { Types } from 'mongoose';
import { ENV } from '../config/env';

const app = createApp();

describe('Phase 3: Timetable Editor and Publish API', () => {
  let adminToken: string;
  let adminUser: IUser;
  let term: IAcademicTerm;
  let termId: string;
  let timetable: ITimetable;
  let timetableId: string;
  let testSlotA: IScheduleSlot;
  let testSlotB: IScheduleSlot;
  let batch: IBatch;
  let course: ICourse;
  let classroom: IClassroom;
  let prof: IUser;

  beforeEach(async () => {
    // 1. Department
    const dept = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      building: 'C Block',
    });

    // 2. Batch
    batch = await Batch.create({
      name: 'CSE III-A',
      departmentId: dept._id,
      semester: 5,
      academicYear: '2026-2027',
    });

    // 3. Course
    course = await Course.create({
      code: 'CS1301',
      title: 'Formal Languages and Automata Theory',
      departmentId: dept._id,
      credits: 3,
      weeklyTheoryHours: 3,
      weeklyLabHours: 0,
    });

    // 4. Classrooms
    classroom = await Classroom.create({
      name: 'C302',
      building: 'C Block',
      capacity: 90,
      type: 'THEORY',
      hasProjector: true,
      isActive: true,
    });

    await Classroom.create({
      name: 'A306',
      building: 'A Block',
      capacity: 80,
      type: 'THEORY',
      hasProjector: true,
      isActive: true,
    });

    // 5. Users: Admin, Professor, Student
    adminUser = await User.create({
      email: 'admin@sam.edu',
      passwordHash: 'hash',
      firstName: 'Institutional',
      lastName: 'Admin',
      role: 'ADMIN',
      departmentId: dept._id,
      tokenVersion: 0,
      isActive: true,
    });

    prof = await User.create({
      email: 'prof.rimjhim@sam.edu',
      passwordHash: 'hash',
      firstName: 'Rimjhim',
      lastName: 'Sharma',
      role: 'PROFESSOR',
      departmentId: dept._id,
      tokenVersion: 0,
      isActive: true,
    });

    await User.create({
      email: 'student.csea01@sam.edu',
      passwordHash: 'hash',
      firstName: 'Aarav',
      lastName: 'Patel',
      role: 'STUDENT',
      rollNumber: '24CS01',
      departmentId: dept._id,
      batchId: batch._id,
      tokenVersion: 0,
      isActive: true,
    });

    // 6. Term
    term = await AcademicTerm.create({
      name: 'Odd Semester 2026-27',
      academicYear: '2026-2027',
      semesterType: 'ODD',
      startDate: '2026-08-03',
      endDate: '2026-12-11',
      workingDays: [1, 2, 3, 4, 5],
      periods: [
        { index: 1, start: '09:00', end: '10:00', blocked: false, label: 'Period 1' },
        { index: 2, start: '10:00', end: '11:00', blocked: false, label: 'Period 2' },
        { index: 3, start: '11:00', end: '12:00', blocked: false, label: 'Period 3' },
        { index: 4, start: '12:00', end: '13:00', blocked: false, label: 'Period 4' },
        { index: 5, start: '13:00', end: '14:00', blocked: true, label: 'Lunch Break' },
        { index: 6, start: '14:00', end: '15:00', blocked: false, label: 'Period 5' },
        { index: 7, start: '15:00', end: '16:00', blocked: false, label: 'Period 6' },
        { index: 8, start: '16:00', end: '17:00', blocked: false, label: 'Period 7' },
      ],
      holidays: [{ dateKey: '2026-08-15', label: 'Independence Day' }],
      isActive: true,
      versions: [],
    });
    termId = term._id.toString();

    // 7. Offering
    await CourseOffering.create({
      termId: term._id,
      courseId: course._id,
      batchId: batch._id,
      professorIds: [prof._id],
      theoryHoursPerWeek: 3,
      labBlocksPerWeek: 0,
      labBlockLength: 2,
      isActive: true,
    });

    // 8. Timetable
    timetable = await Timetable.create({
      title: 'Editor Test Timetable',
      termId: term._id,
      status: 'DRAFT',
      revision: 1,
      createdBy: adminUser._id,
    });
    timetableId = timetable._id.toString();

    // Slot A: Mon (day 1), period 1
    testSlotA = await ScheduleSlot.create({
      timetableId: timetable._id,
      courseId: course._id,
      batchId: batch._id,
      professorIds: [prof._id],
      classroomId: classroom._id,
      dayOfWeek: 1,
      slotIndex: 1,
      durationSlots: 1,
      kind: 'THEORY',
      placed: true,
    });

    // Slot B: Tue (day 2), period 2
    testSlotB = await ScheduleSlot.create({
      timetableId: timetable._id,
      courseId: course._id,
      batchId: batch._id,
      professorIds: [prof._id],
      classroomId: classroom._id,
      dayOfWeek: 2,
      slotIndex: 2,
      durationSlots: 1,
      kind: 'THEORY',
      placed: true,
    });

    // Generate Admin JWT token
    adminToken = jwt.sign(
      {
        id: adminUser._id.toString(),
        role: 'ADMIN',
        email: adminUser.email,
        tokenVersion: 0,
      },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('1. List and Details', () => {
    it('GET /api/v1/timetables lists timetables for term', async () => {
      const res = await request(app)
        .get(`/api/v1/timetables?termId=${termId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((t: { _id: string }) => t._id === timetableId);
      expect(found).toBeDefined();
      expect(found.totalSlots).toBe(2);
      expect(found.placedSlots).toBe(2);
    });

    it('GET /api/v1/timetables/:id returns full timetable with slots and term', async () => {
      const res = await request(app)
        .get(`/api/v1/timetables/${timetableId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.timetable._id).toBe(timetableId);
      expect(res.body.data.term).toBeDefined();
      expect(res.body.data.slots.length).toBe(2);
    });
  });

  describe('2. Drop Map Computation', () => {
    it('GET /api/v1/timetables/:id/slots/:slotId/drop-map returns cell statuses', async () => {
      const res = await request(app)
        .get(`/api/v1/timetables/${timetableId}/slots/${testSlotA._id}/drop-map`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const dropMap = res.body.data;
      expect(dropMap).toBeDefined();

      // Slot B occupies day 2, period 2:
      // Moving slot A to day 2 period 2 would cause batch & professor clash!
      // Therefore key '2:2' must be RED
      expect(dropMap['2:2']).toBeDefined();
      expect(dropMap['2:2'].state).toBe('RED');
      expect(dropMap['2:2'].reasons.length).toBeGreaterThan(0);

      // Period 5 is blocked (lunch 13:00-14:00) in default term grid:
      // '1:5' must be RED
      expect(dropMap['1:5']).toBeDefined();
      expect(dropMap['1:5'].state).toBe('RED');

      // An empty period like day 3 (Wed), period 1 should be GREEN or YELLOW
      expect(dropMap['3:1']).toBeDefined();
      expect(['GREEN', 'YELLOW']).toContain(dropMap['3:1'].state);
    });
  });

  describe('3. Move Slot and Conflict Validation', () => {
    it('PATCH /api/v1/timetables/:id/slots/:slotId successfully moves a slot', async () => {
      const res = await request(app)
        .patch(`/api/v1/timetables/${timetableId}/slots/${testSlotA._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          day: 3,
          period: 1,
          revision: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.slot.dayOfWeek).toBe(3);
      expect(res.body.data.slot.slotIndex).toBe(1);
      expect(res.body.data.revision).toBe(2);

      const updated = await ScheduleSlot.findById(testSlotA._id);
      expect(updated!.dayOfWeek).toBe(3);
      expect(updated!.slotIndex).toBe(1);
    });

    it('PATCH returns 409 when stale revision is sent', async () => {
      // First update moves revision to 2
      await request(app)
        .patch(`/api/v1/timetables/${timetableId}/slots/${testSlotA._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          day: 3,
          period: 1,
          revision: 1,
        });

      // Now send stale revision 1
      const res = await request(app)
        .patch(`/api/v1/timetables/${timetableId}/slots/${testSlotA._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          day: 3,
          period: 2,
          revision: 1,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/revision mismatch/i);
    });

    it('PATCH returns 409 when move creates a conflict', async () => {
      // Slot B is at day 2, period 2. Trying to move Slot A to day 2, period 2 causes conflict.
      const res = await request(app)
        .patch(`/api/v1/timetables/${timetableId}/slots/${testSlotA._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          day: 2,
          period: 2,
          revision: 1,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/cannot place slot/i);
    });
  });

  describe('4. Swap Slots', () => {
    it('POST /api/v1/timetables/:id/slots/swap swaps two valid slots within transaction', async () => {
      // testSlotA is at (1, 1), testSlotB is at (2, 2)
      const res = await request(app)
        .post(`/api/v1/timetables/${timetableId}/slots/swap`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slotA: testSlotA._id.toString(),
          slotB: testSlotB._id.toString(),
          revision: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.revision).toBe(2);

      const refreshedA = await ScheduleSlot.findById(testSlotA._id);
      const refreshedB = await ScheduleSlot.findById(testSlotB._id);

      expect(refreshedA!.dayOfWeek).toBe(2);
      expect(refreshedA!.slotIndex).toBe(2);
      expect(refreshedB!.dayOfWeek).toBe(1);
      expect(refreshedB!.slotIndex).toBe(1);
    });
  });

  describe('5. Clone Timetable', () => {
    it('POST /api/v1/timetables/:id/clone creates draft copy with same lineageId', async () => {
      const res = await request(app)
        .post(`/api/v1/timetables/${timetableId}/clone`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      const clonedTimetable = res.body.data;
      expect(clonedTimetable.status).toBe('DRAFT');
      expect(clonedTimetable.revision).toBe(1);
      expect(clonedTimetable.basedOnTimetableId).toBe(timetableId);

      const clonedSlots = await ScheduleSlot.find({ timetableId: clonedTimetable._id });
      expect(clonedSlots.length).toBe(2);

      const originalA = await ScheduleSlot.findById(testSlotA._id);
      const matchedA = clonedSlots.find((s) => s.lineageId === originalA!.lineageId);
      expect(matchedA).toBeDefined();
      expect(matchedA!._id.toString()).not.toBe(originalA!._id.toString());
    });
  });

  describe('6. Validate Timetable', () => {
    it('POST /api/v1/timetables/:id/validate returns valid true when no conflicts', async () => {
      const res = await request(app)
        .post(`/api/v1/timetables/${timetableId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.unplacedCount).toBe(0);
    });
  });

  describe('7. Publish Timetable', () => {
    it('Publish blocked when unplaced slots exist', async () => {
      const unplacedSlot = await ScheduleSlot.create({
        timetableId: new Types.ObjectId(timetableId),
        courseId: course._id,
        batchId: batch._id,
        professorIds: [],
        dayOfWeek: 1,
        slotIndex: 1,
        durationSlots: 1,
        kind: 'THEORY',
        placed: false,
        unplacedReason: 'Testing unplaced blocking',
      });

      const res = await request(app)
        .post(`/api/v1/timetables/${timetableId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/unplaced/i);

      await ScheduleSlot.findByIdAndDelete(unplacedSlot._id);
    });

    it('Publish succeeds and expands to Booking arbiter & creates notifications', async () => {
      const res = await request(app)
        .post(`/api/v1/timetables/${timetableId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          effectiveFrom: '2026-08-03',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PUBLISHED');

      const updatedTerm = await AcademicTerm.findById(termId);
      const hasVersion = updatedTerm!.versions.some((v) => v.timetableId.toString() === timetableId);
      expect(hasVersion).toBe(true);

      const bookingsCount = await Booking.countDocuments({
        termId: new Types.ObjectId(termId),
        ownerType: 'WEEKLY',
      });
      expect(bookingsCount).toBeGreaterThan(0);

      const notifications = await Notification.find({
        type: 'TIMETABLE_PUBLISHED',
      });
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('Modifying or deleting a published timetable is rejected', async () => {
      // First publish
      await request(app)
        .post(`/api/v1/timetables/${timetableId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      const patchRes = await request(app)
        .patch(`/api/v1/timetables/${timetableId}/slots/${testSlotA._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          day: 4,
          period: 1,
          revision: 1,
        });

      expect(patchRes.status).toBe(400);

      const deleteRes = await request(app)
        .delete(`/api/v1/timetables/${timetableId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(400);
    });
  });

  describe('8. Delete Draft Timetable', () => {
    it('DELETE /api/v1/timetables/:id deletes draft and its slots', async () => {
      const draft = await Timetable.create({
        title: 'Disposable Draft',
        termId: new Types.ObjectId(termId),
        status: 'DRAFT',
        createdBy: adminUser._id,
      });

      const slot = await ScheduleSlot.create({
        timetableId: draft._id,
        courseId: course._id,
        batchId: batch._id,
        dayOfWeek: 1,
        slotIndex: 1,
        placed: false,
      });

      const res = await request(app)
        .delete(`/api/v1/timetables/${draft._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const checkTimetable = await Timetable.findById(draft._id);
      expect(checkTimetable).toBeNull();

      const checkSlot = await ScheduleSlot.findById(slot._id);
      expect(checkSlot).toBeNull();
    });
  });
});
