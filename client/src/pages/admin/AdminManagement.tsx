import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  CirclePlus,
  GraduationCap,
  KeyRound,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Users,
  Building,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { getErrorMessage } from '../../lib/errors';
import {
  Button,
  Field,
  Select,
  Modal,
  Banner,
  Badge,
  EmptyState,
  Tabs,
  ConfirmDialog,
  TabItem,
} from '../../components/ui';
import { showToast } from '../../store/toastStore';

export type Entity = 'students' | 'professors' | 'courses' | 'semesters' | 'rooms' | 'departments';

export interface DepartmentRow {
  _id: string;
  name: string;
  code: string;
  building?: string;
  isActive: boolean;
}

export interface SectionRow {
  _id: string;
  name: string;
  departmentId: string | DepartmentRow;
  semester: number;
  academicYear: string;
  isActive: boolean;
}

export interface ProfessorRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string | DepartmentRow;
  isActive: boolean;
}

export interface StudentRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  rollNumber?: string;
  departmentId: string | DepartmentRow;
  batchId?: string | SectionRow;
  isActive: boolean;
}

export interface CourseRow {
  _id: string;
  code: string;
  title: string;
  departmentId: string | DepartmentRow;
  credits: number;
  weeklyTheoryHours: number;
  weeklyLabHours: number;
  professorIds: Array<string | ProfessorRow>;
  isActive: boolean;
}

export interface RoomRow {
  _id: string;
  name: string;
  building: string;
  capacity: number;
  type: 'THEORY' | 'LABORATORY';
  hasProjector: boolean;
  isActive: boolean;
}

export type EntityRow =
  | StudentRow
  | ProfessorRow
  | CourseRow
  | SectionRow
  | RoomRow
  | DepartmentRow;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  rollNumber: string;
  departmentId: string;
  batchId: string;
  code: string;
  title: string;
  credits: number;
  weeklyTheoryHours: number;
  weeklyLabHours: number;
  professorIds: string[];
  name: string;
  semester: number;
  academicYear: string;
  building: string;
  capacity: number;
  type: 'THEORY' | 'LABORATORY';
  hasProjector: boolean;
}

const defaultForm = (): FormState => ({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  rollNumber: '',
  departmentId: '',
  batchId: '',
  code: '',
  title: '',
  credits: 3,
  weeklyTheoryHours: 3,
  weeklyLabHours: 0,
  professorIds: [],
  name: '',
  semester: 1,
  academicYear: '2026-2027',
  building: '',
  capacity: 30,
  type: 'THEORY',
  hasProjector: true,
});

const entityTabs: TabItem<Entity>[] = [
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'professors', label: 'Professors', icon: Users },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'semesters', label: 'Sections', icon: CalendarDays },
  { id: 'rooms', label: 'Rooms', icon: Building2 },
  { id: 'departments', label: 'Departments', icon: Building },
];

export const AdminManagement: React.FC = () => {
  const [entity, setEntity] = useState<Entity>('students');
  const [items, setItems] = useState<EntityRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [batches, setBatches] = useState<SectionRow[]>([]);
  const [professors, setProfessors] = useState<ProfessorRow[]>([]);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState<FormState>(defaultForm());
  const [editingItem, setEditingItem] = useState<EntityRow | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Password Modal State
  const [passwordTarget, setPasswordTarget] = useState<ProfessorRow | StudentRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Deactivate Confirm State
  const [deactivateTarget, setDeactivateTarget] = useState<EntityRow | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // CSV Import Modal State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    importedCount: number;
    failedCount: number;
    errors: Array<{ row: number; email?: string; error: string }>;
  } | null>(null);

  const [pageError, setPageError] = useState('');

  // Protect against tab-switch race conditions
  const currentEntityRef = useRef<Entity>(entity);
  currentEntityRef.current = entity;

  const loadLookups = useCallback(async () => {
    try {
      const [deptRes, batchRes, profRes] = await Promise.all([
        apiClient.get<{ data: { items: DepartmentRow[] } }>('/admin/departments'),
        apiClient.get<{ data: { items: SectionRow[] } }>('/admin/semesters'),
        apiClient.get<{ data: { items: ProfessorRow[] } }>('/admin/professors'),
      ]);
      setDepartments(deptRes.data.data.items);
      setBatches(batchRes.data.data.items.filter((b) => b.isActive));
      setProfessors(profRes.data.data.items.filter((p) => p.isActive));
    } catch {
      // Lookups fail gracefully; user will see active list error if backend is down
    }
  }, []);

  const loadItems = useCallback(async (target: Entity) => {
    setIsLoading(true);
    setPageError('');
    try {
      const { data } = await apiClient.get<{ data: { items: EntityRow[] } }>(`/admin/${target}`);
      if (currentEntityRef.current === target) {
        setItems(data.data.items);
      }
    } catch (err: unknown) {
      if (currentEntityRef.current === target) {
        setPageError(getErrorMessage(err, `Failed to load ${target}`));
        setItems([]);
      }
    } finally {
      if (currentEntityRef.current === target) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadItems(entity);
  }, [entity, loadItems]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  // Clean entity-specific search matching visible fields
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      if (entity === 'students') {
        const s = item as StudentRow;
        const dept = typeof s.departmentId === 'object' ? `${s.departmentId.code} ${s.departmentId.name}` : '';
        const sec = typeof s.batchId === 'object' ? s.batchId.name : '';
        const text = `${s.firstName} ${s.lastName} ${s.email} ${s.rollNumber || ''} ${dept} ${sec}`.toLowerCase();
        return text.includes(q);
      }
      if (entity === 'professors') {
        const p = item as ProfessorRow;
        const dept = typeof p.departmentId === 'object' ? `${p.departmentId.code} ${p.departmentId.name}` : '';
        const text = `${p.firstName} ${p.lastName} ${p.email} ${dept}`.toLowerCase();
        return text.includes(q);
      }
      if (entity === 'courses') {
        const c = item as CourseRow;
        const dept = typeof c.departmentId === 'object' ? `${c.departmentId.code} ${c.departmentId.name}` : '';
        const text = `${c.code} ${c.title} ${dept}`.toLowerCase();
        return text.includes(q);
      }
      if (entity === 'semesters') {
        const sec = item as SectionRow;
        const dept = typeof sec.departmentId === 'object' ? `${sec.departmentId.code} ${sec.departmentId.name}` : '';
        const text = `${sec.name} ${sec.academicYear} ${sec.semester} ${dept}`.toLowerCase();
        return text.includes(q);
      }
      if (entity === 'rooms') {
        const r = item as RoomRow;
        const text = `${r.name} ${r.building} ${r.capacity} ${r.type}`.toLowerCase();
        return text.includes(q);
      }
      if (entity === 'departments') {
        const d = item as DepartmentRow;
        const text = `${d.name} ${d.code} ${d.building || ''}`.toLowerCase();
        return text.includes(q);
      }
      return false;
    });
  }, [items, search, entity]);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm(defaultForm());
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (item: EntityRow) => {
    setEditingItem(item);
    setFormError('');

    const initial = defaultForm();
    if (entity === 'students') {
      const s = item as StudentRow;
      initial.firstName = s.firstName;
      initial.lastName = s.lastName;
      initial.email = s.email;
      initial.rollNumber = s.rollNumber || '';
      initial.departmentId = typeof s.departmentId === 'object' ? s.departmentId._id : s.departmentId || '';
      initial.batchId = typeof s.batchId === 'object' ? s.batchId._id : s.batchId || '';
    } else if (entity === 'professors') {
      const p = item as ProfessorRow;
      initial.firstName = p.firstName;
      initial.lastName = p.lastName;
      initial.email = p.email;
      initial.departmentId = typeof p.departmentId === 'object' ? p.departmentId._id : p.departmentId || '';
    } else if (entity === 'courses') {
      const c = item as CourseRow;
      initial.code = c.code;
      initial.title = c.title;
      initial.credits = c.credits;
      initial.weeklyTheoryHours = c.weeklyTheoryHours;
      initial.weeklyLabHours = c.weeklyLabHours;
      initial.departmentId = typeof c.departmentId === 'object' ? c.departmentId._id : c.departmentId || '';
      initial.professorIds = (c.professorIds || []).map((prof) =>
        typeof prof === 'object' ? prof._id : prof
      );
    } else if (entity === 'semesters') {
      const sec = item as SectionRow;
      initial.name = sec.name;
      initial.semester = sec.semester;
      initial.academicYear = sec.academicYear;
      initial.departmentId = typeof sec.departmentId === 'object' ? sec.departmentId._id : sec.departmentId || '';
    } else if (entity === 'rooms') {
      const r = item as RoomRow;
      initial.name = r.name;
      initial.building = r.building;
      initial.capacity = r.capacity;
      initial.type = r.type;
      initial.hasProjector = r.hasProjector;
    } else if (entity === 'departments') {
      const d = item as DepartmentRow;
      initial.name = d.name;
      initial.code = d.code;
      initial.building = d.building || '';
    }

    setForm(initial);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError('');

    let payload: Record<string, unknown> = {};

    if (entity === 'students') {
      payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        departmentId: form.departmentId,
        batchId: form.batchId,
      };
      if (form.rollNumber.trim()) payload.rollNumber = form.rollNumber.trim();
      if (!editingItem) payload.password = form.password;
    } else if (entity === 'professors') {
      payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        departmentId: form.departmentId,
      };
      if (!editingItem) payload.password = form.password;
    } else if (entity === 'courses') {
      payload = {
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        departmentId: form.departmentId,
        credits: Number(form.credits),
        weeklyTheoryHours: Number(form.weeklyTheoryHours),
        weeklyLabHours: Number(form.weeklyLabHours),
        professorIds: form.professorIds,
      };
    } else if (entity === 'semesters') {
      payload = {
        name: form.name.trim(),
        departmentId: form.departmentId,
        semester: Number(form.semester),
        academicYear: form.academicYear.trim(),
      };
    } else if (entity === 'rooms') {
      payload = {
        name: form.name.trim(),
        building: form.building.trim(),
        capacity: Number(form.capacity),
        type: form.type,
        hasProjector: form.hasProjector,
      };
    } else if (entity === 'departments') {
      payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        building: form.building.trim() || undefined,
      };
    }

    try {
      if (editingItem) {
        await apiClient.patch(`/admin/${entity}/${editingItem._id}`, payload);
        showToast('Record updated successfully', 'success');
      } else {
        await apiClient.post(`/admin/${entity}`, payload);
        showToast('Record created successfully', 'success');
      }
      setIsFormOpen(false);
      await Promise.all([loadItems(entity), loadLookups()]);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'Failed to save record'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      const response = await apiClient.delete<{
        success: boolean;
        data?: { warning?: string };
        message: string;
      }>(`/admin/${entity}/${deactivateTarget._id}`);

      const warning = response.data?.data?.warning;
      if (warning) {
        showToast(warning, 'warning');
      } else {
        showToast('Record deactivated', 'info');
      }

      setDeactivateTarget(null);
      await Promise.all([loadItems(entity), loadLookups()]);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to deactivate record'), 'error');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async (item: EntityRow) => {
    try {
      await apiClient.patch(`/admin/${entity}/${item._id}/reactivate`);
      showToast('Record reactivated successfully', 'success');
      await Promise.all([loadItems(entity), loadLookups()]);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to reactivate record'), 'error');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword.length > 72) {
      setPasswordError('Password cannot exceed 72 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (!passwordTarget) return;

    setIsChangingPassword(true);
    try {
      await apiClient.patch(`/admin/users/${passwordTarget._id}/password`, {
        password: newPassword,
      });
      showToast(`Password updated for ${passwordTarget.firstName} ${passwordTarget.lastName}`, 'success');
      setPasswordTarget(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordError(getErrorMessage(err, 'Failed to change password'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) return;

    setIsImportingCsv(true);
    setCsvResult(null);
    try {
      const { data } = await apiClient.post<{
        data: {
          importedCount: number;
          failedCount: number;
          errors: Array<{ row: number; email?: string; error: string }>;
        };
      }>('/admin/students/import', { csv: csvContent });

      setCsvResult(data.data);
      showToast(`Imported ${data.data.importedCount} student(s)`, 'success');
      await Promise.all([loadItems('students'), loadLookups()]);
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'CSV import failed'), 'error');
    } finally {
      setIsImportingCsv(false);
    }
  };

  const getItemLabel = (item: EntityRow): string => {
    if ('firstName' in item) return `${item.firstName} ${item.lastName}`;
    if ('title' in item) return `${item.code} · ${item.title}`;
    return item.name;
  };

  const getSubLabel = (item: EntityRow): string => {
    if (entity === 'students') {
      const s = item as StudentRow;
      return `${s.rollNumber || 'No roll'} · ${s.email}`;
    }
    if (entity === 'professors') {
      const p = item as ProfessorRow;
      return p.email;
    }
    if (entity === 'courses') {
      const c = item as CourseRow;
      return `${c.credits} credits · ${c.weeklyTheoryHours}h theory / ${c.weeklyLabHours}h lab`;
    }
    if (entity === 'semesters') {
      const sec = item as SectionRow;
      return `Semester ${sec.semester} · ${sec.academicYear}`;
    }
    if (entity === 'rooms') {
      const r = item as RoomRow;
      return `${r.building} · Capacity ${r.capacity}`;
    }
    if (entity === 'departments') {
      const d = item as DepartmentRow;
      return `Code: ${d.code}${d.building ? ` · ${d.building}` : ''}`;
    }
    return '';
  };

  const getDetailBadge = (item: EntityRow) => {
    if (entity === 'students') {
      const s = item as StudentRow;
      const deptName = typeof s.departmentId === 'object' ? s.departmentId.code : '';
      const batchName = typeof s.batchId === 'object' ? s.batchId.name : '';
      return (
        <span className="text-xs text-slate-500">
          {deptName} {batchName ? `· ${batchName}` : ''}
        </span>
      );
    }
    if (entity === 'professors') {
      const p = item as ProfessorRow;
      return typeof p.departmentId === 'object' ? (
        <span className="text-xs text-slate-500">{p.departmentId.name}</span>
      ) : null;
    }
    if (entity === 'courses') {
      const c = item as CourseRow;
      const activeProfCount = (c.professorIds || []).filter((p) =>
        typeof p === 'object' ? p.isActive !== false : true
      ).length;
      return (
        <span className="text-xs text-slate-500">
          {activeProfCount} faculty assigned
        </span>
      );
    }
    if (entity === 'semesters') {
      const sec = item as SectionRow;
      return typeof sec.departmentId === 'object' ? (
        <span className="text-xs text-slate-500">{sec.departmentId.name}</span>
      ) : null;
    }
    if (entity === 'rooms') {
      const r = item as RoomRow;
      return (
        <Badge variant={r.type === 'LABORATORY' ? 'info' : 'neutral'}>
          {r.type} {r.hasProjector ? '· Projector' : ''}
        </Badge>
      );
    }
    return null;
  };

  const currentTab = entityTabs.find((t) => t.id === entity)!;
  const CurrentIcon = currentTab.icon || Building;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-sky-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Academic records
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage students, faculty, courses, sections, rooms, and departments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {entity === 'students' && (
            <Button
              variant="secondary"
              onClick={() => {
                setCsvContent('');
                setCsvResult(null);
                setIsCsvModalOpen(true);
              }}
              icon={<Upload className="h-4 w-4" />}
            >
              Import CSV
            </Button>
          )}
          <Button
            variant="primary"
            onClick={openCreateModal}
            icon={<CirclePlus className="h-4 w-4" />}
          >
            Add {entity === 'semesters' ? 'Section' : currentTab.label.slice(0, -1)}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5">
        <Tabs
          tabs={entityTabs}
          activeTab={entity}
          onChange={(tab) => {
            setEntity(tab);
            setSearch('');
          }}
        />
      </div>

      {pageError && (
        <div className="mb-4">
          <Banner variant="error" onDismiss={() => setPageError('')}>
            {pageError}
          </Banner>
        </div>
      )}

      {/* Main List Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold text-slate-900">{currentTab.label}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {filteredItems.length} of {items.length} records · Inactive items are retained for academic integrity
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${currentTab.label.toLowerCase()}...`}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            Loading {currentTab.label.toLowerCase()}...
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={CurrentIcon}
            title={search ? 'No matching records' : `No ${currentTab.label.toLowerCase()} yet`}
            description={
              search
                ? 'Try adjusting your search criteria.'
                : `Add a ${currentTab.label.slice(0, -1).toLowerCase()} to get started.`
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <div
                key={item._id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6 hover:bg-slate-50/50 transition"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <CurrentIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {getItemLabel(item)}
                      </p>
                      <Badge variant={item.isActive ? 'success' : 'neutral'}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-slate-500 mt-0.5">
                      {getSubLabel(item)}
                    </p>
                  </div>
                </div>

                <div className="hidden md:block">{getDetailBadge(item)}</div>

                <div className="flex items-center gap-1">
                  {(entity === 'students' || entity === 'professors') && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPasswordTarget(item as ProfessorRow | StudentRow);
                        setNewPassword('');
                        setConfirmPassword('');
                        setPasswordError('');
                      }}
                      title="Reset password"
                      icon={<KeyRound className="h-4 w-4 text-amber-600" />}
                    />
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => openEditModal(item)}
                    title="Edit record"
                    icon={<Pencil className="h-4 w-4 text-sky-600" />}
                  />
                  {item.isActive ? (
                    <Button
                      variant="ghost"
                      onClick={() => setDeactivateTarget(item)}
                      title="Deactivate record"
                      icon={<Trash2 className="h-4 w-4 text-red-600" />}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => void handleReactivate(item)}
                      title="Reactivate record"
                      icon={<RotateCcw className="h-4 w-4 text-emerald-600" />}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={`${editingItem ? 'Edit' : 'Add'} ${
          entity === 'semesters' ? 'Section' : currentTab.label.slice(0, -1)
        }`}
        description="Fill in the required information below."
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <Banner variant="error" onDismiss={() => setFormError('')}>
              {formError}
            </Banner>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {(entity === 'students' || entity === 'professors') && (
              <>
                <Field
                  label="First Name"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
                <Field
                  label="Last Name"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
                <Field
                  label="Email Address"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                {!editingItem && (
                  <Field
                    label="Initial Password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    hint="At least 8 characters (max 72)."
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                )}
                <Select
                  label="Department"
                  required
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.code} · {d.name}
                    </option>
                  ))}
                </Select>
                {entity === 'students' && (
                  <>
                    <Field
                      label="Roll Number"
                      value={form.rollNumber}
                      onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                    />
                    <Select
                      label="Section / Cohort"
                      required
                      value={form.batchId}
                      onChange={(e) => setForm({ ...form, batchId: e.target.value })}
                    >
                      <option value="">Select Section</option>
                      {batches.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name} (Semester {b.semester} · {b.academicYear})
                        </option>
                      ))}
                    </Select>
                  </>
                )}
              </>
            )}

            {entity === 'courses' && (
              <>
                <Field
                  label="Course Code"
                  required
                  placeholder="e.g. CS1301"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
                <Field
                  label="Course Title"
                  required
                  placeholder="e.g. Operating Systems"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <Select
                  label="Department"
                  required
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.code} · {d.name}
                    </option>
                  ))}
                </Select>
                <Field
                  label="Credits"
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: parseInt(e.target.value, 10) || 1 })}
                />
                <Field
                  label="Weekly Theory Hours"
                  type="number"
                  min={0}
                  max={40}
                  required
                  value={form.weeklyTheoryHours}
                  onChange={(e) => setForm({ ...form, weeklyTheoryHours: parseInt(e.target.value, 10) || 0 })}
                />
                <Field
                  label="Weekly Lab Hours"
                  type="number"
                  min={0}
                  max={40}
                  required
                  value={form.weeklyLabHours}
                  onChange={(e) => setForm({ ...form, weeklyLabHours: parseInt(e.target.value, 10) || 0 })}
                />
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Eligible Faculty Pool
                  </label>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-3 grid gap-2 sm:grid-cols-2">
                    {professors.length > 0 ? (
                      professors.map((p) => {
                        const isChecked = form.professorIds.includes(p._id);
                        return (
                          <label key={p._id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setForm({
                                  ...form,
                                  professorIds: e.target.checked
                                    ? [...form.professorIds, p._id]
                                    : form.professorIds.filter((id) => id !== p._id),
                                });
                              }}
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            <span>{p.firstName} {p.lastName}</span>
                          </label>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500">No active professors available.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {entity === 'semesters' && (
              <>
                <Field
                  label="Section Name"
                  required
                  placeholder="e.g. CSE-III-A-2026"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Select
                  label="Department"
                  required
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.code} · {d.name}
                    </option>
                  ))}
                </Select>
                <Field
                  label="Semester"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: parseInt(e.target.value, 10) || 1 })}
                />
                <Field
                  label="Academic Year"
                  required
                  placeholder="YYYY-YYYY"
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                />
              </>
            )}

            {entity === 'rooms' && (
              <>
                <Field
                  label="Room Name"
                  required
                  placeholder="e.g. C302"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Field
                  label="Building"
                  required
                  placeholder="e.g. C Block"
                  value={form.building}
                  onChange={(e) => setForm({ ...form, building: e.target.value })}
                />
                <Field
                  label="Capacity"
                  type="number"
                  min={1}
                  max={1000}
                  required
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value, 10) || 1 })}
                />
                <Select
                  label="Room Type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'THEORY' | 'LABORATORY' })}
                >
                  <option value="THEORY">Theory</option>
                  <option value="LABORATORY">Laboratory</option>
                </Select>
                <div className="flex items-center gap-2 self-end pb-2">
                  <input
                    type="checkbox"
                    id="hasProjector"
                    checked={form.hasProjector}
                    onChange={(e) => setForm({ ...form, hasProjector: e.target.checked })}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor="hasProjector" className="text-sm font-medium text-slate-700">
                    Projector Available
                  </label>
                </div>
              </>
            )}

            {entity === 'departments' && (
              <>
                <Field
                  label="Department Name"
                  required
                  placeholder="e.g. Computer Science and Engineering"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Field
                  label="Department Code"
                  required
                  placeholder="e.g. CSE"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
                <Field
                  label="Building (Optional)"
                  placeholder="e.g. C Block"
                  value={form.building}
                  onChange={(e) => setForm({ ...form, building: e.target.value })}
                />
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSaving} icon={<Check className="h-4 w-4" />}>
              {editingItem ? 'Save Changes' : 'Create Record'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        isOpen={!!passwordTarget}
        onClose={() => setPasswordTarget(null)}
        title="Reset Account Password"
        description={
          passwordTarget
            ? `${passwordTarget.firstName} ${passwordTarget.lastName} (${passwordTarget.email})`
            : ''
        }
        maxWidth="md"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {passwordError && (
            <Banner variant="error" onDismiss={() => setPasswordError('')}>
              {passwordError}
            </Banner>
          )}

          <Field
            label="New Password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Field
            label="Confirm Password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <p className="text-xs text-slate-500">
            Changing the password revokes all active sessions for this account.
          </p>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setPasswordTarget(null)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isChangingPassword}>
              Update Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title={`Deactivate ${deactivateTarget ? getItemLabel(deactivateTarget) : 'record'}?`}
        description="This record will be set to inactive and retained for historical and existing academic records."
        confirmLabel="Deactivate"
        isDestructive
        isLoading={isDeactivating}
      />

      {/* Student CSV Import Modal */}
      <Modal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        title="Import Students from CSV"
        description="Upload or paste student roster data with headers: firstName, lastName, email, rollNumber, departmentCode, batchName, password."
        maxWidth="2xl"
      >
        <form onSubmit={handleCsvImport} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CSV Data (Comma-separated)
            </label>
            <textarea
              rows={8}
              required
              className="block w-full font-mono text-xs rounded-lg border border-slate-300 p-3 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              placeholder={`firstName,lastName,email,rollNumber,departmentCode,batchName,password\nRahul,Verma,rahul@sam.edu,24CS01,CSE,CSE-III-A-2026,Password@123`}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
            />
          </div>

          {csvResult && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
              <p className="font-semibold text-slate-800">
                Imported: {csvResult.importedCount} | Failed: {csvResult.failedCount}
              </p>
              {csvResult.errors.length > 0 && (
                <div className="max-h-28 overflow-y-auto text-red-600">
                  {csvResult.errors.map((err, idx) => (
                    <p key={idx}>
                      Row {err.row}: {err.error} ({err.email})
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsCsvModalOpen(false)} type="button">
              Close
            </Button>
            <Button variant="primary" type="submit" isLoading={isImportingCsv} icon={<Upload className="h-4 w-4" />}>
              Start Import
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
