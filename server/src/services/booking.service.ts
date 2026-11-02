import { ClientSession, Types } from 'mongoose';
import { parseISO, addDays, isAfter } from 'date-fns';
import { Booking } from '../models/Booking';
import { IAcademicTerm } from '../models/AcademicTerm';
import { IScheduleSlot } from '../models/ScheduleSlot';
import { getISODayOfWeek, formatDateKey } from '../utils/dateKey';

export interface ExpandWeeklyResult {
  bookingCount: number;
  datesCount: number;
}

export class BookingService {
  /**
   * Expands weekly placed slots of a timetable into Booking documents across calendar dates
   * from effectiveFrom to term.endDate.
   */
  static async expandWeeklyToBookings(
    term: IAcademicTerm,
    slots: IScheduleSlot[],
    effectiveFrom: string,
    session?: ClientSession
  ): Promise<ExpandWeeklyResult> {
    const holidaySet = new Set<string>((term.holidays || []).map((h) => h.dateKey));
    const workingDaysSet = new Set<number>(term.workingDays || []);

    const placedSlots = slots.filter((s) => s.placed);

    // Group slots by dayOfWeek for rapid lookup
    const slotsByDay = new Map<number, IScheduleSlot[]>();
    for (const slot of placedSlots) {
      const list = slotsByDay.get(slot.dayOfWeek) || [];
      list.push(slot);
      slotsByDay.set(slot.dayOfWeek, list);
    }

    let currentDate = parseISO(effectiveFrom);
    const endDate = parseISO(term.endDate);

    const bookingsToInsert: Array<{
      termId: Types.ObjectId;
      dateKey: string;
      period: number;
      resourceKey: string;
      ownerType: 'WEEKLY';
      ownerId: Types.ObjectId;
    }> = [];

    let datesCount = 0;

    while (!isAfter(currentDate, endDate)) {
      const dateKey = formatDateKey(currentDate);
      const isoDay = getISODayOfWeek(dateKey);

      // Check if working day and not holiday
      if (workingDaysSet.has(isoDay) && !holidaySet.has(dateKey)) {
        datesCount += 1;
        const daySlots = slotsByDay.get(isoDay) || [];

        for (const slot of daySlots) {
          const duration = slot.durationSlots || 1;
          const startPeriod = slot.slotIndex;

          for (let p = startPeriod; p < startPeriod + duration; p += 1) {
            // Batch key
            bookingsToInsert.push({
              termId: term._id,
              dateKey,
              period: p,
              resourceKey: `B:${slot.batchId.toString()}`,
              ownerType: 'WEEKLY',
              ownerId: slot._id,
            });

            // Professor keys
            for (const profId of slot.professorIds || []) {
              bookingsToInsert.push({
                termId: term._id,
                dateKey,
                period: p,
                resourceKey: `P:${profId.toString()}`,
                ownerType: 'WEEKLY',
                ownerId: slot._id,
              });
            }

            // Room key
            if (slot.classroomId) {
              bookingsToInsert.push({
                termId: term._id,
                dateKey,
                period: p,
                resourceKey: `R:${slot.classroomId.toString()}`,
                ownerType: 'WEEKLY',
                ownerId: slot._id,
              });
            }
          }
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    // Delete previous WEEKLY bookings for this term from effectiveFrom onwards
    await Booking.deleteMany(
      {
        termId: term._id,
        ownerType: 'WEEKLY',
        dateKey: { $gte: effectiveFrom },
      },
      { session }
    );

    if (bookingsToInsert.length > 0) {
      // Chunk insertions if large
      const chunkSize = 1000;
      for (let i = 0; i < bookingsToInsert.length; i += chunkSize) {
        const chunk = bookingsToInsert.slice(i, i + chunkSize);
        await Booking.insertMany(chunk, { session });
      }
    }

    return {
      bookingCount: bookingsToInsert.length,
      datesCount,
    };
  }
}
