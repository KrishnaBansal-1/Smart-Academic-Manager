import { Types } from 'mongoose';
import { AcademicTerm } from '../../models/AcademicTerm';
import { Classroom } from '../../models/Classroom';
import { CourseOffering } from '../../models/CourseOffering';
import { Course } from '../../models/Course';
import { Batch } from '../../models/Batch';
import { User } from '../../models/User';
import { SoftConstraint } from '../../models/SoftConstraint';
import { ScheduleSlot } from '../../models/ScheduleSlot';
import { SolverInput, SolverConfig, SolverSlot } from './types';
import { ApiError } from '../../utils/response';

export async function loadSolverInput(
  termId: string | Types.ObjectId,
  pinnedTimetableId?: string | Types.ObjectId,
  config?: SolverConfig
): Promise<SolverInput> {
  const term = await AcademicTerm.findById(termId);
  if (!term) {
    throw new ApiError(404, `Academic term not found: ${termId}`);
  }

  // 1. Working days & periods
  const workingDays = [...term.workingDays];
  const periods = term.periods.map((p) => ({
    index: p.index,
    start: p.start,
    end: p.end,
    blocked: Boolean(p.blocked),
    label: p.label || '',
  }));

  // 2. Classrooms
  const classrooms = await Classroom.find({ isActive: true });
  const rooms = classrooms.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    capacity: r.capacity,
    type: r.type,
  }));

  // 3. Active Course Offerings
  const offeringsDocs = await CourseOffering.find({ termId: term._id, isActive: true });
  if (offeringsDocs.length === 0) {
    throw new ApiError(400, 'No active course offerings found for this academic term.');
  }

  // Fetch unique batches & courses for these offerings
  const batchIds = Array.from(new Set(offeringsDocs.map((o) => o.batchId.toString())));
  const courseIds = Array.from(new Set(offeringsDocs.map((o) => o.courseId.toString())));

  const [batchesDocs, coursesDocs] = await Promise.all([
    Batch.find({ _id: { $in: batchIds } }),
    Course.find({ _id: { $in: courseIds } }),
  ]);

  const courseMap = new Map(coursesDocs.map((c) => [c._id.toString(), c]));

  // Compute student count per batch
  const batches = await Promise.all(
    batchesDocs.map(async (b) => {
      const studentCount = await User.countDocuments({
        batchId: b._id,
        role: 'STUDENT',
        isActive: true,
      });
      return {
        id: b._id.toString(),
        name: b.name,
        studentCount: Math.max(1, studentCount), // At least 1 to prevent 0-sized division
      };
    })
  );

  const offerings = offeringsDocs.map((off) => {
    const course = courseMap.get(off.courseId.toString());
    return {
      id: off._id.toString(),
      courseId: off.courseId.toString(),
      courseCode: course ? course.code : 'UNKNOWN',
      courseName: course ? course.title : undefined,
      batchId: off.batchId.toString(),
      professorIds: off.professorIds.map((p) => p.toString()),
      theoryHoursPerWeek: off.theoryHoursPerWeek,
      labBlocksPerWeek: off.labBlocksPerWeek,
      labBlockLength: off.labBlockLength,
    };
  });

  // 4. Soft constraints
  const constraintsDocs = await SoftConstraint.find({ termId: term._id });
  const constraints = constraintsDocs.map((c) => ({
    professorId: c.professorId.toString(),
    preferredWindows: c.preferredTimeWindows.map((w) => ({
      dayOfWeek: w.dayOfWeek,
      startSlot: w.startSlot,
      endSlot: w.endSlot,
    })),
    unavailableWindows: c.unavailableWindows.map((w) => ({
      dayOfWeek: w.dayOfWeek,
      startSlot: w.startSlot,
      endSlot: w.endSlot,
    })),
    maxDailyHours: c.maxDailyHours,
    priorityWeight: c.priorityWeight,
  }));

  // 5. Pinned slots (if requested)
  let pinnedSlots: SolverSlot[] = [];
  if (pinnedTimetableId) {
    const pinnedDocs = await ScheduleSlot.find({
      timetableId: pinnedTimetableId,
      pinned: true,
      placed: true,
    });
    pinnedSlots = pinnedDocs.map((s) => ({
      lineageId: s.lineageId,
      offeringId: s.offeringId ? s.offeringId.toString() : '',
      courseId: s.courseId.toString(),
      batchId: s.batchId.toString(),
      professorIds: s.professorIds.map((p) => p.toString()),
      classroomId: s.classroomId ? s.classroomId.toString() : null,
      dayOfWeek: s.dayOfWeek,
      slotIndex: s.slotIndex,
      durationSlots: s.durationSlots,
      kind: s.kind,
      pinned: true,
      placed: true,
    }));
  }

  return {
    termId: term._id.toString(),
    workingDays,
    periods,
    rooms,
    batches,
    offerings,
    constraints,
    pinnedSlots,
    config,
  };
}
