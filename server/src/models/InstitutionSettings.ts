import { Schema, model, Document } from 'mongoose';
import { IPeriodGridItem } from '../utils/dateKey';

export interface IInstitutionSettings extends Document {
  timezone: string;
  defaultWorkingDays: number[];
  defaultGrid: IPeriodGridItem[];
  attendanceGood: number;
  attendanceWarning: number;
  attendanceLockHours: number;
  minorNoticeDays: number;
  examReminderHours: number;
}

export const DEFAULT_PERIOD_GRID: IPeriodGridItem[] = [
  { index: 1, start: '09:00', end: '10:00', blocked: false, label: 'Period 1' },
  { index: 2, start: '10:00', end: '11:00', blocked: false, label: 'Period 2' },
  { index: 3, start: '11:00', end: '12:00', blocked: false, label: 'Period 3' },
  { index: 4, start: '12:00', end: '13:00', blocked: false, label: 'Period 4' },
  { index: 5, start: '13:00', end: '14:00', blocked: true, label: 'Lunch Break' },
  { index: 6, start: '14:00', end: '15:00', blocked: false, label: 'Period 5' },
  { index: 7, start: '15:00', end: '16:00', blocked: false, label: 'Period 6' },
  { index: 8, start: '16:00', end: '17:00', blocked: false, label: 'Period 7' },
];

const PeriodGridSchema = new Schema<IPeriodGridItem>(
  {
    index: { type: Number, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    blocked: { type: Boolean, default: false },
    label: { type: String, required: true },
  },
  { _id: false }
);

const InstitutionSettingsSchema = new Schema<IInstitutionSettings>(
  {
    timezone: { type: String, default: 'Asia/Kolkata', required: true },
    defaultWorkingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    defaultGrid: { type: [PeriodGridSchema], default: DEFAULT_PERIOD_GRID },
    attendanceGood: { type: Number, default: 80, min: 0, max: 100 },
    attendanceWarning: { type: Number, default: 70, min: 0, max: 100 },
    attendanceLockHours: { type: Number, default: 24, min: 1 },
    minorNoticeDays: { type: Number, default: 3, min: 0 },
    examReminderHours: { type: Number, default: 24, min: 1 },
  },
  { timestamps: true }
);

export const InstitutionSettings = model<IInstitutionSettings>(
  'InstitutionSettings',
  InstitutionSettingsSchema
);

export async function getOrCreateSettings(): Promise<IInstitutionSettings> {
  let settings = await InstitutionSettings.findOne();
  if (!settings) {
    settings = await InstitutionSettings.create({});
  }
  return settings;
}
