import { Schema, model, Document, Types } from 'mongoose';

export type TimetableStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ITimetable extends Document {
  _id: Types.ObjectId;
  title: string;
  academicYear: string;
  semester: number;
  departmentId?: Types.ObjectId;
  status: TimetableStatus;
  generationScore?: number;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
}

const TimetableSchema = new Schema<ITimetable>(
  {
    title: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1, max: 12 },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    generationScore: { type: Number },
    publishedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Timetable = model<ITimetable>('Timetable', TimetableSchema);
