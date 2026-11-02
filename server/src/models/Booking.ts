import { Schema, model, Document, Types } from 'mongoose';
import { isValidDateKey } from '../utils/dateKey';

export type BookingOwnerType = 'WEEKLY' | 'OVERRIDE' | 'EXAM';

export interface IBooking extends Document {
  _id: Types.ObjectId;
  termId: Types.ObjectId;
  dateKey: string;
  period: number;
  resourceKey: string; // 'P:<id>' | 'B:<id>' | 'R:<id>'
  ownerType: BookingOwnerType;
  ownerId: Types.ObjectId;
}

const BookingSchema = new Schema<IBooking>(
  {
    termId: { type: Schema.Types.ObjectId, ref: 'AcademicTerm', required: true, index: true },
    dateKey: {
      type: String,
      required: true,
      validate: {
        validator: isValidDateKey,
        message: 'Invalid dateKey for booking',
      },
    },
    period: { type: Number, required: true, min: 1, max: 20 },
    resourceKey: { type: String, required: true, trim: true },
    ownerType: {
      type: String,
      enum: ['WEEKLY', 'OVERRIDE', 'EXAM'],
      required: true,
    },
    ownerId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

// One arbiter of occupancy: unique index on (dateKey, period, resourceKey)
BookingSchema.index({ dateKey: 1, period: 1, resourceKey: 1 }, { unique: true });
BookingSchema.index({ termId: 1, dateKey: 1 });
BookingSchema.index({ ownerType: 1, ownerId: 1 });

export const Booking = model<IBooking>('Booking', BookingSchema);
