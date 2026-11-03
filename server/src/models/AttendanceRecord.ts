import { Schema, model, Document, Types } from 'mongoose';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface IAttendanceRecord extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  termId?: Types.ObjectId;
  courseId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  dateKey?: string;
  status: AttendanceStatus;
  remarks?: string;
  markedBy: Types.ObjectId;
  counted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'AttendanceSession', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    termId: { type: Schema.Types.ObjectId, ref: 'AcademicTerm', index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', index: true },
    dateKey: { type: String, index: true },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
      required: true,
      index: true,
    },
    remarks: { type: String, trim: true },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    counted: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

// One record per student per attendance session
AttendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
AttendanceRecordSchema.index({ studentId: 1, termId: 1, courseId: 1 });

export const AttendanceRecord = model<IAttendanceRecord>('AttendanceRecord', AttendanceRecordSchema);
