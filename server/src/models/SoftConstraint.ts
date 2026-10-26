import { Schema, model, Document, Types } from 'mongoose';

export interface ITimeWindow {
  dayOfWeek: number; // 1 (Mon) - 5 (Fri) or 6 (Sat)
  startSlot: number; // 1 to 8
  endSlot: number;   // 1 to 8
}

export interface ISoftConstraint extends Document {
  _id: Types.ObjectId;
  professorId: Types.ObjectId;
  academicYear: string;
  semester: number;
  preferredTimeWindows: ITimeWindow[];
  unavailableWindows: ITimeWindow[];
  maxDailyHours: number;
  priorityWeight: number; // 1 (low) - 5 (high)
}

const TimeWindowSchema = new Schema<ITimeWindow>(
  {
    dayOfWeek: { type: Number, required: true, min: 1, max: 7 },
    startSlot: { type: Number, required: true, min: 1, max: 12 },
    endSlot: { type: Number, required: true, min: 1, max: 12 },
  },
  { _id: false }
);

const SoftConstraintSchema = new Schema<ISoftConstraint>(
  {
    professorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    academicYear: { type: String, required: true },
    semester: { type: Number, required: true },
    preferredTimeWindows: [TimeWindowSchema],
    unavailableWindows: [TimeWindowSchema],
    maxDailyHours: { type: Number, default: 4, min: 1, max: 8 },
    priorityWeight: { type: Number, default: 3, min: 1, max: 5 },
  },
  { timestamps: true }
);

SoftConstraintSchema.index({ professorId: 1, academicYear: 1, semester: 1 }, { unique: true });

export const SoftConstraint = model<ISoftConstraint>('SoftConstraint', SoftConstraintSchema);
