import { create } from 'zustand';
import { DropMap, ScheduleSlot } from '../types';

export type ViewMode = 'BATCH' | 'PROFESSOR' | 'ROOM';

export interface EditorMoveAction {
  type: 'MOVE';
  slotId: string;
  prevDay: number;
  prevPeriod: number;
  prevRoomId?: string | null;
  newDay: number;
  newPeriod: number;
  newRoomId?: string | null;
}

export interface EditorSwapAction {
  type: 'SWAP';
  slotAId: string;
  slotBId: string;
  posA: { day: number; period: number };
  posB: { day: number; period: number };
}

export type EditorHistoryAction = EditorMoveAction | EditorSwapAction;

interface TimetableEditorState {
  viewMode: ViewMode;
  selectedEntityId: string | null;
  activeDragSlot: ScheduleSlot | null;
  dropMap: DropMap | null;
  selectedSlot: ScheduleSlot | null;
  swapModalCandidate: {
    slotA: ScheduleSlot;
    slotBId: string;
  } | null;
  publishModalOpen: boolean;
  history: EditorHistoryAction[];
  future: EditorHistoryAction[];

  setViewMode: (mode: ViewMode, entityId?: string | null) => void;
  setSelectedEntityId: (id: string | null) => void;
  startDrag: (slot: ScheduleSlot, dropMap: DropMap) => void;
  endDrag: () => void;
  setSelectedSlot: (slot: ScheduleSlot | null) => void;
  setSwapModalCandidate: (candidate: { slotA: ScheduleSlot; slotBId: string } | null) => void;
  setPublishModalOpen: (open: boolean) => void;
  recordAction: (action: EditorHistoryAction) => void;
  popUndo: () => EditorHistoryAction | undefined;
  popRedo: () => EditorHistoryAction | undefined;
  clearHistory: () => void;
}

export const useTimetableEditorStore = create<TimetableEditorState>((set, get) => ({
  viewMode: 'BATCH',
  selectedEntityId: null,
  activeDragSlot: null,
  dropMap: null,
  selectedSlot: null,
  swapModalCandidate: null,
  publishModalOpen: false,
  history: [],
  future: [],

  setViewMode: (mode, entityId = null) =>
    set({
      viewMode: mode,
      selectedEntityId: entityId,
      selectedSlot: null,
    }),

  setSelectedEntityId: (id) =>
    set({
      selectedEntityId: id,
      selectedSlot: null,
    }),

  startDrag: (slot, dropMap) =>
    set({
      activeDragSlot: slot,
      dropMap,
    }),

  endDrag: () =>
    set({
      activeDragSlot: null,
      dropMap: null,
    }),

  setSelectedSlot: (slot) =>
    set({
      selectedSlot: slot,
    }),

  setSwapModalCandidate: (candidate) =>
    set({
      swapModalCandidate: candidate,
    }),

  setPublishModalOpen: (open) =>
    set({
      publishModalOpen: open,
    }),

  recordAction: (action) =>
    set((state) => ({
      history: [...state.history, action],
      future: [],
    })),

  popUndo: () => {
    const { history, future } = get();
    if (history.length === 0) return undefined;
    const action = history[history.length - 1];
    set({
      history: history.slice(0, history.length - 1),
      future: [action, ...future],
    });
    return action;
  },

  popRedo: () => {
    const { history, future } = get();
    if (future.length === 0) return undefined;
    const action = future[0];
    set({
      history: [...history, action],
      future: future.slice(1),
    });
    return action;
  },

  clearHistory: () =>
    set({
      history: [],
      future: [],
    }),
}));
