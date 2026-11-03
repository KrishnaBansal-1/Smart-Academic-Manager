import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ScheduleEntry } from '../../types/schedule';
import { RescheduleOption, RescheduleOptionsResponse } from '../../types/occurrence';
import { getRescheduleOptions, rescheduleOccurrence } from '../../api/occurrence';
import { showToast } from '../../store/toastStore';
import { getErrorMessage } from '../../lib/errors';
import { format, addDays } from 'date-fns';
import { Calendar, Clock, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';

export interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: ScheduleEntry | null;
  onSuccess: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  entry,
  onSuccess,
}) => {
  const [targetDate, setTargetDate] = useState<string>('');
  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(false);
  const [optionsResult, setOptionsResult] = useState<RescheduleOptionsResponse | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [selectedRoomByPeriod, setSelectedRoomByPeriod] = useState<Record<number, string>>({});
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize target date when modal opens
  useEffect(() => {
    if (isOpen && entry) {
      // Default to next day
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      setTargetDate(tomorrow);
      setSelectedPeriod(null);
      setSelectedRoomByPeriod({});
      setReason('');
      setOptionsResult(null);
      setOptionsError(null);
    }
  }, [isOpen, entry]);

  // Fetch options when targetDate changes
  useEffect(() => {
    if (!isOpen || !entry || !targetDate) return;

    let isMounted = true;
    const fetchOptions = async () => {
      setIsLoadingOptions(true);
      setOptionsError(null);
      setSelectedPeriod(null);

      try {
        const res = await getRescheduleOptions(entry.lineageId, entry.originalDateKey, targetDate);
        if (!isMounted) return;
        setOptionsResult(res);

        // Pre-fill suggested rooms
        const roomMap: Record<number, string> = {};
        for (const opt of res.options) {
          if (opt.suggestedRoom) {
            roomMap[opt.period] = opt.suggestedRoom._id;
          } else if (opt.availableRooms.length > 0) {
            roomMap[opt.period] = opt.availableRooms[0]._id;
          }
        }
        setSelectedRoomByPeriod(roomMap);
      } catch (err: unknown) {
        if (!isMounted) return;
        setOptionsResult(null);
        setOptionsError(getErrorMessage(err));
      } finally {
        if (isMounted) setIsLoadingOptions(false);
      }
    };

    fetchOptions();
    return () => {
      isMounted = false;
    };
  }, [isOpen, entry, targetDate]);

  if (!entry) return null;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriod) {
      showToast('Please select a period slot to reschedule into', 'warning');
      return;
    }

    const classroomId = selectedRoomByPeriod[selectedPeriod];
    if (!classroomId) {
      showToast('Please select a classroom for the rescheduled period', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await rescheduleOccurrence(entry.lineageId, entry.originalDateKey, {
        targetDate,
        period: selectedPeriod,
        classroomId,
        reason: reason.trim() || undefined,
      });

      showToast('Class occurrence rescheduled successfully', 'success');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reschedule Class Occurrence"
      description="Select a collision-free target date, period, and room."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
        {/* Origin Class Details Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
          <div className="flex items-center justify-between font-medium">
            <span className="font-mono font-bold text-sky-700 text-sm">{entry.course.code}</span>
            <span className="text-slate-500">
              Original: {entry.dateKey} (Period {entry.period}
              {entry.durationSlots > 1 ? ` - ${entry.period + entry.durationSlots - 1}` : ''})
            </span>
          </div>
          <div className="mt-1 font-semibold text-slate-800 text-sm">{entry.course.title}</div>
          <div className="mt-2 flex items-center gap-4 text-slate-500">
            <span>Section: {entry.batch?.name}</span>
            {entry.classroom && <span>Room: {entry.classroom.name}</span>}
            <span>Type: {entry.kind}</span>
          </div>
        </div>

        {/* Step 1: Target Date Picker */}
        <div>
          <label htmlFor="target-date-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            1. Select Target Date
          </label>
          <div className="relative">
            <input
              id="target-date-input"
              type="date"
              min={todayStr}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
              required
            />
          </div>
        </div>

        {/* Step 2: Available Collision-Free Period Slots */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            2. Choose Available Period & Room
          </label>

          {isLoadingOptions && (
            <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
              <div className="flex flex-col items-center gap-2 text-slate-500 text-xs font-medium">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-sky-600"></div>
                <span>Checking professor, batch, and room availability...</span>
              </div>
            </div>
          )}

          {optionsError && !isLoadingOptions && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>{optionsError}</div>
            </div>
          )}

          {!isLoadingOptions && !optionsError && optionsResult && (
            <div>
              {optionsResult.options.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                  <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No Collision-Free Slots Available</p>
                  <p className="mt-1">
                    There are no unblocked periods on {targetDate} where faculty, batch, and a qualifying {entry.kind} room are all free. Please choose another date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {optionsResult.options.map((opt: RescheduleOption) => {
                    const isSelected = selectedPeriod === opt.period;
                    const selectedRoomId = selectedRoomByPeriod[opt.period] || opt.availableRooms[0]?._id;

                    return (
                      <div
                        key={opt.period}
                        onClick={() => setSelectedPeriod(opt.period)}
                        className={`cursor-pointer rounded-xl border p-3 transition text-left flex flex-col justify-between ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/70 shadow-sm ring-1 ring-sky-500'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900">
                              Period {opt.period}
                              {opt.durationSlots > 1 ? ` - ${opt.period + opt.durationSlots - 1}` : ''}
                            </span>
                            {isSelected ? (
                              <CheckCircle className="h-4 w-4 text-sky-600 shrink-0" />
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {opt.availableRooms.length} room{opt.availableRooms.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>
                              {opt.startTime} - {opt.endTime}
                            </span>
                          </div>
                        </div>

                        {/* Room Selector inside option */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mb-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span>Classroom:</span>
                          </div>
                          <select
                            value={selectedRoomId}
                            onChange={(e) => {
                              setSelectedRoomByPeriod((prev) => ({
                                ...prev,
                                [opt.period]: e.target.value,
                              }));
                              setSelectedPeriod(opt.period);
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                          >
                            {opt.availableRooms.map((rm) => (
                              <option key={rm._id} value={rm._id}>
                                {rm.name} ({rm.capacity} seats)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Optional Reason */}
        <div>
          <label htmlFor="reschedule-reason" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            3. Reason for Rescheduling (optional)
          </label>
          <input
            id="reschedule-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Compensation for Monday holiday / Faculty request"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-sky-600 hover:bg-sky-700 text-white"
            isLoading={isSubmitting}
            disabled={!selectedPeriod || isSubmitting}
          >
            Confirm Reschedule
          </Button>
        </div>
      </form>
    </Modal>
  );
};
