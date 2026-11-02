import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export const showToast = (message: string, type?: ToastType) => {
  useToastStore.getState().addToast(message, type);
};
