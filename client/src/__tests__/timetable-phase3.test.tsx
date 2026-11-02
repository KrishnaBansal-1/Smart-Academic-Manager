import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { DroppableCell } from '../components/timetable/DroppableCell';
import { DraggableSlot } from '../components/timetable/DraggableSlot';
import { UnplacedTray } from '../components/timetable/UnplacedTray';
import { ViewSelector } from '../components/timetable/ViewSelector';
import { SlotDetailsPanel } from '../components/timetable/SlotDetailsPanel';
import { PublishDialog } from '../components/timetable/PublishDialog';
import { ScheduleSlot, DropMapCell, ClassroomRef } from '../types';

describe('Phase 3 Frontend Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSlot: ScheduleSlot = {
    _id: 'slot-1',
    timetableId: 'tt-1',
    lineageId: 'lin-1',
    courseId: { _id: 'c-1', code: 'CS1301', title: 'Automata Theory' },
    batchId: { _id: 'b-1', name: 'CSE III-A', semester: 5 },
    professorIds: [{ _id: 'p-1', name: 'Dr. Rimjhim Sharma', email: 'rimjhim@sam.edu' }],
    classroomId: { _id: 'r-1', name: 'C302', capacity: 90, type: 'THEORY' },
    dayOfWeek: 1,
    slotIndex: 1,
    durationSlots: 1,
    kind: 'THEORY',
    pinned: false,
    placed: true,
  };

  describe('1. DroppableCell and Drop-Map States', () => {
    it('renders GREEN state with suggested room badge during drag', () => {
      const dropMapCell: DropMapCell = {
        day: 1,
        period: 1,
        state: 'GREEN',
        suggestedRoomId: 'r-1',
        suggestedRoomName: 'C302',
        reasons: [],
        warnings: [],
      };

      render(
        <DndContext>
          <DroppableCell
            dayOfWeek={1}
            period={{ index: 1, start: '09:00', end: '10:00', label: 'P1' }}
            slots={[]}
            dropMapCell={dropMapCell}
            isDragging={true}
            viewMode="BATCH"
          />
        </DndContext>
      );

      expect(screen.getByText('C302')).toBeInTheDocument();
    });

    it('renders YELLOW state with warning badge during drag', () => {
      const dropMapCell: DropMapCell = {
        day: 1,
        period: 1,
        state: 'YELLOW',
        suggestedRoomName: 'A306',
        reasons: [],
        warnings: ['Outside Prof. preferred window'],
      };

      render(
        <DndContext>
          <DroppableCell
            dayOfWeek={1}
            period={{ index: 1, start: '09:00', end: '10:00', label: 'P1' }}
            slots={[]}
            dropMapCell={dropMapCell}
            isDragging={true}
            viewMode="BATCH"
          />
        </DndContext>
      );

      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('renders RED state with Conflict or Swap badge', () => {
      const redConflictCell: DropMapCell = {
        day: 1,
        period: 1,
        state: 'RED',
        reasons: ['Batch clash'],
        warnings: [],
        swapValid: false,
      };

      const { rerender } = render(
        <DndContext>
          <DroppableCell
            dayOfWeek={1}
            period={{ index: 1, start: '09:00', end: '10:00', label: 'P1' }}
            slots={[]}
            dropMapCell={redConflictCell}
            isDragging={true}
            viewMode="BATCH"
          />
        </DndContext>
      );

      expect(screen.getByText('Conflict')).toBeInTheDocument();

      // When swap is valid
      const redSwapCell: DropMapCell = {
        ...redConflictCell,
        swapValid: true,
        occupantSlotId: 'slot-2',
      };

      rerender(
        <DndContext>
          <DroppableCell
            dayOfWeek={1}
            period={{ index: 1, start: '09:00', end: '10:00', label: 'P1' }}
            slots={[]}
            dropMapCell={redSwapCell}
            isDragging={true}
            viewMode="BATCH"
          />
        </DndContext>
      );

      expect(screen.getByText('Swap')).toBeInTheDocument();
    });
  });

  describe('2. DraggableSlot and Keyboard Accessibility', () => {
    it('renders slot details and handles click selection', () => {
      const handleClick = vi.fn();
      render(
        <DndContext>
          <DraggableSlot
            slot={mockSlot}
            viewMode="BATCH"
            onClick={handleClick}
          />
        </DndContext>
      );

      expect(screen.getByText('CS1301')).toBeInTheDocument();
      expect(screen.getByText('Automata Theory')).toBeInTheDocument();
      expect(screen.getByText('C302')).toBeInTheDocument();

      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders lab badge and duration for multi-period lab', () => {
      const labSlot: ScheduleSlot = {
        ...mockSlot,
        kind: 'LAB',
        durationSlots: 2,
      };

      render(
        <DndContext>
          <DraggableSlot slot={labSlot} viewMode="BATCH" />
        </DndContext>
      );

      expect(screen.getByText('LAB')).toBeInTheDocument();
      expect(screen.getByText('2h')).toBeInTheDocument();
    });
  });

  describe('3. UnplacedTray Component', () => {
    it('renders empty state when zero unplaced slots', () => {
      render(<UnplacedTray unplacedSlots={[]} viewMode="BATCH" />);
      expect(screen.getByText('All classes placed!')).toBeInTheDocument();
    });

    it('renders unplaced slots with reasons and toggle collapse', () => {
      const unplaced: ScheduleSlot = {
        ...mockSlot,
        placed: false,
        unplacedReason: 'Professor unavailable',
      };

      render(<UnplacedTray unplacedSlots={[unplaced]} viewMode="BATCH" />);

      expect(screen.getByText('Unplaced Classes (1)')).toBeInTheDocument();
      expect(screen.getByText('Professor unavailable')).toBeInTheDocument();
    });
  });

  describe('4. ViewSelector Component', () => {
    it('triggers view mode and entity selection', () => {
      const onModeChange = vi.fn();
      const onEntityChange = vi.fn();

      render(
        <ViewSelector
          viewMode="BATCH"
          selectedEntityId="b-1"
          onViewModeChange={onModeChange}
          onEntityChange={onEntityChange}
          batches={[{ _id: 'b-1', name: 'CSE III-A', semester: 5 }]}
          professors={[]}
          classrooms={[]}
        />
      );

      fireEvent.click(screen.getByText('Faculty View'));
      expect(onModeChange).toHaveBeenCalledWith('PROFESSOR');

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '' } });
      expect(onEntityChange).toHaveBeenCalledWith(null);
    });
  });

  describe('5. SlotDetailsPanel Component', () => {
    const classrooms: ClassroomRef[] = [
      { _id: 'r-1', name: 'C302', capacity: 90, type: 'THEORY' },
      { _id: 'r-2', name: 'A306', capacity: 80, type: 'THEORY' },
    ];

    it('displays slot details and allows updating room', async () => {
      const onUpdateRoom = vi.fn().mockResolvedValue(undefined);
      const onTogglePin = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <SlotDetailsPanel
          slot={mockSlot}
          classrooms={classrooms}
          isPublished={false}
          onClose={onClose}
          onUpdateRoom={onUpdateRoom}
          onTogglePin={onTogglePin}
        />
      );

      expect(screen.getByText('CS1301')).toBeInTheDocument();
      expect(screen.getByText('Dr. Rimjhim Sharma')).toBeInTheDocument();

      // Change classroom
      const roomSelect = screen.getByRole('combobox');
      fireEvent.change(roomSelect, { target: { value: 'r-2' } });

      await waitFor(() => {
        expect(onUpdateRoom).toHaveBeenCalledWith('slot-1', 'r-2');
      });

      // Toggle pin
      const pinBtn = screen.getByText('Pin Slot');
      fireEvent.click(pinBtn);

      await waitFor(() => {
        expect(onTogglePin).toHaveBeenCalledWith('slot-1', true);
      });
    });
  });

  describe('6. PublishDialog Component', () => {
    const term = {
      _id: 't-1',
      name: 'Odd Semester 2026-27',
      academicYear: '2026-27',
      semesterType: 'ODD' as const,
      startDate: '2026-08-03',
      endDate: '2026-12-11',
      workingDays: [1, 2, 3, 4, 5],
      periods: [],
      holidays: [],
      isActive: true,
      versions: [],
    };

    it('blocks publish button if unplaced classes exist', () => {
      const onConfirm = vi.fn();
      render(
        <PublishDialog
          isOpen={true}
          term={term}
          unplacedCount={2}
          hasConflicts={false}
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('2 unplaced')).toBeInTheDocument();
      const publishBtn = screen.getByRole('button', { name: /publish timetable/i });
      expect(publishBtn).toBeDisabled();
    });

    it('enables publish button when valid and calls onConfirm with effective date', async () => {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(
        <PublishDialog
          isOpen={true}
          term={term}
          unplacedCount={0}
          hasConflicts={false}
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('0 (All placed)')).toBeInTheDocument();
      expect(screen.getByText('Passed (0 hard conflicts)')).toBeInTheDocument();

      const publishBtn = screen.getByRole('button', { name: /publish timetable/i });
      expect(publishBtn).not.toBeDisabled();

      fireEvent.click(publishBtn);

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalledWith('2026-08-03');
      });
    });
  });
});
