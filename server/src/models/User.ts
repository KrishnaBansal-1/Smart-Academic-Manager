import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'ADMIN' | 'PROFESSOR' | 'STUDENT';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  rollNumber?: string;
  tokenVersion: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Don't return password by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'PROFESSOR', 'STUDENT'],
      required: [true, 'Role is required'],
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
      index: true,
    },
    rollNumber: {
      type: String,
      uppercase: true,
      trim: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        const safeRecord = ret as Record<string, unknown>;
        delete safeRecord.passwordHash;
        delete safeRecord.__v;
        return safeRecord;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Virtual for full name
UserSchema.virtual('name').get(function (this: IUser) {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Partial unique index on rollNumber (sparse/partial filter so null/undefined roll numbers for profs/admins don't conflict)
UserSchema.index(
  { rollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { rollNumber: { $type: 'string' } },
  }
);

// Method to verify candidate password
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = model<IUser>('User', UserSchema);
