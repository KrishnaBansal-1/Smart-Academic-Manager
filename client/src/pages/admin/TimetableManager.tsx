import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  Send,
  Copy,
  Trash2,
  RotateCcw,
  RotateCw,
  AlertTriangle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { timetableApi } from '../../api/timetable';
import { ScheduleSlot, GenerationJob, TimetableValidationResult } from '../../types';
import { TimetableGrid } from '../../components/timetable/TimetableGrid';
import { ViewSelector } from '../../components/timetable/ViewSelector';
import { UnplacedTray } from '../../components/timetable/UnplacedTray';
import { SlotDetailsPanel } from '../../components/timetable/SlotDetailsPanel';
import { SwapConflictModal } from '../../components/timetable/SwapConflictModal';
import { PublishDialog } from '../../components/timetable/PublishDialog';
import { GenerationProgress } from '../../components/timetable/GenerationProgress';
import { useTimetableEditorStore } from '../../store/timetableEditorStore';
import { showToast } from '../../store/toastStore';
import { getErrorMessage } from '../../lib/errors';

export const TimetableManager: React.FC = () => {
  const queryClient = useQueryClient();

  const {
    viewMode,
    selectedEntityId,
    selectedSlot,
    swapModalCandidate,
    publishModalOpen,
    history,
    future,
    setViewMode,
    setSelectedEntityId,
    setSelectedSlot,
    setSwapModalCandidate,
    setPublishModalOpen,
    recordAction,
    popUndo,
    popRedo,
  } = useTimetableEditorStore();

  const [selectedTimetableId, setSelectedTimetableId] = useState<string>('');
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null);
  const [validationResult, setValidationResult] = useState<TimetableValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);

  // 1. Fetch active academic term
  const { data: term } = useQuery({
    queryKey: ['active-term'],
    queryFn: timetableApi.getActiveTerm,
  });

  // 2. Fetch all timetables for the term
  const { data: timetables = [], isLoading: loadingTimetables } = useQuery({
    queryKey: ['timetables', term?._id],
    queryFn: () => timetableApi.listTimetables(term?._id),
    enabled: Boolean(term?._id),
  });

  // Default select first timetable if none selected
  useEffect(() => {
    if (timetables.length > 0 && !selectedTimetableId) {
      setSelectedTimetableId(timetables[0]._id);
    }
  }, [timetables, selectedTimetableId]);

  // 3. Fetch current timetable details and slots
  const filterParams = {
    batchId: viewMode === 'BATCH' && selectedEntityId ? selectedEntityId : undefined,
    professorId: viewMode === 'PROFESSOR' && selectedEntityId ? selectedEntityId : undefined,
    roomId: viewMode === 'ROOM' && selectedEntityId ? selectedEntityId : undefined,
  };

  const {
    data: timetableData,
    isLoading: loadingDetails,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ['timetable-details', selectedTimetableId, filterParams],
    queryFn: () => timetableApi.getTimetable(selectedTimetableId, filterParams),
    enabled: Boolean(selectedTimetableId),
  });

  // 4. Metadata queries for selectors
  const { data: batches = [] } = useQuery({
    queryKey: ['admin-batches'],
    queryFn: timetableApi.getBatches,
  });

  const { data: professors = [] } = useQuery({
    queryKey: ['admin-professors'],
    queryFn: timetableApi.getProfessors,
  });

  const { data: classrooms = [] } = useQuery({
    queryKey: ['admin-classrooms'],
    queryFn: timetableApi.getClassrooms,
  });

  const currentTimetable = timetableData?.timetable;
  const isPublished = currentTimetable?.status === 'PUBLISHED';
  const slots = timetableData?.slots || [];
  const unplacedSlots = timetableData?.unplacedSlots || [];

  // Poll active generation job if one is running
  useEffect(() => {
    if (!activeJob || activeJob.status === 'DONE' || activeJob.status === 'FAILED') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const job = await timetableApi.getGenerationJob(activeJob._id);
        setActiveJob(job);
        if (job.status === 'DONE') {
          queryClient.invalidateQueries({ queryKey: ['timetables'] });
          const newId =
            typeof job.timetableId === 'object' && job.timetableId !== null
              ? job.timetableId._id
              : job.timetableId;
          if (newId) {
            setSelectedTimetableId(newId);
          }
          showToast('Timetable generation complete!', 'success');
        } else if (job.status === 'FAILED') {
          showToast(`Generation failed: ${job.error || 'Unknown error'}`, 'error');
        }
      } catch {
        // Keep polling
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJob, queryClient]);

  // Mutations
  const updateSlotMutation = useMutation({
    mutationFn: (variables: {
      slotId: string;
      day: number;
      period: number;
      classroomId?: string | null;
      pinned?: boolean;
    }) => {
      if (!currentTimetable) throw new Error('No timetable selected');
      return timetableApi.updateSlot(currentTimetable._id, variables.slotId, {
        day: variables.day,
        period: variables.period,
        classroomId: variables.classroomId,
        pinned: variables.pinned,
        revision: currentTimetable.revision,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timetable-details'] });
      queryClient.invalidateQueries({ queryKey: ['timetables'] });

      // Find previous slot position for undo
      const originalSlot = slots.find((s) => s._id === variables.slotId) || unplacedSlots.find((s) => s._id === variables.slotId);
      if (originalSlot) {
        recordAction({
          type: 'MOVE',
          slotId: variables.slotId,
          prevDay: originalSlot.dayOfWeek,
          prevPeriod: originalSlot.slotIndex,
          prevRoomId: originalSlot.classroomId ? originalSlot.classroomId._id : null,
          newDay: variables.day,
          newPeriod: variables.period,
          newRoomId: variables.classroomId,
        });
      }

      showToast('Slot position updated successfully', 'success');
      if (selectedSlot?._id === variables.slotId) {
        setSelectedSlot(data.slot);
      }
    },
    onError: (err) => {
      showToast(getErrorMessage(err), 'error');
      refetchDetails();
    },
  });

  const swapSlotsMutation = useMutation({
    mutationFn: (variables: { slotAId: string; slotBId: string }) => {
      if (!currentTimetable) throw new Error('No timetable selected');
      return timetableApi.swapSlots(currentTimetable._id, {
        slotA: variables.slotAId,
        slotB: variables.slotBId,
        revision: currentTimetable.revision,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timetable-details'] });
      queryClient.invalidateQueries({ queryKey: ['timetables'] });

      const slotA = slots.find((s) => s._id === variables.slotAId);
      const slotB = slots.find((s) => s._id === variables.slotBId);
      if (slotA && slotB) {
        recordAction({
          type: 'SWAP',
          slotAId: variables.slotAId,
          slotBId: variables.slotBId,
          posA: { day: slotA.dayOfWeek, period: slotA.slotIndex },
          posB: { day: slotB.dayOfWeek, period: slotB.slotIndex },
        });
      }

      setSwapModalCandidate(null);
      showToast('Classes swapped successfully', 'success');
    },
    onError: (err) => {
      showToast(getErrorMessage(err), 'error');
      refetchDetails();
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => timetableApi.cloneTimetable(id),
    onSuccess: (newDraft) => {
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
      setSelectedTimetableId(newDraft._id);
      showToast('Timetable cloned into new draft', 'success');
    },
    onError: (err) => {
      showToast(getErrorMessage(err), 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => timetableApi.deleteTimetable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
      setSelectedTimetableId('');
      showToast('Draft timetable deleted', 'success');
    },
    onError: (err) => {
      showToast(getErrorMessage(err), 'error');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (effectiveFrom: string) => {
      if (!currentTimetable) throw new Error('No timetable selected');
      return timetableApi.publishTimetable(currentTimetable._id, { effectiveFrom });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-details'] });
      setPublishModalOpen(false);
      showToast('Timetable published to the institution!', 'success');
    },
    onError: (err) => {
      showToast(getErrorMessage(err), 'error');
    },
  });

  // Handler for drop map fetch
  const handleFetchDropMap = async (slotId: string) => {
    if (!currentTimetable) throw new Error('No timetable selected');
    return timetableApi.getDropMap(currentTimetable._id, slotId);
  };

  // Handler for moving slot via Drag & Drop
  const handleMoveSlot = async (
    slot: ScheduleSlot,
    day: number,
    period: number,
    classroomId?: string | null
  ) => {
    await updateSlotMutation.mutateAsync({
      slotId: slot._id,
      day,
      period,
      classroomId: classroomId !== undefined ? classroomId : (slot.classroomId ? slot.classroomId._id : null),
    });
  };

  // Handler for room update from Details Panel
  const handleUpdateRoom = async (slotId: string, classroomId: string | null) => {
    const targetSlot = slots.find((s) => s._id === slotId);
    if (!targetSlot) return;
    await updateSlotMutation.mutateAsync({
      slotId,
      day: targetSlot.dayOfWeek,
      period: targetSlot.slotIndex,
      classroomId,
    });
  };

  // Handler for pin toggle
  const handleTogglePin = async (slotId: string, pinned: boolean) => {
    const targetSlot = slots.find((s) => s._id === slotId);
    if (!targetSlot) return;
    await updateSlotMutation.mutateAsync({
      slotId,
      day: targetSlot.dayOfWeek,
      period: targetSlot.slotIndex,
      pinned,
    });
  };

  // Validation handler
  const handleValidate = async () => {
    if (!currentTimetable) return;
    try {
      setIsValidating(true);
      const res = await timetableApi.validateTimetable(currentTimetable._id);
      setValidationResult(res);
      if (res.valid) {
        showToast('Timetable valid! Zero hard conflicts detected.', 'success');
      } else {
        showToast(
          `Validation failed: ${res.violations.length} conflict(s), ${res.unplacedCount} unplaced`,
          'warning'
        );
      }
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // Generator handler
  const handleStartGenerate = async () => {
    if (!term) {
      showToast('No active term found to generate timetable', 'error');
      return;
    }

    try {
      setPreflightErrors([]);
      const preflight = await timetableApi.preflight({
        termId: term._id,
        pinnedTimetableId: currentTimetable ? currentTimetable._id : undefined,
      });

      if (!preflight.valid) {
        setPreflightErrors(preflight.errors);
        showToast('Preflight check failed. Please resolve setup issues.', 'error');
        return;
      }

      const res = await timetableApi.generate({
        termId: term._id,
        pinnedTimetableId: currentTimetable ? currentTimetable._id : undefined,
        config: { maxSeconds: 60 },
      });

      setActiveJob({
        _id: res.jobId,
        termId: term._id,
        status: 'RUNNING',
        progress: 0,
      });
      showToast('Timetable generation job initiated!', 'info');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  // Undo / Redo handlers
  const handleUndo = async () => {
    const action = popUndo();
    if (!action || !currentTimetable) return;

    if (action.type === 'MOVE') {
      await updateSlotMutation.mutateAsync({
        slotId: action.slotId,
        day: action.prevDay,
        period: action.prevPeriod,
        classroomId: action.prevRoomId,
      });
    } else if (action.type === 'SWAP') {
      await swapSlotsMutation.mutateAsync({
        slotAId: action.slotAId,
        slotBId: action.slotBId,
      });
    }
  };

  const handleRedo = async () => {
    const action = popRedo();
    if (!action || !currentTimetable) return;

    if (action.type === 'MOVE') {
      await updateSlotMutation.mutateAsync({
        slotId: action.slotId,
        day: action.newDay,
        period: action.newPeriod,
        classroomId: action.newRoomId,
      });
    } else if (action.type === 'SWAP') {
      await swapSlotsMutation.mutateAsync({
        slotAId: action.slotAId,
        slotBId: action.slotBId,
      });
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Preflight Error Banner */}
      {preflightErrors.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Preflight Check Failed ({preflightErrors.length} errors)
            </span>
            <button
              type="button"
              onClick={() => setPreflightErrors([])}
              className="text-rose-700 hover:text-rose-950 font-semibold"
            >
              Dismiss
            </button>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {preflightErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Result Summary Banner */}
      {validationResult && (
        <div
          className={`rounded-xl border p-4 text-xs shadow-xs space-y-2 ${
            validationResult.valid
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {validationResult.valid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              <span className="font-bold">
                {validationResult.valid
                  ? 'Timetable Validation: Passed (100% Valid)'
                  : `Timetable Validation: ${validationResult.violations.length} Violation(s)`}
              </span>
              {validationResult.softScore !== undefined && (
                <span className="rounded bg-white/80 px-2 py-0.5 font-bold shadow-2xs">
                  Score: {validationResult.softScore}%
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setValidationResult(null)}
              className="font-semibold text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>

          {validationResult.violations.length > 0 && (
            <div>
              <div className="font-semibold text-rose-800">Hard Violations:</div>
              <ul className="list-disc pl-5 space-y-0.5 text-rose-700">
                {validationResult.violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div>
              <div className="font-semibold text-amber-800">Soft Warnings:</div>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-700">
                {validationResult.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Main Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        {/* Left: Draft Selector and Status */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Calendar className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">Timetable Visual Editor</h1>
              {currentTimetable && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isPublished
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {currentTimetable.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {term ? `${term.name} (${term.academicYear})` : 'Select or generate a timetable'}
            </p>
          </div>

          {/* Timetable Dropdown Selector */}
          <div className="ml-2">
            <select
              value={selectedTimetableId}
              onChange={(e) => setSelectedTimetableId(e.target.value)}
              disabled={loadingTimetables}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500 min-w-[220px]"
            >
              {timetables.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.title} [v{t.revision}] - {t.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Actions (Generate, Score, Validate, Undo/Redo, Publish) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Soft Score Badge */}
          {currentTimetable?.softScore !== undefined && (
            <div
              className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
              title="Soft constraint optimization score"
            >
              <span>Score:</span>
              <span className="font-bold text-emerald-600 font-mono">
                {currentTimetable.softScore}%
              </span>
            </div>
          )}

          {/* Undo / Redo */}
          {!isPublished && (
            <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs">
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0}
                className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 transition-colors"
                title="Undo last move"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <button
                type="button"
                onClick={handleRedo}
                disabled={future.length === 0}
                className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-30 transition-colors"
                title="Redo move"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleStartGenerate}
            disabled={activeJob?.status === 'RUNNING'}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate</span>
          </button>

          {/* Validate Button */}
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating || !currentTimetable}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            {isValidating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>Validate</span>
          </button>

          {/* Clone / New Draft Button */}
          {currentTimetable && (
            <button
              type="button"
              onClick={() => cloneMutation.mutate(currentTimetable._id)}
              disabled={cloneMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Clone into a new editable draft"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Clone Draft</span>
            </button>
          )}

          {/* Delete Draft Button (Drafts only) */}
          {currentTimetable && !isPublished && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this draft timetable?')) {
                  deleteMutation.mutate(currentTimetable._id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white p-2 text-rose-600 hover:bg-rose-50 transition-colors"
              title="Delete draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Publish Button */}
          {currentTimetable && !isPublished && (
            <button
              type="button"
              onClick={() => setPublishModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publish</span>
            </button>
          )}
        </div>
      </div>

      {/* View Selector (Section, Faculty, Room) */}
      <ViewSelector
        viewMode={viewMode}
        selectedEntityId={selectedEntityId}
        onViewModeChange={(m) => setViewMode(m, null)}
        onEntityChange={(id) => setSelectedEntityId(id)}
        batches={batches}
        professors={professors}
        classrooms={classrooms}
        slotCount={slots.length}
      />

      {/* Main Timetable Grid or Empty State */}
      {loadingDetails ? (
        <div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-slate-500 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin text-sky-600" />
            <span>Loading academic timetable grid...</span>
          </div>
        </div>
      ) : currentTimetable && term ? (
        <TimetableGrid
          timetableId={currentTimetable._id}
          isPublished={isPublished}
          term={term}
          slots={slots}
          onFetchDropMap={handleFetchDropMap}
          onMoveSlot={handleMoveSlot}
          onSlotClick={(s) => setSelectedSlot(s)}
          onSwapConflict={(slotA, slotBId) =>
            setSwapModalCandidate({ slotA, slotBId })
          }
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600 mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Timetable Selected</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Select an existing draft from the dropdown or click Generate to create a conflict-free timetable draft.
          </p>
          <button
            type="button"
            onClick={handleStartGenerate}
            className="mt-4 flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Draft</span>
          </button>
        </div>
      )}

      {/* Unplaced Classes Tray */}
      {currentTimetable && (
        <UnplacedTray
          unplacedSlots={unplacedSlots}
          viewMode={viewMode}
          disabled={isPublished}
          onSlotClick={(s) => setSelectedSlot(s)}
        />
      )}

      {/* Slot Details Slide-over Panel */}
      <SlotDetailsPanel
        slot={selectedSlot}
        classrooms={classrooms}
        isPublished={isPublished}
        onClose={() => setSelectedSlot(null)}
        onUpdateRoom={handleUpdateRoom}
        onTogglePin={handleTogglePin}
      />

      {/* Swap Conflict Resolution Modal */}
      {swapModalCandidate && (
        <SwapConflictModal
          isOpen={Boolean(swapModalCandidate)}
          slotA={swapModalCandidate.slotA}
          slotB={slots.find((s) => s._id === swapModalCandidate.slotBId) || null}
          isSubmitting={swapSlotsMutation.isPending}
          onConfirm={() =>
            swapSlotsMutation.mutate({
              slotAId: swapModalCandidate.slotA._id,
              slotBId: swapModalCandidate.slotBId,
            })
          }
          onClose={() => setSwapModalCandidate(null)}
        />
      )}

      {/* Publish Dialog */}
      <PublishDialog
        isOpen={publishModalOpen}
        term={term || null}
        unplacedCount={unplacedSlots.length}
        hasConflicts={Boolean(validationResult && !validationResult.valid)}
        isSubmitting={publishMutation.isPending}
        onConfirm={async (effectiveFrom) => {
          await publishMutation.mutateAsync(effectiveFrom);
        }}
        onClose={() => setPublishModalOpen(false)}
      />

      {/* Generation Progress Modal */}
      <GenerationProgress
        job={activeJob}
        onClose={() => setActiveJob(null)}
        onViewDraft={(newId) => {
          setActiveJob(null);
          setSelectedTimetableId(newId);
        }}
      />
    </div>
  );
};
