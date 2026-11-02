import {
  SolverInput,
  SolverSlot,
  SolverOffering,
  SolverBatch,
  SolverRoom,
  SolverPeriod,
  SolverUnplaced,
} from './types';
import { SolverPlacementState, checkPlacement } from './conflicts';
import { buildOccupancyKeys } from './occupancy';
import crypto from 'crypto';

interface CSPVariable {
  id: string;
  lineageId: string;
  offering: SolverOffering;
  kind: 'THEORY' | 'LAB';
  durationSlots: number;
  batch: SolverBatch;
  eligibleRooms: SolverRoom[];
  pinnedSlot?: SolverSlot;
}

interface DomainValue {
  dayOfWeek: number;
  slotIndex: number;
  roomId: string;
  heuristicCost: number;
}

export interface CSPResult {
  placedSlots: SolverSlot[];
  unplacedItems: SolverUnplaced[];
  state: SolverPlacementState;
}

function createRng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t >>> 0) / 4294967296;
  };
}

export function constructInitialSchedule(
  input: SolverInput,
  onProgress?: (progress: number, message: string) => void
): CSPResult {
  const seed = input.config?.seed ?? 42;
  const rng = createRng(seed);

  const { workingDays, periods, rooms, batches, offerings, constraints, pinnedSlots = [] } = input;
  const context = {
    workingDays,
    periods,
    rooms,
    batches,
    constraints,
    professors: input.professors,
    courses: input.courses,
  };
  const periodMap = new Map<number, SolverPeriod>(periods.map((p) => [p.index, p]));

  // Build variables
  const variables: CSPVariable[] = [];

  for (const offering of offerings) {
    const batch = batches.find((b) => b.id === offering.batchId);
    if (!batch) continue;

    const eligibleLabRooms = rooms.filter(
      (r) => r.type === 'LABORATORY' && r.capacity >= batch.studentCount
    );
    const eligibleTheoryRooms = rooms.filter(
      (r) => r.type === 'THEORY' && r.capacity >= batch.studentCount
    );

    // Labs
    const labBlocks = offering.labBlocksPerWeek || 0;
    const labLen = offering.labBlockLength || 2;
    for (let i = 0; i < labBlocks; i += 1) {
      variables.push({
        id: `${offering.id}:lab:${i}`,
        lineageId: crypto.randomUUID(),
        offering,
        kind: 'LAB',
        durationSlots: labLen,
        batch,
        eligibleRooms: eligibleLabRooms,
      });
    }

    // Theory
    const theoryHours = offering.theoryHoursPerWeek || 0;
    for (let i = 0; i < theoryHours; i += 1) {
      variables.push({
        id: `${offering.id}:theory:${i}`,
        lineageId: crypto.randomUUID(),
        offering,
        kind: 'THEORY',
        durationSlots: 1,
        batch,
        eligibleRooms: eligibleTheoryRooms,
      });
    }
  }

  // Handle pinned slots
  const initialPlacedSlots: SolverSlot[] = [];
  const assignedVarIds = new Set<string>();

  for (const pinned of pinnedSlots) {
    if (!pinned.placed) continue;
    const match = variables.find(
      (v) =>
        !assignedVarIds.has(v.id) &&
        v.offering.id === pinned.offeringId &&
        v.kind === pinned.kind &&
        v.durationSlots === pinned.durationSlots
    );
    if (match) {
      match.pinnedSlot = pinned;
      match.lineageId = pinned.lineageId;
      assignedVarIds.add(match.id);
      initialPlacedSlots.push({ ...pinned, pinned: true });
    }
  }

  // Coordinates
  const validCoordinatesByDuration = new Map<number, Array<{ dayOfWeek: number; slotIndex: number }>>();

  const getCoordinates = (duration: number) => {
    if (validCoordinatesByDuration.has(duration)) {
      return validCoordinatesByDuration.get(duration)!;
    }
    const coords: Array<{ dayOfWeek: number; slotIndex: number }> = [];
    const maxPeriod = Math.max(...periods.map((p) => p.index));
    const minPeriod = Math.min(...periods.map((p) => p.index));

    for (const day of workingDays) {
      for (let p = minPeriod; p <= maxPeriod - duration + 1; p += 1) {
        let isUnblocked = true;
        for (let step = 0; step < duration; step += 1) {
          const item = periodMap.get(p + step);
          if (!item || item.blocked) {
            isUnblocked = false;
            break;
          }
        }
        if (isUnblocked) {
          coords.push({ dayOfWeek: day, slotIndex: p });
        }
      }
    }
    validCoordinatesByDuration.set(duration, coords);
    return coords;
  };

  const computeDomain = (v: CSPVariable, state: SolverPlacementState): DomainValue[] => {
    if (v.pinnedSlot) {
      return [
        {
          dayOfWeek: v.pinnedSlot.dayOfWeek,
          slotIndex: v.pinnedSlot.slotIndex,
          roomId: v.pinnedSlot.classroomId || v.eligibleRooms[0]?.id || '',
          heuristicCost: 0,
        },
      ];
    }

    const coords = getCoordinates(v.durationSlots);
    const domain: DomainValue[] = [];

    const profConstraints = constraints.filter((c) =>
      v.offering.professorIds.includes(c.professorId)
    );

    for (const coord of coords) {
      for (const room of v.eligibleRooms) {
        const testSlot: SolverSlot = {
          lineageId: v.lineageId,
          offeringId: v.offering.id,
          courseId: v.offering.courseId,
          batchId: v.batch.id,
          professorIds: v.offering.professorIds,
          classroomId: room.id,
          dayOfWeek: coord.dayOfWeek,
          slotIndex: coord.slotIndex,
          durationSlots: v.durationSlots,
          kind: v.kind,
          pinned: false,
          placed: true,
        };

        const violations = checkPlacement(state, testSlot, context);
        if (violations.length === 0) {
          let hCost = 0;

          for (const c of profConstraints) {
            for (let step = 0; step < v.durationSlots; step += 1) {
              const p = coord.slotIndex + step;
              const inUnavailable = c.unavailableWindows?.some(
                (w) => w.dayOfWeek === coord.dayOfWeek && p >= w.startSlot && p <= w.endSlot
              );
              if (inUnavailable) hCost += 500 * (c.priorityWeight || 3);

              const inPreferred = c.preferredWindows?.some(
                (w) => w.dayOfWeek === coord.dayOfWeek && p >= w.startSlot && p <= w.endSlot
              );
              if (c.preferredWindows?.length && !inPreferred) {
                hCost += 20 * (c.priorityWeight || 3);
              }
            }
          }

          if (v.kind === 'THEORY') {
            const sameDayClass = state.slots.some(
              (s) =>
                s.placed &&
                s.batchId === v.batch.id &&
                s.dayOfWeek === coord.dayOfWeek &&
                s.courseId === v.offering.courseId
            );
            if (sameDayClass) {
              const theoryHours = v.offering.theoryHoursPerWeek || 3;
              // Strongly avoid scheduling the same theory course twice on the same day by default
              hCost += theoryHours <= workingDays.length ? 50000 : 5000;
            }
          }

          hCost += rng() * 5;

          domain.push({
            dayOfWeek: coord.dayOfWeek,
            slotIndex: coord.slotIndex,
            roomId: room.id,
            heuristicCost: hCost,
          });
        }
      }
    }

    domain.sort((a, b) => a.heuristicCost - b.heuristicCost);
    return domain;
  };

  const createState = (): SolverPlacementState => ({
    slots: [],
  });

  const MAX_RESTARTS = 6;
  const MAX_BACKTRACKS_PER_RUN = 800;

  let bestPlacedCount = -1;
  let bestState: SolverPlacementState = createState();
  let bestUnplacedVars: CSPVariable[] = [];

  for (let restart = 0; restart < MAX_RESTARTS; restart += 1) {
    const state = createState();
    for (const pinned of initialPlacedSlots) {
      state.slots.push({ ...pinned });
    }

    const remainingVars = variables.filter((v) => !assignedVarIds.has(v.id));
    remainingVars.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'LAB' ? -1 : 1;
      if (a.durationSlots !== b.durationSlots) return b.durationSlots - a.durationSlots;
      return rng() - 0.5;
    });

    let backtracks = 0;

    const search = (unplaced: CSPVariable[]): boolean => {
      if (unplaced.length === 0) return true;
      if (backtracks > MAX_BACKTRACKS_PER_RUN) return false;

      let minDomainSize = Infinity;
      let selectedVarIndex = -1;
      let selectedDomain: DomainValue[] = [];

      const hasLab = unplaced.some((v) => v.kind === 'LAB');

      for (let i = 0; i < unplaced.length; i += 1) {
        const v = unplaced[i];
        if (hasLab && v.kind !== 'LAB') continue;

        const domain = computeDomain(v, state);
        if (domain.length === 0) {
          return false;
        }

        if (domain.length < minDomainSize) {
          minDomainSize = domain.length;
          selectedVarIndex = i;
          selectedDomain = domain;
          if (minDomainSize === 1) break;
        }
      }

      if (selectedVarIndex === -1) {
        selectedVarIndex = 0;
        selectedDomain = computeDomain(unplaced[0], state);
        if (selectedDomain.length === 0) return false;
      }

      const currentVar = unplaced[selectedVarIndex];
      const nextUnplaced = [
        ...unplaced.slice(0, selectedVarIndex),
        ...unplaced.slice(selectedVarIndex + 1),
      ];

      for (const val of selectedDomain) {
        const slot: SolverSlot = {
          lineageId: currentVar.lineageId,
          offeringId: currentVar.offering.id,
          courseId: currentVar.offering.courseId,
          batchId: currentVar.batch.id,
          professorIds: currentVar.offering.professorIds,
          classroomId: val.roomId,
          dayOfWeek: val.dayOfWeek,
          slotIndex: val.slotIndex,
          durationSlots: currentVar.durationSlots,
          kind: currentVar.kind,
          pinned: false,
          placed: true,
        };

        state.slots.push(slot);

        if (search(nextUnplaced)) {
          return true;
        }

        // Backtrack
        backtracks += 1;
        state.slots.pop();

        if (backtracks > MAX_BACKTRACKS_PER_RUN) break;
      }

      return false;
    };

    onProgress?.(
      Math.min(50, 10 + restart * 8),
      `Constructing timetable draft (attempt ${restart + 1}/${MAX_RESTARTS})...`
    );

    const success = search(remainingVars);

    const placedCount = state.slots.length;
    if (placedCount > bestPlacedCount) {
      bestPlacedCount = placedCount;
      bestState = {
        slots: state.slots.map((s) => ({ ...s })),
      };
      const placedLineages = new Set(state.slots.map((s) => s.lineageId));
      bestUnplacedVars = variables.filter((v) => !placedLineages.has(v.lineageId));
    }

    if (success && bestUnplacedVars.length === 0) {
      break;
    }
  }

  const unplacedItems: SolverUnplaced[] = bestUnplacedVars.map((v) => ({
    offeringId: v.offering.id,
    kind: v.kind,
    reason: `Could not find clash-free slot with available classroom for Section "${v.batch.name}" and assigned faculty.`,
  }));

  const finalSlots: SolverSlot[] = bestState.slots.map((s) => ({
    ...s,
    occupancyKeys: buildOccupancyKeys({
      professorIds: s.professorIds,
      batchId: s.batchId,
      classroomId: s.classroomId,
      dayOfWeek: s.dayOfWeek,
      slotIndex: s.slotIndex,
      durationSlots: s.durationSlots,
    }),
  }));

  for (const v of bestUnplacedVars) {
    finalSlots.push({
      lineageId: v.lineageId,
      offeringId: v.offering.id,
      courseId: v.offering.courseId,
      batchId: v.batch.id,
      professorIds: v.offering.professorIds,
      classroomId: null,
      dayOfWeek: workingDays[0] || 1,
      slotIndex: 1,
      durationSlots: v.durationSlots,
      kind: v.kind,
      pinned: false,
      placed: false,
      unplacedReason: `Could not find clash-free slot with available classroom for Section "${v.batch.name}".`,
      occupancyKeys: [],
    });
  }

  onProgress?.(55, `Initial draft constructed: ${bestState.slots.length} placed, ${unplacedItems.length} unplaced.`);

  return {
    placedSlots: finalSlots,
    unplacedItems,
    state: bestState,
  };
}
