import { Schema, model, Document, Types } from 'mongoose';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface IAttendanceRecord extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: AttendanceStatus;
  remarks?: string;
  markedBy: Types.ObjectId;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'AttendanceSession', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
      required: true,
      index: true,
    },
    remarks: { type: String, trim: true },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Unique compound index: One record per student per attendance session
AttendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

export const AttendanceRecord = model<IAttendanceRecord>('AttendanceRecord', AttendanceRecordSchema);
