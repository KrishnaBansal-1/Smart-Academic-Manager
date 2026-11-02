import React, { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxWidthMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = '2xl',
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in" />
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Content
            className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl transition-all sm:rounded-2xl ${maxWidthMap[maxWidth]}`}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-900">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-sm text-slate-500">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <div className="p-5 sm:p-6">{children}</div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
