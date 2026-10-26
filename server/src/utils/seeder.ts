import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ENV } from '../config/env';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Classroom } from '../models/Classroom';
import { Course } from '../models/Course';
import { Batch } from '../models/Batch';

export const seedDatabase = async () => {
  try {
    console.log('🌱 Connecting to database for seeding...');
    await mongoose.connect(ENV.MONGO_URI);

    console.log('🧹 Cleaning existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Department.deleteMany({}),
      Classroom.deleteMany({}),
      Course.deleteMany({}),
      Batch.deleteMany({}),
    ]);

    const defaultPasswordHash = await bcrypt.hash('Password@123', 12);
    const adminPasswordHash = await bcrypt.hash('Admin@123', 12);

    // 1. Department
    console.log('🏛️ Seeding Departments...');
    const cseDept = await Department.create({
      name: 'Computer Science and Engineering',
      code: 'CSE',
      building: 'Turing Block',
    });

    // 2. Classrooms
    console.log('🏫 Seeding Classrooms...');
    const classrooms = await Classroom.create([
      { name: 'LH-101', building: 'Turing Block', capacity: 60, type: 'THEORY', hasProjector: true },
      { name: 'LH-102', building: 'Turing Block', capacity: 60, type: 'THEORY', hasProjector: true },
      { name: 'Lab-A', building: 'Turing Block', capacity: 35, type: 'LABORATORY', hasProjector: true },
      { name: 'Lab-B', building: 'Turing Block', capacity: 35, type: 'LABORATORY', hasProjector: true },
    ]);

    // 3. Courses
    console.log('📚 Seeding Courses...');
    const courses = await Course.create([
      { code: 'CS301', title: 'Data Structures & Algorithms', departmentId: cseDept._id, credits: 4, weeklyTheoryHours: 3, weeklyLabHours: 2 },
      { code: 'CS302', title: 'Operating Systems', departmentId: cseDept._id, credits: 4, weeklyTheoryHours: 3, weeklyLabHours: 2 },
      { code: 'CS303', title: 'Database Management Systems', departmentId: cseDept._id, credits: 4, weeklyTheoryHours: 3, weeklyLabHours: 2 },
      { code: 'CS304', title: 'Computer Networks', departmentId: cseDept._id, credits: 3, weeklyTheoryHours: 3, weeklyLabHours: 0 },
    ]);

    // 4. Admin User
    console.log('👑 Seeding Admin User...');
    const admin = await User.create({
      email: 'admin@sam.edu',
      passwordHash: adminPasswordHash,
      firstName: 'Institutional',
      lastName: 'Admin',
      role: 'ADMIN',
      departmentId: cseDept._id,
    });

    // 5. Professors
    console.log('👨‍🏫 Seeding Professors...');
    const profSharma = await User.create({
      email: 'prof.sharma@sam.edu',
      passwordHash: defaultPasswordHash,
      firstName: 'Anil',
      lastName: 'Sharma',
      role: 'PROFESSOR',
      departmentId: cseDept._id,
    });

    const profPatel = await User.create({
      email: 'prof.patel@sam.edu',
      passwordHash: defaultPasswordHash,
      firstName: 'Priya',
      lastName: 'Patel',
      role: 'PROFESSOR',
      departmentId: cseDept._id,
    });

    // 6. Batches
    console.log('👥 Seeding Batches...');
    const batchA = await Batch.create({
      name: 'CSE-2026-SecA',
      departmentId: cseDept._id,
      semester: 3,
      academicYear: '2026-2027',
      studentCount: 30,
      students: [],
    });

    // 7. Students
    console.log('🎓 Seeding Students...');
    const student1 = await User.create({
      email: 'student.aarav@sam.edu',
      passwordHash: defaultPasswordHash,
      firstName: 'Aarav',
      lastName: 'Gupta',
      role: 'STUDENT',
      departmentId: cseDept._id,
      batchId: batchA._id,
      rollNumber: 'CSE26001',
    });

    const student2 = await User.create({
      email: 'student.diya@sam.edu',
      passwordHash: defaultPasswordHash,
      firstName: 'Diya',
      lastName: 'Verma',
      role: 'STUDENT',
      departmentId: cseDept._id,
      batchId: batchA._id,
      rollNumber: 'CSE26002',
    });

    const student3 = await User.create({
      email: 'student.rohan@sam.edu',
      passwordHash: defaultPasswordHash,
      firstName: 'Rohan',
      lastName: 'Iyer',
      role: 'STUDENT',
      departmentId: cseDept._id,
      batchId: batchA._id,
      rollNumber: 'CSE26003',
    });

    // Update batch with student IDs
    batchA.students = [student1._id, student2._id, student3._id];
    batchA.studentCount = 3;
    await batchA.save();

    console.log('\n=============================================');
    console.log('🎉 Seeding Complete! Demo Accounts Created:');
    console.log('---------------------------------------------');
    console.log('ADMIN:     admin@sam.edu          | Admin@123');
    console.log('PROFESSOR: prof.sharma@sam.edu    | Password@123');
    console.log('PROFESSOR: prof.patel@sam.edu     | Password@123');
    console.log('STUDENT:   student.aarav@sam.edu  | Password@123');
    console.log('=============================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDatabase();
}
