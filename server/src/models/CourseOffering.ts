import { Schema, model, Document, Types } from 'mongoose';

export interface ICourseOffering extends Document {
  _id: Types.ObjectId;
  termId: Types.ObjectId;
  courseId: Types.ObjectId;
  batchId: Types.ObjectId;
  professorIds: Types.ObjectId[];
  theoryHoursPerWeek: number;
  labBlocksPerWeek: number;
  labBlockLength: number;
  isActive: boolean;
}

const CourseOfferingSchema = new Schema<ICourseOffering>(
  {
    termId: { type: Schema.Types.ObjectId, ref: 'AcademicTerm', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    professorIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    theoryHoursPerWeek: { type: Number, default: 3, min: 0 },
    labBlocksPerWeek: { type: Number, default: 0, min: 0 },
    labBlockLength: { type: Number, default: 2, min: 1, max: 4 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// One offering per course per batch in a term
CourseOfferingSchema.index({ termId: 1, courseId: 1, batchId: 1 }, { unique: true });
// Index for finding professor workload and assignments across offerings
CourseOfferingSchema.index({ termId: 1, professorIds: 1 });

export const CourseOffering = model<ICourseOffering>('CourseOffering', CourseOfferingSchema);
