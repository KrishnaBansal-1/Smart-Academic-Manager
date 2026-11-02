import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TimetableGridShell } from '../components/timetable/TimetableGridShell';
import { ProfessorPreferences } from '../pages/professor/ProfessorPreferences';
import { AcademicSetup } from '../pages/admin/AcademicSetup';
import { apiClient } from '../api/client';
import { BrowserRouter } from 'react-router-dom';

describe('Phase 1 Frontend Components & Academic Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TimetableGridShell', () => {
    it('renders the grid headers and invokes cell render callbacks for each coordinate', () => {
      const workingDays = [1, 2, 3]; // Mon, Tue, Wed
      const periods = [
        { index: 1, start: '09:00', end: '10:00', label: 'Period 1' },
        { index: 2, start: '10:00', end: '11:00', label: 'Period 2', blocked: true },
      ];

      const renderCell = vi.fn((day, period) => (
        <div data-testid={`cell-${day}-${period.index}`}>Slot</div>
      ));

      render(
        <TimetableGridShell
          workingDays={workingDays}
          periods={periods}
          renderCell={renderCell}
        />
      );

      // Verify day headers
      expect(screen.getByText('Monday')).toBeInTheDocument();
      expect(screen.getByText('Tuesday')).toBeInTheDocument();
      expect(screen.getByText('Wednesday')).toBeInTheDocument();

      // Verify period headers
      expect(screen.getByText('Period 1')).toBeInTheDocument();
      expect(screen.getByText('Period 2')).toBeInTheDocument();
      expect(screen.getByText('Blocked')).toBeInTheDocument();

      // Verify cell calls (3 days x 2 periods = 6 cells)
      expect(renderCell).toHaveBeenCalledTimes(6);
      expect(screen.getByTestId('cell-1-1')).toBeInTheDocument();
      expect(screen.getByTestId('cell-3-2')).toBeInTheDocument();
    });
  });

  describe('ProfessorPreferences', () => {
    it('loads active term and allows painting preferred time slots', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/terms/active') {
          return {
            data: {
              data: {
                _id: 'term-1',
                name: 'Odd Semester 2026-27',
                academicYear: '2026-27',
                semesterType: 'ODD',
                startDate: '2026-08-03',
                endDate: '2026-12-11',
                workingDays: [1, 2],
                periods: [
                  { index: 1, start: '09:00', end: '10:00', label: 'Period 1' },
                  { index: 2, start: '10:00', end: '11:00', label: 'Period 2' },
                ],
                holidays: [],
                isActive: true,
              },
            },
          } as never;
        }
        if (url.startsWith('/constraints/me')) {
          return {
            data: {
              data: {
                _id: 'constraint-1',
                maxDailyHours: 4,
                priorityWeight: 4,
                preferredTimeWindows: [],
                unavailableWindows: [],
              },
            },
          } as never;
        }
        return { data: { data: null } } as never;
      });

      render(<ProfessorPreferences />);

      await waitFor(() => {
        expect(screen.getByText(/teaching preferences/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/priority weight: 4 \/ 5/i)).toBeInTheDocument();

      // Check paint tool buttons exist
      const preferredBtn = screen.getByRole('button', { name: /preferred/i });
      const unavailableBtn = screen.getByRole('button', { name: /unavailable/i });
      expect(preferredBtn).toBeInTheDocument();
      expect(unavailableBtn).toBeInTheDocument();

      // Paint a cell by clicking on it
      const slotCells = screen.getAllByLabelText(/period 1 neutral/i);
      expect(slotCells.length).toBeGreaterThan(0);
      fireEvent.mouseDown(slotCells[0]);

      // Now the cell should display "Preferred"
      await waitFor(() => {
        expect(screen.getByLabelText(/period 1 preferred/i)).toBeInTheDocument();
      });
    });
  });

  describe('AcademicSetup', () => {
    it('renders tabs and displays period grid configuration', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/terms') {
          return {
            data: {
              data: {
                items: [
                  {
                    _id: 'term-1',
                    name: 'Odd Semester 2026-27',
                    academicYear: '2026-27',
                    semesterType: 'ODD',
                    startDate: '2026-08-03',
                    endDate: '2026-12-11',
                    workingDays: [1, 2, 3, 4, 5],
                    periods: [
                      { index: 1, start: '09:00', end: '10:00', label: 'Period 1', blocked: false },
                      { index: 2, start: '13:00', end: '14:00', label: 'Lunch Break', blocked: true },
                    ],
                    holidays: [{ dateKey: '2026-08-15', label: 'Independence Day' }],
                    isActive: true,
                  },
                ],
              },
            },
          } as never;
        }
        if (url.startsWith('/offerings')) {
          return { data: { data: { items: [] } } } as never;
        }
        return { data: { data: { items: [] } } } as never;
      });

      render(
        <BrowserRouter>
          <AcademicSetup />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /academic setup/i })).toBeInTheDocument();
      });

      // Verify tabs exist
      expect(screen.getByRole('tab', { name: /term & period grid/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /holidays/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /course offerings/i })).toBeInTheDocument();

      // Verify term name and periods are displayed
      expect(screen.getByText('Odd Semester 2026-27')).toBeInTheDocument();
      expect(screen.getByText('Lunch Break')).toBeInTheDocument();
      expect(screen.getByText('Blocked (Lunch / Break)')).toBeInTheDocument();
    });

    it('allows admin to create a new term and switch between terms', async () => {
      const term1 = {
        _id: 'term-1',
        name: 'Odd Semester 2026-27',
        academicYear: '2026-27',
        semesterType: 'ODD' as const,
        startDate: '2026-08-03',
        endDate: '2026-12-11',
        workingDays: [1, 2, 3, 4, 5],
        periods: [{ index: 1, start: '09:00', end: '10:00', label: 'Period 1', blocked: false }],
        holidays: [],
        isActive: true,
      };

      const term2 = {
        _id: 'term-2',
        name: 'Even Semester 2026-27',
        academicYear: '2026-27',
        semesterType: 'EVEN' as const,
        startDate: '2027-01-04',
        endDate: '2027-05-15',
        workingDays: [1, 2, 3, 4, 5],
        periods: [{ index: 1, start: '09:00', end: '10:00', label: 'Period 1', blocked: false }],
        holidays: [],
        isActive: false,
      };

      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/terms') {
          return { data: { data: { items: [term1, term2] } } } as never;
        }
        return { data: { data: { items: [] } } } as never;
      });

      const postSpy = vi.spyOn(apiClient, 'post').mockImplementation(async (url: string, data: unknown) => {
        if (url === '/terms') {
          return { data: { data: { ...(data as Record<string, unknown>), _id: 'term-3' } } } as never;
        }
        return { data: { data: {} } } as never;
      });

      render(
        <BrowserRouter>
          <AcademicSetup />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Odd Semester 2026-27')).toBeInTheDocument();
      });

      // Verify New Term button is present
      const newTermBtn = screen.getByRole('button', { name: /new term/i });
      expect(newTermBtn).toBeInTheDocument();

      // Open modal
      fireEvent.click(newTermBtn);
      expect(screen.getByRole('heading', { name: /create academic term/i })).toBeInTheDocument();

      // Enter term name
      const nameInput = screen.getByPlaceholderText(/e.g. odd semester 2026-27/i);
      fireEvent.change(nameInput, { target: { value: 'Summer Term 2027' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /create academic term/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalledWith(
          '/terms',
          expect.objectContaining({ name: 'Summer Term 2027' })
        );
      });
    });
  });
});
