import { SolverInput, SolverSlot, SolverPeriod } from './types';
import { SolverPlacementState, checkPlacement } from './conflicts';
import { evaluateSoftCost } from './cost';
import { buildOccupancyKeys } from './occupancy';

function createRng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t >>> 0) / 4294967296;
  };
}

export function annealSchedule(
  slots: SolverSlot[],
  _state: SolverPlacementState,
  input: SolverInput,
  onProgress?: (progress: number, message: string) => void
): SolverSlot[] {
  const seed = (input.config?.seed ?? 42) + 101;
  const rng = createRng(seed);

  const { workingDays, periods, rooms, batches } = input;
  const context = { workingDays, periods, rooms, batches };

  // Clone slots so we don't mutate input
  const currentSlots: SolverSlot[] = slots.map((s) => ({ ...s }));
  const state: SolverPlacementState = { slots: currentSlots };

  const unpinnedSlots = currentSlots.filter((s) => s.placed && !s.pinned);
  if (unpinnedSlots.length === 0) return slots;

  const maxSeconds = Math.max(2, Math.min(25, input.config?.maxSeconds || 10));
  const timeLimitMs = maxSeconds * 1000;
  const startTime = Date.now();

  let currentCost = evaluateSoftCost(currentSlots, input).totalCost;
  let bestCost = currentCost;
  let bestSlots = currentSlots.map((s) => ({ ...s }));

  const T0 = 80.0;
  const Tmin = 0.5;

  let iterations = 0;
  const maxPeriod = Math.max(...periods.map((p) => p.index));
  const minPeriod = Math.min(...periods.map((p) => p.index));
  const periodMap = new Map<number, SolverPeriod>(periods.map((p) => [p.index, p]));

  const maxIterations = Math.max(1000, Math.min(10000, (input.config?.maxSeconds || 5) * 600));

  while (iterations < maxIterations && Date.now() - startTime < timeLimitMs && bestCost > 0) {
    const fraction = iterations / maxIterations;
    const T = Math.max(Tmin, T0 * Math.pow(Tmin / T0, fraction));
    iterations += 1;

    if (iterations % 200 === 0 && onProgress) {
      const progressPercent = Math.min(95, Math.round(60 + fraction * 35));
      onProgress(progressPercent, `Optimizing timetable (Cost: ${bestCost})...`);
    }

    const slotIdx = Math.floor(rng() * unpinnedSlots.length);
    const slot = unpinnedSlots[slotIdx];
    const moveType = rng();

    if (moveType < 0.5) {
      // 1. MOVE: Move slot to new (day, period, room)
      const oldDay = slot.dayOfWeek;
      const oldSlotIndex = slot.slotIndex;
      const oldRoomId = slot.classroomId;

      const newDay = workingDays[Math.floor(rng() * workingDays.length)];
      const newSlotIndex = minPeriod + Math.floor(rng() * (maxPeriod - slot.durationSlots - minPeriod + 2));

      let unblocked = true;
      for (let step = 0; step < slot.durationSlots; step += 1) {
        const item = periodMap.get(newSlotIndex + step);
        if (!item || item.blocked) {
          unblocked = false;
          break;
        }
      }
      if (!unblocked) continue;

      const batch = batches.find((b) => b.id === slot.batchId);
      const eligibleRooms = rooms.filter(
        (r) =>
          (slot.kind === 'LAB' ? r.type === 'LABORATORY' : r.type === 'THEORY') &&
          r.capacity >= (batch?.studentCount || 0)
      );
      if (eligibleRooms.length === 0) continue;
      const newRoom = eligibleRooms[Math.floor(rng() * eligibleRooms.length)];

      // Mutate
      slot.dayOfWeek = newDay;
      slot.slotIndex = newSlotIndex;
      slot.classroomId = newRoom.id;

      const violations = checkPlacement(state, slot, context);
      if (violations.length === 0) {
        const newCost = evaluateSoftCost(currentSlots, input).totalCost;
        const delta = newCost - currentCost;

        if (delta <= 0 || rng() < Math.exp(-delta / T)) {
          currentCost = newCost;
          if (currentCost < bestCost) {
            bestCost = currentCost;
            bestSlots = currentSlots.map((s) => ({ ...s }));
          }
        } else {
          // Revert
          slot.dayOfWeek = oldDay;
          slot.slotIndex = oldSlotIndex;
          slot.classroomId = oldRoomId;
        }
      } else {
        // Revert
        slot.dayOfWeek = oldDay;
        slot.slotIndex = oldSlotIndex;
        slot.classroomId = oldRoomId;
      }
    } else if (moveType < 0.8) {
      // 2. SWAP: Swap two slots of the SAME BATCH and same duration
      const sameBatchSlots = unpinnedSlots.filter(
        (s) => s.batchId === slot.batchId && s.lineageId !== slot.lineageId && s.durationSlots === slot.durationSlots
      );
      if (sameBatchSlots.length === 0) continue;

      const other = sameBatchSlots[Math.floor(rng() * sameBatchSlots.length)];

      const sDay = slot.dayOfWeek;
      const sIndex = slot.slotIndex;
      const sRoom = slot.classroomId;

      const oDay = other.dayOfWeek;
      const oIndex = other.slotIndex;
      const oRoom = other.classroomId;

      // Swap coordinates & rooms
      slot.dayOfWeek = oDay;
      slot.slotIndex = oIndex;
      slot.classroomId = oRoom;

      other.dayOfWeek = sDay;
      other.slotIndex = sIndex;
      other.classroomId = sRoom;

      const viol1 = checkPlacement(state, slot, context);
      const viol2 = checkPlacement(state, other, context);

      if (viol1.length === 0 && viol2.length === 0) {
        const newCost = evaluateSoftCost(currentSlots, input).totalCost;
        const delta = newCost - currentCost;

        if (delta <= 0 || rng() < Math.exp(-delta / T)) {
          currentCost = newCost;
          if (currentCost < bestCost) {
            bestCost = currentCost;
            bestSlots = currentSlots.map((s) => ({ ...s }));
          }
        } else {
          // Revert
          slot.dayOfWeek = sDay;
          slot.slotIndex = sIndex;
          slot.classroomId = sRoom;
          other.dayOfWeek = oDay;
          other.slotIndex = oIndex;
          other.classroomId = oRoom;
        }
      } else {
        // Revert
        slot.dayOfWeek = sDay;
        slot.slotIndex = sIndex;
        slot.classroomId = sRoom;
        other.dayOfWeek = oDay;
        other.slotIndex = oIndex;
        other.classroomId = oRoom;
      }
    } else {
      // 3. ROOM_CHANGE
      const batch = batches.find((b) => b.id === slot.batchId);
      const eligibleRooms = rooms.filter(
        (r) =>
          r.id !== slot.classroomId &&
          (slot.kind === 'LAB' ? r.type === 'LABORATORY' : r.type === 'THEORY') &&
          r.capacity >= (batch?.studentCount || 0)
      );
      if (eligibleRooms.length === 0) continue;

      const newRoom = eligibleRooms[Math.floor(rng() * eligibleRooms.length)];
      const oldRoomId = slot.classroomId;

      slot.classroomId = newRoom.id;
      const violations = checkPlacement(state, slot, context);

      if (violations.length === 0) {
        const newCost = evaluateSoftCost(currentSlots, input).totalCost;
        const delta = newCost - currentCost;

        if (delta <= 0 || rng() < Math.exp(-delta / T)) {
          currentCost = newCost;
          if (currentCost < bestCost) {
            bestCost = currentCost;
            bestSlots = currentSlots.map((s) => ({ ...s }));
          }
        } else {
          slot.classroomId = oldRoomId;
        }
      } else {
        slot.classroomId = oldRoomId;
      }
    }
  }

  // Populate occupancyKeys for best slots
  return bestSlots.map((s) => ({
    ...s,
    occupancyKeys: s.placed
      ? buildOccupancyKeys({
          professorIds: s.professorIds,
          batchId: s.batchId,
          classroomId: s.classroomId,
          dayOfWeek: s.dayOfWeek,
          slotIndex: s.slotIndex,
          durationSlots: s.durationSlots,
        })
      : [],
  }));
}
