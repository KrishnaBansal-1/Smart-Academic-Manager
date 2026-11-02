import {
  SolverSlot,
  SolverRoom,
  SolverBatch,
  SolverPeriod,
  SolverProfessor,
  SolverCourse,
  SolverProfessorConstraint,
} from './types';

export type HardViolationType =
  | 'PROFESSOR_CLASH'
  | 'PROFESSOR_UNAVAILABLE'
  | 'BATCH_CLASH'
  | 'ROOM_CLASH'
  | 'CAPACITY'
  | 'ROOM_TYPE'
  | 'BLOCKED_PERIOD'
  | 'BLOCK_STRADDLES_BREAK'
  | 'DAY_OVERFLOW';

export interface HardViolation {
  type: HardViolationType;
  message: string;
  details?: Record<string, unknown>;
}

export interface SolverPlacementState {
  slots: SolverSlot[];
}

const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

/**
 * Checks a candidate slot placement against current state and solver context.
 * Returns an array of hard violations using range overlap across each period.
 */
export function checkPlacement(
  state: { slots: SolverSlot[] },
  candidate: SolverSlot,
  context: {
    workingDays: number[];
    periods: SolverPeriod[];
    rooms: SolverRoom[];
    batches: SolverBatch[];
    constraints?: SolverProfessorConstraint[];
    professors?: SolverProfessor[];
    courses?: SolverCourse[];
  }
): HardViolation[] {
  const violations: HardViolation[] = [];
  const { workingDays, periods, rooms, batches, constraints, professors } = context;

  const duration = candidate.durationSlots || 1;
  const day = candidate.dayOfWeek;
  const dayName = DAY_NAMES[day] || `Day ${day}`;
  const startPeriod = candidate.slotIndex;
  const endPeriod = startPeriod + duration - 1;

  // 1. DAY_OVERFLOW
  const maxPeriod = periods.length > 0 ? Math.max(...periods.map((p) => p.index)) : 8;
  const minPeriod = periods.length > 0 ? Math.min(...periods.map((p) => p.index)) : 1;

  if (!workingDays.includes(day)) {
    violations.push({
      type: 'DAY_OVERFLOW',
      message: `Day ${day} is not a valid working day for this term.`,
      details: { day, workingDays },
    });
  }

  if (startPeriod < minPeriod || endPeriod > maxPeriod) {
    violations.push({
      type: 'DAY_OVERFLOW',
      message: `Period range [${startPeriod}..${endPeriod}] overflows grid boundaries [${minPeriod}..${maxPeriod}].`,
      details: { startPeriod, endPeriod, minPeriod, maxPeriod },
    });
  }

  // 2. BLOCKED_PERIOD & BLOCK_STRADDLES_BREAK
  const periodMap = new Map<number, SolverPeriod>(periods.map((p) => [p.index, p]));
  let hasBlocked = false;

  for (let p = startPeriod; p <= endPeriod; p += 1) {
    const gridItem = periodMap.get(p);
    if (gridItem && gridItem.blocked) {
      hasBlocked = true;
      violations.push({
        type: 'BLOCKED_PERIOD',
        message: `Period ${p} (${gridItem.label || 'Break'}) is blocked.`,
        details: { period: p, label: gridItem.label },
      });
    }
  }

  if (hasBlocked && duration > 1) {
    violations.push({
      type: 'BLOCK_STRADDLES_BREAK',
      message: `Multi-period block of length ${duration} spans across a blocked period/break.`,
      details: { startPeriod, endPeriod },
    });
  }

  // 3. CAPACITY & ROOM_TYPE
  if (candidate.classroomId) {
    const room = rooms.find((r) => r.id === candidate.classroomId);
    const batch = batches.find((b) => b.id === candidate.batchId);

    if (room && batch) {
      if (room.capacity < batch.studentCount) {
        violations.push({
          type: 'CAPACITY',
          message: `Classroom "${room.name}" capacity (${room.capacity}) is smaller than batch "${batch.name}" size (${batch.studentCount}).`,
          details: { roomCapacity: room.capacity, batchSize: batch.studentCount },
        });
      }

      if (candidate.kind === 'LAB' && room.type !== 'LABORATORY') {
        violations.push({
          type: 'ROOM_TYPE',
          message: `Lab class requires a LABORATORY room, but "${room.name}" is a ${room.type} room.`,
          details: { required: 'LABORATORY', actual: room.type },
        });
      }

      if (candidate.kind === 'THEORY' && room.type === 'LABORATORY') {
        violations.push({
          type: 'ROOM_TYPE',
          message: `Theory class cannot be placed in LABORATORY room "${room.name}".`,
          details: { required: 'THEORY', actual: room.type },
        });
      }
    }
  }

  // 4. RESOURCE CONFLICTS: Direct range overlap across each period
  for (const s of state.slots) {
    if (!s.placed || s.lineageId === candidate.lineageId) continue;
    if (s.dayOfWeek !== day) continue;

    const sStart = s.slotIndex;
    const sDuration = s.durationSlots || 1;
    const sEnd = s.slotIndex + sDuration - 1;

    // Check period range overlap
    const hasOverlap = Math.max(startPeriod, sStart) <= Math.min(endPeriod, sEnd);
    if (!hasOverlap) continue;

    // Batch clash
    if (s.batchId === candidate.batchId) {
      const b = batches.find((item) => item.id === candidate.batchId);
      const batchName = b ? b.name : candidate.batchId;
      violations.push({
        type: 'BATCH_CLASH',
        message: `Batch clash for ${batchName} on ${dayName} between [${startPeriod}..${endPeriod}] and [${sStart}..${sEnd}].`,
        details: { batchId: candidate.batchId, day, startPeriod, endPeriod },
      });
    }

    // Room clash
    if (candidate.classroomId && s.classroomId && s.classroomId === candidate.classroomId) {
      const room = rooms.find((r) => r.id === candidate.classroomId);
      const roomName = room ? room.name : candidate.classroomId;
      violations.push({
        type: 'ROOM_CLASH',
        message: `Classroom clash for room "${roomName}" on ${dayName} between [${startPeriod}..${endPeriod}] and [${sStart}..${sEnd}].`,
        details: { classroomId: candidate.classroomId, day, startPeriod, endPeriod },
      });
    }

    // Professor clash
    for (const profId of candidate.professorIds || []) {
      if (s.professorIds && s.professorIds.includes(profId)) {
        const prof = professors?.find((p) => p.id === profId);
        const profName = prof ? prof.name : profId;
        violations.push({
          type: 'PROFESSOR_CLASH',
          message: `Professor clash for ${profName} on ${dayName} between [${startPeriod}..${endPeriod}] and [${sStart}..${sEnd}].`,
          details: { professorId: profId, day, startPeriod, endPeriod },
        });
      }
    }
  }

  // 5. PROFESSOR UNAVAILABLE WINDOWS: Check every period of the slot [startPeriod..endPeriod]
  if (constraints && constraints.length > 0) {
    for (const profId of candidate.professorIds || []) {
      const constraint = constraints.find((c) => c.professorId === profId);
      if (constraint?.unavailableWindows && constraint.unavailableWindows.length > 0) {
        for (let p = startPeriod; p <= endPeriod; p += 1) {
          const isUnavailable = constraint.unavailableWindows.some(
            (w) => w.dayOfWeek === day && p >= w.startSlot && p <= w.endSlot
          );
          if (isUnavailable) {
            const prof = professors?.find((item) => item.id === profId);
            const profName = prof ? prof.name : profId;
            violations.push({
              type: 'PROFESSOR_UNAVAILABLE',
              message: `Professor ${profName} is unavailable on ${dayName} during period ${p}.`,
              details: { professorId: profId, day, period: p },
            });
            break;
          }
        }
      }
    }
  }

  return violations;
}

export function isPlacementFeasible(
  state: { slots: SolverSlot[] },
  candidate: SolverSlot,
  context: {
    workingDays: number[];
    periods: SolverPeriod[];
    rooms: SolverRoom[];
    batches: SolverBatch[];
    constraints?: SolverProfessorConstraint[];
    professors?: SolverProfessor[];
    courses?: SolverCourse[];
  }
): boolean {
  return checkPlacement(state, candidate, context).length === 0;
}
