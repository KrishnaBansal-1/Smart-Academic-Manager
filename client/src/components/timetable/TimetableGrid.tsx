import React, { useEffect, useState } from 'react';
import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { Monitor, AlertCircle } from 'lucide-react';
import { ScheduleSlot, DropMap } from '../../types';
import { AcademicTerm, IPeriodGridItem } from '../../types/academics';
import { TimetableGridShell } from './TimetableGridShell';
import { DroppableCell } from './DroppableCell';
import { DraggableSlot } from './DraggableSlot';
import { useTimetableEditorStore } from '../../store/timetableEditorStore';

interface TimetableGridProps {
  timetableId: string;
  isPublished: boolean;
  term: AcademicTerm;
  slots: ScheduleSlot[];
  onFetchDropMap: (slotId: string) => Promise<DropMap>;
  onMoveSlot: (
    slot: ScheduleSlot,
    day: number,
    period: number,
    classroomId?: string | null
  ) => Promise<void>;
  onSlotClick?: (slot: ScheduleSlot) => void;
  onSwapConflict?: (slotA: ScheduleSlot, slotBId: string) => void;
}

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  timetableId: _timetableId,
  isPublished,
  term,
  slots,
  onFetchDropMap,
  onMoveSlot,
  onSlotClick,
  onSwapConflict,
}) => {
  const {
    viewMode,
    selectedEntityId,
    activeDragSlot,
    dropMap,
    startDrag,
    endDrag,
  } = useTimetableEditorStore();

  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = async (event: DragStartEvent) => {
    if (isPublished || !isDesktop) return;
    const slot = event.active.data.current?.slot as ScheduleSlot | undefined;
    if (!slot) return;

    try {
      const computedDropMap = await onFetchDropMap(slot._id);
      startDrag(slot, computedDropMap);
    } catch {
      endDrag();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    const slot = active.data.current?.slot as ScheduleSlot | undefined;

    if (!over || !slot || !dropMap) {
      endDrag();
      return;
    }

    const overData = over.data.current as { dayOfWeek: number; periodIndex: number } | undefined;
    if (!overData) {
      endDrag();
      return;
    }

    const { dayOfWeek, periodIndex } = overData;
    const cellKey = `${dayOfWeek}:${periodIndex}`;
    const cellState = dropMap[cellKey];

    if (!cellState) {
      endDrag();
      return;
    }

    if (cellState.state === 'GREEN' || cellState.state === 'YELLOW') {
      await onMoveSlot(slot, dayOfWeek, periodIndex, cellState.suggestedRoomId);
    } else if (cellState.state === 'RED' && cellState.swapValid && cellState.occupantSlotId) {
      if (onSwapConflict) {
        onSwapConflict(slot, cellState.occupantSlotId);
      }
    }

    endDrag();
  };

  // Group slots by dayOfWeek and slotIndex
  // For multi-period slots, we place them at their starting slotIndex
  const slotsByDayAndPeriod = new Map<string, ScheduleSlot[]>();
  for (const s of slots) {
    if (!s.placed) continue;
    const key = `${s.dayOfWeek}:${s.slotIndex}`;
    const list = slotsByDayAndPeriod.get(key) || [];
    list.push(s);
    slotsByDayAndPeriod.set(key, list);
  }

  const isDragDisabled = isPublished || !isDesktop;

  return (
    <div className="space-y-3">
      {/* Read-only mobile / tablet banner */}
      {!isDesktop && (
        <div className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-xs text-sky-800 shadow-xs">
          <Monitor className="w-4 h-4 text-sky-600 shrink-0" />
          <span className="font-semibold">Desktop Mode Required:</span>
          <span>
            The visual drag-and-drop editor is optimized for screens 1024px and above. The timetable is currently in view-only mode.
          </span>
        </div>
      )}

      {isPublished && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 shadow-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-semibold">Published Timetable:</span>
          <span>
            This timetable is published and locked. To modify placement, clone it into a new draft.
          </span>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <TimetableGridShell
          workingDays={term.workingDays}
          periods={term.periods}
          renderCell={(dayOfWeek: number, period: IPeriodGridItem) => {
            const cellKey = `${dayOfWeek}:${period.index}`;
            const cellSlots = slotsByDayAndPeriod.get(cellKey) || [];
            const cellDropState = dropMap ? dropMap[cellKey] : undefined;

            // In filtered entity view (single Section/Faculty/Room), if a slot spans multiple periods,
            // we use colSpan so it visually spans across the columns!
            if (selectedEntityId && cellSlots.length > 0 && cellSlots[0].durationSlots > 1) {
              const span = cellSlots[0].durationSlots;
              return {
                content: (
                  <DroppableCell
                    key={cellKey}
                    dayOfWeek={dayOfWeek}
                    period={period}
                    slots={cellSlots}
                    dropMapCell={cellDropState}
                    isDragging={Boolean(activeDragSlot)}
                    viewMode={viewMode}
                    selectedEntityId={selectedEntityId}
                    disabled={isDragDisabled}
                    onSlotClick={onSlotClick}
                  />
                ),
                colSpan: span,
              };
            }

            // In All Sections view or single-slot cells, check if any multi-period slot is currently continuing across this period
            const ongoingSlots = slots.filter(
              (s) =>
                s.placed &&
                s.dayOfWeek === dayOfWeek &&
                s.durationSlots > 1 &&
                period.index > s.slotIndex &&
                period.index < s.slotIndex + s.durationSlots
            );

            return (
              <DroppableCell
                key={cellKey}
                dayOfWeek={dayOfWeek}
                period={period}
                slots={cellSlots}
                ongoingSlots={ongoingSlots}
                dropMapCell={cellDropState}
                isDragging={Boolean(activeDragSlot)}
                viewMode={viewMode}
                selectedEntityId={selectedEntityId}
                disabled={isDragDisabled}
                onSlotClick={onSlotClick}
              />
            );
          }}
        />

        {/* Drag Overlay for smooth preview */}
        <DragOverlay>
          {activeDragSlot ? (
            <div className="w-[180px]">
              <DraggableSlot
                slot={activeDragSlot}
                viewMode={viewMode}
                selectedEntityId={selectedEntityId}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
