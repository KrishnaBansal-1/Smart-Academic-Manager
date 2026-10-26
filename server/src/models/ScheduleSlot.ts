import { Schema, model, Document, Types } from 'mongoose';

export interface IScheduleSlot extends Document {
  _id: Types.ObjectId;
  timetableId: Types.ObjectId;
  dayOfWeek: number; // 1 to 5 (or 6)
  slotIndex: number; // 1 to 8
  durationSlots: number; // 1 for 1hr theory, 2 for 2hr lab
  courseId: Types.ObjectId;
  professorId: Types.ObjectId;
  batchId: Types.ObjectId;
  classroomId: Types.ObjectId;
}

const ScheduleSlotSchema = new Schema<IScheduleSlot>(
  {
    timetableId: { type: Schema.Types.ObjectId, ref: 'Timetable', required: true, index: true },
    dayOfWeek: { type: Number, required: true, min: 1, max: 7 },
    slotIndex: { type: Number, required: true, min: 1, max: 12 },
    durationSlots: { type: Number, default: 1, min: 1, max: 4 },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    professorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
  },
  { timestamps: true }
);

// Compound indexes enforcing database-level hard conflict integrity
ScheduleSlotSchema.index({ timetableId: 1, dayOfWeek: 1, slotIndex: 1, professorId: 1 }, { unique: true });
ScheduleSlotSchema.index({ timetableId: 1, dayOfWeek: 1, slotIndex: 1, batchId: 1 }, { unique: true });
ScheduleSlotSchema.index({ timetableId: 1, dayOfWeek: 1, slotIndex: 1, classroomId: 1 }, { unique: true });

export const ScheduleSlot = model<IScheduleSlot>('ScheduleSlot', ScheduleSlotSchema);
