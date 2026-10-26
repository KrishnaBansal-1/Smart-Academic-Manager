import { Schema, model, Document, Types } from 'mongoose';

export interface IBatch extends Document {
  _id: Types.ObjectId;
  name: string;
  departmentId: Types.ObjectId;
  semester: number;
  academicYear: string;
  studentCount: number;
  students: Types.ObjectId[];
  isActive: boolean;
}

const BatchSchema = new Schema<IBatch>(
  {
    name: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    semester: { type: Number, required: true, min: 1, max: 12 },
    academicYear: { type: String, required: true, trim: true }, // e.g. "2026-2027"
    studentCount: { type: Number, required: true, default: 0, min: 0 },
    students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique batch name per department & academic year
BatchSchema.index({ name: 1, departmentId: 1, academicYear: 1 }, { unique: true });

export const Batch = model<IBatch>('Batch', BatchSchema);
