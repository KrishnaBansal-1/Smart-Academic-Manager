import { SolverInput, SolverSlot, SolverProfessorConstraint } from './types';

export interface CostBreakdown {
  unavailableWindows: number;
  overDailyHours: number;
  outsidePreferred: number;
  idleGaps: number;
  sameDayRepeat: number;
  totalCost: number;
}

export interface CostEvaluation {
  totalCost: number;
  softScore: number;
  breakdown: CostBreakdown;
  warnings: string[];
}

export function evaluateSoftCost(slots: SolverSlot[], input: SolverInput): CostEvaluation {
  let unavailableCost = 0;
  let overDailyHoursCost = 0;
  let outsidePreferredCost = 0;
  let idleGapsCost = 0;
  let sameDayRepeatCost = 0;

  const warnings: string[] = [];

  const constraintMap = new Map<string, SolverProfessorConstraint>(
    input.constraints.map((c) => [c.professorId, c])
  );

  const blockedPeriods = new Set<number>(
    input.periods.filter((p) => p.blocked).map((p) => p.index)
  );

  const placedSlots = slots.filter((s) => s.placed);

  // 1. Professor Unavailable Windows & Outside Preferred Windows
  for (const slot of placedSlots) {
    const day = slot.dayOfWeek;
    const startP = slot.slotIndex;
    const endP = startP + slot.durationSlots - 1;

    for (const profId of slot.professorIds || []) {
      const constraint = constraintMap.get(profId);
      const weight = constraint?.priorityWeight || 3;

      if (constraint?.unavailableWindows && constraint.unavailableWindows.length > 0) {
        let hitUnavailable = 0;
        for (let p = startP; p <= endP; p += 1) {
          const inWindow = constraint.unavailableWindows.some(
            (w) => w.dayOfWeek === day && p >= w.startSlot && p <= w.endSlot
          );
          if (inWindow) hitUnavailable += 1;
        }

        if (hitUnavailable > 0) {
          const penalty = hitUnavailable * 500 * weight;
          unavailableCost += penalty;
          warnings.push(
            `Professor ${profId} scheduled in unavailable window on day ${day}, period(s) [${startP}..${endP}].`
          );
        }
      }

      if (constraint?.preferredWindows && constraint.preferredWindows.length > 0) {
        let outsideCount = 0;
        for (let p = startP; p <= endP; p += 1) {
          const inPreferred = constraint.preferredWindows.some(
            (w) => w.dayOfWeek === day && p >= w.startSlot && p <= w.endSlot
          );
          if (!inPreferred) outsideCount += 1;
        }

        if (outsideCount > 0) {
          outsidePreferredCost += outsideCount * 20 * weight;
        }
      }
    }
  }

  // 2. Over maxDailyHours for Professors
  const profDayHours = new Map<string, number>(); // profId:day -> totalHours
  for (const slot of placedSlots) {
    const day = slot.dayOfWeek;
    for (const profId of slot.professorIds || []) {
      const key = `${profId}:${day}`;
      profDayHours.set(key, (profDayHours.get(key) || 0) + slot.durationSlots);
    }
  }

  for (const [key, hours] of profDayHours.entries()) {
    const [profId, dayStr] = key.split(':');
    const day = Number(dayStr);
    const constraint = constraintMap.get(profId);
    const maxDaily = constraint?.maxDailyHours || 4;
    const weight = constraint?.priorityWeight || 3;

    if (hours > maxDaily) {
      const excess = hours - maxDaily;
      overDailyHoursCost += excess * 100 * weight;
      warnings.push(
        `Professor ${profId} assigned ${hours} hours on day ${day}, exceeding daily limit of ${maxDaily} hours.`
      );
    }
  }

  // 3. Idle Gaps for Batches & Professors (excluding blocked break periods)
  // Batch gaps
  const batchDayPeriods = new Map<string, number[]>(); // batchId:day -> periods
  for (const slot of placedSlots) {
    const key = `${slot.batchId}:${slot.dayOfWeek}`;
    const list = batchDayPeriods.get(key) || [];
    for (let p = slot.slotIndex; p < slot.slotIndex + slot.durationSlots; p += 1) {
      list.push(p);
    }
    batchDayPeriods.set(key, list);
  }

  for (const [, periods] of batchDayPeriods.entries()) {
    if (periods.length <= 1) continue;
    const sorted = Array.from(new Set(periods)).sort((a, b) => a - b);
    const minP = sorted[0];
    const maxP = sorted[sorted.length - 1];

    for (let p = minP + 1; p < maxP; p += 1) {
      if (!blockedPeriods.has(p) && !sorted.includes(p)) {
        idleGapsCost += 30; // Medium penalty
      }
    }
  }

  // Professor gaps
  const profDayPeriods = new Map<string, number[]>(); // profId:day -> periods
  for (const slot of placedSlots) {
    for (const profId of slot.professorIds || []) {
      const key = `${profId}:${slot.dayOfWeek}`;
      const list = profDayPeriods.get(key) || [];
      for (let p = slot.slotIndex; p < slot.slotIndex + slot.durationSlots; p += 1) {
        list.push(p);
      }
      profDayPeriods.set(key, list);
    }
  }

  for (const [, periods] of profDayPeriods.entries()) {
    if (periods.length <= 1) continue;
    const sorted = Array.from(new Set(periods)).sort((a, b) => a - b);
    const minP = sorted[0];
    const maxP = sorted[sorted.length - 1];

    for (let p = minP + 1; p < maxP; p += 1) {
      if (!blockedPeriods.has(p) && !sorted.includes(p)) {
        idleGapsCost += 30; // Medium penalty
      }
    }
  }

  // 4. Same Theory Course Twice in a Day for a Batch
  const batchDayCourseCount = new Map<string, number>(); // batchId:day:courseId -> count
  for (const slot of placedSlots) {
    if (slot.kind === 'THEORY') {
      const key = `${slot.batchId}:${slot.dayOfWeek}:${slot.courseId}`;
      batchDayCourseCount.set(key, (batchDayCourseCount.get(key) || 0) + 1);
    }
  }

  for (const [key, count] of batchDayCourseCount.entries()) {
    if (count > 1) {
      const excess = count - 1;
      sameDayRepeatCost += excess * 40; // Medium penalty
      const [, dayStr, courseId] = key.split(':');
      warnings.push(`Course ${courseId} scheduled ${count} times on day ${dayStr}.`);
    }
  }

  const totalCost =
    unavailableCost +
    overDailyHoursCost +
    outsidePreferredCost +
    idleGapsCost +
    sameDayRepeatCost;

  // Baseline maxCost for normalized softScore calculation
  const totalHours = placedSlots.reduce((acc, s) => acc + s.durationSlots, 0);
  const maxCost = Math.max(1000, totalHours * 120);

  const softScore = Math.max(0, Math.min(100, Math.round(100 * (1 - totalCost / maxCost))));

  return {
    totalCost,
    softScore,
    breakdown: {
      unavailableWindows: unavailableCost,
      overDailyHours: overDailyHoursCost,
      outsidePreferred: outsidePreferredCost,
      idleGaps: idleGapsCost,
      sameDayRepeat: sameDayRepeatCost,
      totalCost,
    },
    warnings,
  };
}
