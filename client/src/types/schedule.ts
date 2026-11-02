import { IPeriodGridItem } from './index';

export type ScheduleEntryState = 'NORMAL' | 'CANCELLED' | 'MOVED_OUT' | 'MOVED_IN' | 'EXAM';

export interface ScheduleEntry {
  occurrenceId: string;
  lineageId: string;
  originalDateKey: string;
  dateKey: string;
  period: number;
  durationSlots: number;
  startTime: string;
  endTime: string;
  state: ScheduleEntryState;
  reason?: string;
  slotId?: string;
  offeringId?: string;
  course: {
    _id: string;
    code: string;
    title: string;
    name: string;
    credits?: number;
  };
  batch: {
    _id: string;
    name: string;
    section?: string;
  };
  professors: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
  }>;
  classroom: {
    _id: string;
    name: string;
    building?: string;
    roomNumber?: string;
  } | null;
  kind: 'THEORY' | 'LAB';
  exam?: {
    _id: string;
    title: string;
    syllabus?: string;
  };
}

export interface ScheduleResponse {
  published: boolean;
  message?: string;
  term: {
    id: string;
    name: string;
    academicYear: string;
    semesterType: string;
    startDate: string;
    endDate: string;
    workingDays: number[];
    periods: IPeriodGridItem[];
    holidays: Array<{ dateKey: string; label: string }>;
  } | null;
  range: {
    from: string;
    to: string;
  };
  weekOf?: string;
  entries: ScheduleEntry[];
  holidays: Array<{ dateKey: string; label: string }>;
}
