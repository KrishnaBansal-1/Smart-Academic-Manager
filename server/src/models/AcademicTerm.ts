import { Schema, model, Document, Types } from 'mongoose';
import { IPeriodGridItem, isValidDateKey } from '../utils/dateKey';

export type SemesterType = 'ODD' | 'EVEN';

export interface ITermHoliday {
  dateKey: string;
  label: string;
}

export interface ITermVersion {
  timetableId: Types.ObjectId;
  effectiveFrom: string; // dateKey
}

export interface IAcademicTerm extends Document {
  _id: Types.ObjectId;
  name: string;
  academicYear: string;
  semesterType: SemesterType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  workingDays: number[];
  periods: IPeriodGridItem[];
  holidays: ITermHoliday[];
  isActive: boolean;
  versions: ITermVersion[];
}

const TermHolidaySchema = new Schema<ITermHoliday>(
  {
    dateKey: {
      type: String,
      required: true,
      validate: {
        validator: isValidDateKey,
        message: 'Invalid dateKey for holiday',
      },
    },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const TermVersionSchema = new Schema<ITermVersion>(
  {
    timetableId: { type: Schema.Types.ObjectId, ref: 'Timetable', required: true },
    effectiveFrom: {
      type: String,
      required: true,
      validate: {
        validator: isValidDateKey,
        message: 'Invalid dateKey for version effectiveFrom',
      },
    },
  },
  { _id: false }
);

const PeriodGridSchema = new Schema<IPeriodGridItem>(
  {
    index: { type: Number, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    blocked: { type: Boolean, default: false },
    label: { type: String, required: true },
  },
  { _id: false }
);

const AcademicTermSchema = new Schema<IAcademicTerm>(
  {
    name: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true, trim: true },
    semesterType: { type: String, enum: ['ODD', 'EVEN'], required: true },
    startDate: {
      type: String,
      required: true,
      validate: {
        validator: isValidDateKey,
        message: 'Invalid startDate dateKey',
      },
    },
    endDate: {
      type: String,
      required: true,
      validate: {
        validator: isValidDateKey,
        message: 'Invalid endDate dateKey',
      },
    },
    workingDays: {
      type: [Number],
      required: true,
      validate: {
        validator: (days: number[]) =>
          days.length > 0 && days.every((d) => d >= 1 && d <= 7),
        message: 'Working days must be non-empty and between 1 (Mon) and 7 (Sun)',
      },
    },
    periods: {
      type: [PeriodGridSchema],
      required: true,
      validate: {
        validator: (periods: IPeriodGridItem[]) => periods.length > 0,
        message: 'Periods array cannot be empty',
      },
    },
    holidays: { type: [TermHolidaySchema], default: [] },
    isActive: { type: Boolean, default: false },
    versions: { type: [TermVersionSchema], default: [] },
  },
  { timestamps: true }
);

// Enforce only one active academic term at a time
AcademicTermSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

export const AcademicTerm = model<IAcademicTerm>('AcademicTerm', AcademicTermSchema);
