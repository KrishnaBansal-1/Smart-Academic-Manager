import { Schema, model, Document, Types } from 'mongoose';
import crypto from 'crypto';
import { buildOccupancyKeys } from '../services/scheduler/occupancy';

export type ScheduleSlotKind = 'THEORY' | 'LAB';

export interface IScheduleSlot extends Document {
  _id: Types.ObjectId;
  timetableId: Types.ObjectId;
  lineageId: string;
  offeringId?: Types.ObjectId;
  courseId: Types.ObjectId;
  batchId: Types.ObjectId;
  professorIds: Types.ObjectId[];
  professorId?: Types.ObjectId; // Backwards compatibility getter/setter
  classroomId?: Types.ObjectId | null;
  dayOfWeek: number; // 1 to 7 (1 = Mon)
  slotIndex: number; // 1 to 20 (Period index)
  durationSlots: number; // 1 for 1hr theory, 2/3 for lab
  kind: ScheduleSlotKind;
  pinned: boolean;
  placed: boolean;
  unplacedReason?: string;
  occupancyKeys: string[];
}

const ScheduleSlotSchema = new Schema<IScheduleSlot>(
  {
    timetableId: { type: Schema.Types.ObjectId, ref: 'Timetable', required: true, index: true },
    lineageId: {
      type: String,
      required: true,
      default: () => crypto.randomUUID(),
      index: true,
    },
    offeringId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    professorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', default: null },
    dayOfWeek: { type: Number, required: true, min: 1, max: 7 },
    slotIndex: { type: Number, required: true, min: 1, max: 20 },
    durationSlots: { type: Number, default: 1, min: 1, max: 10 },
    kind: { type: String, enum: ['THEORY', 'LAB'], default: 'THEORY', required: true },
    pinned: { type: Boolean, default: false },
    placed: { type: Boolean, default: true, index: true },
    unplacedReason: { type: String, trim: true },
    occupancyKeys: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Virtual for legacy professorId access
ScheduleSlotSchema.virtual('professorId')
  .get(function (this: IScheduleSlot) {
    return this.professorIds && this.professorIds.length > 0 ? this.professorIds[0] : undefined;
  })
  .set(function (this: IScheduleSlot, val: Types.ObjectId) {
    if (val && !this.professorIds?.some((id) => id.toString() === val.toString())) {
      if (!this.professorIds) this.professorIds = [];
      this.professorIds.push(val);
    }
  });

// Pre-validate hook to populate defaults and occupancy keys
ScheduleSlotSchema.pre('validate', function (next) {
  if (!this.lineageId) {
    this.lineageId = crypto.randomUUID();
  }

  // Handle single professorId passed during creation
  const anyThis = this as unknown as { professorId?: Types.ObjectId };
  if (anyThis.professorId && (!this.professorIds || this.professorIds.length === 0)) {
    this.professorIds = [anyThis.professorId];
  }

  if (this.placed) {
    if (
      !this.occupancyKeys ||
      this.occupancyKeys.length === 0 ||
      this.isModified('dayOfWeek') ||
      this.isModified('slotIndex') ||
      this.isModified('durationSlots') ||
      this.isModified('classroomId') ||
      this.isModified('professorIds') ||
      this.isModified('batchId')
    ) {
      this.occupancyKeys = buildOccupancyKeys({
        professorIds: this.professorIds,
        batchId: this.batchId,
        classroomId: this.classroomId,
        dayOfWeek: this.dayOfWeek,
        slotIndex: this.slotIndex,
        durationSlots: this.durationSlots,
      });
    }
  } else {
    this.occupancyKeys = [];
  }

  next();
});

// Compound partial unique index enforcing single arbiter of occupancy on placed slots
ScheduleSlotSchema.index(
  { timetableId: 1, occupancyKeys: 1 },
  { unique: true, partialFilterExpression: { placed: true } }
);

// Additional helpful indexes
ScheduleSlotSchema.index({ timetableId: 1, batchId: 1 });
ScheduleSlotSchema.index({ timetableId: 1, professorIds: 1 });
ScheduleSlotSchema.index({ timetableId: 1, classroomId: 1 });

export const ScheduleSlot = model<IScheduleSlot>('ScheduleSlot', ScheduleSlotSchema);
