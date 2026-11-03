import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CancelClassModal } from '../components/timetable/CancelClassModal';
import { RescheduleModal } from '../components/timetable/RescheduleModal';
import * as occurrenceApi from '../api/occurrence';
import { ScheduleEntry } from '../types/schedule';

vi.mock('../api/occurrence', () => ({
  cancelOccurrence: vi.fn(),
  getRescheduleOptions: vi.fn(),
  rescheduleOccurrence: vi.fn(),
  revertOccurrence: vi.fn(),
}));

describe('Phase 6 Client: Cancel and Reschedule Modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEntry: ScheduleEntry = {
    occurrenceId: 'LIN-CS1301-MON:2026-08-10',
    lineageId: 'LIN-CS1301-MON',
    originalDateKey: '2026-08-10',
    dateKey: '2026-08-10',
    period: 2,
    durationSlots: 1,
    startTime: '10:00',
    endTime: '11:00',
    state: 'NORMAL',
    course: {
      _id: 'c1',
      code: 'CS1301',
      title: 'Formal Languages and Automata Theory',
      name: 'Formal Languages and Automata Theory',
    },
    batch: {
      _id: 'b1',
      name: 'CSE III-A',
      section: 'A',
    },
    professors: [
      {
        _id: 'p1',
        firstName: 'Alan',
        lastName: 'Turing',
        name: 'Alan Turing',
        email: 'alan@sam.edu',
      },
    ],
    classroom: {
      _id: 'r1',
      name: 'C301',
      building: 'C Block',
    },
    kind: 'THEORY',
  };

  describe('CancelClassModal', () => {
    it('renders class details and submits cancellation with reason', async () => {
      const onClose = vi.fn();
      const onSuccess = vi.fn();
      vi.mocked(occurrenceApi.cancelOccurrence).mockResolvedValue({ message: 'Success' });

      render(
        <CancelClassModal
          isOpen={true}
          onClose={onClose}
          entry={mockEntry}
          onSuccess={onSuccess}
        />
      );

      expect(screen.getByText('Cancel Class Occurrence')).toBeInTheDocument();
      expect(screen.getByText('Formal Languages and Automata Theory')).toBeInTheDocument();
      expect(screen.getByText('CS1301')).toBeInTheDocument();

      const textarea = screen.getByPlaceholderText(/Faculty medical leave/i);
      fireEvent.change(textarea, { target: { value: 'Faculty conference' } });

      const confirmBtn = screen.getByText('Confirm Cancellation');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(occurrenceApi.cancelOccurrence).toHaveBeenCalledWith(
          'LIN-CS1301-MON',
          '2026-08-10',
          'Faculty conference'
        );
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('RescheduleModal', () => {
    it('queries collision-free options when date is selected and submits reschedule', async () => {
      const onClose = vi.fn();
      const onSuccess = vi.fn();

      vi.mocked(occurrenceApi.getRescheduleOptions).mockResolvedValue({
        targetDate: '2026-08-11',
        durationSlots: 1,
        options: [
          {
            period: 3,
            durationSlots: 1,
            startTime: '11:00',
            endTime: '12:00',
            availableRooms: [
              { _id: 'r1', name: 'C301', building: 'C Block', capacity: 60, type: 'THEORY' },
            ],
            suggestedRoom: {
              _id: 'r1',
              name: 'C301',
              building: 'C Block',
              capacity: 60,
              type: 'THEORY',
            },
          },
        ],
      });

      vi.mocked(occurrenceApi.rescheduleOccurrence).mockResolvedValue({ message: 'Success' });

      render(
        <RescheduleModal
          isOpen={true}
          onClose={onClose}
          entry={mockEntry}
          onSuccess={onSuccess}
        />
      );

      expect(screen.getByText('Reschedule Class Occurrence')).toBeInTheDocument();

      // Wait for options to load
      await waitFor(() => {
        expect(screen.getByText('Period 3')).toBeInTheDocument();
        expect(screen.getByText('11:00 - 12:00')).toBeInTheDocument();
      });

      // Select period 3
      const periodCard = screen.getByText('Period 3').closest('div');
      fireEvent.click(periodCard!);

      // Enter optional reason
      const reasonInput = screen.getByPlaceholderText(/Compensation for Monday holiday/i);
      fireEvent.change(reasonInput, { target: { value: 'Rescheduled to Tuesday P3' } });

      // Click Confirm Reschedule
      const confirmBtn = screen.getByText('Confirm Reschedule');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(occurrenceApi.rescheduleOccurrence).toHaveBeenCalledWith(
          'LIN-CS1301-MON',
          '2026-08-10',
          expect.objectContaining({
            period: 3,
            classroomId: 'r1',
            reason: 'Rescheduled to Tuesday P3',
          })
        );
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
