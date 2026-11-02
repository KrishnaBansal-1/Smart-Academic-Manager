import { SolverInput, PreflightResult, PreflightItemError, PreflightItemWarning } from './types';

export function runPreflight(input: SolverInput): PreflightResult {
  const errors: PreflightItemError[] = [];
  const warnings: PreflightItemWarning[] = [];

  const { workingDays, periods, rooms, batches, offerings, constraints } = input;

  // 1. Offering with no faculty
  for (const offering of offerings) {
    if (!offering.professorIds || offering.professorIds.length === 0) {
      const batch = batches.find((b) => b.id === offering.batchId);
      const batchName = batch ? batch.name : offering.batchId;
      errors.push({
        code: 'NO_FACULTY',
        message: `Offering "${offering.courseCode || offering.id}" for section "${batchName}" has no faculty assigned.`,
        fix: 'Assign at least one active professor to this offering in Academic Setup.',
        offeringId: offering.id,
        batchId: offering.batchId,
      });
    }
  }

  // Calculate unblocked periods and contiguous runs
  const unblockedPeriods = periods.filter((p) => !p.blocked);
  const usablePeriodsPerDay = unblockedPeriods.length;
  const totalUsablePeriods = workingDays.length * usablePeriodsPerDay;

  // Find max contiguous unblocked run of periods in a day
  let maxContiguousRun = 0;
  let currentRun = 0;
  // Sort periods by index
  const sortedPeriods = [...periods].sort((a, b) => a.index - b.index);
  for (const p of sortedPeriods) {
    if (!p.blocked) {
      currentRun += 1;
      if (currentRun > maxContiguousRun) maxContiguousRun = currentRun;
    } else {
      currentRun = 0;
    }
  }

  // 2. Batch hours exceed usable periods
  const batchHours = new Map<string, number>();
  for (const off of offerings) {
    const hours = (off.theoryHoursPerWeek || 0) + (off.labBlocksPerWeek || 0) * (off.labBlockLength || 2);
    batchHours.set(off.batchId, (batchHours.get(off.batchId) || 0) + hours);
  }

  for (const [batchId, reqHours] of batchHours.entries()) {
    const batch = batches.find((b) => b.id === batchId);
    const batchName = batch ? batch.name : batchId;
    if (reqHours > totalUsablePeriods) {
      errors.push({
        code: 'BATCH_HOURS_EXCEED_GRID',
        message: `Section "${batchName}" requires ${reqHours} weekly hours, but only ${totalUsablePeriods} unblocked periods are available across the working days.`,
        fix: 'Reduce course weekly hours or add more working days / periods to the academic term.',
        batchId,
      });
    } else if (reqHours >= totalUsablePeriods - 2) {
      warnings.push({
        code: 'TIGHT_SECTION_SCHEDULE',
        message: `Section "${batchName}" schedule is very tight (${reqHours}/${totalUsablePeriods} periods occupied).`,
      });
    }
  }

  // 3. Professor hours exceed availability
  const profHours = new Map<string, number>();
  for (const off of offerings) {
    const hours = (off.theoryHoursPerWeek || 0) + (off.labBlocksPerWeek || 0) * (off.labBlockLength || 2);
    for (const profId of off.professorIds || []) {
      profHours.set(profId, (profHours.get(profId) || 0) + hours);
    }
  }

  const constraintMap = new Map(constraints.map((c) => [c.professorId, c]));
  const unblockedIndices = new Set(unblockedPeriods.map((p) => p.index));

  for (const [profId, assignedHours] of profHours.entries()) {
    const constraint = constraintMap.get(profId);
    let unavailableCount = 0;

    if (constraint?.unavailableWindows) {
      for (const w of constraint.unavailableWindows) {
        if (workingDays.includes(w.dayOfWeek)) {
          for (let p = w.startSlot; p <= w.endSlot; p += 1) {
            if (unblockedIndices.has(p)) {
              unavailableCount += 1;
            }
          }
        }
      }
    }

    const availablePeriods = totalUsablePeriods - unavailableCount;
    if (assignedHours > availablePeriods) {
      errors.push({
        code: 'PROFESSOR_HOURS_EXCEED_AVAILABILITY',
        message: `Professor "${profId}" is assigned ${assignedHours} teaching hours, but has only ${availablePeriods} usable periods available after accounting for unavailable windows.`,
        fix: 'Relax unavailable windows in Professor Preferences or reassign offerings.',
        professorId: profId,
      });
    }
  }

  // 4. Room capacity checks
  const maxRoomCapacity = rooms.length > 0 ? Math.max(...rooms.map((r) => r.capacity)) : 0;
  const labRooms = rooms.filter((r) => r.type === 'LABORATORY');
  const maxLabCapacity = labRooms.length > 0 ? Math.max(...labRooms.map((r) => r.capacity)) : 0;

  for (const batch of batches) {
    const hasTheory = offerings.some((o) => o.batchId === batch.id && o.theoryHoursPerWeek > 0);
    const hasLab = offerings.some((o) => o.batchId === batch.id && o.labBlocksPerWeek > 0);

    // No room large enough
    if (hasTheory && batch.studentCount > maxRoomCapacity) {
      errors.push({
        code: 'NO_ROOM_LARGE_ENOUGH',
        message: `Section "${batch.name}" has ${batch.studentCount} students, but the largest available classroom has capacity ${maxRoomCapacity}.`,
        fix: `Add a classroom with capacity of at least ${batch.studentCount} or reduce the section size.`,
        batchId: batch.id,
      });
    }

    // No lab large enough
    if (hasLab) {
      if (labRooms.length === 0) {
        errors.push({
          code: 'NO_LAB_ROOMS',
          message: `Section "${batch.name}" requires laboratories, but no LABORATORY rooms exist in the system.`,
          fix: 'Add at least one laboratory classroom in Classroom Management.',
          batchId: batch.id,
        });
      } else if (batch.studentCount > maxLabCapacity) {
        errors.push({
          code: 'NO_LAB_LARGE_ENOUGH',
          message: `Section "${batch.name}" has ${batch.studentCount} students, but the largest laboratory has capacity ${maxLabCapacity}. Batches are not split into lab groups in this version.`,
          fix: `Add a laboratory room with capacity of at least ${batch.studentCount} or reduce the section size.`,
          batchId: batch.id,
        });
      }
    }
  }

  // 6. Lab block longer than any contiguous free run
  for (const off of offerings) {
    if (off.labBlocksPerWeek > 0 && off.labBlockLength > maxContiguousRun) {
      errors.push({
        code: 'LAB_BLOCK_TOO_LONG',
        message: `Offering "${off.courseCode || off.id}" requires a contiguous lab block of ${off.labBlockLength} periods, but the longest unblocked period block in the grid is ${maxContiguousRun}.`,
        fix: `Decrease lab block length to ${maxContiguousRun} or adjust blocked periods in the term grid.`,
        offeringId: off.id,
        batchId: off.batchId,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
