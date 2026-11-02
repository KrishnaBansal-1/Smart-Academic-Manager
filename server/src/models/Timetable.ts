import { Schema, model, Document, Types } from 'mongoose';

export type TimetableStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ITimetable extends Document {
  _id: Types.ObjectId;
  title: string;
  termId?: Types.ObjectId;
  academicYear?: string;
  semester?: number;
  departmentId?: Types.ObjectId;
  status: TimetableStatus;
  revision: number;
  basedOnTimetableId?: Types.ObjectId;
  generationJobId?: Types.ObjectId;
  softScore?: number;
  generationScore?: number;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
}

const TimetableSchema = new Schema<ITimetable>(
  {
    title: { type: String, required: true, trim: true },
    termId: { type: Schema.Types.ObjectId, ref: 'AcademicTerm', index: true },
    academicYear: { type: String, trim: true },
    semester: { type: Number, min: 1, max: 12 },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    revision: { type: Number, default: 1 },
    basedOnTimetableId: { type: Schema.Types.ObjectId, ref: 'Timetable' },
    generationJobId: { type: Schema.Types.ObjectId },
    softScore: { type: Number },
    generationScore: { type: Number },
    publishedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

TimetableSchema.index({ termId: 1, status: 1 });

export const Timetable = model<ITimetable>('Timetable', TimetableSchema);
