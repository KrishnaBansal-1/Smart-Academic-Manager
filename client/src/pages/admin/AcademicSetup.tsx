import React, { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useToastStore } from '../../store/toastStore';
import { getErrorMessage } from '../../lib/errors';
import {
  AcademicTerm,
  CourseOffering,
  IPeriodGridItem,
  ITermHoliday,
} from '../../types';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Banner } from '../../components/ui/Banner';
import { Modal } from '../../components/ui/Modal';
import { Field } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { DAY_NAMES } from '../../components/timetable/TimetableGridShell';
import {
  Calendar,
  Grid,
  Palmtree,
  BookOpen,
  Plus,
  AlertTriangle,
  Sparkles,
  Search,
  CheckCircle,
  Edit2,
  Trash2,
} from 'lucide-react';

type TabKey = 'term' | 'holidays' | 'offerings';

interface DepartmentOption {
  _id: string;
  name: string;
  code: string;
}

interface CourseOption {
  _id: string;
  code: string;
  title: string;
  credits: number;
}

interface BatchOption {
  _id: string;
  name: string;
  semester: number;
}

interface ProfessorOption {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AffectedClassPreview {
  slotId: string;
  courseCode: string;
  courseTitle: string;
  batchName: string;
  periodIndex: number;
}

interface HolidayPreviewData {
  dateKey: string;
  label: string;
  dayOfWeek: number;
  affectedClassesCount: number;
  affectedClasses: AffectedClassPreview[];
}

interface BulkOfferingResponse {
  createdCount: number;
  skippedCount: number;
  totalProcessed: number;
}

const DEFAULT_GRID_TEMPLATE: IPeriodGridItem[] = [
  { index: 1, start: '09:00', end: '10:00', blocked: false, label: 'Period 1' },
  { index: 2, start: '10:00', end: '11:00', blocked: false, label: 'Period 2' },
  { index: 3, start: '11:00', end: '12:00', blocked: false, label: 'Period 3' },
  { index: 4, start: '12:00', end: '13:00', blocked: false, label: 'Period 4' },
  { index: 5, start: '13:00', end: '14:00', blocked: true, label: 'Lunch Break' },
  { index: 6, start: '14:00', end: '15:00', blocked: false, label: 'Period 5' },
  { index: 7, start: '15:00', end: '16:00', blocked: false, label: 'Period 6' },
  { index: 8, start: '16:00', end: '17:00', blocked: false, label: 'Period 7' },
];

export const AcademicSetup: React.FC = () => {
  const { addToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<TabKey>('term');

  // Terms state
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<AcademicTerm | null>(null);
  const [isTermsLoading, setIsTermsLoading] = useState(true);

  // Offerings state
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [isOfferingsLoading, setIsOfferingsLoading] = useState(false);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown master records
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [professors, setProfessors] = useState<ProfessorOption[]>([]);

  // Modals state
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isOfferingModalOpen, setIsOfferingModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Term modal inputs
  const [isEditingTerm, setIsEditingTerm] = useState(false);
  const [termName, setTermName] = useState('');
  const [termYear, setTermYear] = useState('2026-27');
  const [termSemesterType, setTermSemesterType] = useState<'ODD' | 'EVEN'>('ODD');
  const [termStartDate, setTermStartDate] = useState('2026-08-03');
  const [termEndDate, setTermEndDate] = useState('2026-12-11');
  const [termWorkingDays, setTermWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [termPeriods, setTermPeriods] = useState<IPeriodGridItem[]>(DEFAULT_GRID_TEMPLATE);
  const [termIsActive, setTermIsActive] = useState(true);
  const [isSavingTerm, setIsSavingTerm] = useState(false);

  // Holiday modal inputs
  const [holidayDateKey, setHolidayDateKey] = useState('');
  const [holidayLabel, setHolidayLabel] = useState('');
  const [holidayPreview, setHolidayPreview] = useState<HolidayPreviewData | null>(null);
  const [isPreviewingHoliday, setIsPreviewingHoliday] = useState(false);
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);

  // Offering form state
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [offeringCourseId, setOfferingCourseId] = useState('');
  const [offeringBatchId, setOfferingBatchId] = useState('');
  const [offeringProfIds, setOfferingProfIds] = useState<string[]>([]);
  const [offeringTheoryHours, setOfferingTheoryHours] = useState(3);
  const [offeringLabBlocks, setOfferingLabBlocks] = useState(0);
  const [offeringLabLength, setOfferingLabLength] = useState(2);
  const [isSavingOffering, setIsSavingOffering] = useState(false);

  // Bulk modal state
  const [bulkDeptId, setBulkDeptId] = useState('');
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // 1. Fetch Terms & Dropdown masters
  const loadInitialData = async () => {
    try {
      setIsTermsLoading(true);
      const [termsRes, deptRes, courseRes, batchRes, profRes] = await Promise.all([
        apiClient.get<{ data: { items: AcademicTerm[] } }>('/terms'),
        apiClient.get<{ data: { items: DepartmentOption[] } }>('/admin/departments'),
        apiClient.get<{ data: { items: CourseOption[] } }>('/admin/courses'),
        apiClient.get<{ data: { items: BatchOption[] } }>('/admin/semesters'),
        apiClient.get<{ data: { items: ProfessorOption[] } }>('/admin/professors'),
      ]);

      const loadedTerms = termsRes.data.data.items || [];
      setTerms(loadedTerms);

      const active = loadedTerms.find((t) => t.isActive) || loadedTerms[0] || null;
      setSelectedTerm(active);

      setDepartments(deptRes.data.data.items || []);
      setCourses(courseRes.data.data.items || []);
      setBatches(batchRes.data.data.items || []);
      setProfessors(profRes.data.data.items || []);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setIsTermsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // 2. Fetch Offerings when selectedTerm changes
  const loadOfferings = async (termId: string) => {
    try {
      setIsOfferingsLoading(true);
      const res = await apiClient.get<{ data: { items: CourseOffering[] } }>(
        `/offerings?termId=${termId}`
      );
      setOfferings(res.data.data.items || []);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setIsOfferingsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTerm) {
      loadOfferings(selectedTerm._id);
    } else {
      setOfferings([]);
    }
  }, [selectedTerm]);

  // Term creation / editing handlers
  const openCreateTermModal = () => {
    setIsEditingTerm(false);
    setTermName('');
    setTermYear('2026-27');
    setTermSemesterType('ODD');
    setTermStartDate('2026-08-03');
    setTermEndDate('2026-12-11');
    setTermWorkingDays([1, 2, 3, 4, 5]);
    setTermPeriods(DEFAULT_GRID_TEMPLATE.map((p) => ({ ...p })));
    setTermIsActive(terms.length === 0);
    setIsTermModalOpen(true);
  };

  const openEditTermModal = (term: AcademicTerm) => {
    setIsEditingTerm(true);
    setTermName(term.name);
    setTermYear(term.academicYear);
    setTermSemesterType(term.semesterType);
    setTermStartDate(term.startDate);
    setTermEndDate(term.endDate);
    setTermWorkingDays([...term.workingDays]);
    setTermPeriods(term.periods.map((p) => ({ ...p })));
    setTermIsActive(term.isActive);
    setIsTermModalOpen(true);
  };

  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termName || !termStartDate || !termEndDate) {
      addToast('Please fill all required term fields', 'error');
      return;
    }

    try {
      setIsSavingTerm(true);
      const payload = {
        name: termName,
        academicYear: termYear,
        semesterType: termSemesterType,
        startDate: termStartDate,
        endDate: termEndDate,
        workingDays: termWorkingDays,
        periods: termPeriods,
        isActive: termIsActive,
      };

      if (isEditingTerm && selectedTerm) {
        const res = await apiClient.patch<{ data: AcademicTerm }>(
          `/terms/${selectedTerm._id}`,
          payload
        );
        const updated = res.data.data;
        setSelectedTerm(updated);
        setTerms((prev) =>
          prev.map((t) => {
            if (t._id === updated._id) return updated;
            if (updated.isActive) return { ...t, isActive: false };
            return t;
          })
        );
        addToast('Academic term updated successfully', 'success');
      } else {
        const res = await apiClient.post<{ data: AcademicTerm }>('/terms', payload);
        const created = res.data.data;
        setTerms((prev) => {
          if (created.isActive) {
            return [created, ...prev.map((t) => ({ ...t, isActive: false }))];
          }
          return [created, ...prev];
        });
        setSelectedTerm(created);
        addToast('Academic term created successfully', 'success');
      }
      setIsTermModalOpen(false);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setIsSavingTerm(false);
    }
  };

  const handleActivateTerm = async (termId: string) => {
    try {
      const res = await apiClient.patch<{ data: AcademicTerm }>(`/terms/${termId}`, {
        isActive: true,
      });
      const updated = res.data.data;
      setSelectedTerm(updated);
      setTerms((prev) =>
        prev.map((t) => (t._id === updated._id ? updated : { ...t, isActive: false }))
      );
      addToast(`${updated.name} is now the active academic term`, 'success');
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    }
  };

  // Holiday handlers
  const handlePreviewHoliday = async () => {
    if (!selectedTerm || !holidayDateKey) return;
    try {
      setIsPreviewingHoliday(true);
      const res = await apiClient.post<{ data: HolidayPreviewData }>(
        `/terms/${selectedTerm._id}/holidays/preview`,
        { dateKey: holidayDateKey, label: holidayLabel || 'Holiday' }
      );
      setHolidayPreview(res.data.data);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setIsPreviewingHoliday(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerm || !holidayDateKey || !holidayLabel) return;
    try {
      setIsAddingHoliday(true);
      const res = await apiClient.post<{ data: AcademicTerm }>(
        `/terms/${selectedTerm._id}/holidays`,
        { dateKey: holidayDateKey, label: holidayLabel }
      );

      const updatedTerm = res.data.data;
      setSelectedTerm(updatedTerm);
      setTerms((prev) => prev.map((t) => (t._id === updatedTerm._id ? updatedTerm : t)));
      setIsHolidayModalOpen(false);
      setHolidayDateKey('');
      setHolidayLabel('');
      setHolidayPreview(null);
      addToast('Holiday added successfully', 'success');
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setIsAddingHoliday(false);
    }
  };

  // Offering handlers
  const openCreateOfferingModal = () => {
    setEditingOfferingId(null);
    setOfferingCourseId(courses[0]?._id || '');
    setOfferingBatchId(batches[0]?._id || '');
    setOfferingProfIds([]);
    setOfferingTheoryHours(3);
    setOfferingLabBlocks(0);
    setOfferingLabLength(2);
    setIsOfferingModalOpen(true);
  };

  const openEditOfferingModal = (offering: CourseOffering) => {
    setEditingOfferingId(offering._id);
    setOfferingCourseId(offering.courseId._id);
    setOfferingBatchId(offering.batchId._id);
    setOfferingProfIds((offering.professorIds || []).map((p) => p._id));
    setOfferingTheoryHours(offering.theoryHoursPerWeek);
    setOfferingLabBlocks(offering.labBlocksPerWeek);
    setOfferingLabLength(offering.labBlockLength);
    setIsOfferingModalOpen(true);
  };

  const handleSaveOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerm) return;

    try {
      setIsSavingOffering(true);
      if (editingOfferingId) {
        // Update
        const res = await apiClient.patch<{ data: CourseOffering }>(
          `/offerings/${editingOfferingId}`,
          {
            professorIds: offeringProfIds,
            theoryHoursPerWeek: Number(offeringTheoryHours),
            labBlocksPerWeek: Number(offeringLabBlocks),
            labBlockLength: Number(offeringLabLength),
            isActive: offeringProfIds.length > 0,
          }
        );
        const updated = res.data.data;
        setOfferings((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));
        addToast('Course offering updated', 'success');
      } else {
        // Create
        const res = await apiClient.post<{ data: CourseOffering }>('/offerings', {
          termId: selectedTerm._id,
          courseId: offeringCourseId,
          batchId: offeringBatchId,
          professorIds: offeringProfIds,
          theoryHoursPerWeek: Number(offeringTheoryHours),
          labBlocksPerWeek: Number(offeringLabBlocks),
          labBlockLength: Number(offeringLabLength),
          isActive: offeringProfIds.length > 0,
        });
        const created = res.data.data;
        setOfferings((prev) => [created, ...prev]);
        addToast('Course offering created', 'success');
      }
      setIsOfferingModalOpen(false);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setIsSavingOffering(false);
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerm || !bulkDeptId) return;
    try {
      setIsBulkLoading(true);
      const res = await apiClient.post<{ data: BulkOfferingResponse; message?: string }>(
        '/offerings/bulk-from-department',
        {
          termId: selectedTerm._id,
          departmentId: bulkDeptId,
        }
      );

      addToast(res.data.message || 'Bulk creation finished', 'success');
      setIsBulkModalOpen(false);
      loadOfferings(selectedTerm._id);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Warnings calculation for Offerings
  const getOfferingsWarnings = () => {
    if (!selectedTerm) return [];
    const warningList: string[] = [];

    // 1. Offerings with 0 faculty
    const noFaculty = offerings.filter((o) => !o.professorIds || o.professorIds.length === 0);
    if (noFaculty.length > 0) {
      const codes = noFaculty.map((o) => o.courseId.code).join(', ');
      warningList.push(
        `Offerings with no assigned faculty (${noFaculty.length}): ${codes}. These must have faculty assigned before schedule generation.`
      );
    }

    // 2. Section total hours vs usable periods
    const usablePeriods =
      selectedTerm.workingDays.length *
      selectedTerm.periods.filter((p) => !p.blocked).length;

    const hoursPerSection: Record<string, { name: string; hours: number }> = {};
    offerings.forEach((o) => {
      const batchId = o.batchId._id;
      const hours =
        (o.theoryHoursPerWeek || 0) + (o.labBlocksPerWeek || 0) * (o.labBlockLength || 2);
      if (!hoursPerSection[batchId]) {
        hoursPerSection[batchId] = { name: o.batchId.name, hours: 0 };
      }
      hoursPerSection[batchId].hours += hours;
    });

    Object.values(hoursPerSection).forEach((sec) => {
      if (sec.hours > usablePeriods) {
        warningList.push(
          `Section ${sec.name} total weekly hours (${sec.hours} hrs) exceed available non-blocked periods in working days (${usablePeriods} periods). Impossible to schedule.`
        );
      }
    });

    return warningList;
  };

  const warnings = getOfferingsWarnings();

  // Filter offerings
  const filteredOfferings = offerings.filter((o) => {
    if (selectedBatchFilter !== 'ALL' && o.batchId._id !== selectedBatchFilter) {
      return false;
    }
    const deptId =
      typeof o.courseId.departmentId === 'object' && o.courseId.departmentId !== null
        ? o.courseId.departmentId._id
        : o.courseId.departmentId;

    if (selectedDeptFilter !== 'ALL' && deptId !== selectedDeptFilter) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const codeMatch = o.courseId.code.toLowerCase().includes(q);
      const titleMatch = o.courseId.title.toLowerCase().includes(q);
      const profMatch = (o.professorIds || []).some(
        (p) =>
          p.firstName?.toLowerCase().includes(q) ||
          p.lastName?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q)
      );
      if (!codeMatch && !titleMatch && !profMatch) return false;
    }
    return true;
  });

  if (isTermsLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-sky-800 to-indigo-900 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-sky-200" />
              <h2 className="text-2xl font-bold sm:text-3xl">Academic Setup</h2>
            </div>
            <p className="mt-1 text-sm text-sky-100 max-w-2xl">
              Configure academic terms, period grids, institutional holidays, and section-wise course
              offerings.
            </p>
          </div>

          {/* Active Term Selector & Create Button */}
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {terms.length > 0 && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/20">
                <span className="text-xs font-semibold uppercase text-sky-200">Term:</span>
                <select
                  value={selectedTerm?._id || ''}
                  onChange={(e) => {
                    const found = terms.find((t) => t._id === e.target.value);
                    if (found) setSelectedTerm(found);
                  }}
                  className="bg-transparent text-sm font-semibold text-white outline-none cursor-pointer"
                >
                  {terms.map((t) => (
                    <option key={t._id} value={t._id} className="text-slate-800">
                      {t.name} {t.isActive ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              variant="secondary"
              onClick={openCreateTermModal}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs py-1.5 px-3"
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              New Term
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-6">
        <Tabs<TabKey>
          tabs={[
            { id: 'term', label: 'Term & Period Grid', icon: Grid },
            { id: 'holidays', label: 'Holidays', icon: Palmtree, badge: selectedTerm?.holidays?.length || 0 },
            { id: 'offerings', label: 'Course Offerings', icon: BookOpen, badge: offerings.length },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab)}
        />
      </div>

      {/* TAB 1: TERM & GRID */}
      {activeTab === 'term' && (
        <div className="space-y-6">
          {!selectedTerm ? (
            <EmptyState
              icon={Calendar}
              title="No academic terms configured"
              description="Define your first academic term with its date range, working days, and period grid to begin."
              action={
                <Button variant="primary" onClick={openCreateTermModal} icon={<Plus className="h-4 w-4" />}>
                  Create Academic Term
                </Button>
              }
            />
          ) : (
            <>
              {/* Term Overview Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-xl font-bold text-slate-800">{selectedTerm.name}</h3>
                      {selectedTerm.isActive ? (
                        <Badge variant="success">Active Term</Badge>
                      ) : (
                        <Badge variant="warning">Inactive Term</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Academic Year: {selectedTerm.academicYear} · Semester Type: {selectedTerm.semesterType}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="purple" className="px-3 py-1 text-xs">
                      {selectedTerm.startDate} to {selectedTerm.endDate}
                    </Badge>

                    {!selectedTerm.isActive && (
                      <Button
                        variant="secondary"
                        onClick={() => handleActivateTerm(selectedTerm._id)}
                        className="text-xs py-1 px-3 text-emerald-700 hover:bg-emerald-50"
                        icon={<CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                      >
                        Set as Active
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      onClick={() => openEditTermModal(selectedTerm)}
                      className="text-xs py-1 px-3"
                      icon={<Edit2 className="h-3.5 w-3.5 text-slate-500" />}
                    >
                      Edit Term & Grid
                    </Button>
                  </div>
                </div>

                {/* Working Days Badges */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Working Days:</span>
                  {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                    const isWorking = selectedTerm.workingDays.includes(dayNum);
                    return (
                      <span
                        key={dayNum}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          isWorking ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {DAY_NAMES[dayNum]}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Period Grid */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800">Period Grid Configuration</h4>
                    <p className="text-xs text-slate-500">
                      {selectedTerm.periods.length} daily time periods. Blocked slots (e.g. lunch) are
                      unavailable for teaching.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3">Slot Index</th>
                        <th className="px-6 py-3">Period Label</th>
                        <th className="px-6 py-3">Start Time</th>
                        <th className="px-6 py-3">End Time</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTerm.periods.map((p: IPeriodGridItem) => (
                        <tr key={p.index} className={p.blocked ? 'bg-amber-50/40' : 'hover:bg-slate-50/50'}>
                          <td className="px-6 py-3.5 font-bold text-slate-700">Period {p.index}</td>
                          <td className="px-6 py-3.5 font-medium text-slate-900">{p.label}</td>
                          <td className="px-6 py-3.5 text-slate-600 font-mono text-xs">{p.start}</td>
                          <td className="px-6 py-3.5 text-slate-600 font-mono text-xs">{p.end}</td>
                          <td className="px-6 py-3.5">
                            {p.blocked ? (
                              <Badge variant="warning">Blocked (Lunch / Break)</Badge>
                            ) : (
                              <Badge variant="success">Teaching Period</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: HOLIDAYS */}
      {activeTab === 'holidays' && (
        <div className="space-y-6">
          {!selectedTerm ? (
            <EmptyState
              icon={Palmtree}
              title="No academic term selected"
              description="Please create or select an academic term first to manage its holidays."
              action={
                <Button variant="primary" onClick={openCreateTermModal}>
                  Create Academic Term
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Institutional Holidays for {selectedTerm.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Classes falling on holiday dates are automatically excluded or cancelled during calendar resolution.
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    setHolidayDateKey('');
                    setHolidayLabel('');
                    setHolidayPreview(null);
                    setIsHolidayModalOpen(true);
                  }}
                  icon={<Plus className="h-4 w-4" />}
                >
                  Add Holiday
                </Button>
              </div>

              {(!selectedTerm.holidays || selectedTerm.holidays.length === 0) ? (
                <EmptyState
                  icon={Palmtree}
                  title="No holidays configured"
                  description="No institutional holidays have been added to this academic term yet."
                  action={
                    <Button variant="primary" onClick={() => setIsHolidayModalOpen(true)}>
                      Add First Holiday
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Holiday Name</th>
                        <th className="px-6 py-3">Term Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedTerm.holidays || []).map((h: ITermHoliday) => (
                        <tr key={h.dateKey} className="hover:bg-slate-50/50">
                          <td className="px-6 py-3.5 font-mono text-xs font-bold text-slate-800">{h.dateKey}</td>
                          <td className="px-6 py-3.5 font-semibold text-slate-900">{h.label}</td>
                          <td className="px-6 py-3.5 text-xs text-slate-500">{selectedTerm.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: COURSE OFFERINGS */}
      {activeTab === 'offerings' && (
        <div className="space-y-6">
          {!selectedTerm ? (
            <EmptyState
              icon={BookOpen}
              title="No academic term selected"
              description="Please create or select an academic term first to manage course offerings."
              action={
                <Button variant="primary" onClick={openCreateTermModal}>
                  Create Academic Term
                </Button>
              }
            />
          ) : (
            <>
              {/* Warnings Banner if any */}
              {warnings.length > 0 && (
                <Banner variant="warning">
                  <div className="font-semibold mb-1">Feasibility & Staffing Warnings:</div>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    {warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </Banner>
              )}

              {/* Action Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Filter controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search course or faculty..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 w-56"
                    />
                  </div>

                  <select
                    value={selectedBatchFilter}
                    onChange={(e) => setSelectedBatchFilter(e.target.value)}
                    className="py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white shadow-sm outline-none font-medium text-slate-700"
                  >
                    <option value="ALL">All Sections</option>
                    {batches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedDeptFilter}
                    onChange={(e) => setSelectedDeptFilter(e.target.value)}
                    className="py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white shadow-sm outline-none font-medium text-slate-700"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setBulkDeptId(departments[0]?._id || '');
                      setIsBulkModalOpen(true);
                    }}
                    icon={<Sparkles className="h-4 w-4 text-indigo-600" />}
                  >
                    Bulk from Department
                  </Button>
                  <Button
                    variant="primary"
                    onClick={openCreateOfferingModal}
                    icon={<Plus className="h-4 w-4" />}
                  >
                    Add Offering
                  </Button>
                </div>
              </div>

              {/* Offerings Table */}
              {isOfferingsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredOfferings.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No offerings found"
                  description="No course offerings match your filter or search criteria."
                  action={
                    <Button variant="primary" onClick={openCreateOfferingModal}>
                      Create Course Offering
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3">Course</th>
                          <th className="px-6 py-3">Section</th>
                          <th className="px-6 py-3">Theory / Lab Hours</th>
                          <th className="px-6 py-3">Assigned Faculty</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOfferings.map((offering) => {
                          const hasFaculty = offering.professorIds && offering.professorIds.length > 0;
                          return (
                            <tr key={offering._id} className="hover:bg-slate-50/50">
                              <td className="px-6 py-3.5">
                                <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded text-xs">
                                  {offering.courseId.code}
                                </span>
                                <div className="font-semibold text-slate-900 mt-1">{offering.courseId.title}</div>
                                <div className="text-[11px] text-slate-400">{offering.courseId.credits} credits</div>
                              </td>

                              <td className="px-6 py-3.5">
                                <span className="font-semibold text-slate-800">{offering.batchId.name}</span>
                                <div className="text-xs text-slate-400">Semester {offering.batchId.semester}</div>
                              </td>

                              <td className="px-6 py-3.5">
                                <div className="text-xs text-slate-700">
                                  <span className="font-semibold">{offering.theoryHoursPerWeek} hrs</span> theory / wk
                                </div>
                                {offering.labBlocksPerWeek > 0 && (
                                  <div className="text-xs text-indigo-700 font-medium mt-0.5">
                                    {offering.labBlocksPerWeek} × {offering.labBlockLength} hr lab block
                                  </div>
                                )}
                              </td>

                              <td className="px-6 py-3.5">
                                {!hasFaculty ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                                    <AlertTriangle className="h-3 w-3" />
                                    No Faculty Assigned
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {offering.professorIds.map((p) => (
                                      <span
                                        key={p._id}
                                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                                      >
                                        {p.firstName} {p.lastName}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              <td className="px-6 py-3.5">
                                {offering.isActive ? (
                                  <Badge variant="success">Active</Badge>
                                ) : (
                                  <Badge variant="warning">Inactive (Pending Faculty)</Badge>
                                )}
                              </td>

                              <td className="px-6 py-3.5 text-right">
                                <Button
                                  variant="ghost"
                                  onClick={() => openEditOfferingModal(offering)}
                                  className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
                                >
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MODAL 0: CREATE OR EDIT ACADEMIC TERM */}
      <Modal
        isOpen={isTermModalOpen}
        onClose={() => setIsTermModalOpen(false)}
        title={isEditingTerm ? 'Edit Academic Term & Grid' : 'Create Academic Term'}
        description="Configure term dates, semester type, working days, and daily period grid."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTerm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Term Name"
              placeholder="e.g. Odd Semester 2026-27"
              required
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
            />
            <Field
              label="Academic Year"
              placeholder="e.g. 2026-27"
              required
              value={termYear}
              onChange={(e) => setTermYear(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Semester Type</label>
              <select
                value={termSemesterType}
                onChange={(e) => setTermSemesterType(e.target.value as 'ODD' | 'EVEN')}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-800 outline-none"
              >
                <option value="ODD">ODD Semester</option>
                <option value="EVEN">EVEN Semester</option>
              </select>
            </div>

            <Field
              label="Start Date"
              type="date"
              required
              value={termStartDate}
              onChange={(e) => setTermStartDate(e.target.value)}
            />

            <Field
              label="End Date"
              type="date"
              required
              value={termEndDate}
              onChange={(e) => setTermEndDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Working Days</label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                const isSelected = termWorkingDays.includes(dayNum);
                return (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (termWorkingDays.length > 1) {
                          setTermWorkingDays(termWorkingDays.filter((d) => d !== dayNum));
                        }
                      } else {
                        setTermWorkingDays([...termWorkingDays, dayNum].sort((a, b) => a - b));
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {DAY_NAMES[dayNum]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period Grid Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Period Grid ({termPeriods.length} periods)
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const nextIndex = termPeriods.length + 1;
                  setTermPeriods([
                    ...termPeriods,
                    {
                      index: nextIndex,
                      start: '17:00',
                      end: '18:00',
                      blocked: false,
                      label: `Period ${nextIndex}`,
                    },
                  ]);
                }}
                className="text-xs py-1 px-2.5"
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Add Period
              </Button>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-2">
              {termPeriods.map((p, pIdx) => (
                <div
                  key={pIdx}
                  className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 rounded-lg text-xs"
                >
                  <span className="font-bold text-slate-600 w-6">P{p.index}</span>
                  <input
                    type="text"
                    placeholder="Label"
                    value={p.label}
                    onChange={(e) => {
                      const next = [...termPeriods];
                      next[pIdx].label = e.target.value;
                      setTermPeriods(next);
                    }}
                    className="w-24 rounded border border-slate-300 p-1 bg-white"
                  />
                  <input
                    type="time"
                    value={p.start}
                    onChange={(e) => {
                      const next = [...termPeriods];
                      next[pIdx].start = e.target.value;
                      setTermPeriods(next);
                    }}
                    className="rounded border border-slate-300 p-1 bg-white"
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={p.end}
                    onChange={(e) => {
                      const next = [...termPeriods];
                      next[pIdx].end = e.target.value;
                      setTermPeriods(next);
                    }}
                    className="rounded border border-slate-300 p-1 bg-white"
                  />
                  <label className="flex items-center gap-1 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={p.blocked || false}
                      onChange={(e) => {
                        const next = [...termPeriods];
                        next[pIdx].blocked = e.target.checked;
                        setTermPeriods(next);
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[11px] font-semibold text-slate-600">Lunch/Blocked</span>
                  </label>
                  {termPeriods.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = termPeriods
                          .filter((_, idx) => idx !== pIdx)
                          .map((item, idx) => ({ ...item, index: idx + 1 }));
                        setTermPeriods(next);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remove period"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={termIsActive}
              onChange={(e) => setTermIsActive(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm font-medium text-slate-700">
              Set as the active academic term (deactivates others)
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsTermModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingTerm}>
              {isEditingTerm ? 'Save Term Changes' : 'Create Academic Term'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 1: ADD HOLIDAY WITH PREVIEW */}
      <Modal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        title="Add Institutional Holiday"
        description={`Record a holiday for ${selectedTerm?.name}. Classes falling on this date will be affected.`}
      >
        <form onSubmit={handleAddHoliday} className="space-y-4">
          <Field
            label="Holiday Date (YYYY-MM-DD)"
            type="date"
            required
            value={holidayDateKey}
            min={selectedTerm?.startDate}
            max={selectedTerm?.endDate}
            onChange={(e) => setHolidayDateKey(e.target.value)}
          />

          <Field
            label="Holiday Label / Reason"
            placeholder="e.g. Mahatma Gandhi Jayanti"
            required
            value={holidayLabel}
            onChange={(e) => setHolidayLabel(e.target.value)}
          />

          {/* Preview button */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">Classroom Schedule Impact</span>
              <Button
                type="button"
                variant="secondary"
                disabled={!holidayDateKey}
                isLoading={isPreviewingHoliday}
                onClick={handlePreviewHoliday}
                className="text-xs py-1 px-3"
              >
                Preview Affected Classes
              </Button>
            </div>

            {holidayPreview ? (
              <div className="text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">
                  {holidayPreview.affectedClassesCount} classes affected on this date.
                </div>
                {holidayPreview.affectedClassesCount > 0 && (
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px] max-h-28 overflow-y-auto">
                    {holidayPreview.affectedClasses.map((c, i) => (
                      <li key={i}>
                        {c.courseCode} ({c.batchName}) - Period {c.periodIndex}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Click preview to analyze potential timetable slots affected by this holiday.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsHolidayModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isAddingHoliday}>
              Confirm & Add Holiday
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ADD / EDIT COURSE OFFERING */}
      <Modal
        isOpen={isOfferingModalOpen}
        onClose={() => setIsOfferingModalOpen(false)}
        title={editingOfferingId ? 'Edit Course Offering' : 'Add Course Offering'}
        description="Assign course hours, lab blocks, and faculty instructors to a student section."
      >
        <form onSubmit={handleSaveOffering} className="space-y-4">
          {!editingOfferingId && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
                <select
                  value={offeringCourseId}
                  onChange={(e) => setOfferingCourseId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800 outline-none"
                  required
                >
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Section (Batch)</label>
                <select
                  value={offeringBatchId}
                  onChange={(e) => setOfferingBatchId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800 outline-none"
                  required
                >
                  {batches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} (Semester {b.semester})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Theory Hrs / Wk"
              type="number"
              min={0}
              max={10}
              value={offeringTheoryHours}
              onChange={(e) => setOfferingTheoryHours(Number(e.target.value))}
            />
            <Field
              label="Lab Blocks / Wk"
              type="number"
              min={0}
              max={4}
              value={offeringLabBlocks}
              onChange={(e) => setOfferingLabBlocks(Number(e.target.value))}
            />
            <Field
              label="Lab Block Length"
              type="number"
              min={1}
              max={4}
              value={offeringLabLength}
              onChange={(e) => setOfferingLabLength(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Assigned Faculty (Co-teachers allowed)
            </label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1">
              {professors.map((p) => {
                const isChecked = offeringProfIds.includes(p._id);
                return (
                  <label
                    key={p._id}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setOfferingProfIds([...offeringProfIds, p._id]);
                        } else {
                          setOfferingProfIds(offeringProfIds.filter((id) => id !== p._id));
                        }
                      }}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="font-medium text-slate-800">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="text-slate-400">({p.email})</span>
                  </label>
                );
              })}
            </div>
            {offeringProfIds.length === 0 && (
              <p className="mt-1 text-xs text-amber-600 font-medium">
                Offering will be created inactive until faculty is assigned.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsOfferingModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingOffering}>
              {editingOfferingId ? 'Update Offering' : 'Create Offering'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: BULK GENERATE FROM DEPARTMENT */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Generate Course Offerings"
        description="Automatically create course offerings for all active courses and sections in the department."
      >
        <form onSubmit={handleBulkGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Department</label>
            <select
              value={bulkDeptId}
              onChange={(e) => setBulkDeptId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800 outline-none"
              required
            >
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-slate-500">
            For theory courses with multiple eligible faculty, sections will be assigned faculty sequentially. Lab courses with multiple faculty will co-teach all sections. Existing offerings will be preserved.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isBulkLoading}>
              Generate Offerings
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AcademicSetup;
