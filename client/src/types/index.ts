export * from './auth';

export interface Classroom {
  _id: string;
  name: string;
  building: string;
  capacity: number;
  type: 'THEORY' | 'LABORATORY';
  hasProjector: boolean;
}

export interface Course {
  _id: string;
  code: string;
  title: string;
  credits: number;
  weeklyTheoryHours: number;
  weeklyLabHours: number;
}

export interface Batch {
  _id: string;
  name: string;
  semester: number;
  academicYear: string;
  studentCount: number;
}

export interface ScheduleSlot {
  _id: string;
  timetableId: string;
  dayOfWeek: number; // 1-5
  slotIndex: number; // 1-8
  durationSlots: number;
  courseId: Course;
  professorId: { _id: string; firstName: string; lastName: string; email: string };
  batchId: Batch;
  classroomId: Classroom;
}

export interface AttendanceSummary {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  conducted: number;
  attended: number;
  percentage: number;
  status: 'GOOD' | 'WARNING' | 'CRITICAL';
}
