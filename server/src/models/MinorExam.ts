import { Schema, model, Document, Types } from 'mongoose';

export type MinorExamStatus = 'SCHEDULED' | 'CANCELLED';

export interface IMinorExam extends Document {
  _id: Types.ObjectId;
  termId: Types.ObjectId;
  offeringId?: Types.ObjectId;
  courseId: Types.ObjectId;
  batchId: Types.ObjectId;
  professorId: Types.ObjectId;
  title: string;
  syllabus?: string;
  dateKey: string;
  startPeriod: number;
  durationSlots: number;
  classroomId?: Types.ObjectId;
  displacedOverrideIds: Types.ObjectId[];
  status: MinorExamStatus;
  cancelReason?: string;
  revision: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MinorExamSchema = new Schema<IMinorExam>(
  {
    termId: { type: Schema.Types.ObjectId, ref: 'AcademicTerm', required: true, index: true },
    offeringId: { type: Schema.Types.ObjectId, ref: 'CourseOffering', index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    professorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    syllabus: { type: String, trim: true },
    dateKey: { type: String, required: true, index: true },
    startPeriod: { type: Number, required: true, min: 1, max: 20 },
    durationSlots: { type: Number, required: true, default: 1, min: 1, max: 10 },
    classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom' },
    displacedOverrideIds: [{ type: Schema.Types.ObjectId, ref: 'ScheduleOverride' }],
    status: {
      type: String,
      enum: ['SCHEDULED', 'CANCELLED'],
      default: 'SCHEDULED',
      required: true,
      index: true,
    },
    cancelReason: { type: String, trim: true },
    revision: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

MinorExamSchema.index({ batchId: 1, dateKey: 1 });
MinorExamSchema.index({ professorId: 1, dateKey: 1 });
MinorExamSchema.index({ status: 1, dateKey: 1 });

export const MinorExam = model<IMinorExam>('MinorExam', MinorExamSchema);
