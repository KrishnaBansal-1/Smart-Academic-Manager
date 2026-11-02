import { apiClient } from './client';
import { ScheduleResponse } from '../types/schedule';

export interface ScheduleQueryParams {
  weekOf?: string;
  batchId?: string;
  professorId?: string;
  roomId?: string;
}

export async function getWeekSchedule(params?: ScheduleQueryParams): Promise<ScheduleResponse> {
  const query = new URLSearchParams();
  if (params?.weekOf) query.set('weekOf', params.weekOf);
  if (params?.batchId) query.set('batchId', params.batchId);
  if (params?.professorId) query.set('professorId', params.professorId);
  if (params?.roomId) query.set('roomId', params.roomId);

  const qs = query.toString();
  const url = qs ? `/schedule/week?${qs}` : '/schedule/week';
  const response = await apiClient.get<{ data: ScheduleResponse }>(url);
  return response.data.data;
}

export async function getTodaySchedule(params?: Omit<ScheduleQueryParams, 'weekOf'>): Promise<ScheduleResponse> {
  const query = new URLSearchParams();
  if (params?.batchId) query.set('batchId', params.batchId);
  if (params?.professorId) query.set('professorId', params.professorId);
  if (params?.roomId) query.set('roomId', params.roomId);

  const qs = query.toString();
  const url = qs ? `/schedule/today?${qs}` : '/schedule/today';
  const response = await apiClient.get<{ data: ScheduleResponse }>(url);
  return response.data.data;
}
