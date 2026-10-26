import { Schema, model, Document, Types } from 'mongoose';

export interface IDepartment extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  building?: string;
  isActive: boolean;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, uppercase: true, trim: true, unique: true },
    building: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Department = model<IDepartment>('Department', DepartmentSchema);
