import { apiClient } from './client';
import {
  Timetable,
  ScheduleSlot,
  DropMap,
  PreflightResult,
  GenerationJob,
  TimetableValidationResult,
  ClassroomRef,
  BatchRef,
  UserRef,
} from '../types';
import { AcademicTerm } from '../types/academics';

export interface TimetableDetailsResponse {
  timetable: Timetable;
  term: AcademicTerm;
  slots: ScheduleSlot[];
  unplacedSlots: ScheduleSlot[];
}

export const timetableApi = {
  // Timetable listing & details
  listTimetables: async (termId?: string): Promise<Timetable[]> => {
    const params = termId ? { termId } : {};
    const res = await apiClient.get('/timetables', { params });
    return res.data.data;
  },

  getTimetable: async (
    id: string,
    filter?: { batchId?: string; professorId?: string; roomId?: string }
  ): Promise<TimetableDetailsResponse> => {
    const res = await apiClient.get(`/timetables/${id}`, { params: filter });
    return res.data.data;
  },

  // Drop Map
  getDropMap: async (timetableId: string, slotId: string): Promise<DropMap> => {
    const res = await apiClient.get(`/timetables/${timetableId}/slots/${slotId}/drop-map`);
    return res.data.data;
  },

  // Slot mutations
  updateSlot: async (
    timetableId: string,
    slotId: string,
    data: {
      day: number;
      period: number;
      classroomId?: string | null;
      pinned?: boolean;
      revision: number;
    }
  ): Promise<{ slot: ScheduleSlot; revision: number; softScore?: number }> => {
    const res = await apiClient.patch(`/timetables/${timetableId}/slots/${slotId}`, data);
    return res.data.data;
  },

  swapSlots: async (
    timetableId: string,
    data: { slotA: string; slotB: string; revision: number }
  ): Promise<{ slots: ScheduleSlot[]; revision: number; softScore?: number }> => {
    const res = await apiClient.post(`/timetables/${timetableId}/slots/swap`, data);
    return res.data.data;
  },

  // Timetable actions
  cloneTimetable: async (id: string): Promise<Timetable> => {
    const res = await apiClient.post(`/timetables/${id}/clone`);
    return res.data.data;
  },

  validateTimetable: async (id: string): Promise<TimetableValidationResult> => {
    const res = await apiClient.post(`/timetables/${id}/validate`);
    return res.data.data;
  },

  publishTimetable: async (
    id: string,
    data?: { effectiveFrom?: string }
  ): Promise<Timetable> => {
    const res = await apiClient.post(`/timetables/${id}/publish`, data || {});
    return res.data.data;
  },

  deleteTimetable: async (id: string): Promise<void> => {
    await apiClient.delete(`/timetables/${id}`);
  },

  // Preflight and Generation
  preflight: async (data: {
    termId: string;
    pinnedTimetableId?: string;
  }): Promise<PreflightResult> => {
    const res = await apiClient.post('/timetables/preflight', data);
    return res.data.data;
  },

  generate: async (data: {
    termId: string;
    pinnedTimetableId?: string;
    config?: { maxSeconds?: number; seed?: number; targetScore?: number };
  }): Promise<{ jobId: string }> => {
    const res = await apiClient.post('/timetables/generate', data);
    return res.data.data;
  },

  getGenerationJob: async (jobId: string): Promise<GenerationJob> => {
    const res = await apiClient.get(`/generation-jobs/${jobId}`);
    return res.data.data.job;
  },

  // Common metadata helpers
  getActiveTerm: async (): Promise<AcademicTerm | null> => {
    const res = await apiClient.get('/terms/active');
    return res.data.data;
  },

  getBatches: async (): Promise<BatchRef[]> => {
    const res = await apiClient.get('/admin/semesters');
    return res.data.data.items || res.data.data || [];
  },

  getProfessors: async (): Promise<UserRef[]> => {
    const res = await apiClient.get('/admin/professors');
    const items = res.data.data.items || res.data.data || [];
    return items.map((p: { _id: string; firstName?: string; lastName?: string; name?: string; email: string; departmentId?: string }) => ({
      ...p,
      name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email,
    }));
  },

  getClassrooms: async (): Promise<ClassroomRef[]> => {
    const res = await apiClient.get('/admin/rooms');
    return res.data.data.items || res.data.data || [];
  },
};
