export interface IPeriodGridItem {
  index: number;
  start: string;
  end: string;
  blocked?: boolean;
  label: string;
}

export interface ITermHoliday {
  dateKey: string;
  label: string;
}

export interface AcademicTerm {
  _id: string;
  name: string;
  academicYear: string;
  semesterType: 'ODD' | 'EVEN';
  startDate: string;
  endDate: string;
  workingDays: number[];
  periods: IPeriodGridItem[];
  holidays: ITermHoliday[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InstitutionSettings {
  _id?: string;
  timezone: string;
  defaultWorkingDays: number[];
  defaultGrid: IPeriodGridItem[];
  attendanceGood: number;
  attendanceWarning: number;
  attendanceLockHours: number;
  minorNoticeDays: number;
  examReminderHours: number;
}

export interface DepartmentRef {
  _id: string;
  code: string;
  name: string;
}

export interface CourseOffering {
  _id: string;
  termId: AcademicTerm | string;
  courseId: {
    _id: string;
    code: string;
    title: string;
    credits: number;
    departmentId?: DepartmentRef | string;
    weeklyTheoryHours?: number;
    weeklyLabHours?: number;
  };
  batchId: {
    _id: string;
    name: string;
    semester: number;
    academicYear?: string;
    departmentId?: DepartmentRef | string;
  };
  professorIds: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
  }>;
  theoryHoursPerWeek: number;
  labBlocksPerWeek: number;
  labBlockLength: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ITimeWindow {
  dayOfWeek: number;
  startSlot: number;
  endSlot: number;
}

export interface SoftConstraint {
  _id: string;
  professorId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    departmentId?: DepartmentRef | string;
  } | string;
  termId: AcademicTerm | string;
  preferredTimeWindows: ITimeWindow[];
  unavailableWindows: ITimeWindow[];
  maxDailyHours: number;
  priorityWeight: number;
}
