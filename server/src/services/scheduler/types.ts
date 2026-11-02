/**
 * Pure JSON types for the SAM Timetable Scheduler.
 * Decoupled from Mongoose / database models to allow execution inside worker threads.
 */

export interface SolverPeriod {
  index: number;
  start: string;
  end: string;
  blocked: boolean;
  label?: string;
}

export interface SolverTimeWindow {
  dayOfWeek: number; // 1 (Mon) - 7 (Sun)
  startSlot: number; // 1-based period index
  endSlot: number;   // 1-based period index
}

export interface SolverProfessorConstraint {
  professorId: string;
  preferredWindows: SolverTimeWindow[];
  unavailableWindows: SolverTimeWindow[];
  maxDailyHours: number;
  priorityWeight: number; // 1 (low) - 5 (high)
}

export interface SolverRoom {
  id: string;
  name: string;
  capacity: number;
  type: 'THEORY' | 'LABORATORY';
}

export interface SolverBatch {
  id: string;
  name: string;
  studentCount: number;
}

export interface SolverOffering {
  id: string;
  courseId: string;
  courseCode: string;
  courseName?: string;
  batchId: string;
  professorIds: string[];
  theoryHoursPerWeek: number;
  labBlocksPerWeek: number;
  labBlockLength: number;
}

export interface SolverSlot {
  id?: string;
  lineageId: string;
  offeringId: string;
  courseId: string;
  batchId: string;
  professorIds: string[];
  classroomId?: string | null;
  dayOfWeek: number;
  slotIndex: number;
  durationSlots: number;
  kind: 'THEORY' | 'LAB';
  pinned: boolean;
  placed: boolean;
  unplacedReason?: string;
  occupancyKeys?: string[];
}

export interface SolverConfig {
  maxSeconds?: number;
  seed?: number;
  targetScore?: number;
}

export interface SolverInput {
  termId: string;
  workingDays: number[];
  periods: SolverPeriod[];
  rooms: SolverRoom[];
  batches: SolverBatch[];
  offerings: SolverOffering[];
  constraints: SolverProfessorConstraint[];
  pinnedSlots?: SolverSlot[];
  config?: SolverConfig;
}

export interface SolverUnplaced {
  offeringId: string;
  kind: 'THEORY' | 'LAB';
  reason: string;
}

export interface SolverMetrics {
  placed: number;
  unplaced: number;
  softScore: number;
  costBreakdown: {
    unavailableWindows: number;
    overDailyHours: number;
    outsidePreferred: number;
    idleGaps: number;
    sameDayRepeat: number;
    totalCost: number;
  };
  durationMs: number;
}

export interface SolverOutput {
  slots: SolverSlot[];
  unplaced: SolverUnplaced[];
  metrics: SolverMetrics;
  error?: string;
}

export interface PreflightItemError {
  code: string;
  message: string;
  fix: string;
  offeringId?: string;
  batchId?: string;
  professorId?: string;
}

export interface PreflightItemWarning {
  code: string;
  message: string;
  fix?: string;
}

export interface PreflightResult {
  valid: boolean;
  errors: PreflightItemError[];
  warnings: PreflightItemWarning[];
}
