import { Schema, model, Document, Types } from 'mongoose';

export type ClassroomType = 'THEORY' | 'LABORATORY';

export interface IClassroom extends Document {
  _id: Types.ObjectId;
  name: string;
  building: string;
  capacity: number;
  type: ClassroomType;
  hasProjector: boolean;
  isActive: boolean;
}

const ClassroomSchema = new Schema<IClassroom>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    building: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ['THEORY', 'LABORATORY'], default: 'THEORY', required: true },
    hasProjector: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Classroom = model<IClassroom>('Classroom', ClassroomSchema);
