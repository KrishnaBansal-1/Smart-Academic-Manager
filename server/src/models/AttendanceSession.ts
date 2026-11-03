import { Schema, model, Document, Types } from 'mongoose';

export type SessionStatus = 'SCHEDULED' | 'SUBMITTED' | 'LOCKED' | 'MISSED' | 'CANCELLED';

export interface IAttendanceSession extends Document {
  _id: Types.ObjectId;
  lineageId: string;
  originalDateKey: string;
  termId: Types.ObjectId;
  offeringId?: Types.ObjectId;
  courseId: Types.ObjectId;
  batchId: Types.ObjectId;
  professorIds: Types.ObjectId[];
  actualDateKey: string;
  period: number;
  durationSlots: number;
  classroomId?: Types.ObjectId;
  status: SessionStatus;
  lockAt?: Date;
  submittedAt?: Date;
  submittedBy?: Types.ObjectId;
  revision: number;
  statusBeforeCancel?: 'SCHEDULED' | 'SUBMITTED' | 'LOCKED' | 'MISSED';
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    lineageId: { type: String, required: true, index: true },
    originalDateKey: { type: String, required: true, index: true },
    termId: { type: Schema.Types.ObjectId, ref: 'AcademicTerm', required: true, index: true },
    offeringId: { type: Schema.Types.ObjectId, ref: 'CourseOffering' },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    professorIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    actualDateKey: { type: String, required: true, index: true },
    period: { type: Number, required: true },
    durationSlots: { type: Number, default: 1, required: true },
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom' },
    status: {
      type: String,
      enum: ['SCHEDULED', 'SUBMITTED', 'LOCKED', 'MISSED', 'CANCELLED'],
      default: 'SCHEDULED',
      required: true,
      index: true,
    },
    lockAt: { type: Date, index: true },
    submittedAt: { type: Date },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    revision: { type: Number, default: 0 },
    statusBeforeCancel: {
      type: String,
      enum: ['SCHEDULED', 'SUBMITTED', 'LOCKED', 'MISSED'],
    },
  },
  { timestamps: true }
);

// Unique compound identity: (lineageId, originalDateKey)
AttendanceSessionSchema.index({ lineageId: 1, originalDateKey: 1 }, { unique: true });
AttendanceSessionSchema.index({ professorIds: 1, actualDateKey: 1 });
AttendanceSessionSchema.index({ batchId: 1, actualDateKey: 1 });
AttendanceSessionSchema.index({ status: 1, lockAt: 1 });

export const AttendanceSession = model<IAttendanceSession>('AttendanceSession', AttendanceSessionSchema);
