import { Schema, model, Document, Types } from 'mongoose';

export interface ITimeWindow {
  dayOfWeek: number; // 1 (Mon) - 7 (Sun)
  startSlot: number; // Period index (1-based)
  endSlot: number;   // Period index (1-based)
}

export interface ISoftConstraint extends Document {
  _id: Types.ObjectId;
  professorId: Types.ObjectId;
  termId: Types.ObjectId;
  preferredTimeWindows: ITimeWindow[];
  unavailableWindows: ITimeWindow[];
  maxDailyHours: number;
  priorityWeight: number; // 1 (low) - 5 (high), admin-set
}

const TimeWindowSchema = new Schema<ITimeWindow>(
  {
    dayOfWeek: { type: Number, required: true, min: 1, max: 7 },
    startSlot: { type: Number, required: true, min: 1, max: 20 },
    endSlot: { type: Number, required: true, min: 1, max: 20 },
  },
  { _id: false }
);

TimeWindowSchema.pre('validate', function (next) {
  if (this.startSlot > this.endSlot) {
    next(new Error(`startSlot (${this.startSlot}) cannot exceed endSlot (${this.endSlot})`));
  } else {
    next();
  }
});

const SoftConstraintSchema = new Schema<ISoftConstraint>(
  {
    professorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    termId: { type: Schema.Types.ObjectId, ref: 'AcademicTerm', required: true, index: true },
    preferredTimeWindows: { type: [TimeWindowSchema], default: [] },
    unavailableWindows: { type: [TimeWindowSchema], default: [] },
    maxDailyHours: { type: Number, default: 4, min: 1, max: 12 },
    priorityWeight: { type: Number, default: 3, min: 1, max: 5 },
  },
  { timestamps: true }
);

// Unique constraint per professor per academic term
SoftConstraintSchema.index({ professorId: 1, termId: 1 }, { unique: true });

export const SoftConstraint = model<ISoftConstraint>('SoftConstraint', SoftConstraintSchema);
