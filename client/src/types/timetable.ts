import { AcademicTerm } from './academics';

export type TimetableStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type SlotKind = 'THEORY' | 'LAB';
export type DropState = 'GREEN' | 'YELLOW' | 'RED';

export interface ClassroomRef {
  _id: string;
  name: string;
  building?: string;
  capacity: number;
  type: string;
}

export interface UserRef {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  departmentId?: string;
}

export interface BatchRef {
  _id: string;
  name: string;
  semester: number;
  section?: string;
  departmentId?: string;
}

export interface CourseRef {
  _id: string;
  code: string;
  title: string;
  weeklyTheoryHours?: number;
  weeklyLabHours?: number;
}

export interface ScheduleSlot {
  _id: string;
  timetableId: string;
  lineageId: string;
  offeringId?: string;
  courseId: CourseRef;
  batchId: BatchRef;
  professorIds: UserRef[];
  classroomId?: ClassroomRef | null;
  dayOfWeek: number;
  slotIndex: number;
  durationSlots: number;
  kind: SlotKind;
  pinned: boolean;
  placed: boolean;
  unplacedReason?: string;
  occupancyKeys?: string[];
}

export interface Timetable {
  _id: string;
  title: string;
  termId: AcademicTerm | string;
  status: TimetableStatus;
  revision: number;
  basedOnTimetableId?: string;
  generationJobId?: string;
  softScore?: number;
  publishedAt?: string;
  createdBy?: UserRef | string;
  totalSlots?: number;
  placedSlots?: number;
  unplacedSlots?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DropMapCell {
  day: number;
  period: number;
  state: DropState;
  suggestedRoomId?: string;
  suggestedRoomName?: string;
  reasons: string[];
  warnings: string[];
  swapValid?: boolean;
  occupantSlotId?: string;
}

export type DropMap = Record<string, DropMapCell>;

export interface PreflightResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalOfferings: number;
    totalBatches: number;
    totalProfessors: number;
    totalClassrooms: number;
    totalPeriodsPerWeek: number;
  };
}

export interface GenerationJob {
  _id: string;
  termId: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  progress: number;
  timetableId?: string | { _id: string };
  error?: string;
  metrics?: {
    placed: number;
    unplaced: number;
    softScore: number;
    durationMs: number;
  };
  unplaced?: Array<{
    offeringId?: string;
    kind: string;
    reason: string;
  }>;
}

export interface TimetableValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
  softScore?: number;
  unplacedCount: number;
}
