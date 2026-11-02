import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WeekView } from '../components/timetable/WeekView';
import { StudentDashboard } from '../pages/student/StudentDashboard';
import { ProfessorDashboard } from '../pages/professor/ProfessorDashboard';
import { ScheduleResponse } from '../types/schedule';
import * as AuthContext from '../context/AuthContext';
import * as ScheduleApi from '../api/schedule';
import { apiClient } from '../api/client';

describe('Phase 4 Frontend Schedule & Calendar Components', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const mockScheduleData: ScheduleResponse = {
    published: true,
    term: {
      id: 'term-1',
      name: 'Odd Semester 2026-27',
      academicYear: '2026-2027',
      semesterType: 'ODD',
      startDate: '2026-08-03',
      endDate: '2026-12-11',
      workingDays: [1, 2, 3, 4, 5],
      periods: [
        { index: 1, start: '09:00', end: '10:00', label: 'Period 1' },
        { index: 2, start: '10:00', end: '11:00', label: 'Period 2' },
        { index: 3, start: '11:00', end: '12:00', label: 'Period 3' },
      ],
      holidays: [{ dateKey: '2026-08-14', label: 'Independence Day Holiday' }],
    },
    range: {
      from: '2026-08-10',
      to: '2026-08-16',
    },
    weekOf: '2026-08-10',
    entries: [
      {
        occurrenceId: 'slot-1:2026-08-10',
        lineageId: 'slot-1',
        originalDateKey: '2026-08-10',
        dateKey: '2026-08-10',
        period: 1,
        durationSlots: 1,
        startTime: '09:00',
        endTime: '10:00',
        state: 'NORMAL',
        course: { _id: 'c1', code: 'CS1301', title: 'Automata Theory', name: 'Automata Theory' },
        batch: { _id: 'b1', name: 'CSE III-A', section: 'CSE III-A' },
        professors: [{ _id: 'p1', firstName: 'Alan', lastName: 'Turing', name: 'Alan Turing', email: 'alan@sam.edu' }],
        classroom: { _id: 'r1', name: 'C301', roomNumber: '301' },
        kind: 'THEORY',
      },
      {
        occurrenceId: 'slot-2:2026-08-10',
        lineageId: 'slot-2',
        originalDateKey: '2026-08-10',
        dateKey: '2026-08-10',
        period: 2,
        durationSlots: 1,
        startTime: '10:00',
        endTime: '11:00',
        state: 'CANCELLED',
        reason: 'Faculty attending research conference',
        course: { _id: 'c2', code: 'CS1302', title: 'Database Systems', name: 'Database Systems' },
        batch: { _id: 'b1', name: 'CSE III-A', section: 'CSE III-A' },
        professors: [{ _id: 'p2', firstName: 'Ada', lastName: 'Lovelace', name: 'Ada Lovelace', email: 'ada@sam.edu' }],
        classroom: { _id: 'r2', name: 'C302', roomNumber: '302' },
        kind: 'THEORY',
      },
      {
        occurrenceId: 'slot-3:2026-08-10',
        lineageId: 'slot-3',
        originalDateKey: '2026-08-10',
        dateKey: '2026-08-10',
        period: 3,
        durationSlots: 1,
        startTime: '11:00',
        endTime: '12:00',
        state: 'MOVED_OUT',
        reason: 'Moved to 2026-08-12',
        course: { _id: 'c3', code: 'CS1303', title: 'Computer Networks', name: 'Computer Networks' },
        batch: { _id: 'b1', name: 'CSE III-A', section: 'CSE III-A' },
        professors: [{ _id: 'p1', firstName: 'Alan', lastName: 'Turing', name: 'Alan Turing', email: 'alan@sam.edu' }],
        classroom: { _id: 'r1', name: 'C301', roomNumber: '301' },
        kind: 'THEORY',
      },
      {
        occurrenceId: 'slot-3:2026-08-10',
        lineageId: 'slot-3',
        originalDateKey: '2026-08-10',
        dateKey: '2026-08-12',
        period: 1,
        durationSlots: 1,
        startTime: '09:00',
        endTime: '10:00',
        state: 'MOVED_IN',
        reason: 'Rescheduled from 2026-08-10',
        course: { _id: 'c3', code: 'CS1303', title: 'Computer Networks', name: 'Computer Networks' },
        batch: { _id: 'b1', name: 'CSE III-A', section: 'CSE III-A' },
        professors: [{ _id: 'p1', firstName: 'Alan', lastName: 'Turing', name: 'Alan Turing', email: 'alan@sam.edu' }],
        classroom: { _id: 'r1', name: 'C301', roomNumber: '301' },
        kind: 'THEORY',
      },
      {
        occurrenceId: 'exam-1',
        lineageId: 'exam-1',
        originalDateKey: '2026-08-12',
        dateKey: '2026-08-12',
        period: 2,
        durationSlots: 1,
        startTime: '10:00',
        endTime: '11:00',
        state: 'EXAM',
        reason: 'Minor 1 Examination',
        course: { _id: 'c1', code: 'CS1301', title: 'Automata Theory', name: 'Automata Theory' },
        batch: { _id: 'b1', name: 'CSE III-A', section: 'CSE III-A' },
        professors: [{ _id: 'p1', firstName: 'Alan', lastName: 'Turing', name: 'Alan Turing', email: 'alan@sam.edu' }],
        classroom: { _id: 'r1', name: 'C301', roomNumber: '301' },
        kind: 'THEORY',
        exam: { _id: 'exam-1', title: 'Minor 1 Examination', syllabus: 'Units 1 and 2' },
      },
    ],
    holidays: [{ dateKey: '2026-08-14', label: 'Independence Day Holiday' }],
  };

  describe('1. WeekView Component', () => {
    it('renders "No Published Timetable" empty state when timetable is not published', () => {
      const unpublishedData: ScheduleResponse = {
        published: false,
        message: 'No published timetable for this term',
        term: null,
        range: { from: '2026-08-10', to: '2026-08-16' },
        entries: [],
        holidays: [],
      };

      render(
        <WeekView
          scheduleData={unpublishedData}
          isLoading={false}
          currentWeekOf="2026-08-10"
          onWeekChange={vi.fn()}
        />
      );

      expect(screen.getByText('No Published Timetable')).toBeInTheDocument();
      expect(screen.getByText('No published timetable for this term')).toBeInTheDocument();
    });

    it('renders desktop grid with normal, cancelled, moved, and exam entries', () => {
      render(
        <WeekView
          scheduleData={mockScheduleData}
          isLoading={false}
          currentWeekOf="2026-08-10"
          onWeekChange={vi.fn()}
        />
      );

      // Verify header and legend
      expect(screen.getByText('Odd Semester 2026-27')).toBeInTheDocument();
      expect(screen.getByText('Normal Class')).toBeInTheDocument();
      expect(screen.getAllByText('Minor Exam').length).toBeGreaterThan(0);

      // Verify normal course
      expect(screen.getAllByText('Automata Theory').length).toBeGreaterThan(0);
      expect(screen.getAllByText('CS1301').length).toBeGreaterThan(0);

      // Verify cancelled badge and text
      expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Database Systems').length).toBeGreaterThan(0);

      // Verify moved badges
      expect(screen.getAllByText('Moved').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Rescheduled').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Minor Exam').length).toBeGreaterThan(0);

      // Verify holiday notice for Friday 2026-08-14
      expect(
        screen.getByText(/Independence Day Holiday — Term Holiday/i)
      ).toBeInTheDocument();
    });

    it('allows changing weeks via previous and next week buttons', () => {
      const onWeekChange = vi.fn();
      render(
        <WeekView
          scheduleData={mockScheduleData}
          isLoading={false}
          currentWeekOf="2026-08-10"
          onWeekChange={onWeekChange}
        />
      );

      const prevBtn = screen.getByLabelText('Previous Week');
      fireEvent.click(prevBtn);
      expect(onWeekChange).toHaveBeenCalledWith('2026-08-03');

      const nextBtn = screen.getByLabelText('Next Week');
      fireEvent.click(nextBtn);
      expect(onWeekChange).toHaveBeenCalledWith('2026-08-17');
    });
  });

  describe('2. StudentDashboard Today Schedule Integration', () => {
    it('displays today classes on student dashboard when published', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 's-1',
          _id: 's-1',
          firstName: 'Alice',
          lastName: 'Student',
          email: 'alice@sam.edu',
          role: 'STUDENT',
          rollNumber: 'CS24B001',
          batchId: { _id: 'b-1', name: 'CSE III-A' } as any,
          tokenVersion: 0,
        },
        token: 'token',
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        getDashboardRoute: () => '/student',
      });

      vi.spyOn(ScheduleApi, 'getTodaySchedule').mockResolvedValue({
        published: true,
        term: mockScheduleData.term,
        range: { from: '2026-08-10', to: '2026-08-10' },
        entries: [mockScheduleData.entries[0]], // Automata Theory
        holidays: [],
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <StudentDashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText("Today's Schedule")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Automata Theory')).toBeInTheDocument();
        expect(screen.getByText('CS1301')).toBeInTheDocument();
        expect(screen.getByText('C301')).toBeInTheDocument();
      });
    });
  });

  describe('3. ProfessorDashboard Today Schedule Integration', () => {
    it('displays today teaching schedule on professor dashboard when published', async () => {
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
        user: {
          id: 'p-1',
          _id: 'p-1',
          firstName: 'Alan',
          lastName: 'Turing',
          email: 'alan@sam.edu',
          role: 'PROFESSOR',
          tokenVersion: 0,
        },
        token: 'token',
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        getDashboardRoute: () => '/professor',
      });

      vi.spyOn(apiClient, 'get').mockResolvedValue({
        data: { data: { items: [] } },
      } as any);

      vi.spyOn(ScheduleApi, 'getTodaySchedule').mockResolvedValue({
        published: true,
        term: mockScheduleData.term,
        range: { from: '2026-08-10', to: '2026-08-10' },
        entries: [mockScheduleData.entries[0]],
        holidays: [],
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ProfessorDashboard />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText("Today's Teaching Schedule")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Automata Theory')).toBeInTheDocument();
        expect(screen.getByText('CS1301')).toBeInTheDocument();
        expect(screen.getByText('CSE III-A (P1)')).toBeInTheDocument();
      });
    });
  });
});
