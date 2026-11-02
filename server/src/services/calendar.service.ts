import { Types } from 'mongoose';
import { parseISO, format, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { AcademicTerm, IAcademicTerm, ITermHoliday } from '../models/AcademicTerm';
import { Timetable } from '../models/Timetable';
import { ScheduleSlot, IScheduleSlot } from '../models/ScheduleSlot';
import { ScheduleOverride, IScheduleOverride } from '../models/ScheduleOverride';
import { MinorExam, IMinorExam } from '../models/MinorExam';
import { Classroom } from '../models/Classroom';
import { InstitutionSettings, getOrCreateSettings } from '../models/InstitutionSettings';
import { isValidDateKey, today, getISODayOfWeek, DEFAULT_TIMEZONE, IPeriodGridItem } from '../utils/dateKey';
import { ApiError } from '../utils/response';

export interface IScheduleScope {
  termId?: string | Types.ObjectId;
  batchId?: string | Types.ObjectId;
  professorId?: string | Types.ObjectId;
  roomId?: string | Types.ObjectId;
}

export type ScheduleEntryState = 'NORMAL' | 'CANCELLED' | 'MOVED_OUT' | 'MOVED_IN' | 'EXAM';

export interface IScheduleEntry {
  occurrenceId: string; // lineageId:originalDateKey
  lineageId: string;
  originalDateKey: string;
  dateKey: string;
  period: number;
  durationSlots: number;
  startTime: string;
  endTime: string;
  state: ScheduleEntryState;
  reason?: string;
  slotId?: string;
  offeringId?: string;
  course: {
    _id: string;
    code: string;
    title: string;
    name: string;
    credits?: number;
  };
  batch: {
    _id: string;
    name: string;
    section?: string;
  };
  professors: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
  }>;
  classroom: {
    _id: string;
    name: string;
    building?: string;
    roomNumber?: string;
  } | null;
  kind: 'THEORY' | 'LAB';
  exam?: {
    _id: string;
    title: string;
    syllabus?: string;
  };
}

export interface IResolvedSchedule {
  published: boolean;
  message?: string;
  term: {
    id: string;
    name: string;
    academicYear: string;
    semesterType: string;
    startDate: string;
    endDate: string;
    workingDays: number[];
    periods: IPeriodGridItem[];
    holidays: ITermHoliday[];
  } | null;
  range: {
    from: string;
    to: string;
  };
  weekOf?: string;
  entries: IScheduleEntry[];
  holidays: ITermHoliday[];
}

function formatCourse(course: any) {
  if (!course) {
    return { _id: '', code: 'UNKNOWN', title: 'Unknown Course', name: 'Unknown Course' };
  }
  const title = course.title || course.name || 'Untitled Course';
  return {
    _id: (course._id || course.id || '').toString(),
    code: course.code || '',
    title,
    name: title,
    credits: course.credits,
  };
}

function formatBatch(batch: any) {
  if (!batch) {
    return { _id: '', name: 'Unknown Section' };
  }
  return {
    _id: (batch._id || batch.id || '').toString(),
    name: batch.name || '',
    section: batch.section || batch.name || '',
  };
}

function formatProfessors(professors: any[]) {
  if (!Array.isArray(professors) || professors.length === 0) {
    return [];
  }
  return professors.map((p) => {
    const firstName = p.firstName || '';
    const lastName = p.lastName || '';
    const name = `${firstName} ${lastName}`.trim() || p.email || 'Faculty';
    return {
      _id: (p._id || p.id || '').toString(),
      firstName,
      lastName,
      name,
      email: p.email || '',
    };
  });
}

function formatClassroom(classroom: any) {
  if (!classroom) return null;
  return {
    _id: (classroom._id || classroom.id || '').toString(),
    name: classroom.name || `${classroom.building || ''} ${classroom.roomNumber || ''}`.trim(),
    building: classroom.building,
    roomNumber: classroom.roomNumber,
  };
}

function calculateClockTimes(
  period: number,
  durationSlots: number,
  grid: IPeriodGridItem[]
): { startTime: string; endTime: string } {
  const startPeriod = grid.find((p) => p.index === period);
  const endPeriod =
    grid.find((p) => p.index === period + durationSlots - 1) || startPeriod;

  return {
    startTime: startPeriod?.start || '',
    endTime: endPeriod?.end || startPeriod?.end || '',
  };
}

export class CalendarService {
  /**
   * Resolves the schedule for a given date range and scope.
   * Order: weekly slots → minus holidays → minus moved-out/cancelled → plus moved-in → plus exams
   */
  static async resolveRange(
    from: string,
    to: string,
    scope: IScheduleScope = {}
  ): Promise<IResolvedSchedule> {
    if (!isValidDateKey(from) || !isValidDateKey(to)) {
      throw new ApiError(400, 'Invalid date range: parameters must be in YYYY-MM-DD format');
    }

    if (from > to) {
      throw new ApiError(400, 'Invalid date range: "from" must be before or equal to "to"');
    }

    // 1. Find Term
    let term: IAcademicTerm | null = null;
    if (scope.termId) {
      term = await AcademicTerm.findById(scope.termId);
    } else {
      term = await AcademicTerm.findOne({ isActive: true });
    }

    if (!term) {
      return {
        published: false,
        message: 'No active academic term found',
        term: null,
        range: { from, to },
        entries: [],
        holidays: [],
      };
    }

    // 2. Check for Published Timetable versions
    let versions = term.versions || [];
    if (versions.length === 0) {
      const pubTimetable = await Timetable.findOne({
        termId: term._id,
        status: 'PUBLISHED',
      });
      if (!pubTimetable) {
        return {
          published: false,
          message: 'No published timetable for this term',
          term: {
            id: term._id.toString(),
            name: term.name,
            academicYear: term.academicYear,
            semesterType: term.semesterType,
            startDate: term.startDate,
            endDate: term.endDate,
            workingDays: term.workingDays,
            periods: term.periods,
            holidays: term.holidays,
          },
          range: { from, to },
          entries: [],
          holidays: (term.holidays || []).filter(
            (h) => h.dateKey >= from && h.dateKey <= to
          ),
        };
      }
      versions = [{ timetableId: pubTimetable._id, effectiveFrom: term.startDate }];
    }

    // Sort versions by effectiveFrom ascending
    const sortedVersions = [...versions].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom)
    );

    const timetableIds = Array.from(new Set(sortedVersions.map((v) => v.timetableId)));

    // 3. Load slots for all published versions in scope
    const slotQuery: any = {
      timetableId: { $in: timetableIds },
      placed: true,
    };
    if (scope.batchId) {
      slotQuery.batchId = scope.batchId;
    }
    if (scope.professorId) {
      slotQuery.professorIds = scope.professorId;
    }
    if (scope.roomId) {
      slotQuery.classroomId = scope.roomId;
    }

    const weeklySlots = await ScheduleSlot.find(slotQuery)
      .populate('courseId')
      .populate('batchId')
      .populate('professorIds')
      .populate('classroomId');

    // Also collect all lineages in scope
    const slotByTimetableAndLineage = new Map<string, IScheduleSlot>();
    for (const slot of weeklySlots) {
      slotByTimetableAndLineage.set(
        `${slot.timetableId.toString()}:${slot.lineageId}`,
        slot
      );
    }

    // 4. Load relevant overrides
    const overrideQuery: any = {
      $or: [
        { originalDateKey: { $gte: from, $lte: to } },
        { status: 'RESCHEDULED', 'target.dateKey': { $gte: from, $lte: to } },
      ],
    };
    const overrides = await ScheduleOverride.find(overrideQuery);

    // If there are overrides for slots not loaded in weeklySlots (e.g. reschedule into target room or batch), load them
    const missingLineages = new Set<string>();
    for (const ov of overrides) {
      let found = false;
      for (const tId of timetableIds) {
        if (slotByTimetableAndLineage.has(`${tId.toString()}:${ov.lineageId}`)) {
          found = true;
          break;
        }
      }
      if (!found) {
        missingLineages.add(ov.lineageId);
      }
    }

    if (missingLineages.size > 0) {
      const extraSlots = await ScheduleSlot.find({
        lineageId: { $in: Array.from(missingLineages) },
        placed: true,
      })
        .populate('courseId')
        .populate('batchId')
        .populate('professorIds')
        .populate('classroomId');

      for (const slot of extraSlots) {
        slotByTimetableAndLineage.set(
          `${slot.timetableId.toString()}:${slot.lineageId}`,
          slot
        );
      }
    }

    // Lookup classrooms for targets in overrides if populated
    const targetRoomIds = overrides
      .map((ov) => ov.target?.classroomId)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const targetRooms = await Classroom.find({ _id: { $in: targetRoomIds } });
    const targetRoomMap = new Map(targetRooms.map((r) => [r._id.toString(), r]));

    // Map overrides by lineageId:originalDateKey
    const overrideByLineageAndDate = new Map<string, IScheduleOverride>();
    for (const ov of overrides) {
      overrideByLineageAndDate.set(`${ov.lineageId}:${ov.originalDateKey}`, ov);
    }

    // 5. Load scheduled Minor Exams in range and scope
    const examQuery: any = {
      termId: term._id,
      status: 'SCHEDULED',
      dateKey: { $gte: from, $lte: to },
    };
    if (scope.batchId) {
      examQuery.batchId = scope.batchId;
    }
    if (scope.professorId) {
      examQuery.professorId = scope.professorId;
    }
    if (scope.roomId) {
      examQuery.classroomId = scope.roomId;
    }

    const exams = await MinorExam.find(examQuery)
      .populate('courseId')
      .populate('batchId')
      .populate('professorId')
      .populate('classroomId');

    // 6. Generate day-by-day dates
    const dateInterval = eachDayOfInterval({
      start: parseISO(from),
      end: parseISO(to),
    });
    const dateKeys = dateInterval.map((d) => format(d, 'yyyy-MM-dd'));

    const holidayMap = new Map(
      (term.holidays || []).map((h) => [h.dateKey, h.label])
    );
    const workingDaysSet = new Set(term.workingDays || []);

    const entries: IScheduleEntry[] = [];

    for (const d of dateKeys) {
      // Check term boundaries
      if (d < term.startDate || d > term.endDate) {
        continue;
      }

      const isHoliday = holidayMap.has(d);
      const dayOfWeek = getISODayOfWeek(d);
      const isWorkingDay = workingDaysSet.has(dayOfWeek);

      // A. Weekly Slots (if working day and NOT a holiday)
      if (isWorkingDay && !isHoliday) {
        // Pick applicable timetable version for date d
        let activeTimetableId = sortedVersions[0].timetableId;
        for (const ver of sortedVersions) {
          if (ver.effectiveFrom <= d) {
            activeTimetableId = ver.timetableId;
          }
        }

        // Find slots for this timetable and dayOfWeek
        for (const slot of weeklySlots) {
          if (
            slot.timetableId.toString() === activeTimetableId.toString() &&
            slot.dayOfWeek === dayOfWeek
          ) {
            const occurrenceKey = `${slot.lineageId}:${d}`;
            const override = overrideByLineageAndDate.get(occurrenceKey);

            const { startTime, endTime } = calculateClockTimes(
              slot.slotIndex,
              slot.durationSlots || 1,
              term.periods
            );

            if (!override || override.status === 'REVERTED') {
              // NORMAL
              entries.push({
                occurrenceId: occurrenceKey,
                lineageId: slot.lineageId,
                originalDateKey: d,
                dateKey: d,
                period: slot.slotIndex,
                durationSlots: slot.durationSlots || 1,
                startTime,
                endTime,
                state: 'NORMAL',
                slotId: slot._id.toString(),
                offeringId: slot.offeringId?.toString(),
                course: formatCourse(slot.courseId),
                batch: formatBatch(slot.batchId),
                professors: formatProfessors(slot.professorIds),
                classroom: formatClassroom(slot.classroomId),
                kind: slot.kind,
              });
            } else if (override.status === 'CANCELLED') {
              entries.push({
                occurrenceId: occurrenceKey,
                lineageId: slot.lineageId,
                originalDateKey: d,
                dateKey: d,
                period: slot.slotIndex,
                durationSlots: slot.durationSlots || 1,
                startTime,
                endTime,
                state: 'CANCELLED',
                reason: override.reason || 'Class cancelled',
                slotId: slot._id.toString(),
                offeringId: slot.offeringId?.toString(),
                course: formatCourse(slot.courseId),
                batch: formatBatch(slot.batchId),
                professors: formatProfessors(slot.professorIds),
                classroom: formatClassroom(slot.classroomId),
                kind: slot.kind,
              });
            } else if (override.status === 'RESCHEDULED') {
              entries.push({
                occurrenceId: occurrenceKey,
                lineageId: slot.lineageId,
                originalDateKey: d,
                dateKey: d,
                period: slot.slotIndex,
                durationSlots: slot.durationSlots || 1,
                startTime,
                endTime,
                state: 'MOVED_OUT',
                reason:
                  override.reason ||
                  (override.target
                    ? `Rescheduled to ${override.target.dateKey} (P${override.target.period})`
                    : 'Rescheduled'),
                slotId: slot._id.toString(),
                offeringId: slot.offeringId?.toString(),
                course: formatCourse(slot.courseId),
                batch: formatBatch(slot.batchId),
                professors: formatProfessors(slot.professorIds),
                classroom: formatClassroom(slot.classroomId),
                kind: slot.kind,
              });
            }
            // If ORPHANED, skip
          }
        }
      }

      // If it IS a holiday, check if any explicit source: HOLIDAY override exists to show as CANCELLED
      if (isHoliday) {
        for (const [key, override] of overrideByLineageAndDate.entries()) {
          if (override.originalDateKey === d && override.status === 'CANCELLED') {
            // Find slot
            let slot: IScheduleSlot | undefined;
            for (const tId of timetableIds) {
              const candidate = slotByTimetableAndLineage.get(`${tId.toString()}:${override.lineageId}`);
              if (candidate) {
                slot = candidate;
                break;
              }
            }
            if (slot) {
              const { startTime, endTime } = calculateClockTimes(
                slot.slotIndex,
                slot.durationSlots || 1,
                term.periods
              );
              entries.push({
                occurrenceId: key,
                lineageId: slot.lineageId,
                originalDateKey: d,
                dateKey: d,
                period: slot.slotIndex,
                durationSlots: slot.durationSlots || 1,
                startTime,
                endTime,
                state: 'CANCELLED',
                reason: override.reason || `Holiday: ${holidayMap.get(d) || 'Term Holiday'}`,
                slotId: slot._id.toString(),
                offeringId: slot.offeringId?.toString(),
                course: formatCourse(slot.courseId),
                batch: formatBatch(slot.batchId),
                professors: formatProfessors(slot.professorIds),
                classroom: formatClassroom(slot.classroomId),
                kind: slot.kind,
              });
            }
          }
        }
      }

      // B. Plus MOVED_IN (from RESCHEDULED overrides where target.dateKey === d)
      for (const override of overrides) {
        if (
          override.status === 'RESCHEDULED' &&
          override.target &&
          override.target.dateKey === d
        ) {
          // Find the slot
          let slot: IScheduleSlot | undefined;
          for (const tId of timetableIds) {
            const candidate = slotByTimetableAndLineage.get(
              `${tId.toString()}:${override.lineageId}`
            );
            if (candidate) {
              slot = candidate;
              break;
            }
          }

          if (slot) {
            // Check scope filter
            const matchesBatch =
              !scope.batchId ||
              (slot.batchId as any)._id?.toString() === scope.batchId.toString() ||
              (slot.batchId as any).toString() === scope.batchId.toString();

            const matchesProf =
              !scope.professorId ||
              (slot.professorIds || []).some(
                (p: any) =>
                  (p._id ? p._id.toString() : p.toString()) ===
                  scope.professorId!.toString()
              );

            const effectiveClassroomId =
              override.target.classroomId || (slot.classroomId as any)?._id || slot.classroomId;

            const matchesRoom =
              !scope.roomId ||
              (effectiveClassroomId &&
                effectiveClassroomId.toString() === scope.roomId.toString());

            if (matchesBatch && matchesProf && matchesRoom) {
              const targetClassroomDoc = override.target.classroomId
                ? targetRoomMap.get(override.target.classroomId.toString()) || null
                : slot.classroomId;

              const { startTime, endTime } = calculateClockTimes(
                override.target.period,
                slot.durationSlots || 1,
                term.periods
              );

              entries.push({
                occurrenceId: `${slot.lineageId}:${override.originalDateKey}`,
                lineageId: slot.lineageId,
                originalDateKey: override.originalDateKey,
                dateKey: d,
                period: override.target.period,
                durationSlots: slot.durationSlots || 1,
                startTime,
                endTime,
                state: 'MOVED_IN',
                reason:
                  override.reason ||
                  `Rescheduled from ${override.originalDateKey}`,
                slotId: slot._id.toString(),
                offeringId: slot.offeringId?.toString(),
                course: formatCourse(slot.courseId),
                batch: formatBatch(slot.batchId),
                professors: formatProfessors(slot.professorIds),
                classroom: formatClassroom(targetClassroomDoc),
                kind: slot.kind,
              });
            }
          }
        }
      }

      // C. Plus EXAMS on date d
      for (const exam of exams) {
        if (exam.dateKey === d) {
          const { startTime, endTime } = calculateClockTimes(
            exam.startPeriod,
            exam.durationSlots,
            term.periods
          );

          entries.push({
            occurrenceId: `exam:${exam._id.toString()}`,
            lineageId: `exam:${exam._id.toString()}`,
            originalDateKey: d,
            dateKey: d,
            period: exam.startPeriod,
            durationSlots: exam.durationSlots,
            startTime,
            endTime,
            state: 'EXAM',
            reason: exam.title,
            course: formatCourse(exam.courseId),
            batch: formatBatch(exam.batchId),
            professors: formatProfessors(
              exam.professorId ? [exam.professorId] : []
            ),
            classroom: formatClassroom(exam.classroomId),
            kind: 'THEORY',
            exam: {
              _id: exam._id.toString(),
              title: exam.title,
              syllabus: exam.syllabus,
            },
          });
        }
      }
    }

    // Sort entries: by dateKey, then period
    entries.sort((a, b) => {
      const dateCmp = a.dateKey.localeCompare(b.dateKey);
      if (dateCmp !== 0) return dateCmp;
      return a.period - b.period;
    });

    return {
      published: true,
      term: {
        id: term._id.toString(),
        name: term.name,
        academicYear: term.academicYear,
        semesterType: term.semesterType,
        startDate: term.startDate,
        endDate: term.endDate,
        workingDays: term.workingDays,
        periods: term.periods,
        holidays: term.holidays,
      },
      range: { from, to },
      entries,
      holidays: (term.holidays || []).filter(
        (h) => h.dateKey >= from && h.dateKey <= to
      ),
    };
  }

  /**
   * Resolves schedule for today in the institution's timezone.
   */
  static async getToday(
    scope: IScheduleScope = {},
    customTimezone?: string
  ): Promise<IResolvedSchedule> {
    let timezone = customTimezone;
    if (!timezone) {
      const settings = await getOrCreateSettings();
      timezone = settings.timezone || DEFAULT_TIMEZONE;
    }

    const todayDateKey = today(timezone);
    return CalendarService.resolveRange(todayDateKey, todayDateKey, scope);
  }

  /**
   * Resolves schedule for a given week (Monday to Sunday).
   */
  static async getWeek(
    weekOfDate?: string,
    scope: IScheduleScope = {},
    customTimezone?: string
  ): Promise<IResolvedSchedule> {
    let timezone = customTimezone;
    if (!timezone) {
      const settings = await getOrCreateSettings();
      timezone = settings.timezone || DEFAULT_TIMEZONE;
    }

    const baseDateKey = weekOfDate || today(timezone);
    if (!isValidDateKey(baseDateKey)) {
      throw new ApiError(400, `Invalid weekOf dateKey: ${baseDateKey}`);
    }

    const baseDate = parseISO(baseDateKey);
    const monday = startOfWeek(baseDate, { weekStartsOn: 1 });
    const sunday = endOfWeek(baseDate, { weekStartsOn: 1 });

    const mondayKey = format(monday, 'yyyy-MM-dd');
    const sundayKey = format(sunday, 'yyyy-MM-dd');

    const result = await CalendarService.resolveRange(mondayKey, sundayKey, scope);
    result.weekOf = mondayKey;
    return result;
  }
}
