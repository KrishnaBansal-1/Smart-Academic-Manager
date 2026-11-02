import request from 'supertest';
import { createApp } from '../app';
import { seedDatabase } from '../utils/seeder';
import { solve } from '../services/scheduler/algorithm';
import { runPreflight } from '../services/scheduler/preflight';
import { runSolverJob } from '../services/scheduler/worker';
import { loadSolverInput } from '../services/scheduler/dataLoader';
import { SolverInput, SolverOutput } from '../services/scheduler/types';
import { AcademicTerm } from '../models/AcademicTerm';
import { GenerationJob } from '../models/GenerationJob';
import { Timetable } from '../models/Timetable';
import { ScheduleSlot } from '../models/ScheduleSlot';
import { User } from '../models/User';
import { CourseOffering } from '../models/CourseOffering';
import { Classroom } from '../models/Classroom';
import crypto from 'crypto';

const app = createApp();

/**
 * INDEPENDENT HARD CONFLICT CHECKER
 * Deliberately does NOT import or share any logic from conflicts.ts.
 * Checks ground-truth invariants on scheduler output.
 */
function independentVerifySchedule(output: SolverOutput, input: SolverInput): void {
  const { periods, rooms, batches, workingDays, offerings } = input;
  const placedSlots = output.slots.filter((s) => s.placed);

  const periodMap = new Map(periods.map((p) => [p.index, p]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const batchMap = new Map(batches.map((b) => [b.id, b]));

  // 1. Grid boundary, working days, and blocked period checks
  for (const slot of placedSlots) {
    expect(workingDays).toContain(slot.dayOfWeek);

    const start = slot.slotIndex;
    const end = slot.slotIndex + slot.durationSlots - 1;

    // Must be contiguous and within grid
    expect(slot.durationSlots).toBeGreaterThanOrEqual(1);

    for (let p = start; p <= end; p += 1) {
      const gridItem = periodMap.get(p);
      expect(gridItem).toBeDefined();
      // Invariant: No class in blocked periods
      expect(gridItem!.blocked).toBe(false);
    }

    // Classroom type and capacity check
    if (slot.classroomId) {
      const room = roomMap.get(slot.classroomId);
      expect(room).toBeDefined();

      const batch = batchMap.get(slot.batchId);
      expect(batch).toBeDefined();

      // Invariant: Classroom capacity must accommodate batch studentCount
      expect(room!.capacity).toBeGreaterThanOrEqual(batch!.studentCount);

      // Invariant: Labs must be in LABORATORY rooms
      if (slot.kind === 'LAB') {
        expect(room!.type).toBe('LABORATORY');
      } else {
        expect(room!.type).toBe('THEORY');
      }
    }
  }

  // 2. Pairwise clash checks: Range overlap across periods
  for (let i = 0; i < placedSlots.length; i += 1) {
    const a = placedSlots[i];
    const aStart = a.slotIndex;
    const aEnd = a.slotIndex + a.durationSlots - 1;

    for (let j = i + 1; j < placedSlots.length; j += 1) {
      const b = placedSlots[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;

      const bStart = b.slotIndex;
      const bEnd = b.slotIndex + b.durationSlots - 1;

      // Check period range overlap
      const hasOverlap = Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);
      if (!hasOverlap) continue;

      // Invariant: Batch cannot be in two places at once
      if (a.batchId === b.batchId) {
        throw new Error(
          `INDEPENDENT CHECKER FAILED: Batch clash for batch "${a.batchId}" on day ${a.dayOfWeek} between periods [${aStart}..${aEnd}] and [${bStart}..${bEnd}]`
        );
      }

      // Invariant: Classroom cannot hold two classes simultaneously
      if (a.classroomId && b.classroomId && a.classroomId === b.classroomId) {
        throw new Error(
          `INDEPENDENT CHECKER FAILED: Room clash for room "${a.classroomId}" on day ${a.dayOfWeek} between periods [${aStart}..${aEnd}] and [${bStart}..${bEnd}]`
        );
      }

      // Invariant: Professor cannot teach two classes simultaneously
      for (const profA of a.professorIds) {
        if (b.professorIds.includes(profA)) {
          throw new Error(
            `INDEPENDENT CHECKER FAILED: Professor clash for prof "${profA}" on day ${a.dayOfWeek} between periods [${aStart}..${aEnd}] and [${bStart}..${bEnd}]`
          );
        }
      }
    }
  }

  // 3. Invariant: Placed hours match offering specifications when placed
  const hoursPerOffering = new Map<string, number>();
  for (const slot of placedSlots) {
    hoursPerOffering.set(
      slot.offeringId,
      (hoursPerOffering.get(slot.offeringId) || 0) + slot.durationSlots
    );
  }

  for (const off of offerings) {
    const expectedHours =
      (off.theoryHoursPerWeek || 0) + (off.labBlocksPerWeek || 0) * (off.labBlockLength || 2);
    const placedHours = hoursPerOffering.get(off.id) || 0;
    // Each placed offering should have at most the expected hours
    expect(placedHours).toBeLessThanOrEqual(expectedHours);
  }
}

describe('Phase 2: Timetable Scheduler & Solver Engine', () => {
  let adminToken: string;
  let activeTermId: string;
  let defaultInput: SolverInput;

  beforeEach(async () => {
    // Seed full academic dataset (NIT Warangal data)
    await seedDatabase();

    // Login as admin
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@sam.edu',
      password: 'Admin@123',
    });
    adminToken = loginRes.body.data.accessToken;

    const term = await AcademicTerm.findOne({ isActive: true });
    expect(term).toBeDefined();
    activeTermId = term!._id.toString();

    defaultInput = await loadSolverInput(activeTermId);
  }, 60000);

  describe('Preflight Validation Suite', () => {
    it('passes preflight on the valid seeded NIT Warangal dataset', () => {
      const result = runPreflight(defaultInput);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects offering with no faculty and suggests the exact fix', () => {
      const brokenInput: SolverInput = JSON.parse(JSON.stringify(defaultInput));
      brokenInput.offerings[0].professorIds = [];

      const result = runPreflight(brokenInput);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.code === 'NO_FACULTY');
      expect(err).toBeDefined();
      expect(err!.fix).toBe('Assign at least one active professor to this offering in Academic Setup.');
    });

    it('detects when batch hours exceed usable periods in grid', () => {
      const brokenInput: SolverInput = JSON.parse(JSON.stringify(defaultInput));
      // Artificially inflate hours of first offering beyond usable periods (35)
      brokenInput.offerings[0].theoryHoursPerWeek = 40;

      const result = runPreflight(brokenInput);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.code === 'BATCH_HOURS_EXCEED_GRID');
      expect(err).toBeDefined();
      expect(err!.fix).toBe('Reduce course weekly hours or add more working days / periods to the academic term.');
    });

    it('detects when professor hours exceed availability after unavailable windows', () => {
      const brokenInput: SolverInput = JSON.parse(JSON.stringify(defaultInput));
      const profId = brokenInput.offerings[0].professorIds[0];

      // Mark all working days as unavailable for this professor
      brokenInput.constraints.push({
        professorId: profId,
        preferredWindows: [],
        unavailableWindows: [1, 2, 3, 4, 5].map((d) => ({
          dayOfWeek: d,
          startSlot: 1,
          endSlot: 8,
        })),
        maxDailyHours: 0,
        priorityWeight: 5,
      });

      const result = runPreflight(brokenInput);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.code === 'PROFESSOR_HOURS_EXCEED_AVAILABILITY');
      expect(err).toBeDefined();
      expect(err!.fix).toBe('Relax unavailable windows in Professor Preferences or reassign offerings.');
    });

    it('detects when no classroom is large enough for a section', () => {
      const brokenInput: SolverInput = JSON.parse(JSON.stringify(defaultInput));
      brokenInput.batches[0].studentCount = 200; // largest room is 90

      const result = runPreflight(brokenInput);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.code === 'NO_ROOM_LARGE_ENOUGH');
      expect(err).toBeDefined();
      expect(err!.fix).toContain('Add a classroom with capacity of at least 200');
    });

    it('detects when no laboratory is large enough for a section without splitting', () => {
      const brokenInput: SolverInput = JSON.parse(JSON.stringify(defaultInput));
      brokenInput.batches[0].studentCount = 50; // largest lab is 45

      const result = runPreflight(brokenInput);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.code === 'NO_LAB_LARGE_ENOUGH');
      expect(err).toBeDefined();
      expect(err!.fix).toContain('Add a laboratory room with capacity of at least 50');
      expect(err!.message).toContain('Batches are not split into lab groups in this version');
    });

    it('detects lab block longer than any contiguous free run in grid', () => {
      const brokenInput: SolverInput = JSON.parse(JSON.stringify(defaultInput));
      const labOff = brokenInput.offerings.find((o) => o.labBlocksPerWeek > 0);
      expect(labOff).toBeDefined();
      labOff!.labBlockLength = 6; // Max contiguous run in grid is 4 (periods 1-4)

      const result = runPreflight(brokenInput);
      expect(result.valid).toBe(false);
      const err = result.errors.find((e) => e.code === 'LAB_BLOCK_TOO_LONG');
      expect(err).toBeDefined();
      expect(err!.fix).toBe('Decrease lab block length to 4 or adjust blocked periods in the term grid.');
    });
  });

  describe('Solver Engine Performance, Integrity & Determinism', () => {
    it('solves the complete NIT Warangal seed dataset with 0 unplaced in under 30 seconds', () => {
      const startTime = Date.now();
      const output = solve(defaultInput);
      const durationMs = Date.now() - startTime;

      expect(durationMs).toBeLessThan(30000);
      expect(output.error).toBeUndefined();
      expect(output.metrics.unplaced).toBe(0);
      expect(output.unplaced).toHaveLength(0);
      expect(output.metrics.placed).toBeGreaterThan(60);
      expect(output.metrics.softScore).toBeGreaterThanOrEqual(70);

      // Independent invariant check
      independentVerifySchedule(output, defaultInput);
    }, 35000);

    it('produces 0 hard violations across multiple distinct random seeds', () => {
      const testSeeds = [101, 777, 9999];

      for (const seed of testSeeds) {
        const inputWithSeed: SolverInput = {
          ...defaultInput,
          config: { seed, maxSeconds: 3 },
        };

        const output = solve(inputWithSeed);
        expect(output.error).toBeUndefined();
        expect(output.metrics.unplaced).toBe(0);

        // Verify with independent checker
        independentVerifySchedule(output, inputWithSeed);
      }
    }, 45000);

    it('is completely deterministic: same seed produces identical results', () => {
      const config = { seed: 12345, maxSeconds: 2 };
      const inputA: SolverInput = { ...defaultInput, config };
      const inputB: SolverInput = { ...defaultInput, config };

      const outputA = solve(inputA);
      const outputB = solve(inputB);

      expect(outputA.metrics.softScore).toBe(outputB.metrics.softScore);
      expect(outputA.slots).toHaveLength(outputB.slots.length);

      // Verify that every slot is placed at the exact same coordinates and room
      for (let i = 0; i < outputA.slots.length; i += 1) {
        const slotA = outputA.slots[i];
        const slotB = outputB.slots[i];
        expect(slotA.dayOfWeek).toBe(slotB.dayOfWeek);
        expect(slotA.slotIndex).toBe(slotB.slotIndex);
        expect(slotA.classroomId).toBe(slotB.classroomId);
      }
    }, 20000);

    it('gracefully saves unplaceable items with clear reasons when capacity is constrained', () => {
      const constrainedInput: SolverInput = JSON.parse(JSON.stringify(defaultInput));
      // Artificially cut working days down to 1 day only (7 unblocked periods total)
      constrainedInput.workingDays = [1];

      const output = solve(constrainedInput);
      expect(output.metrics.unplaced).toBeGreaterThan(0);
      expect(output.unplaced.length).toBeGreaterThan(0);

      const unplacedSlot = output.slots.find((s) => !s.placed);
      expect(unplacedSlot).toBeDefined();
      expect(unplacedSlot!.unplacedReason).toBeDefined();

      // Independent checker must still hold for all placed slots
      independentVerifySchedule(output, constrainedInput);
    });

    it('runs successfully inside a worker thread using runSolverJob', async () => {
      const input: SolverInput = {
        ...defaultInput,
        config: { seed: 42, maxSeconds: 3 },
      };

      const progressUpdates: number[] = [];
      const output = await runSolverJob(input, (progress) => {
        progressUpdates.push(progress);
      });

      expect(output).toBeDefined();
      expect(output.metrics.placed).toBeGreaterThan(0);
      expect(output.metrics.unplaced).toBe(0);
      expect(progressUpdates.length).toBeGreaterThan(0);

      independentVerifySchedule(output, input);
    }, 20000);
  });

  describe('Timetable & Generation Jobs HTTP API', () => {
    it('POST /api/v1/timetables/preflight returns preflight status for admin', async () => {
      const res = await request(app)
        .post('/api/v1/timetables/preflight')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ termId: activeTermId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.errors).toHaveLength(0);
    });

    it('POST /api/v1/timetables/preflight rejects non-admin access', async () => {
      const prof = await User.findOne({ role: 'PROFESSOR' });
      const profLogin = await request(app).post('/api/v1/auth/login').send({
        email: prof!.email,
        password: 'Password@123',
      });
      const profToken = profLogin.body.data.accessToken;

      const res = await request(app)
        .post('/api/v1/timetables/preflight')
        .set('Authorization', `Bearer ${profToken}`)
        .send({ termId: activeTermId });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/timetables/generate triggers generation job and persists draft', async () => {
      const res = await request(app)
        .post('/api/v1/timetables/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          termId: activeTermId,
          config: { seed: 555, maxSeconds: 3 },
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBeDefined();

      const jobId = res.body.data.jobId;

      // Poll generation job status until completed
      let jobStatus = 'RUNNING';
      let attempts = 0;
      let finalJob: { status: string; progress: number; timetableId: { _id?: string } | string } | null = null;

      while (attempts < 30 && (jobStatus === 'RUNNING' || jobStatus === 'QUEUED')) {
        await new Promise((r) => setTimeout(r, 1000));
        attempts += 1;

        const pollRes = await request(app)
          .get(`/api/v1/generation-jobs/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(pollRes.status).toBe(200);
        finalJob = pollRes.body.data.job;
        jobStatus = finalJob?.status || '';
      }

      expect(jobStatus).toBe('DONE');
      expect(finalJob!.progress).toBe(100);
      expect(finalJob!.timetableId).toBeDefined();

      // Check generated Timetable draft
      const targetTimetableId = typeof finalJob!.timetableId === 'object' && finalJob!.timetableId !== null
        ? (finalJob!.timetableId as { _id?: string })._id
        : finalJob!.timetableId;
      const timetable = await Timetable.findById(targetTimetableId);
      expect(timetable).toBeDefined();
      expect(timetable!.status).toBe('DRAFT');
      expect(timetable!.revision).toBe(1);

      // Check generated ScheduleSlots
      const slots = await ScheduleSlot.find({ timetableId: timetable!._id });
      expect(slots.length).toBeGreaterThan(60);

      // Check occupancyKeys on placed slots
      const placedSlot = slots.find((s) => s.placed);
      expect(placedSlot).toBeDefined();
      expect(placedSlot!.occupancyKeys.length).toBeGreaterThan(0);
      expect(placedSlot!.occupancyKeys[0]).toMatch(/^[PBR]:/);
    }, 45000);

    it('POST /api/v1/timetables/generate returns 409 when a generation job is already running', async () => {
      // Create a mock RUNNING job
      const runningJob = await GenerationJob.create({
        termId: activeTermId,
        status: 'RUNNING',
        progress: 10,
      });

      const res = await request(app)
        .post('/api/v1/timetables/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ termId: activeTermId });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already running');

      // Cleanup
      await GenerationJob.findByIdAndDelete(runningJob._id);
    });

    it('honors pinned slots when regenerating from an existing draft', async () => {
      // Create a draft timetable and pin one slot
      const admin = await User.findOne({ role: 'ADMIN' });
      const existingTimetable = await Timetable.create({
        title: 'Original Draft',
        termId: activeTermId,
        status: 'DRAFT',
        revision: 1,
        createdBy: admin!._id,
      });

      const off = await CourseOffering.findOne({ termId: activeTermId, isActive: true });
      const room = await Classroom.findOne({ type: 'THEORY' });

      const slotToPin = await ScheduleSlot.create({
        timetableId: existingTimetable._id,
        lineageId: crypto.randomUUID(),
        offeringId: off!._id,
        courseId: off!.courseId,
        batchId: off!.batchId,
        professorIds: off!.professorIds,
        classroomId: room!._id,
        dayOfWeek: 1,
        slotIndex: 1,
        durationSlots: 1,
        kind: 'THEORY',
        pinned: true,
        placed: true,
      });
      expect(slotToPin).toBeDefined();

      // Request regeneration based on this draft with pinned slot
      const res = await request(app)
        .post('/api/v1/timetables/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          termId: activeTermId,
          pinnedTimetableId: existingTimetable._id.toString(),
          config: { seed: 999, maxSeconds: 3 },
        });

      expect(res.status).toBe(202);
      const jobId = res.body.data.jobId;

      // Wait for completion
      let jobStatus = 'RUNNING';
      let attempts = 0;
      let finalJob: { status: string; progress: number; timetableId: { _id?: string } | string } | null = null;

      while (attempts < 30 && jobStatus === 'RUNNING') {
        await new Promise((r) => setTimeout(r, 1000));
        attempts += 1;
        const pollRes = await request(app)
          .get(`/api/v1/generation-jobs/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        finalJob = pollRes.body.data.job;
        jobStatus = finalJob?.status || '';
      }

      expect(jobStatus).toBe('DONE');

      // Verify that the new timetable contains the pinned slot at the exact same location
      const pinnedTimetableId = typeof finalJob!.timetableId === 'object' && finalJob!.timetableId !== null
        ? (finalJob!.timetableId as { _id?: string })._id
        : finalJob!.timetableId;
      const newSlots = await ScheduleSlot.find({ timetableId: pinnedTimetableId });
      const matchedSlot = newSlots.find((s) => s.lineageId === slotToPin.lineageId);
      expect(matchedSlot).toBeDefined();
      expect(matchedSlot!.pinned).toBe(true);
      expect(matchedSlot!.dayOfWeek).toBe(slotToPin.dayOfWeek);
      expect(matchedSlot!.slotIndex).toBe(slotToPin.slotIndex);
    }, 45000);
  });
});
