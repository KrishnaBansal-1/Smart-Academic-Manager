/**
 * Unified occupancy key builder for SAM.
 * Shared between the model layer (ScheduleSlot multikey index) and the scheduler.
 * 
 * Key format:
 * - P:<professorId>:<dayOfWeek>:<period>
 * - B:<batchId>:<dayOfWeek>:<period>
 * - R:<classroomId>:<dayOfWeek>:<period>
 */

export interface OccupancySlotLike {
  professorIds?: Array<string | { toString(): string }>;
  professorId?: string | { toString(): string };
  batchId: string | { toString(): string };
  classroomId?: string | { toString(): string } | null;
  dayOfWeek: number;
  slotIndex: number;
  durationSlots?: number;
}

export function buildOccupancyKeys(slot: OccupancySlotLike, _grid?: unknown): string[] {
  const keys: string[] = [];
  const duration = slot.durationSlots ?? 1;
  const day = slot.dayOfWeek;
  const startPeriod = slot.slotIndex;

  // Extract all professor IDs
  const profs: string[] = [];
  if (Array.isArray(slot.professorIds)) {
    for (const p of slot.professorIds) {
      if (p) profs.push(p.toString());
    }
  }
  if (slot.professorId && !profs.includes(slot.professorId.toString())) {
    profs.push(slot.professorId.toString());
  }

  const batch = slot.batchId ? slot.batchId.toString() : '';
  const room = slot.classroomId ? slot.classroomId.toString() : null;

  for (let p = startPeriod; p < startPeriod + duration; p += 1) {
    if (batch) {
      keys.push(`B:${batch}:${day}:${p}`);
    }
    for (const profId of profs) {
      keys.push(`P:${profId}:${day}:${p}`);
    }
    if (room) {
      keys.push(`R:${room}:${day}:${p}`);
    }
  }

  return keys;
}
