import { Schema, model, Document, Types } from 'mongoose';

export type GenerationJobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

export interface IGenerationJobUnplaced {
  offeringId: Types.ObjectId;
  kind: 'THEORY' | 'LAB';
  reason: string;
}

export interface IGenerationJobMetrics {
  placed: number;
  unplaced: number;
  softScore: number;
  durationMs: number;
}

export interface IGenerationJob extends Document {
  _id: Types.ObjectId;
  termId: Types.ObjectId;
  status: GenerationJobStatus;
  progress: number;
  config?: Record<string, unknown>;
  seed?: number;
  metrics: IGenerationJobMetrics;
  unplaced: IGenerationJobUnplaced[];
  timetableId?: Types.ObjectId;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GenerationJobSchema = new Schema<IGenerationJob>(
  {
    termId: { type: Schema.Types.ObjectId, ref: 'AcademicTerm', required: true },
    status: {
      type: String,
      enum: ['QUEUED', 'RUNNING', 'DONE', 'FAILED'],
      default: 'QUEUED',
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    config: { type: Schema.Types.Mixed, default: {} },
    seed: { type: Number },
    metrics: {
      placed: { type: Number, default: 0 },
      unplaced: { type: Number, default: 0 },
      softScore: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
    },
    unplaced: [
      {
        offeringId: { type: Schema.Types.ObjectId, ref: 'CourseOffering' },
        kind: { type: String, enum: ['THEORY', 'LAB'] },
        reason: { type: String, trim: true },
      },
    ],
    timetableId: { type: Schema.Types.ObjectId, ref: 'Timetable' },
    error: { type: String, trim: true },
  },
  { timestamps: true }
);

// One running generation job per academic term
GenerationJobSchema.index(
  { termId: 1 },
  { unique: true, partialFilterExpression: { status: 'RUNNING' } }
);

export const GenerationJob = model<IGenerationJob>('GenerationJob', GenerationJobSchema);
