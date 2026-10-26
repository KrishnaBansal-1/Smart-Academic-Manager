import { Schema, model, Document, Types } from 'mongoose';

export interface ICourse extends Document {
  _id: Types.ObjectId;
  code: string;
  title: string;
  departmentId: Types.ObjectId;
  credits: number;
  weeklyTheoryHours: number;
  weeklyLabHours: number;
  isActive: boolean;
}

const CourseSchema = new Schema<ICourse>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    credits: { type: Number, required: true, min: 1 },
    weeklyTheoryHours: { type: Number, required: true, default: 3, min: 0 },
    weeklyLabHours: { type: Number, required: true, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Course = model<ICourse>('Course', CourseSchema);
