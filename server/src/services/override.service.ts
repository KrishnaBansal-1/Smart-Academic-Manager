import { Types } from 'mongoose';
import { AcademicTerm, IAcademicTerm } from '../models/AcademicTerm';
import { ScheduleSlot, IScheduleSlot } from '../models/ScheduleSlot';
import { ScheduleOverride, IScheduleOverride } from '../models/ScheduleOverride';
import { Booking } from '../models/Booking';
import { Classroom, IClassroom } from '../models/Classroom';
import { User, IUser } from '../models/User';
import { AttendanceSession, IAttendanceSession } from '../models/AttendanceSession';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { AttendanceAuditLog } from '../models/AttendanceAuditLog';
import { getOrCreateSettings } from '../models/InstitutionSettings';
import { NotificationService } from './notification.service';
import { runWithTransaction } from '../utils/transaction';
import { isValidDateKey, today, getISODayOfWeek, DEFAULT_TIMEZONE, IPeriodGridItem } from '../utils/dateKey';
import { ApiError } from '../utils/response';

export interface RescheduleRoomOption {
  _id: string;
  name: string;
  building: string;
  capacity: number;
  type: string;
}

export interface RescheduleOption {
  period: number;
  durationSlots: number;
  startTime: string;
  endTime: string;
  availableRooms: RescheduleRoomOption[];
  suggestedRoom: RescheduleRoomOption | null;
}

export interface RescheduleOptionsResult {
  targetDate: string;
  durationSlots: number;
  options: RescheduleOption[];
}

export interface ActorUser {
  _id: Types.ObjectId | string;
  role: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export class OverrideService {
  /**
   * Helper: Resolves the active term and the slot for a given lineageId.
   */
  private static async getTermAndSlot(lineageId: string): Promise<{ term: IAcademicTerm; slot: IScheduleSlot }> {
    const term = await AcademicTerm.findOne({ isActive: true });
    if (!term) {
      throw new ApiError(404, 'No active academic term found');
    }

    const slot = await ScheduleSlot.findOne({
      lineageId,
      placed: true,
    })
      .populate('courseId')
      .populate('batchId')
      .populate('professorIds')
      .populate('classroomId');

    if (!slot) {
      throw new ApiError(404, `Class occurrence not found for lineage ID: ${lineageId}`);
    }

    return { term, slot };
  }

  /**
   * Helper: Checks that the actor has permission to mutate this occurrence.
   * Admin can mutate any class.
   * Professor must be one of the slot's professorIds (any co-teacher can act).
   */
  private static checkPermission(slot: IScheduleSlot, user: ActorUser): void {
    if (user.role === 'ADMIN') {
      return;
    }

    if (user.role === 'PROFESSOR') {
      const userIdStr = user._id.toString();
      const isTeacher = (slot.professorIds || []).some((p: any) => {
        const id = p._id ? p._id.toString() : p.toString();
        return id === userIdStr;
      });

      if (!isTeacher) {
        throw new ApiError(403, 'You can only cancel or reschedule classes that you teach');
      }
      return;
    }

    throw new ApiError(403, 'Forbidden: insufficient permissions');
  }

  /**
   * Helper: Validates that a target date is a valid, working, non-holiday date within the term, not in the past.
   */
  private static async validateTargetDate(term: IAcademicTerm, targetDate: string): Promise<void> {
    if (!isValidDateKey(targetDate)) {
      throw new ApiError(400, 'Invalid target date format: must be YYYY-MM-DD');
    }

    if (targetDate < term.startDate || targetDate > term.endDate) {
      throw new ApiError(
        400,
        `Target date ${targetDate} is outside academic term dates (${term.startDate} to ${term.endDate})`
      );
    }

    const settings = await getOrCreateSettings();
    const todayStr = today(settings.timezone || DEFAULT_TIMEZONE);
    if (targetDate < todayStr) {
      throw new ApiError(400, `Target date ${targetDate} cannot be in the past (today is ${todayStr})`);
    }

    const isoDay = getISODayOfWeek(targetDate);
    if (!(term.workingDays || []).includes(isoDay)) {
      throw new ApiError(400, `Target date ${targetDate} is not an official working day`);
    }

    const holiday = (term.holidays || []).find((h) => h.dateKey === targetDate);
    if (holiday) {
      throw new ApiError(400, `Target date ${targetDate} is an academic holiday (${holiday.label})`);
    }
  }

  /**
   * Cancels a class occurrence on a specific date.
   * POST /api/v1/occurrences/:lineageId/:dateKey/cancel
   */
  static async cancelOccurrence(
    lineageId: string,
    dateKey: string,
    reason: string | undefined,
    user: ActorUser
  ): Promise<{ message: string; override: IScheduleOverride }> {
    if (!isValidDateKey(dateKey)) {
      throw new ApiError(400, 'Invalid dateKey format: must be YYYY-MM-DD');
    }

    const { term, slot } = await this.getTermAndSlot(lineageId);
    this.checkPermission(slot, user);

    if (dateKey < term.startDate || dateKey > term.endDate) {
      throw new ApiError(400, `Occurrence date ${dateKey} is outside term dates`);
    }

    // Check attendance session lifecycle rule
    const existingSession = await AttendanceSession.findOne({
      lineageId,
      originalDateKey: dateKey,
    });

    if (existingSession) {
      if (existingSession.status === 'SUBMITTED' || existingSession.status === 'LOCKED') {
        if (user.role !== 'ADMIN') {
          throw new ApiError(
            403,
            'Professors cannot cancel a class whose attendance has already been submitted or locked. Please contact an administrator.'
          );
        }
        if (!reason || !reason.trim()) {
          throw new ApiError(400, 'A reason is required when an administrator cancels a submitted or locked class');
        }
      }
    }

    return await runWithTransaction(async (session) => {
      // 1. Update AttendanceSession if it exists
      if (existingSession && existingSession.status !== 'CANCELLED') {
        const prevStatus = existingSession.status;
        existingSession.statusBeforeCancel = prevStatus as 'SCHEDULED' | 'SUBMITTED' | 'LOCKED' | 'MISSED';
        existingSession.status = 'CANCELLED';
        await existingSession.save({ session });

        if (prevStatus === 'SUBMITTED' || prevStatus === 'LOCKED') {
          // Exclude records from percentage calculation
          await AttendanceRecord.updateMany(
            { sessionId: existingSession._id },
            { counted: false },
            { session }
          );

          // Write audit log
          await AttendanceAuditLog.create(
            [
              {
                sessionId: existingSession._id,
                actorId: new Types.ObjectId(user._id.toString()),
                actorRole: user.role,
                reason: reason?.trim() || 'Class cancelled by administrator',
                kind: 'CANCEL',
                oldStatus: prevStatus,
                newStatus: 'CANCELLED',
              },
            ],
            { session }
          );
        }
      }

      // 2. Release bookings
      const existingOverride = await ScheduleOverride.findOne({
        lineageId,
        originalDateKey: dateKey,
      }).session(session || null);

      if (existingOverride && existingOverride.status === 'RESCHEDULED') {
        // Release the rescheduled target bookings
        await Booking.deleteMany(
          { ownerType: 'OVERRIDE', ownerId: existingOverride._id },
          { session }
        );
      }

      // Release original weekly bookings on dateKey
      await Booking.deleteMany(
        { ownerId: slot._id, dateKey },
        { session }
      );

      // 3. Upsert ScheduleOverride
      let overrideDoc: IScheduleOverride;
      if (existingOverride) {
        existingOverride.status = 'CANCELLED';
        existingOverride.source = 'MANUAL';
        existingOverride.target = undefined;
        existingOverride.reason = reason?.trim() || 'Class cancelled';
        existingOverride.requestedBy = new Types.ObjectId(user._id.toString());
        await existingOverride.save({ session });
        overrideDoc = existingOverride;
      } else {
        const created = await ScheduleOverride.create(
          [
            {
              lineageId,
              originalDateKey: dateKey,
              originalSlotId: slot._id,
              status: 'CANCELLED',
              source: 'MANUAL',
              reason: reason?.trim() || 'Class cancelled',
              requestedBy: new Types.ObjectId(user._id.toString()),
            },
          ],
          { session }
        );
        overrideDoc = created[0];
      }

      // 4. Send Notifications
      const course = slot.courseId as any;
      const courseCode = course?.code || 'Class';
      const courseTitle = course?.title || 'Class';

      const students = await User.find({
        batchId: slot.batchId,
        role: 'STUDENT',
        isActive: true,
      });

      const recipientIds = [
        ...students.map((st) => st._id),
        ...(slot.professorIds || []).map((p: any) => p._id || p),
      ];

      await NotificationService.notify(session, recipientIds, {
        type: 'CLASS_CANCELLED',
        title: `Class Cancelled: ${courseCode}`,
        body: `${courseTitle} scheduled for ${dateKey} (Period ${slot.slotIndex}) has been cancelled${
          reason ? `: ${reason}` : ''
        }.`,
        link: '/schedule',
        dedupeKeyPrefix: `cancel:${lineageId}:${dateKey}`,
      });

      return {
        message: 'Class occurrence cancelled successfully',
        override: overrideDoc,
      };
    });
  }

  /**
   * 3-Way Finder: returns free contiguous period options on targetDate
   * where professors, batch, and qualifying room are all free from Booking.
   * GET /api/v1/occurrences/:lineageId/:dateKey/reschedule-options?targetDate=YYYY-MM-DD
   */
  static async getRescheduleOptions(
    lineageId: string,
    dateKey: string,
    targetDate: string,
    user: ActorUser
  ): Promise<RescheduleOptionsResult> {
    const { term, slot } = await this.getTermAndSlot(lineageId);
    this.checkPermission(slot, user);
    await this.validateTargetDate(term, targetDate);

    // If session is submitted/locked, professors cannot reschedule
    const existingSession = await AttendanceSession.findOne({
      lineageId,
      originalDateKey: dateKey,
    });
    if (existingSession && (existingSession.status === 'SUBMITTED' || existingSession.status === 'LOCKED')) {
      if (user.role !== 'ADMIN') {
        throw new ApiError(
          403,
          'Professors cannot reschedule a class whose attendance has already been submitted or locked'
        );
      }
    }

    const duration = slot.durationSlots || 1;
    const batchIdStr = (slot.batchId as any)._id
      ? (slot.batchId as any)._id.toString()
      : slot.batchId.toString();

    const profIds = (slot.professorIds || []).map((p: any) =>
      p._id ? p._id.toString() : p.toString()
    );

    // Find student batch size
    const studentCount = await User.countDocuments({
      batchId: slot.batchId,
      role: 'STUDENT',
      isActive: true,
    });

    const roomType = slot.kind === 'LAB' ? 'LABORATORY' : 'THEORY';

    // Find qualifying active classrooms of right type & capacity
    const qualifyingRooms = await Classroom.find({
      isActive: true,
      type: roomType,
      capacity: { $gte: Math.max(1, studentCount) },
    }).sort({ capacity: 1 });

    // Look for existing override for this occurrence (to exclude its own target bookings if it was already rescheduled to targetDate)
    const currentOverride = await ScheduleOverride.findOne({
      lineageId,
      originalDateKey: dateKey,
    });

    const bookingsOnDate = await Booking.find({ dateKey: targetDate });

    // Exclude bookings owned by this override so moving within the same day/periods does not self-collide
    const relevantBookings = bookingsOnDate.filter(
      (b) => !(currentOverride && b.ownerType === 'OVERRIDE' && b.ownerId.equals(currentOverride._id))
    );

    const busyResourcesByPeriod = new Map<number, Set<string>>();
    for (const b of relevantBookings) {
      let set = busyResourcesByPeriod.get(b.period);
      if (!set) {
        set = new Set<string>();
        busyResourcesByPeriod.set(b.period, set);
      }
      set.add(b.resourceKey);
    }

    const batchKey = `B:${batchIdStr}`;
    const profKeys = profIds.map((pid) => `P:${pid}`);

    const sortedPeriods = [...(term.periods || [])].sort((a, b) => a.index - b.index);
    const periodMap = new Map<number, IPeriodGridItem>(sortedPeriods.map((p) => [p.index, p]));

    const options: RescheduleOption[] = [];

    for (let i = 0; i <= sortedPeriods.length - duration; i += 1) {
      const startP = sortedPeriods[i].index;

      // 1. Check contiguous run of unblocked periods
      let validRun = true;
      for (let d = 0; d < duration; d += 1) {
        const periodObj = periodMap.get(startP + d);
        if (!periodObj || periodObj.blocked) {
          validRun = false;
          break;
        }
      }
      if (!validRun) continue;

      // 2. Check batch is free across all duration periods
      let batchFree = true;
      for (let d = 0; d < duration; d += 1) {
        if (busyResourcesByPeriod.get(startP + d)?.has(batchKey)) {
          batchFree = false;
          break;
        }
      }
      if (!batchFree) continue;

      // 3. Check all professors are free across all duration periods
      let profsFree = true;
      for (let d = 0; d < duration; d += 1) {
        const busySet = busyResourcesByPeriod.get(startP + d);
        if (busySet && profKeys.some((pk) => busySet.has(pk))) {
          profsFree = false;
          break;
        }
      }
      if (!profsFree) continue;

      // 4. Find all qualifying rooms free across all duration periods
      const freeRooms = qualifyingRooms.filter((room) => {
        const roomKey = `R:${room._id.toString()}`;
        for (let d = 0; d < duration; d += 1) {
          if (busyResourcesByPeriod.get(startP + d)?.has(roomKey)) {
            return false;
          }
        }
        return true;
      });

      if (freeRooms.length > 0) {
        const originalRoomId = (slot.classroomId as any)?._id
          ? (slot.classroomId as any)._id.toString()
          : slot.classroomId?.toString();

        const origRoomCandidate = originalRoomId
          ? freeRooms.find((r) => r._id.toString() === originalRoomId)
          : null;

        const suggestedRoomDoc = origRoomCandidate || freeRooms[0];
        const startPeriodObj = periodMap.get(startP)!;
        const endPeriodObj = periodMap.get(startP + duration - 1)!;

        options.push({
          period: startP,
          durationSlots: duration,
          startTime: startPeriodObj.start,
          endTime: endPeriodObj.end,
          availableRooms: freeRooms.map((r) => ({
            _id: r._id.toString(),
            name: r.name,
            building: r.building,
            capacity: r.capacity,
            type: r.type,
          })),
          suggestedRoom: {
            _id: suggestedRoomDoc._id.toString(),
            name: suggestedRoomDoc.name,
            building: suggestedRoomDoc.building,
            capacity: suggestedRoomDoc.capacity,
            type: suggestedRoomDoc.type,
          },
        });
      }
    }

    return {
      targetDate,
      durationSlots: duration,
      options,
    };
  }

  /**
   * Reschedules a class occurrence to a new date, period, and room.
   * If already rescheduled, updates the override in place in one transaction.
   * POST /api/v1/occurrences/:lineageId/:dateKey/reschedule
   */
  static async rescheduleOccurrence(
    lineageId: string,
    dateKey: string,
    params: {
      targetDate: string;
      period: number;
      classroomId: string;
      reason?: string;
    },
    user: ActorUser
  ): Promise<{ message: string; override: IScheduleOverride }> {
    if (!isValidDateKey(dateKey)) {
      throw new ApiError(400, 'Invalid dateKey format: must be YYYY-MM-DD');
    }

    const { targetDate, period, classroomId, reason } = params;

    const { term, slot } = await this.getTermAndSlot(lineageId);
    this.checkPermission(slot, user);
    await this.validateTargetDate(term, targetDate);

    // Validate period
    const duration = slot.durationSlots || 1;
    const periodMap = new Map<number, IPeriodGridItem>(
      (term.periods || []).map((p) => [p.index, p])
    );

    for (let d = 0; d < duration; d += 1) {
      const pObj = periodMap.get(period + d);
      if (!pObj) {
        throw new ApiError(400, `Period index ${period + d} does not exist in the period grid`);
      }
      if (pObj.blocked) {
        throw new ApiError(400, `Period index ${period + d} is a blocked period / break`);
      }
    }

    // Validate classroom
    if (!Types.ObjectId.isValid(classroomId)) {
      throw new ApiError(400, 'Invalid classroomId format');
    }

    const room = await Classroom.findById(classroomId);
    if (!room || !room.isActive) {
      throw new ApiError(400, 'Classroom not found or is currently inactive');
    }

    const expectedType = slot.kind === 'LAB' ? 'LABORATORY' : 'THEORY';
    if (room.type !== expectedType) {
      throw new ApiError(
        400,
        `Classroom type mismatch: ${slot.kind} class requires a ${expectedType} room, but ${room.name} is ${room.type}`
      );
    }

    const studentCount = await User.countDocuments({
      batchId: slot.batchId,
      role: 'STUDENT',
      isActive: true,
    });

    if (room.capacity < studentCount) {
      throw new ApiError(
        400,
        `Classroom capacity (${room.capacity}) is too small for batch size (${studentCount} students)`
      );
    }

    // Check attendance session lifecycle rule
    const existingSession = await AttendanceSession.findOne({
      lineageId,
      originalDateKey: dateKey,
    });
    if (existingSession && (existingSession.status === 'SUBMITTED' || existingSession.status === 'LOCKED')) {
      if (user.role !== 'ADMIN') {
        throw new ApiError(
          403,
          'Professors cannot reschedule a class whose attendance has already been submitted or locked'
        );
      }
    }

    return await runWithTransaction(async (session) => {
      // Find or create override
      let override = await ScheduleOverride.findOne({
        lineageId,
        originalDateKey: dateKey,
      }).session(session || null);

      if (!override) {
        override = new ScheduleOverride({
          lineageId,
          originalDateKey: dateKey,
          originalSlotId: slot._id,
        });
      }

      // If already rescheduled, release its previous override bookings
      if (override.status === 'RESCHEDULED') {
        await Booking.deleteMany(
          { ownerType: 'OVERRIDE', ownerId: override._id },
          { session }
        );
      } else {
        // First-time reschedule: release original weekly bookings on dateKey
        await Booking.deleteMany(
          { ownerId: slot._id, dateKey },
          { session }
        );
      }

      // Update override fields
      override.status = 'RESCHEDULED';
      override.source = 'MANUAL';
      override.target = {
        dateKey: targetDate,
        period,
        classroomId: room._id,
      };
      override.reason = reason?.trim() || undefined;
      override.requestedBy = new Types.ObjectId(user._id.toString());
      await override.save({ session });

      // Claim new bookings on targetDate
      const batchIdStr = (slot.batchId as any)._id
        ? (slot.batchId as any)._id.toString()
        : slot.batchId.toString();

      const bookingsToInsert: any[] = [];
      for (let p = period; p < period + duration; p += 1) {
        bookingsToInsert.push({
          termId: term._id,
          dateKey: targetDate,
          period: p,
          resourceKey: `B:${batchIdStr}`,
          ownerType: 'OVERRIDE',
          ownerId: override._id,
        });

        for (const prof of slot.professorIds || []) {
          const profId = (prof as any)._id ? (prof as any)._id.toString() : prof.toString();
          bookingsToInsert.push({
            termId: term._id,
            dateKey: targetDate,
            period: p,
            resourceKey: `P:${profId}`,
            ownerType: 'OVERRIDE',
            ownerId: override._id,
          });
        }

        bookingsToInsert.push({
          termId: term._id,
          dateKey: targetDate,
          period: p,
          resourceKey: `R:${room._id.toString()}`,
          ownerType: 'OVERRIDE',
          ownerId: override._id,
        });
      }

      try {
        await Booking.insertMany(bookingsToInsert, { session });
      } catch (insertErr: any) {
        if (insertErr?.code === 11000 || insertErr?.message?.includes('duplicate key') || insertErr?.message?.includes('E11000')) {
          throw new ApiError(
            409,
            `Conflict: One or more resources (batch, professor, or room) are already booked on ${targetDate} for Period ${period}`
          );
        }
        throw insertErr;
      }

      // Update AttendanceSession if exists
      if (existingSession) {
        existingSession.actualDateKey = targetDate;
        existingSession.period = period;
        existingSession.classroomId = room._id;
        await existingSession.save({ session });
      }

      // Notifications
      const course = slot.courseId as any;
      const courseCode = course?.code || 'Class';
      const courseTitle = course?.title || 'Class';

      const students = await User.find({
        batchId: slot.batchId,
        role: 'STUDENT',
        isActive: true,
      });

      const recipientIds = [
        ...students.map((st) => st._id),
        ...(slot.professorIds || []).map((p: any) => p._id || p),
      ];

      await NotificationService.notify(session, recipientIds, {
        type: 'CLASS_RESCHEDULED',
        title: `Class Rescheduled: ${courseCode}`,
        body: `${courseTitle} from ${dateKey} has been rescheduled to ${targetDate} (Period ${period}, ${room.name})${
          reason ? `: ${reason}` : ''
        }.`,
        link: '/schedule',
        dedupeKeyPrefix: `reschedule:${lineageId}:${dateKey}:${targetDate}`,
      });

      return {
        message: 'Class occurrence rescheduled successfully',
        override,
      };
    });
  }

  /**
   * Reverts a cancelled or rescheduled class occurrence back to its original schedule.
   * If the original weekly slot is now occupied by another booking, returns 409 and leaves as is.
   * POST /api/v1/occurrences/:lineageId/:dateKey/revert
   */
  static async revertOccurrence(
    lineageId: string,
    dateKey: string,
    user: ActorUser
  ): Promise<{ message: string }> {
    if (!isValidDateKey(dateKey)) {
      throw new ApiError(400, 'Invalid dateKey format: must be YYYY-MM-DD');
    }

    const { term, slot } = await this.getTermAndSlot(lineageId);
    this.checkPermission(slot, user);

    const override = await ScheduleOverride.findOne({
      lineageId,
      originalDateKey: dateKey,
    });

    if (!override || override.status === 'REVERTED') {
      return { message: 'Occurrence is already at its original schedule' };
    }

    return await runWithTransaction(async (session) => {
      const duration = slot.durationSlots || 1;
      const startP = slot.slotIndex;
      const batchIdStr = (slot.batchId as any)._id
        ? (slot.batchId as any)._id.toString()
        : slot.batchId.toString();

      const requiredKeys: string[] = [`B:${batchIdStr}`];
      for (const prof of slot.professorIds || []) {
        const profId = (prof as any)._id ? (prof as any)._id.toString() : prof.toString();
        requiredKeys.push(`P:${profId}`);
      }
      if (slot.classroomId) {
        const roomId = (slot.classroomId as any)?._id
          ? (slot.classroomId as any)._id.toString()
          : slot.classroomId.toString();
        requiredKeys.push(`R:${roomId}`);
      }

      // Check if original keys are occupied on dateKey in [startP .. startP + duration - 1]
      const conflictingBooking = await Booking.findOne({
        dateKey,
        period: { $gte: startP, $lt: startP + duration },
        resourceKey: { $in: requiredKeys },
      }).session(session || null);

      if (conflictingBooking) {
        throw new ApiError(
          409,
          `Cannot revert class: original slot on ${dateKey} (Period ${conflictingBooking.period}) is currently occupied by resource ${conflictingBooking.resourceKey}`
        );
      }

      // If it was rescheduled, release its target bookings
      if (override.status === 'RESCHEDULED') {
        await Booking.deleteMany(
          { ownerType: 'OVERRIDE', ownerId: override._id },
          { session }
        );
      }

      // Re-claim original weekly bookings on dateKey
      const weeklyBookings: any[] = [];
      for (let p = startP; p < startP + duration; p += 1) {
        weeklyBookings.push({
          termId: term._id,
          dateKey,
          period: p,
          resourceKey: `B:${batchIdStr}`,
          ownerType: 'WEEKLY',
          ownerId: slot._id,
        });

        for (const prof of slot.professorIds || []) {
          const profId = (prof as any)._id ? (prof as any)._id.toString() : prof.toString();
          weeklyBookings.push({
            termId: term._id,
            dateKey,
            period: p,
            resourceKey: `P:${profId}`,
            ownerType: 'WEEKLY',
            ownerId: slot._id,
          });
        }

        if (slot.classroomId) {
          const roomId = (slot.classroomId as any)?._id
            ? (slot.classroomId as any)._id.toString()
            : slot.classroomId.toString();
          weeklyBookings.push({
            termId: term._id,
            dateKey,
            period: p,
            resourceKey: `R:${roomId}`,
            ownerType: 'WEEKLY',
            ownerId: slot._id,
          });
        }
      }

      await Booking.insertMany(weeklyBookings, { session });

      // Update override status to REVERTED
      override.status = 'REVERTED';
      override.target = undefined;
      override.reason = undefined;
      await override.save({ session });

      // Restore AttendanceSession if cancelled
      const sessionDoc = await AttendanceSession.findOne({
        lineageId,
        originalDateKey: dateKey,
      }).session(session || null);

      if (sessionDoc) {
        if (sessionDoc.status === 'CANCELLED' && sessionDoc.statusBeforeCancel) {
          const restoredStatus = sessionDoc.statusBeforeCancel;
          sessionDoc.status = restoredStatus;
          sessionDoc.statusBeforeCancel = undefined;

          if (restoredStatus === 'SUBMITTED' || restoredStatus === 'LOCKED') {
            await AttendanceRecord.updateMany(
              { sessionId: sessionDoc._id },
              { counted: true },
              { session }
            );

            await AttendanceAuditLog.create(
              [
                {
                  sessionId: sessionDoc._id,
                  actorId: new Types.ObjectId(user._id.toString()),
                  actorRole: user.role,
                  reason: 'Class occurrence restored to original schedule',
                  kind: 'RESTORE',
                  oldStatus: 'CANCELLED',
                  newStatus: restoredStatus,
                },
              ],
              { session }
            );
          }
        }

        sessionDoc.actualDateKey = sessionDoc.originalDateKey;
        sessionDoc.period = slot.slotIndex;
        sessionDoc.classroomId = (slot.classroomId as any)?._id || slot.classroomId;
        await sessionDoc.save({ session });
      }

      // Send notifications
      const course = slot.courseId as any;
      const courseCode = course?.code || 'Class';
      const courseTitle = course?.title || 'Class';

      const students = await User.find({
        batchId: slot.batchId,
        role: 'STUDENT',
        isActive: true,
      });

      const recipientIds = [
        ...students.map((st) => st._id),
        ...(slot.professorIds || []).map((p: any) => p._id || p),
      ];

      await NotificationService.notify(session, recipientIds, {
        type: 'CLASS_RESTORED',
        title: `Class Restored: ${courseCode}`,
        body: `${courseTitle} on ${dateKey} has been restored to its original schedule (Period ${slot.slotIndex}).`,
        link: '/schedule',
        dedupeKeyPrefix: `restore:${lineageId}:${dateKey}`,
      });

      return {
        message: 'Class occurrence reverted to original schedule successfully',
      };
    });
  }
}
