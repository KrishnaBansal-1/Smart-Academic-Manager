import { Schema, model, Document, Types } from 'mongoose';

export type AuditLogKind = 'EDIT' | 'ADMIN_OVERRIDE' | 'CANCEL' | 'RESTORE';

export interface IAttendanceAuditLog extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  studentId?: Types.ObjectId;
  oldStatus?: string;
  newStatus?: string;
  actorId: Types.ObjectId;
  actorRole: string;
  reason: string;
  kind: AuditLogKind;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceAuditLogSchema = new Schema<IAttendanceAuditLog>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'AttendanceSession', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User' },
    oldStatus: { type: String },
    newStatus: { type: String },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    reason: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ['EDIT', 'ADMIN_OVERRIDE', 'CANCEL', 'RESTORE'],
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

AttendanceAuditLogSchema.index({ sessionId: 1, createdAt: -1 });

export const AttendanceAuditLog = model<IAttendanceAuditLog>(
  'AttendanceAuditLog',
  AttendanceAuditLogSchema
);
