import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { AcademicTerm, IAcademicTerm } from '../models/AcademicTerm';
import { Timetable, ITimetable } from '../models/Timetable';
import { ScheduleSlot, IScheduleSlot } from '../models/ScheduleSlot';
import { ScheduleOverride } from '../models/ScheduleOverride';
import { MinorExam } from '../models/MinorExam';
import { Booking } from '../models/Booking';
import { Classroom, IClassroom } from '../models/Classroom';
import { Batch, IBatch } from '../models/Batch';
import { Course, ICourse } from '../models/Course';
import { CourseOffering } from '../models/CourseOffering';
import { Department } from '../models/Department';
import { User, IUser } from '../models/User';
import { AttendanceSession } from '../models/AttendanceSession';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { AttendanceAuditLog } from '../models/AttendanceAuditLog';
import { Notification } from '../models/Notification';
import { BookingService } from '../services/booking.service';
import { ENV } from '../config/env';

const app = createApp();

describe('Phase 6: Cancel and Reschedule Occurrences', () => {
  let adminToken: string;
  let profAToken: string;
  let profCoTeacherToken: string;
  let profOtherToken: string;
  let studentToken: string;

  let adminUser: IUser;
  let profA: IUser;
  let profCoTeacher: IUser;
  let profOther: IUser;
  let studentA: IUser;

  let term: IAcademicTerm;
  let publishedTimetable: ITimetable;
  let batchA: IBatch;
  let courseA: ICourse;
  let classroomA: IClassroom;
  let classroomB: IClassroom;
  let slotA: IScheduleSlot;

  beforeEach(async () => {
    // 1. Department
    const deptCSE = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      building: 'C Block',
    });

    // 2. Batch
    batchA = await Batch.create({
      name: 'CSE III-A',
      departmentId: deptCSE._id,
      semester: 5,
      academicYear: '2026-2027',
    });

    // 3. Course
    courseA = await Course.create({
      code: 'CS1301',
      title: 'Formal Languages and Automata Theory',
      departmentId: deptCSE._id,
      credits: 3,
      weeklyTheoryHours: 3,
      weeklyLabHours: 0,
    });

    // 4. Classrooms
    classroomA = await Classroom.create({
      name: 'C301',
      building: 'C Block',
      capacity: 60,
      type: 'THEORY',
      hasProjector: true,
      isActive: true,
    });

    classroomB = await Classroom.create({
      name: 'C302',
      building: 'C Block',
      capacity: 60,
      type: 'THEORY',
      hasProjector: true,
      isActive: true,
    });

    // 5. Users
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin.occ@sam.edu',
      passwordHash: 'hash',
      role: 'ADMIN',
      tokenVersion: 0,
      isActive: true,
    });

    profA = await User.create({
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'prof.a.occ@sam.edu',
      passwordHash: 'hash',
      role: 'PROFESSOR',
      departmentId: deptCSE._id,
      tokenVersion: 0,
      isActive: true,
    });

    profCoTeacher = await User.create({
      firstName: 'Alonzo',
      lastName: 'Church',
      email: 'prof.coteacher.occ@sam.edu',
      passwordHash: 'hash',
      role: 'PROFESSOR',
      departmentId: deptCSE._id,
      tokenVersion: 0,
      isActive: true,
    });

    profOther = await User.create({
      firstName: 'John',
      lastName: 'von Neumann',
      email: 'prof.other.occ@sam.edu',
      passwordHash: 'hash',
      role: 'PROFESSOR',
      departmentId: deptCSE._id,
      tokenVersion: 0,
      isActive: true,
    });

    studentA = await User.create({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'student.a.occ@sam.edu',
      passwordHash: 'hash',
      role: 'STUDENT',
      batchId: batchA._id,
      departmentId: deptCSE._id,
      tokenVersion: 0,
      isActive: true,
    });

    // Auth Tokens
    const sign = (u: IUser) =>
      jwt.sign(
        { id: u._id.toString(), role: u.role, tokenVersion: u.tokenVersion },
        ENV.JWT_SECRET,
        { expiresIn: '15m' }
      );

    adminToken = sign(adminUser);
    profAToken = sign(profA);
    profCoTeacherToken = sign(profCoTeacher);
    profOtherToken = sign(profOther);
    studentToken = sign(studentA);

    // 6. Term
    term = await AcademicTerm.create({
      name: 'Autumn Term 2026',
      academicYear: '2026-2027',
      semesterType: 'ODD',
      startDate: '2026-08-01',
      endDate: '2026-12-15',
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
    });

    // 7. CourseOffering
    const offeringA = await CourseOffering.create({
      termId: term._id,
      courseId: courseA._id,
      batchId: batchA._id,
      professorIds: [profA._id, profCoTeacher._id],
      theoryHoursPerWeek: 3,
      labBlocksPerWeek: 0,
      labBlockLength: 0,
      isActive: true,
    });

    // 8. Timetable & Slots
    publishedTimetable = await Timetable.create({
      termId: term._id,
      name: 'Published Final Timetable',
      status: 'PUBLISHED',
      revision: 1,
      publishedAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    term.versions = [{ timetableId: publishedTimetable._id, effectiveFrom: term.startDate }];
    await term.save();

    // Slot on Monday (dayOfWeek = 1), Period 2 (10:00 - 11:00), lineage: LIN-CS1301-MON
    slotA = await ScheduleSlot.create({
      timetableId: publishedTimetable._id,
      offeringId: offeringA._id,
      lineageId: 'LIN-CS1301-MON',
      courseId: courseA._id,
      batchId: batchA._id,
      professorIds: [profA._id, profCoTeacher._id],
      classroomId: classroomA._id,
      dayOfWeek: 1,
      slotIndex: 2,
      durationSlots: 1,
      kind: 'THEORY',
      placed: true,
    });

    // Expand weekly slots to bookings across calendar
    await BookingService.expandWeeklyToBookings(term, [slotA], term.startDate);
  });

  describe('3-Way Reschedule Options Finder', () => {
    it('returns available periods where professor, batch, and qualifying room are all free', async () => {
      // 2026-08-11 is a Tuesday (working day, not holiday)
      const res = await request(app)
        .get(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule-options?targetDate=2026-08-11`)
        .set('Authorization', `Bearer ${profAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetDate).toBe('2026-08-11');
      expect(Array.isArray(res.body.data.options)).toBe(true);

      // Period 5 (13:00-14:00) is lunch break (blocked: true), so it must NEVER appear
      const periodIndices = res.body.data.options.map((o: any) => o.period);
      expect(periodIndices).not.toContain(5);

      // Available options should suggest classroomA if available
      const opt = res.body.data.options[0];
      expect(opt.availableRooms.length).toBeGreaterThan(0);
      expect(opt.suggestedRoom).toBeDefined();
    });

    it('excludes periods when the batch or professor is already booked on targetDate', async () => {
      // Simulate that profA has another booking on 2026-08-11 at Period 3
      await Booking.create({
        termId: term._id,
        dateKey: '2026-08-11',
        period: 3,
        resourceKey: `P:${profA._id.toString()}`,
        ownerType: 'WEEKLY',
        ownerId: slotA._id,
      });

      const res = await request(app)
        .get(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule-options?targetDate=2026-08-11`)
        .set('Authorization', `Bearer ${profAToken}`);

      expect(res.status).toBe(200);
      const periodIndices = res.body.data.options.map((o: any) => o.period);
      expect(periodIndices).not.toContain(3);
    });

    it('rejects target date if it is an academic holiday or weekend', async () => {
      // 2026-08-15 is Independence Day (holiday)
      const resHoliday = await request(app)
        .get(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule-options?targetDate=2026-08-15`)
        .set('Authorization', `Bearer ${profAToken}`);

      expect(resHoliday.status).toBe(400);
      expect(resHoliday.body.message).toContain('holiday');

      // 2026-08-16 is a Sunday (not a working day)
      const resSunday = await request(app)
        .get(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule-options?targetDate=2026-08-16`)
        .set('Authorization', `Bearer ${profAToken}`);

      expect(resSunday.status).toBe(400);
      expect(resSunday.body.message).toContain('working day');
    });
  });

  describe('Rescheduling', () => {
    it('successfully reschedules a class, updates bookings and sends notifications', async () => {
      const res = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule`)
        .set('Authorization', `Bearer ${profAToken}`)
        .send({
          targetDate: '2026-08-11',
          period: 3,
          classroomId: classroomA._id.toString(),
          reason: 'Moved to Tuesday morning',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check ScheduleOverride was created
      const override = await ScheduleOverride.findOne({
        lineageId: 'LIN-CS1301-MON',
        originalDateKey: '2026-08-10',
      });
      expect(override).not.toBeNull();
      expect(override?.status).toBe('RESCHEDULED');
      expect(override?.target?.dateKey).toBe('2026-08-11');
      expect(override?.target?.period).toBe(3);

      // Check old bookings on 2026-08-10 were released
      const oldBookings = await Booking.find({
        ownerId: slotA._id,
        dateKey: '2026-08-10',
      });
      expect(oldBookings.length).toBe(0);

      // Check new bookings on 2026-08-11 are claimed
      const newBookings = await Booking.find({
        ownerType: 'OVERRIDE',
        ownerId: override?._id,
        dateKey: '2026-08-11',
      });
      expect(newBookings.length).toBe(4); // Batch, profA, profCoTeacher, classroomA

      // Check student notification was created
      const studentNotif = await Notification.findOne({
        recipientId: studentA._id,
        type: 'CLASS_RESCHEDULED',
      });
      expect(studentNotif).not.toBeNull();
      expect(studentNotif?.body).toContain('rescheduled to 2026-08-11');
    });

    it('rescheduling twice updates the same override in place without self-collision', async () => {
      // 1. First reschedule to 2026-08-11 Period 3
      await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule`)
        .set('Authorization', `Bearer ${profAToken}`)
        .send({
          targetDate: '2026-08-11',
          period: 3,
          classroomId: classroomA._id.toString(),
          reason: 'Move 1',
        });

      // 2. Second reschedule to 2026-08-12 Period 4
      const res2 = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule`)
        .set('Authorization', `Bearer ${profAToken}`)
        .send({
          targetDate: '2026-08-12',
          period: 4,
          classroomId: classroomB._id.toString(),
          reason: 'Move 2',
        });

      expect(res2.status).toBe(200);

      // Overrides count must remain exactly 1
      const count = await ScheduleOverride.countDocuments({
        lineageId: 'LIN-CS1301-MON',
        originalDateKey: '2026-08-10',
      });
      expect(count).toBe(1);

      // The bookings on 2026-08-11 must be released
      const midBookings = await Booking.find({
        dateKey: '2026-08-11',
      });
      expect(midBookings.length).toBe(0);

      // The bookings on 2026-08-12 must be active
      const finalBookings = await Booking.find({
        dateKey: '2026-08-12',
      });
      expect(finalBookings.length).toBe(4);
    });

    it('race condition: two concurrent claims for the same slot result in one 409 conflict', async () => {
      // Launch two concurrent reschedules claiming the same targetDate (2026-08-11), period 3, classroomA
      const promise1 = request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule`)
        .set('Authorization', `Bearer ${profAToken}`)
        .send({
          targetDate: '2026-08-11',
          period: 3,
          classroomId: classroomA._id.toString(),
        });

      const promise2 = request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule`)
        .set('Authorization', `Bearer ${profCoTeacherToken}`)
        .send({
          targetDate: '2026-08-11',
          period: 3,
          classroomId: classroomA._id.toString(),
        });

      const [res1, res2] = await Promise.all([promise1, promise2]);
      const statuses = [res1.status, res2.status].sort();

      // In a transactional unique index, one succeeds (200) and one receives 409 conflict
      expect(statuses).toEqual([200, 409]);
    });
  });

  describe('Revert and Restoration', () => {
    it('successfully reverts a rescheduled class back to normal weekly schedule', async () => {
      // First reschedule
      await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule`)
        .set('Authorization', `Bearer ${profAToken}`)
        .send({
          targetDate: '2026-08-11',
          period: 3,
          classroomId: classroomA._id.toString(),
        });

      // Now revert
      const revertRes = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/revert`)
        .set('Authorization', `Bearer ${profAToken}`);

      expect(revertRes.status).toBe(200);

      const override = await ScheduleOverride.findOne({
        lineageId: 'LIN-CS1301-MON',
        originalDateKey: '2026-08-10',
      });
      expect(override?.status).toBe('REVERTED');

      // Original weekly bookings must be restored on 2026-08-10
      const restoredBookings = await Booking.find({
        dateKey: '2026-08-10',
        period: 2,
      });
      expect(restoredBookings.length).toBe(4);

      // Notification sent for restoration
      const restoreNotif = await Notification.findOne({
        recipientId: studentA._id,
        type: 'CLASS_RESTORED',
      });
      expect(restoreNotif).not.toBeNull();
    });

    it('returns 409 conflict if original slot was taken by another booking in the meantime', async () => {
      // 1. Reschedule slot away from 2026-08-10
      await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule`)
        .set('Authorization', `Bearer ${profAToken}`)
        .send({
          targetDate: '2026-08-11',
          period: 3,
          classroomId: classroomA._id.toString(),
        });

      // 2. Someone else takes classroomA on 2026-08-10 at Period 2
      await Booking.create({
        termId: term._id,
        dateKey: '2026-08-10',
        period: 2,
        resourceKey: `R:${classroomA._id.toString()}`,
        ownerType: 'EXAM',
        ownerId: adminUser._id,
      });

      // 3. Attempt to revert -> should be rejected with 409
      const revertRes = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/revert`)
        .set('Authorization', `Bearer ${profAToken}`);

      expect(revertRes.status).toBe(409);
      expect(revertRes.body.message).toContain('occupied');

      // Override stays RESCHEDULED
      const override = await ScheduleOverride.findOne({
        lineageId: 'LIN-CS1301-MON',
        originalDateKey: '2026-08-10',
      });
      expect(override?.status).toBe('RESCHEDULED');
    });
  });

  describe('Cancellation and Attendance Session Lifecycle', () => {
    it('allows professor to cancel an upcoming scheduled class', async () => {
      const res = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/cancel`)
        .set('Authorization', `Bearer ${profAToken}`)
        .send({ reason: 'Faculty conference' });

      expect(res.status).toBe(200);

      const override = await ScheduleOverride.findOne({
        lineageId: 'LIN-CS1301-MON',
        originalDateKey: '2026-08-10',
      });
      expect(override?.status).toBe('CANCELLED');
      expect(override?.reason).toBe('Faculty conference');

      // Bookings on 2026-08-10 released
      const bookings = await Booking.find({
        dateKey: '2026-08-10',
      });
      expect(bookings.length).toBe(0);
    });

    it('rejects another professor who does not teach the class with 403', async () => {
      const res = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/cancel`)
        .set('Authorization', `Bearer ${profOtherToken}`)
        .send({ reason: 'Unauthorized cancellation' });

      expect(res.status).toBe(403);
    });

    it('prevents professor from cancelling a SUBMITTED or LOCKED session with 403', async () => {
      // Create a SUBMITTED AttendanceSession
      const session = await AttendanceSession.create({
        lineageId: 'LIN-CS1301-MON',
        originalDateKey: '2026-08-10',
        termId: term._id,
        courseId: courseA._id,
        batchId: batchA._id,
        professorIds: [profA._id],
        actualDateKey: '2026-08-10',
        period: 2,
        durationSlots: 1,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      });

      const res = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/cancel`)
        .set('Authorization', `Bearer ${profAToken}`)
        .send({ reason: 'Prof cancellation attempt' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('already been submitted or locked');
    });

    it('allows admin to cancel a SUBMITTED session with required reason and logs audit', async () => {
      // Create a SUBMITTED AttendanceSession with a record
      const session = await AttendanceSession.create({
        lineageId: 'LIN-CS1301-MON',
        originalDateKey: '2026-08-10',
        termId: term._id,
        courseId: courseA._id,
        batchId: batchA._id,
        professorIds: [profA._id],
        actualDateKey: '2026-08-10',
        period: 2,
        durationSlots: 1,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      });

      const record = await AttendanceRecord.create({
        sessionId: session._id,
        studentId: studentA._id,
        status: 'PRESENT',
        markedBy: profA._id,
        counted: true,
      });

      // Admin cancellation requires a reason
      const resNoReason = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: ' ' });

      expect(resNoReason.status).toBe(400);

      // Admin cancellation with reason
      const res = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Administrative cancellation: system drill' });

      expect(res.status).toBe(200);

      // Session becomes CANCELLED with statusBeforeCancel preserved
      const updatedSession = await AttendanceSession.findById(session._id);
      expect(updatedSession?.status).toBe('CANCELLED');
      expect(updatedSession?.statusBeforeCancel).toBe('SUBMITTED');

      // Attendance records are marked counted = false
      const updatedRecord = await AttendanceRecord.findById(record._id);
      expect(updatedRecord?.counted).toBe(false);

      // Audit log entry created
      const auditLog = await AttendanceAuditLog.findOne({
        sessionId: session._id,
        kind: 'CANCEL',
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.reason).toBe('Administrative cancellation: system drill');
      expect(auditLog?.actorRole).toBe('ADMIN');

      // When admin reverts/restores the occurrence:
      const restoreRes = await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/revert`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(restoreRes.status).toBe(200);

      // Session status restored to SUBMITTED and counted back to true
      const restoredSession = await AttendanceSession.findById(session._id);
      expect(restoredSession?.status).toBe('SUBMITTED');

      const restoredRecord = await AttendanceRecord.findById(record._id);
      expect(restoredRecord?.counted).toBe(true);

      const restoreAudit = await AttendanceAuditLog.findOne({
        sessionId: session._id,
        kind: 'RESTORE',
      });
      expect(restoreAudit).not.toBeNull();
    });
  });

  describe('Post-Publish Holiday Management', () => {
    it('holiday preview lists affected classes and confirms absence of conflicts', async () => {
      const res = await request(app)
        .post(`/api/v1/terms/${term._id}/holidays/preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dateKey: '2026-08-17', // Monday
          label: 'Parsi New Year',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.affectedClassesCount).toBe(1);
      expect(res.body.data.canDeclareHoliday).toBe(true);
      expect(res.body.data.blockingIssues.length).toBe(0);
    });

    it('holiday addition is blocked with 409 if a rescheduled class is targeting that date', async () => {
      // Reschedule class to 2026-08-18 (Tuesday)
      await request(app)
        .post(`/api/v1/occurrences/LIN-CS1301-MON/2026-08-10/reschedule`)
        .set('Authorization', `Bearer ${profAToken}`)
        .send({
          targetDate: '2026-08-18',
          period: 3,
          classroomId: classroomA._id.toString(),
        });

      // Admin tries to declare 2026-08-18 as a holiday
      const res = await request(app)
        .post(`/api/v1/terms/${term._id}/holidays`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dateKey: '2026-08-18',
          label: 'Special Holiday',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('rescheduled class(es)');
    });

    it('confirmed post-publish holiday creates source: HOLIDAY overrides, cancels bookings and notifies', async () => {
      const res = await request(app)
        .post(`/api/v1/terms/${term._id}/holidays`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          dateKey: '2026-08-17', // Monday
          label: 'Parsi New Year',
        });

      expect(res.status).toBe(201);

      // ScheduleOverride with source: HOLIDAY created for slotA on 2026-08-17
      const override = await ScheduleOverride.findOne({
        lineageId: 'LIN-CS1301-MON',
        originalDateKey: '2026-08-17',
      });
      expect(override).not.toBeNull();
      expect(override?.status).toBe('CANCELLED');
      expect(override?.source).toBe('HOLIDAY');
      expect(override?.reason).toBe('Parsi New Year');

      // Bookings on 2026-08-17 released
      const bookings = await Booking.find({
        dateKey: '2026-08-17',
      });
      expect(bookings.length).toBe(0);

      // Notification sent
      const notif = await Notification.findOne({
        recipientId: studentA._id,
        type: 'CLASS_CANCELLED',
      });
      expect(notif).not.toBeNull();
      expect(notif?.title).toContain('Parsi New Year');
    });
  });
});
