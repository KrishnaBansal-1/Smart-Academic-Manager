import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ScheduleEntry } from '../../types/schedule';
import { cancelOccurrence } from '../../api/occurrence';
import { showToast } from '../../store/toastStore';
import { getErrorMessage } from '../../lib/errors';
import { AlertTriangle, Clock, MapPin, Users } from 'lucide-react';

export interface CancelClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: ScheduleEntry | null;
  onSuccess: () => void;
}

export const CancelClassModal: React.FC<CancelClassModalProps> = ({
  isOpen,
  onClose,
  entry,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await cancelOccurrence(entry.lineageId, entry.originalDateKey, reason);
      showToast('Class occurrence cancelled successfully', 'success');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Class Occurrence"
      description="Notify students and release the booked period and classroom."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Class Details Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-sky-700">{entry.course.code}</span>
            <span className="text-xs font-semibold text-slate-500">
              Period {entry.period}
              {entry.durationSlots > 1 ? ` - ${entry.period + entry.durationSlots - 1}` : ''}
            </span>
          </div>
          <h4 className="font-bold text-slate-900">{entry.course.title}</h4>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {entry.dateKey} ({entry.startTime} - {entry.endTime})
              </span>
            </div>
            {entry.classroom && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>{entry.classroom.name}</span>
              </div>
            )}
            {entry.batch && (
              <div className="flex items-center gap-1.5 col-span-2">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <span>Section: {entry.batch.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cancellation Reason */}
        <div>
          <label htmlFor="cancel-reason" className="block text-xs font-semibold text-slate-700 mb-1">
            Reason for Cancellation (optional / required if submitted)
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Faculty medical leave / Urgent department meeting"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Keep Class
          </Button>
          <Button
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white"
            isLoading={isSubmitting}
          >
            Confirm Cancellation
          </Button>
        </div>
      </form>
    </Modal>
  );
};
