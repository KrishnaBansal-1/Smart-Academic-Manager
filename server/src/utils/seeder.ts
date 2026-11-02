import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Classroom } from '../models/Classroom';
import { Course } from '../models/Course';
import { Batch } from '../models/Batch';
import { ScheduleSlot } from '../models/ScheduleSlot';
import { ScheduleOverride } from '../models/ScheduleOverride';
import { Timetable } from '../models/Timetable';
import { AttendanceSession } from '../models/AttendanceSession';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { SoftConstraint } from '../models/SoftConstraint';
import { AcademicTerm } from '../models/AcademicTerm';
import { CourseOffering } from '../models/CourseOffering';
import { InstitutionSettings, DEFAULT_PERIOD_GRID } from '../models/InstitutionSettings';

const DEFAULT_PASSWORD = 'Password@123';
const ADMIN_PASSWORD = 'Admin@123';

type DepartmentCode = 'CSE' | 'AIDS';
type FacultySeed = { key: string; email: string; firstName: string; lastName: string; department: DepartmentCode };

const faculty: FacultySeed[] = [
  { key: 'rimjhim', email: 'prof.rimjhim@sam.edu', firstName: 'Prof.', lastName: 'Rimjhim', department: 'CSE' },
  { key: 'sudarshan', email: 'prof.sudarshan@sam.edu', firstName: 'Prof. Sudarshan Chakravarthy', lastName: 'A', department: 'CSE' },
  { key: 'venkanna', email: 'prof.venkanna@sam.edu', firstName: 'Prof. Venkanna', lastName: 'U.', department: 'CSE' },
  { key: 'sriram', email: 'prof.sriram@sam.edu', firstName: 'Prof. Sriram', lastName: 'Kailasam', department: 'CSE' },
  { key: 'raviChandra', email: 'prof.ravi.chandra@sam.edu', firstName: 'Prof. S. Ravi', lastName: 'Chandra', department: 'CSE' },
  { key: 'sangharatna', email: 'prof.sangharatna@sam.edu', firstName: 'Prof. Sangharatna', lastName: 'Godboley', department: 'CSE' },
  { key: 'balaprakasa', email: 'prof.balaprakasa@sam.edu', firstName: 'Prof. Balaprakasa Rao', lastName: 'Killi', department: 'CSE' },
  { key: 'ramalingaswamy', email: 'prof.ramalingaswamy@sam.edu', firstName: 'Prof. Ramalingaswamy', lastName: 'Cheruku', department: 'CSE' },
  { key: 'ilaiah', email: 'prof.ilaiah@sam.edu', firstName: 'Prof. Ilaiah', lastName: 'Kavati', department: 'CSE' },
  { key: 'shivaDarshan', email: 'prof.shiva.darshan@sam.edu', firstName: 'Prof. Shiva Darshan', lastName: 'SL', department: 'CSE' },
  { key: 'chanchal', email: 'prof.chanchal@sam.edu', firstName: 'Prof. Chanchal', lastName: 'Suman', department: 'AIDS' },
  { key: 'anusha', email: 'prof.anusha@sam.edu', firstName: 'Prof. Anusha', lastName: 'Vangala', department: 'AIDS' },
  { key: 'geet', email: 'prof.geet@sam.edu', firstName: 'Prof. Geet', lastName: 'Sahu', department: 'AIDS' },
  { key: 'rbv', email: 'prof.rbv.subramanyam@sam.edu', firstName: 'Prof. R. B. V.', lastName: 'Subramanyam', department: 'AIDS' },
  { key: 'suresh', email: 'prof.esuresh@sam.edu', firstName: 'Prof. E.', lastName: 'Suresh Babu', department: 'AIDS' },
  { key: 'raju', email: 'prof.raju@sam.edu', firstName: 'Prof. Raju', lastName: 'Bhukya', department: 'AIDS' },
  { key: 'kadambari', email: 'prof.kadambari@sam.edu', firstName: 'Prof. K. V.', lastName: 'Kadambari', department: 'CSE' },
  { key: 'sRavichandra', email: 'prof.s.ravichandra@sam.edu', firstName: 'Prof. S.', lastName: 'Ravichandra', department: 'AIDS' },
  { key: 'priyanka', email: 'prof.priyanka@sam.edu', firstName: 'Prof. Priyanka', lastName: 'Chawla', department: 'AIDS' },
  { key: 'sarath', email: 'prof.sarath@sam.edu', firstName: 'Prof. Sarath', lastName: 'Babu', department: 'CSE' },
  { key: 'rashmi', email: 'prof.rashmi@sam.edu', firstName: 'Prof. Rashmi Ranjan', lastName: 'Rout', department: 'CSE' },
];

type CourseSeed = {
  code: string;
  title: string;
  department: DepartmentCode;
  credits: number;
  weeklyTheoryHours: number;
  weeklyLabHours: number;
  faculty: string[];
};

const courses: CourseSeed[] = [
  { code: 'CS1301', title: 'Data Warehousing and Data Mining', department: 'CSE', credits: 4, weeklyTheoryHours: 4, weeklyLabHours: 0, faculty: ['rimjhim', 'ramalingaswamy'] },
  // Fixed double-counted lab hours: CS1303 gets weeklyLabHours: 0 because CS1303-LAB exists
  { code: 'CS1303', title: 'Full Stack Development', department: 'CSE', credits: 4, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['sudarshan'] },
  { code: 'CS1305', title: 'Computer Networks', department: 'CSE', credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['venkanna'] },
  { code: 'CS1307', title: 'Distributed Computing', department: 'CSE', credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['sriram'] },
  { code: 'CS1323', title: 'Advanced Computer Architecture', department: 'CSE', credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['raviChandra'] },
  { code: 'CS1331', title: 'Software Testing', department: 'CSE', credits: 2, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['sangharatna'] },
  { code: 'CS1381', title: 'Fractal Course - I', department: 'CSE', credits: 1, weeklyTheoryHours: 0, weeklyLabHours: 1, faculty: [] },
  { code: 'CS1309', title: 'Computer Networks Laboratory', department: 'CSE', credits: 2, weeklyTheoryHours: 0, weeklyLabHours: 2, faculty: ['venkanna', 'balaprakasa'] },
  { code: 'CS1311', title: 'Knowledge Engineering Laboratory', department: 'CSE', credits: 2, weeklyTheoryHours: 0, weeklyLabHours: 2, faculty: ['rimjhim', 'ramalingaswamy', 'kadambari'] },
  { code: 'CS1303-LAB', title: 'Full Stack Development Laboratory', department: 'CSE', credits: 2, weeklyTheoryHours: 0, weeklyLabHours: 2, faculty: ['sudarshan', 'ilaiah'] },
  // Fixed double-counted lab hours: CS2301 gets weeklyLabHours: 0 because CS2301-LAB exists
  { code: 'CS2301', title: 'Software Engineering', department: 'AIDS', credits: 4, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['sangharatna'] },
  { code: 'CS2303', title: 'Data Science Fundamentals', department: 'AIDS', credits: 4, weeklyTheoryHours: 4, weeklyLabHours: 0, faculty: ['chanchal'] },
  { code: 'CS2305', title: 'Computer Networks', department: 'AIDS', credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['anusha'] },
  { code: 'CS2307', title: 'Data Visualization Techniques and Design', department: 'AIDS', credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['geet'] },
  { code: 'CS2323', title: 'Data Mining Algorithms', department: 'AIDS', credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['rbv'] },
  { code: 'CS2381', title: 'Fractal Course - I', department: 'AIDS', credits: 1, weeklyTheoryHours: 0, weeklyLabHours: 1, faculty: [] },
  { code: 'CS2309', title: 'Computer Networks Laboratory', department: 'AIDS', credits: 2, weeklyTheoryHours: 0, weeklyLabHours: 2, faculty: ['anusha', 'suresh'] },
  { code: 'CS2311', title: 'Data Science Laboratory', department: 'AIDS', credits: 2, weeklyTheoryHours: 0, weeklyLabHours: 2, faculty: ['chanchal', 'raju'] },
  { code: 'CS2301-LAB', title: 'Software Engineering Laboratory', department: 'AIDS', credits: 2, weeklyTheoryHours: 0, weeklyLabHours: 2, faculty: ['sangharatna', 'sRavichandra'] },
];

const sections = [
  { name: 'CSE-III-A-2026', department: 'CSE' as const, rollPrefix: '24CSB0A', semester: 5 },
  { name: 'CSE-III-B-2026', department: 'CSE' as const, rollPrefix: '24CSB0B', semester: 5 },
  { name: 'AIDS-III-A-2026', department: 'AIDS' as const, rollPrefix: '24CSB1A', semester: 5 },
];

export const seedDatabase = async () => {
  if (ENV.NODE_ENV === 'production') {
    console.error('❌ Refusing to run seeder in production environment.');
    process.exit(1);
  }

  try {
    if (mongoose.connection.readyState === 0) {
      console.log('🌱 Connecting to database for seeding...');
      await mongoose.connect(ENV.MONGO_URI);
    }

    console.log('🧹 Clearing previous dataset and models...');
    await Promise.all([
      CourseOffering.deleteMany({}),
      AcademicTerm.deleteMany({}),
      InstitutionSettings.deleteMany({}),
      AttendanceRecord.deleteMany({}),
      AttendanceSession.deleteMany({}),
      ScheduleOverride.deleteMany({}),
      ScheduleSlot.deleteMany({}),
      Timetable.deleteMany({}),
      SoftConstraint.deleteMany({}),
      User.deleteMany({}),
      Department.deleteMany({}),
      Classroom.deleteMany({}),
      Course.deleteMany({}),
      Batch.deleteMany({}),
    ]);

    const [defaultPasswordHash, adminPasswordHash] = await Promise.all([
      bcrypt.hash(DEFAULT_PASSWORD, 12),
      bcrypt.hash(ADMIN_PASSWORD, 12),
    ]);

    // 1. Institution Settings
    await InstitutionSettings.create({
      timezone: 'Asia/Kolkata',
      defaultWorkingDays: [1, 2, 3, 4, 5],
      defaultGrid: DEFAULT_PERIOD_GRID,
      attendanceGood: 80,
      attendanceWarning: 70,
      attendanceLockHours: 24,
      minorNoticeDays: 3,
      examReminderHours: 24,
    });

    // 2. Academic Term (Active: Odd Semester 2026-27, 3 Aug – 11 Dec 2026)
    const activeTerm = await AcademicTerm.create({
      name: 'Odd Semester 2026-27',
      academicYear: '2026-27',
      semesterType: 'ODD',
      startDate: '2026-08-03',
      endDate: '2026-12-11',
      workingDays: [1, 2, 3, 4, 5],
      periods: DEFAULT_PERIOD_GRID,
      holidays: [
        { dateKey: '2026-08-15', label: 'Independence Day' },
        { dateKey: '2026-10-02', label: 'Mahatma Gandhi Jayanti' },
        { dateKey: '2026-11-08', label: 'Diwali' },
        { dateKey: '2026-11-24', label: 'Guru Nanak Jayanti' },
      ],
      isActive: true,
      versions: [],
    });

    // 3. Departments
    const [cseDepartment, aidsDepartment] = await Department.create([
      { name: 'Computer Science and Engineering', code: 'CSE', building: 'C Block' },
      { name: 'Artificial Intelligence and Data Science', code: 'AIDS', building: 'A Block' },
    ]);
    const departmentIds = { CSE: cseDepartment._id, AIDS: aidsDepartment._id };

    // 4. Classrooms
    await Classroom.create([
      { name: 'C302', building: 'C Block', capacity: 90, type: 'THEORY', hasProjector: true },
      { name: 'A306', building: 'A Block', capacity: 80, type: 'THEORY', hasProjector: true },
      { name: 'Software Engineering Lab', building: 'Software Engineering Block', capacity: 45, type: 'LABORATORY', hasProjector: true },
      { name: 'Computing Lab', building: 'Computing Block', capacity: 45, type: 'LABORATORY', hasProjector: true },
      { name: 'Security Lab', building: 'Security Block', capacity: 45, type: 'LABORATORY', hasProjector: true },
    ]);

    // 5. Admin
    const admin = await User.create({
      email: 'admin@sam.edu',
      passwordHash: adminPasswordHash,
      firstName: 'Institutional',
      lastName: 'Admin',
      role: 'ADMIN',
      departmentId: cseDepartment._id,
    });

    // 6. Professors
    const professorUsers = await User.create(
      faculty.map((prof) => ({
        email: prof.email,
        passwordHash: defaultPasswordHash,
        firstName: prof.firstName,
        lastName: prof.lastName,
        role: 'PROFESSOR' as const,
        departmentId: departmentIds[prof.department],
      }))
    );
    const professorIds = new Map(faculty.map((prof, index) => [prof.key, professorUsers[index]._id]));

    // 7. Courses
    const courseRecords = await Course.create(
      courses.map((course) => ({
        code: course.code,
        title: course.title,
        departmentId: departmentIds[course.department],
        credits: course.credits,
        weeklyTheoryHours: course.weeklyTheoryHours,
        weeklyLabHours: course.weeklyLabHours,
        professorIds: course.faculty.map((key) => professorIds.get(key)).filter((id): id is Types.ObjectId => Boolean(id)),
      }))
    );
    const courseMap = new Map(courses.map((c, i) => [c.code, courseRecords[i]]));

    // 8. Batches (Sections) — semester: 5 for III-year sections
    const batchRecords = await Batch.create(
      sections.map((section) => ({
        name: section.name,
        departmentId: departmentIds[section.department],
        semester: section.semester,
        academicYear: '2026-2027',
      }))
    );
    const batchMap = new Map(sections.map((s, i) => [s.name, batchRecords[i]]));

    // 9. Students: Grow each section to 30 students (first 5 accounts unchanged)
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
      const section = sections[sectionIndex];
      const batch = batchRecords[sectionIndex];
      await User.create(
        Array.from({ length: 30 }, (_, offset) => {
          const rollIndex = offset + 1;
          const sectionCode = section.name.includes('CSE-III-A')
            ? 'csea'
            : section.name.includes('CSE-III-B')
            ? 'cseb'
            : 'aidsa';
          return {
            email: `student.${sectionCode}${String(rollIndex).padStart(2, '0')}@sam.edu`,
            passwordHash: defaultPasswordHash,
            firstName: `${section.department}-${section.name.includes('-A-') ? 'A' : 'B'}`,
            lastName: `Student ${String(rollIndex).padStart(2, '0')}`,
            role: 'STUDENT' as const,
            departmentId: departmentIds[section.department],
            batchId: batch._id,
            rollNumber: `${section.rollPrefix}${String(rollIndex).padStart(2, '0')}`,
          };
        })
      );
    }

    // 10. Course Offerings:
    // Theory course with 2 faculty: separate sections
    // Lab course: co-teach
    // Fractal course (CS1381, CS2381): 0 faculty, inactive
    const offeringsToCreate: Array<Record<string, unknown>> = [];

    // CSE Sections (CSE-III-A-2026, CSE-III-B-2026)
    const cseBatches = [batchMap.get('CSE-III-A-2026')!, batchMap.get('CSE-III-B-2026')!];
    const cseCourses = courses.filter((c) => c.department === 'CSE');

    for (const c of cseCourses) {
      const courseRecord = courseMap.get(c.code)!;
      for (let bIdx = 0; bIdx < cseBatches.length; bIdx += 1) {
        const batch = cseBatches[bIdx];
        let assignedFaculty: Types.ObjectId[] = [];

        if (c.code === 'CS1381') {
          // Fractal course: no faculty
          assignedFaculty = [];
        } else if (c.weeklyLabHours > 0 || c.code.endsWith('-LAB')) {
          // Lab course: co-teaching
          assignedFaculty = c.faculty.map((fKey) => professorIds.get(fKey)!).filter(Boolean);
        } else {
          // Theory course:
          if (c.faculty.length > 1) {
            // 2 faculty: section A gets first, section B gets second
            const chosenKey = c.faculty[bIdx] || c.faculty[0];
            assignedFaculty = [professorIds.get(chosenKey)!];
          } else {
            assignedFaculty = c.faculty.map((fKey) => professorIds.get(fKey)!).filter(Boolean);
          }
        }

        const isFractal = c.code === 'CS1381';
        const labBlocks = (c.weeklyLabHours > 0 || c.code.endsWith('-LAB')) ? 1 : 0;
        const labLength = labBlocks > 0 ? (c.weeklyLabHours || 2) : 2;

        offeringsToCreate.push({
          termId: activeTerm._id,
          courseId: courseRecord._id,
          batchId: batch._id,
          professorIds: assignedFaculty,
          theoryHoursPerWeek: c.weeklyTheoryHours,
          labBlocksPerWeek: labBlocks,
          labBlockLength: labLength,
          isActive: !isFractal && assignedFaculty.length > 0,
        });
      }
    }

    // AIDS Section (AIDS-III-A-2026)
    const aidsBatch = batchMap.get('AIDS-III-A-2026')!;
    const aidsCourses = courses.filter((c) => c.department === 'AIDS');

    for (const c of aidsCourses) {
      const courseRecord = courseMap.get(c.code)!;
      let assignedFaculty: Types.ObjectId[] = [];

      if (c.code === 'CS2381') {
        // Fractal course: no faculty
        assignedFaculty = [];
      } else {
        assignedFaculty = c.faculty.map((fKey) => professorIds.get(fKey)!).filter(Boolean);
      }

      const isFractal = c.code === 'CS2381';
      const labBlocks = (c.weeklyLabHours > 0 || c.code.endsWith('-LAB')) ? 1 : 0;
      const labLength = labBlocks > 0 ? (c.weeklyLabHours || 2) : 2;

      offeringsToCreate.push({
        termId: activeTerm._id,
        courseId: courseRecord._id,
        batchId: aidsBatch._id,
        professorIds: assignedFaculty,
        theoryHoursPerWeek: c.weeklyTheoryHours,
        labBlocksPerWeek: labBlocks,
        labBlockLength: labLength,
        isActive: !isFractal && assignedFaculty.length > 0,
      });
    }

    await CourseOffering.create(offeringsToCreate);

    // 11. Sample Soft Constraints for Faculty
    const rimjhimId = professorIds.get('rimjhim');
    const sangharatnaId = professorIds.get('sangharatna');
    const venkannaId = professorIds.get('venkanna');

    if (rimjhimId) {
      await SoftConstraint.create({
        professorId: rimjhimId,
        termId: activeTerm._id,
        preferredTimeWindows: [
          { dayOfWeek: 1, startSlot: 1, endSlot: 3 }, // Mon morning
          { dayOfWeek: 3, startSlot: 1, endSlot: 3 }, // Wed morning
        ],
        unavailableWindows: [
          { dayOfWeek: 5, startSlot: 6, endSlot: 8 }, // Fri afternoon
        ],
        maxDailyHours: 4,
        priorityWeight: 4,
      });
    }

    if (sangharatnaId) {
      await SoftConstraint.create({
        professorId: sangharatnaId,
        termId: activeTerm._id,
        preferredTimeWindows: [
          { dayOfWeek: 2, startSlot: 2, endSlot: 4 }, // Tue morning
          { dayOfWeek: 4, startSlot: 2, endSlot: 4 }, // Thu morning
        ],
        unavailableWindows: [
          { dayOfWeek: 3, startSlot: 1, endSlot: 2 }, // Wed early morning
        ],
        maxDailyHours: 4,
        priorityWeight: 5,
      });
    }

    if (venkannaId) {
      await SoftConstraint.create({
        professorId: venkannaId,
        termId: activeTerm._id,
        preferredTimeWindows: [
          { dayOfWeek: 1, startSlot: 1, endSlot: 4 }, // Mon morning
          { dayOfWeek: 4, startSlot: 1, endSlot: 4 }, // Thu morning
        ],
        unavailableWindows: [
          { dayOfWeek: 5, startSlot: 7, endSlot: 8 }, // Fri late
        ],
        maxDailyHours: 4,
        priorityWeight: 3,
      });
    }

    console.log('\n=============================================');
    console.log('🎉 NIT Warangal academic dataset seeded successfully');
    console.log('---------------------------------------------');
    console.log(`TERM:      ${activeTerm.name} (${activeTerm.startDate} to ${activeTerm.endDate})`);
    console.log(`ADMIN:     ${admin.email} | ${ADMIN_PASSWORD}`);
    console.log(`PROFESSOR: ${faculty[0].email} | ${DEFAULT_PASSWORD}`);
    console.log('STUDENT:   student.csea01@sam.edu | Password@123');
    console.log('Sections:  CSE III-A, CSE III-B, AI&DS III-A (30 students each)');
    console.log(`Faculty:   ${faculty.length} | Courses: ${courses.length} | Offerings: ${offeringsToCreate.length}`);
    console.log(`Fractal:   CS1381 and CS2381 created inactive with 0 faculty`);
    console.log('=============================================\n');

    if (require.main === module) {
      await mongoose.disconnect();
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    if (require.main === module) {
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  seedDatabase();
}
