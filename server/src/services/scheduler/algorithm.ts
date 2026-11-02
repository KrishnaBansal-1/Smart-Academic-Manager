import { SolverInput, SolverOutput } from './types';
import { runPreflight } from './preflight';
import { constructInitialSchedule } from './construct';
import { annealSchedule } from './anneal';
import { evaluateSoftCost } from './cost';
import { buildOccupancyKeys } from './occupancy';
import crypto from 'crypto';

export function solve(
  input: SolverInput,
  onProgress?: (progress: number, message: string) => void
): SolverOutput {
  const startTime = Date.now();

  // 1. Preflight Validation
  onProgress?.(5, 'Running scheduler preflight validation...');
  const preflight = runPreflight(input);

  if (!preflight.valid) {
    const durationMs = Date.now() - startTime;
    const fatalErrors = preflight.errors.map((e) => `${e.message} (Fix: ${e.fix})`).join('; ');

    const unplacedList = preflight.errors.map((e) => ({
      offeringId: e.offeringId || '',
      kind: 'THEORY' as const,
      reason: `${e.message} Fix: ${e.fix}`,
    }));

    const unplacedSlots = unplacedList.map((u) => ({
      lineageId: crypto.randomUUID(),
      offeringId: u.offeringId,
      courseId: '',
      batchId: '',
      professorIds: [],
      classroomId: null,
      dayOfWeek: input.workingDays[0] || 1,
      slotIndex: 1,
      durationSlots: 1,
      kind: u.kind,
      pinned: false,
      placed: false,
      unplacedReason: u.reason,
      occupancyKeys: [],
    }));

    return {
      slots: unplacedSlots,
      unplaced: unplacedList,
      metrics: {
        placed: 0,
        unplaced: preflight.errors.length,
        softScore: 0,
        costBreakdown: {
          unavailableWindows: 0,
          overDailyHours: 0,
          outsidePreferred: 0,
          idleGaps: 0,
          sameDayRepeat: 0,
          totalCost: 0,
        },
        durationMs,
      },
      error: `Preflight failed: ${fatalErrors}`,
    };
  }

  // 2. CSP Construction (Labs first, MRV, forward checking, bounded backtracking)
  onProgress?.(10, 'Executing CSP construction...');
  const cspResult = constructInitialSchedule(input, onProgress);

  // 3. Simulated Annealing (Feasible moves only: move, swap, room change)
  onProgress?.(60, 'Starting simulated annealing optimization...');
  let optimizedSlots = cspResult.placedSlots;

  const hasPlacedUnpinned = cspResult.placedSlots.some((s) => s.placed && !s.pinned);
  if (hasPlacedUnpinned) {
    optimizedSlots = annealSchedule(
      cspResult.placedSlots,
      cspResult.state,
      input,
      onProgress
    );
  }

  // Ensure all placed slots have valid occupancy keys computed
  for (const slot of optimizedSlots) {
    if (slot.placed) {
      slot.occupancyKeys = buildOccupancyKeys({
        professorIds: slot.professorIds,
        batchId: slot.batchId,
        classroomId: slot.classroomId,
        dayOfWeek: slot.dayOfWeek,
        slotIndex: slot.slotIndex,
        durationSlots: slot.durationSlots,
      });
    } else {
      slot.occupancyKeys = [];
    }
  }

  // 4. Final Cost & Metrics Evaluation
  const costEval = evaluateSoftCost(optimizedSlots, input);
  const placedCount = optimizedSlots.filter((s) => s.placed).length;
  const unplacedCount = cspResult.unplacedItems.length;
  const durationMs = Date.now() - startTime;

  onProgress?.(100, `Generation complete in ${(durationMs / 1000).toFixed(1)}s (Score: ${costEval.softScore}%)`);

  return {
    slots: optimizedSlots,
    unplaced: cspResult.unplacedItems,
    metrics: {
      placed: placedCount,
      unplaced: unplacedCount,
      softScore: costEval.softScore,
      costBreakdown: costEval.breakdown,
      durationMs,
    },
  };
}
