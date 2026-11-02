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
  { code: 'CS1303', title: 'Full Stack Development', department: 'CSE', credits: 4, weeklyTheoryHours: 3, weeklyLabHours: 2, faculty: ['sudarshan'] },
  { code: 'CS1305', title: 'Computer Networks', department: 'CSE', credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['venkanna'] },
  { code: 'CS1307', title: 'Distributed Computing', department: 'CSE', credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['sriram'] },
  { code: 'CS1323', title: 'Advanced Computer Architecture', department: 'CSE', credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['raviChandra'] },
  { code: 'CS1331', title: 'Software Testing', department: 'CSE', credits: 2, weeklyTheoryHours: 3, weeklyLabHours: 0, faculty: ['sangharatna'] },
  { code: 'CS1381', title: 'Fractal Course - I', department: 'CSE', credits: 1, weeklyTheoryHours: 0, weeklyLabHours: 1, faculty: [] },
  { code: 'CS1309', title: 'Computer Networks Laboratory', department: 'CSE', credits: 2, weeklyTheoryHours: 0, weeklyLabHours: 2, faculty: ['venkanna', 'balaprakasa'] },
  { code: 'CS1311', title: 'Knowledge Engineering Laboratory', department: 'CSE', credits: 2, weeklyTheoryHours: 0, weeklyLabHours: 2, faculty: ['rimjhim', 'ramalingaswamy', 'kadambari'] },
  { code: 'CS1303-LAB', title: 'Full Stack Development Laboratory', department: 'CSE', credits: 2, weeklyTheoryHours: 0, weeklyLabHours: 2, faculty: ['sudarshan', 'ilaiah'] },
  { code: 'CS2301', title: 'Software Engineering', department: 'AIDS', credits: 4, weeklyTheoryHours: 3, weeklyLabHours: 2, faculty: ['sangharatna'] },
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
  { name: 'CSE-III-A-2026', department: 'CSE' as const, rollPrefix: '24CSB0A' },
  { name: 'CSE-III-B-2026', department: 'CSE' as const, rollPrefix: '24CSB0B' },
  { name: 'AIDS-III-A-2026', department: 'AIDS' as const, rollPrefix: '24CSB1A' },
];

export const seedDatabase = async () => {
  if (ENV.NODE_ENV === 'production') {
    console.error('❌ Refusing to run seeder in production environment.');
    process.exit(1);
  }

  try {
    console.log('🌱 Connecting to database for seeding...');
    await mongoose.connect(ENV.MONGO_URI);

    console.log('🧹 Replacing the previous demo dataset...');
    await Promise.all([
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

    const [cseDepartment, aidsDepartment] = await Department.create([
      { name: 'Computer Science and Engineering', code: 'CSE', building: 'C Block' },
      { name: 'Artificial Intelligence and Data Science', code: 'AIDS', building: 'A Block' },
    ]);
    const departmentIds = { CSE: cseDepartment._id, AIDS: aidsDepartment._id };

    await Classroom.create([
      { name: 'C302', building: 'C Block', capacity: 90, type: 'THEORY', hasProjector: true },
      { name: 'A306', building: 'A Block', capacity: 80, type: 'THEORY', hasProjector: true },
      { name: 'Software Engineering Lab', building: 'Software Engineering Block', capacity: 45, type: 'LABORATORY', hasProjector: true },
      { name: 'Computing Lab', building: 'Computing Block', capacity: 45, type: 'LABORATORY', hasProjector: true },
      { name: 'Security Lab', building: 'Security Block', capacity: 45, type: 'LABORATORY', hasProjector: true },
    ]);

    const admin = await User.create({
      email: 'admin@sam.edu',
      passwordHash: adminPasswordHash,
      firstName: 'Institutional',
      lastName: 'Admin',
      role: 'ADMIN',
      departmentId: cseDepartment._id,
    });

    const professorUsers = await User.create(faculty.map((professor) => ({
      email: professor.email,
      passwordHash: defaultPasswordHash,
      firstName: professor.firstName,
      lastName: professor.lastName,
      role: 'PROFESSOR' as const,
      departmentId: departmentIds[professor.department],
    })));
    const professorIds = new Map(faculty.map((professor, index) => [professor.key, professorUsers[index]._id]));

    await Course.create(courses.map((course) => ({
      code: course.code,
      title: course.title,
      departmentId: departmentIds[course.department],
      credits: course.credits,
      weeklyTheoryHours: course.weeklyTheoryHours,
      weeklyLabHours: course.weeklyLabHours,
      professorIds: course.faculty.map((key) => professorIds.get(key)).filter((id): id is Types.ObjectId => Boolean(id)),
    })));

    const batchRecords = await Batch.create(sections.map((section) => ({
      name: section.name,
      departmentId: departmentIds[section.department],
      semester: 1,
      academicYear: '2026-2027',
    })));

    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
      const section = sections[sectionIndex];
      const batch = batchRecords[sectionIndex];
      await User.create(Array.from({ length: 5 }, (_, offset) => {
        const rollIndex = offset + 1;
        const sectionCode = section.name.includes('CSE-III-A') ? 'csea' : section.name.includes('CSE-III-B') ? 'cseb' : 'aidsa';
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
      }));
    }

    console.log('\n=============================================');
    console.log('🎉 NIT Warangal timetable dataset seeded');
    console.log('---------------------------------------------');
    console.log(`ADMIN:     ${admin.email} | ${ADMIN_PASSWORD}`);
    console.log(`PROFESSOR: ${faculty[0].email} | ${DEFAULT_PASSWORD}`);
    console.log('STUDENT:   student.csea01@sam.edu | Password@123');
    console.log('Sections:  CSE III-A, CSE III-B, AI&DS III-A (5 students each)');
    console.log(`Faculty:   ${faculty.length} | Courses: ${courses.length} | Rooms/Labs: 5`);
    console.log('All seeded professor and student accounts use Password@123.');
    console.log('=============================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDatabase();
}
