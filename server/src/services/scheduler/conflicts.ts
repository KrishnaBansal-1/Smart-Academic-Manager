import { SolverSlot, SolverRoom, SolverBatch, SolverPeriod } from './types';

export type HardViolationType =
  | 'PROFESSOR_CLASH'
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
  }
): HardViolation[] {
  const violations: HardViolation[] = [];
  const { workingDays, periods, rooms, batches } = context;

  const duration = candidate.durationSlots || 1;
  const day = candidate.dayOfWeek;
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
    const sEnd = s.slotIndex + s.durationSlots - 1;

    // Check period range overlap
    const hasOverlap = Math.max(startPeriod, sStart) <= Math.min(endPeriod, sEnd);
    if (!hasOverlap) continue;

    // Batch clash
    if (s.batchId === candidate.batchId) {
      violations.push({
        type: 'BATCH_CLASH',
        message: `Batch clash on day ${day} between [${startPeriod}..${endPeriod}] and [${sStart}..${sEnd}].`,
        details: { batchId: candidate.batchId, day, startPeriod, endPeriod },
      });
    }

    // Room clash
    if (candidate.classroomId && s.classroomId && s.classroomId === candidate.classroomId) {
      violations.push({
        type: 'ROOM_CLASH',
        message: `Classroom clash for room "${candidate.classroomId}" on day ${day} between [${startPeriod}..${endPeriod}] and [${sStart}..${sEnd}].`,
        details: { classroomId: candidate.classroomId, day, startPeriod, endPeriod },
      });
    }

    // Professor clash
    for (const profId of candidate.professorIds || []) {
      if (s.professorIds && s.professorIds.includes(profId)) {
        violations.push({
          type: 'PROFESSOR_CLASH',
          message: `Professor clash for professor "${profId}" on day ${day} between [${startPeriod}..${endPeriod}] and [${sStart}..${sEnd}].`,
          details: { professorId: profId, day, startPeriod, endPeriod },
        });
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
  }
): boolean {
  return checkPlacement(state, candidate, context).length === 0;
}
