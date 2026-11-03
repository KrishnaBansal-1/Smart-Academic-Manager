import { apiClient } from './client';
import { RescheduleOptionsResponse } from '../types/occurrence';

export async function cancelOccurrence(
  lineageId: string,
  dateKey: string,
  reason?: string
): Promise<{ message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/occurrences/${lineageId}/${dateKey}/cancel`,
    { reason }
  );
  return { message: res.data.message };
}

export async function getRescheduleOptions(
  lineageId: string,
  dateKey: string,
  targetDate: string
): Promise<RescheduleOptionsResponse> {
  const res = await apiClient.get<{ success: boolean; data: RescheduleOptionsResponse }>(
    `/occurrences/${lineageId}/${dateKey}/reschedule-options?targetDate=${encodeURIComponent(targetDate)}`
  );
  return res.data.data;
}

export async function rescheduleOccurrence(
  lineageId: string,
  dateKey: string,
  data: {
    targetDate: string;
    period: number;
    classroomId: string;
    reason?: string;
  }
): Promise<{ message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/occurrences/${lineageId}/${dateKey}/reschedule`,
    data
  );
  return { message: res.data.message };
}

export async function revertOccurrence(
  lineageId: string,
  dateKey: string
): Promise<{ message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/occurrences/${lineageId}/${dateKey}/revert`
  );
  return { message: res.data.message };
}
