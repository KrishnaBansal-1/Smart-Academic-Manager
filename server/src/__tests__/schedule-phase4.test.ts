import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { AcademicTerm, IAcademicTerm } from '../models/AcademicTerm';
import { Timetable, ITimetable } from '../models/Timetable';
import { ScheduleSlot, IScheduleSlot } from '../models/ScheduleSlot';
import { ScheduleOverride } from '../models/ScheduleOverride';
import { MinorExam } from '../models/MinorExam';
import { Classroom, IClassroom } from '../models/Classroom';
import { Batch, IBatch } from '../models/Batch';
import { Course, ICourse } from '../models/Course';
import { CourseOffering } from '../models/CourseOffering';
import { Department } from '../models/Department';
import { User, IUser } from '../models/User';
import { InstitutionSettings } from '../models/InstitutionSettings';
import { Types } from 'mongoose';
import { ENV } from '../config/env';
import { formatInTimeZone } from 'date-fns-tz';

const app = createApp();

describe('Phase 4: Calendar & Read-Only Schedule Views', () => {
  let adminToken: string;
  let profToken: string;
  let profOtherDeptToken: string;
  let studentToken: string;

  let adminUser: IUser;
  let profA: IUser;
  let profB: IUser; // Same department as profA
  let profOtherDept: IUser; // Different department
  let studentA: IUser;
  let studentB: IUser; // Different section

  let term: IAcademicTerm;
  let publishedTimetable: ITimetable;
  let batchA: IBatch;
  let batchB: IBatch;
  let courseA: ICourse;
  let courseB: ICourse;
  let classroomA: IClassroom;
  let classroomB: IClassroom;
  let slotA: IScheduleSlot;
  let slotB: IScheduleSlot;

  beforeEach(async () => {
    // 1. Departments
    const deptCSE = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      building: 'C Block',
    });

    const deptECE = await Department.create({
      name: 'Electronics and Communication Engineering',
      code: 'ECE',
      building: 'E Block',
    });

    // 2. Batches
    batchA = await Batch.create({
      name: 'CSE III-A',
      departmentId: deptCSE._id,
      semester: 5,
      academicYear: '2026-2027',
    });

    batchB = await Batch.create({
      name: 'CSE III-B',
      departmentId: deptCSE._id,
      semester: 5,
      academicYear: '2026-2027',
    });

    // 3. Courses
    courseA = await Course.create({
      code: 'CS1301',
      title: 'Formal Languages and Automata Theory',
      departmentId: deptCSE._id,
      credits: 3,
      weeklyTheoryHours: 3,
      weeklyLabHours: 0,
    });

    courseB = await Course.create({
      code: 'CS1302',
      title: 'Database Management Systems',
      departmentId: deptCSE._id,
      credits: 4,
      weeklyTheoryHours: 4,
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
      email: 'admin.sched@sam.edu',
      passwordHash: 'hash',
      role: 'ADMIN',
      tokenVersion: 0,
      isActive: true,
    });

    profA = await User.create({
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan.turing@sam.edu',
      passwordHash: 'hash',
      role: 'PROFESSOR',
      departmentId: deptCSE._id,
      tokenVersion: 0,
      isActive: true,
    });

    profB = await User.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada.lovelace@sam.edu',
      passwordHash: 'hash',
      role: 'PROFESSOR',
      departmentId: deptCSE._id,
      tokenVersion: 0,
      isActive: true,
    });

    profOtherDept = await User.create({
      firstName: 'Claude',
      lastName: 'Shannon',
      email: 'claude.shannon@sam.edu',
      passwordHash: 'hash',
      role: 'PROFESSOR',
      departmentId: deptECE._id,
      tokenVersion: 0,
      isActive: true,
    });

    studentA = await User.create({
      firstName: 'Alice',
      lastName: 'Student',
      email: 'alice.student@sam.edu',
      passwordHash: 'hash',
      role: 'STUDENT',
      departmentId: deptCSE._id,
      batchId: batchA._id,
      rollNumber: 'CS24B001',
      tokenVersion: 0,
      isActive: true,
    });

    studentB = await User.create({
      firstName: 'Bob',
      lastName: 'Student',
      email: 'bob.student@sam.edu',
      passwordHash: 'hash',
      role: 'STUDENT',
      departmentId: deptCSE._id,
      batchId: batchB._id,
      rollNumber: 'CS24B002',
      tokenVersion: 0,
      isActive: true,
    });

    // Tokens
    const signUserToken = (user: IUser) =>
      jwt.sign(
        { id: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion || 0 },
        ENV.JWT_SECRET,
        { expiresIn: '1h' }
      );

    adminToken = signUserToken(adminUser);
    profToken = signUserToken(profA);
    profOtherDeptToken = signUserToken(profOtherDept);
    studentToken = signUserToken(studentA);

    // 6. Academic Term
    term = await AcademicTerm.create({
      name: 'Odd Semester 2026-27',
      academicYear: '2026-2027',
      semesterType: 'ODD',
      startDate: '2026-08-03',
      endDate: '2026-12-11',
      workingDays: [1, 2, 3, 4, 5], // Mon to Fri
      periods: [
        { index: 1, start: '09:00', end: '10:00', label: 'Period 1' },
        { index: 2, start: '10:00', end: '11:00', label: 'Period 2' },
        { index: 3, start: '11:00', end: '12:00', label: 'Period 3' },
        { index: 4, start: '12:00', end: '13:00', label: 'Period 4' },
        { index: 5, start: '13:00', end: '14:00', label: 'Lunch', blocked: true },
        { index: 6, start: '14:00', end: '15:00', label: 'Period 5' },
      ],
      holidays: [
        { dateKey: '2026-08-14', label: 'Independence Day Eve Holiday' },
      ],
      isActive: true,
      versions: [],
    });

    // 7. Offerings
    const offeringA = await CourseOffering.create({
      termId: term._id,
      courseId: courseA._id,
      batchId: batchA._id,
      professorIds: [profA._id],
      theoryHoursPerWeek: 3,
      labBlocksPerWeek: 0,
      labBlockLength: 2,
      isActive: true,
    });

    const offeringB = await CourseOffering.create({
      termId: term._id,
      courseId: courseB._id,
      batchId: batchA._id,
      professorIds: [profB._id],
      theoryHoursPerWeek: 3,
      labBlocksPerWeek: 0,
      labBlockLength: 2,
      isActive: true,
    });

    // 8. Timetable (Published)
    publishedTimetable = await Timetable.create({
      title: 'Official Timetable v1',
      termId: term._id,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      revision: 1,
      createdBy: adminUser._id,
    });

    // Link version to term
    term.versions = [
      {
        timetableId: publishedTimetable._id,
        effectiveFrom: '2026-08-03',
      },
    ];
    await term.save();

    // 9. Weekly Schedule Slots
    // Slot A: Monday (day 1), Period 1, Prof A, Course A, Batch A, Room C301
    slotA = await ScheduleSlot.create({
      timetableId: publishedTimetable._id,
      offeringId: offeringA._id,
      courseId: courseA._id,
      batchId: batchA._id,
      professorIds: [profA._id],
      classroomId: classroomA._id,
      dayOfWeek: 1,
      slotIndex: 1,
      durationSlots: 1,
      kind: 'THEORY',
      placed: true,
    });

    // Slot B: Monday (day 1), Period 2, Prof B, Course B, Batch A, Room C302
    slotB = await ScheduleSlot.create({
      timetableId: publishedTimetable._id,
      offeringId: offeringB._id,
      courseId: courseB._id,
      batchId: batchA._id,
      professorIds: [profB._id],
      classroomId: classroomB._id,
      dayOfWeek: 1,
      slotIndex: 2,
      durationSlots: 1,
      kind: 'THEORY',
      placed: true,
    });
  });

  describe('1. Resolver Pipeline Order & Overrides', () => {
    it('resolves weekly slots as NORMAL when no overrides exist', async () => {
      const res = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.published).toBe(true);

      const entries = res.body.data.entries;
      expect(entries.length).toBe(2);

      const p1 = entries.find((e: any) => e.period === 1);
      expect(p1).toBeDefined();
      expect(p1.state).toBe('NORMAL');
      expect(p1.course.code).toBe('CS1301');
      expect(p1.startTime).toBe('09:00');
      expect(p1.endTime).toBe('10:00');
      expect(p1.professors[0].name).toBe('Alan Turing');
      expect(p1.occurrenceId).toBe(`${slotA.lineageId}:2026-08-10`);
    });

    it('processes CANCELLED override: marks class CANCELLED with reason', async () => {
      // Create override for Slot A on 2026-08-10 (Monday)
      await ScheduleOverride.create({
        lineageId: slotA.lineageId,
        originalDateKey: '2026-08-10',
        originalSlotId: slotA._id,
        status: 'CANCELLED',
        source: 'MANUAL',
        reason: 'Professor attending academic conference',
        requestedBy: profA._id,
      });

      const res = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const entries = res.body.data.entries;
      const cancelledEntry = entries.find((e: any) => e.lineageId === slotA.lineageId);

      expect(cancelledEntry).toBeDefined();
      expect(cancelledEntry.state).toBe('CANCELLED');
      expect(cancelledEntry.reason).toBe('Professor attending academic conference');
      expect(cancelledEntry.occurrenceId).toBe(`${slotA.lineageId}:2026-08-10`);
    });

    it('processes RESCHEDULED override: emits MOVED_OUT on origin date and MOVED_IN on target date', async () => {
      // Reschedule Slot B from Monday (2026-08-10 P2) to Wednesday (2026-08-12 P3)
      await ScheduleOverride.create({
        lineageId: slotB.lineageId,
        originalDateKey: '2026-08-10',
        originalSlotId: slotB._id,
        status: 'RESCHEDULED',
        source: 'MANUAL',
        reason: 'Special lab session arrangement',
        target: {
          dateKey: '2026-08-12',
          period: 3,
          classroomId: classroomA._id,
        },
        requestedBy: profB._id,
      });

      const res = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const entries = res.body.data.entries;

      // On Monday (2026-08-10), slot B must be MOVED_OUT
      const movedOut = entries.find(
        (e: any) => e.dateKey === '2026-08-10' && e.lineageId === slotB.lineageId
      );
      expect(movedOut).toBeDefined();
      expect(movedOut.state).toBe('MOVED_OUT');
      expect(movedOut.reason).toContain('Special lab session arrangement');

      // On Wednesday (2026-08-12), slot B must be MOVED_IN at Period 3
      const movedIn = entries.find(
        (e: any) => e.dateKey === '2026-08-12' && e.lineageId === slotB.lineageId
      );
      expect(movedIn).toBeDefined();
      expect(movedIn.state).toBe('MOVED_IN');
      expect(movedIn.period).toBe(3);
      expect(movedIn.startTime).toBe('11:00');
      expect(movedIn.endTime).toBe('12:00');
      expect(movedIn.originalDateKey).toBe('2026-08-10');
      expect(movedIn.classroom.name).toBe('C301');
    });

    it('processes scheduled MinorExam as EXAM on the calendar', async () => {
      // Schedule an exam for Batch A on Wednesday 2026-08-12 at Period 1
      const exam = await MinorExam.create({
        termId: term._id,
        courseId: courseA._id,
        batchId: batchA._id,
        professorId: profA._id,
        classroomId: classroomB._id,
        title: 'Minor Exam 1 - Automata',
        syllabus: 'Modules 1 and 2',
        dateKey: '2026-08-12',
        startPeriod: 1,
        durationSlots: 1,
        displacedOverrideIds: [],
        status: 'SCHEDULED',
        createdBy: profA._id,
      });

      const res = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const entries = res.body.data.entries;
      const examEntry = entries.find((e: any) => e.state === 'EXAM');

      expect(examEntry).toBeDefined();
      expect(examEntry.dateKey).toBe('2026-08-12');
      expect(examEntry.period).toBe(1);
      expect(examEntry.reason).toBe('Minor Exam 1 - Automata');
      expect(examEntry.exam.title).toBe('Minor Exam 1 - Automata');
      expect(examEntry.exam.syllabus).toBe('Modules 1 and 2');
    });

    it('handles REVERTED override by displaying class normally', async () => {
      await ScheduleOverride.create({
        lineageId: slotA.lineageId,
        originalDateKey: '2026-08-10',
        originalSlotId: slotA._id,
        status: 'REVERTED',
        source: 'MANUAL',
        reason: 'Restored to original schedule',
        requestedBy: profA._id,
      });

      const res = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const slotAEntry = res.body.data.entries.find((e: any) => e.lineageId === slotA.lineageId);
      expect(slotAEntry.state).toBe('NORMAL');
    });
  });

  describe('2. Holidays Handling', () => {
    it('suppresses regular weekly slots on holidays ("minus holidays")', async () => {
      // 2026-08-14 is a Friday, and is configured as holiday in term.holidays
      // Add a slot on Friday (day 5)
      await ScheduleSlot.create({
        timetableId: publishedTimetable._id,
        courseId: courseA._id,
        batchId: batchA._id,
        professorIds: [profA._id],
        classroomId: classroomA._id,
        dayOfWeek: 5,
        slotIndex: 1,
        placed: true,
      });

      const res = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const fridayEntries = res.body.data.entries.filter((e: any) => e.dateKey === '2026-08-14');
      // No regular slot on holiday
      expect(fridayEntries.length).toBe(0);

      // Holiday is listed in the response holidays array
      expect(res.body.data.holidays.some((h: any) => h.dateKey === '2026-08-14')).toBe(true);
    });

    it('emits CANCELLED entry if an explicit HOLIDAY override exists on a holiday', async () => {
      const fridaySlot = await ScheduleSlot.create({
        timetableId: publishedTimetable._id,
        courseId: courseA._id,
        batchId: batchA._id,
        professorIds: [profA._id],
        classroomId: classroomA._id,
        dayOfWeek: 5,
        slotIndex: 1,
        placed: true,
      });

      await ScheduleOverride.create({
        lineageId: fridaySlot.lineageId,
        originalDateKey: '2026-08-14',
        originalSlotId: fridaySlot._id,
        status: 'CANCELLED',
        source: 'HOLIDAY',
        reason: 'Independence Day Eve Holiday',
        requestedBy: adminUser._id,
      });

      const res = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const fridayEntry = res.body.data.entries.find((e: any) => e.dateKey === '2026-08-14');
      expect(fridayEntry).toBeDefined();
      expect(fridayEntry.state).toBe('CANCELLED');
      expect(fridayEntry.reason).toContain('Independence Day');
    });
  });

  describe('3. Role-Based Access Control (RBAC)', () => {
    it('forces student to own batch and forbids querying another batch (403)', async () => {
      // Student A belongs to Batch A
      const allowedRes = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(allowedRes.status).toBe(200);
      expect(allowedRes.body.data.entries.every((e: any) => e.batch._id === batchA._id.toString())).toBe(true);

      // Student attempting to query Batch B
      const forbiddenRes = await request(app)
        .get(`/api/v1/schedule/week?weekOf=2026-08-10&batchId=${batchB._id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.message).toContain('Students can only view their own section schedule');
    });

    it('allows professor to view own schedule by default', async () => {
      const res = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
      // Professor A teaches Slot A (course A), but NOT slot B (course B)
      const entries = res.body.data.entries;
      expect(entries.length).toBe(1);
      expect(entries[0].course.code).toBe('CS1301');
    });

    it('allows professor to view colleague in the same department', async () => {
      // Prof A querying Prof B (both in CSE)
      const res = await request(app)
        .get(`/api/v1/schedule/week?weekOf=2026-08-10&professorId=${profB._id}`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(200);
      const entries = res.body.data.entries;
      expect(entries.length).toBe(1);
      expect(entries[0].course.code).toBe('CS1302');
    });

    it('forbids professor from viewing faculty in a different department (403)', async () => {
      // Prof A (CSE) querying Prof Other Dept (ECE)
      const res = await request(app)
        .get(`/api/v1/schedule/week?weekOf=2026-08-10&professorId=${profOtherDept._id}`)
        .set('Authorization', `Bearer ${profToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('department');
    });

    it('allows admin to query any batch, professor, or room', async () => {
      const batchRes = await request(app)
        .get(`/api/v1/schedule/week?weekOf=2026-08-10&batchId=${batchA._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(batchRes.status).toBe(200);

      const roomRes = await request(app)
        .get(`/api/v1/schedule/week?weekOf=2026-08-10&roomId=${classroomA._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(roomRes.status).toBe(200);
      expect(roomRes.body.data.entries.every((e: any) => e.classroom._id === classroomA._id.toString())).toBe(true);
    });
  });

  describe('4. Timezone & IST Midnight Boundary Transition', () => {
    it('correctly shifts dateKey across 23:59 IST and 00:01 IST boundaries', () => {
      // UTC 18:29:00 on 2026-08-10 corresponds to 23:59:00 IST on 2026-08-10
      const utcBeforeMidnight = new Date('2026-08-10T18:29:00.000Z');
      const istBeforeMidnight = formatInTimeZone(utcBeforeMidnight, 'Asia/Kolkata', 'yyyy-MM-dd');
      expect(istBeforeMidnight).toBe('2026-08-10');

      // UTC 18:31:00 on 2026-08-10 corresponds to 00:01:00 IST on 2026-08-11
      const utcAfterMidnight = new Date('2026-08-10T18:31:00.000Z');
      const istAfterMidnight = formatInTimeZone(utcAfterMidnight, 'Asia/Kolkata', 'yyyy-MM-dd');
      expect(istAfterMidnight).toBe('2026-08-11');
    });

    it('GET /api/v1/schedule/today retrieves schedule for today in institution timezone', async () => {
      const res = await request(app)
        .get('/api/v1/schedule/today')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.published).toBe(true);
      expect(res.body.data.range.from).toBe(res.body.data.range.to);
    });
  });

  describe('5. Term Boundaries & Unpublished States', () => {
    it('returns empty entries for dates before startDate or after endDate', async () => {
      // Term startDate is 2026-08-03, endDate is 2026-12-11
      const preTermRes = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-07-06')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(preTermRes.status).toBe(200);
      expect(preTermRes.body.data.published).toBe(true);
      expect(preTermRes.body.data.entries.length).toBe(0);

      const postTermRes = await request(app)
        .get('/api/v1/schedule/week?weekOf=2027-01-11')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(postTermRes.status).toBe(200);
      expect(postTermRes.body.data.published).toBe(true);
      expect(postTermRes.body.data.entries.length).toBe(0);
    });

    it('returns explicit published: false when no timetable has been published', async () => {
      // Clear term versions and published timetables
      term.versions = [];
      await term.save();
      await Timetable.deleteMany({});

      const res = await request(app)
        .get('/api/v1/schedule/week?weekOf=2026-08-10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(false);
      expect(res.body.data.message).toContain('No published timetable');
      expect(res.body.data.entries).toEqual([]);
    });
  });
});
