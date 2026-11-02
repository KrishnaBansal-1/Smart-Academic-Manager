import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, BookOpen, Building2, CalendarDays, Check, CirclePlus, GraduationCap, Loader2, Pencil, Search, Trash2, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';

type Entity = 'students' | 'professors' | 'courses' | 'semesters' | 'rooms';
type Row = Record<string, any>;
type Department = { _id: string; name: string; code: string };
type Section = { id: Entity; label: string; singular: string; icon: React.ElementType };

const sections: Section[] = [
  { id: 'students', label: 'Students', singular: 'student', icon: GraduationCap },
  { id: 'professors', label: 'Professors', singular: 'professor', icon: Users },
  { id: 'courses', label: 'Courses', singular: 'course', icon: BookOpen },
  { id: 'semesters', label: 'Semesters', singular: 'semester', icon: CalendarDays },
  { id: 'rooms', label: 'Rooms', singular: 'room', icon: Building2 },
];

const emptyForm = (entity: Entity): Row => {
  if (entity === 'students') return { firstName: '', lastName: '', email: '', password: '', departmentId: '', batchId: '', rollNumber: '' };
  if (entity === 'professors') return { firstName: '', lastName: '', email: '', password: '', departmentId: '' };
  if (entity === 'courses') return { code: '', title: '', departmentId: '', credits: '3', weeklyTheoryHours: '3', weeklyLabHours: '0', professorIds: [] };
  if (entity === 'semesters') return { name: '', departmentId: '', semester: '1', academicYear: '' };
  return { name: '', building: '', capacity: '30', type: 'THEORY', hasProjector: true };
};

const getErrorMessage = (error: any) => error?.response?.data?.message || 'Something went wrong. Please try again.';

export const AdminManagement: React.FC = () => {
  const [entity, setEntity] = useState<Entity>('students');
  const [items, setItems] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Row[]>([]);
  const [professors, setProfessors] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Row>(emptyForm('students'));
  const [editing, setEditing] = useState<Row | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loadItems = useCallback(async (target: Entity) => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get<{ data: { items: Row[] } }>(`/admin/${target}`);
      setItems(data.data.items);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadItems(entity); }, [entity, loadItems]);
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [deptResult, batchResult, profResult] = await Promise.all([
          apiClient.get<{ data: { items: Department[] } }>('/admin/departments'),
          apiClient.get<{ data: { items: Row[] } }>('/admin/semesters'),
          apiClient.get<{ data: { items: Row[] } }>('/admin/professors'),
        ]);
        setDepartments(deptResult.data.data.items);
        setBatches(batchResult.data.data.items.filter((item) => item.isActive));
        setProfessors(profResult.data.data.items.filter((item) => item.isActive));
      } catch {
        // The active list shows its own request error; lookups can be retried by reloading the page.
      }
    };
    void loadLookups();
  }, []);

  const section = sections.find((item) => item.id === entity)!;
  const filteredItems = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) => Object.values(item).some((field) => {
      if (typeof field === 'string' || typeof field === 'number') return String(field).toLowerCase().includes(value);
      if (field && typeof field === 'object') return Object.values(field).some((nested) => typeof nested === 'string' && nested.toLowerCase().includes(value));
      return false;
    }));
  }, [items, search]);

  const openCreate = () => { setEditing(null); setForm(emptyForm(entity)); setError(''); setIsFormOpen(true); };
  const openEdit = (item: Row) => {
    const next = { ...emptyForm(entity), ...item };
    if (entity === 'students' || entity === 'professors') {
      next.departmentId = typeof item.departmentId === 'object' ? item.departmentId?._id : item.departmentId || '';
      next.batchId = typeof item.batchId === 'object' ? item.batchId?._id : item.batchId || '';
    }
    if (entity === 'courses' || entity === 'semesters') next.departmentId = typeof item.departmentId === 'object' ? item.departmentId?._id : item.departmentId || '';
    if (entity === 'courses') next.professorIds = (item.professorIds || []).map((professor: Row) => typeof professor === 'object' ? professor._id : professor);
    setEditing(item);
    setForm(next);
    setError('');
    setIsFormOpen(true);
  };

  const setValue = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    const payload = { ...form };
    if (entity === 'students' || entity === 'professors') {
      if (!payload.batchId) delete payload.batchId;
      if (editing) delete payload.password;
    }
    if (entity === 'courses' || entity === 'semesters') {
      for (const key of ['credits', 'weeklyTheoryHours', 'weeklyLabHours', 'semester']) {
        if (payload[key] !== undefined) payload[key] = Number(payload[key]);
      }
    }
    if (entity === 'rooms') payload.capacity = Number(payload.capacity);
    try {
      if (editing) await apiClient.patch(`/admin/${entity}/${editing._id}`, payload);
      else await apiClient.post(`/admin/${entity}`, payload);
      setIsFormOpen(false);
      await loadItems(entity);
      if (entity === 'semesters' || entity === 'professors') {
        const [batchResult, profResult] = await Promise.all([
          apiClient.get<{ data: { items: Row[] } }>('/admin/semesters'),
          apiClient.get<{ data: { items: Row[] } }>('/admin/professors'),
        ]);
        setBatches(batchResult.data.data.items.filter((item) => item.isActive));
        setProfessors(profResult.data.data.items.filter((item) => item.isActive));
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (item: Row) => {
    const label = entity === 'students' || entity === 'professors' ? `${item.firstName} ${item.lastName}` : item.name || item.title || item.code;
    if (!window.confirm(`Remove ${label}? This record will be deactivated and kept for existing academic records.`)) return;
    setError('');
    try {
      await apiClient.delete(`/admin/${entity}/${item._id}`);
      await loadItems(entity);
    } catch (requestError) { setError(getErrorMessage(requestError)); }
  };

  const departmentOptions = departments.map((department) => <option key={department._id} value={department._id}>{department.code} · {department.name}</option>);
  const fieldClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100';
  const labelClass = 'block text-sm font-medium text-slate-700';

  const renderFormFields = () => {
    const textField = (key: string, label: string, required = true, type = 'text', hint?: string) => (
      <label key={key} className={labelClass}>{label}<input className={fieldClass} type={type} required={required} min={type === 'number' ? 0 : undefined} value={form[key] ?? ''} onChange={(event) => setValue(key, event.target.value)} />{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>
    );
    const departmentSelect = <label key="departmentId" className={labelClass}>Department<select className={fieldClass} required value={form.departmentId} onChange={(event) => setValue('departmentId', event.target.value)}><option value="">Select department</option>{departmentOptions}</select></label>;
    if (entity === 'students' || entity === 'professors') return <>
      {textField('firstName', 'First name')}{textField('lastName', 'Last name')}{textField('email', 'Email address', true, 'email')}
      {!editing && textField('password', 'Initial password', true, 'password', 'At least 8 characters.')}
      {departmentSelect}
      {entity === 'students' && <>
        {textField('rollNumber', 'Roll number')}
        <label className={labelClass}>Semester / cohort<select className={fieldClass} required value={form.batchId} onChange={(event) => setValue('batchId', event.target.value)}><option value="">Select a semester</option>{batches.map((batch) => <option key={batch._id} value={batch._id}>{batch.name} · Semester {batch.semester} · {batch.academicYear}</option>)}</select></label>
      </>}
    </>;
    if (entity === 'courses') return <>
      {textField('code', 'Course code')}{textField('title', 'Course title')}{departmentSelect}
      {textField('credits', 'Credits', true, 'number')}{textField('weeklyTheoryHours', 'Weekly theory hours', true, 'number')}{textField('weeklyLabHours', 'Weekly lab hours', true, 'number')}
      <fieldset className="sm:col-span-2"><legend className={labelClass}>Assigned professors</legend><div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">{professors.length ? professors.map((professor) => <label key={professor._id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={(form.professorIds || []).includes(professor._id)} onChange={(event) => setValue('professorIds', event.target.checked ? [...(form.professorIds || []), professor._id] : (form.professorIds || []).filter((id: string) => id !== professor._id))} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" />{professor.firstName} {professor.lastName}</label>) : <p className="text-sm text-slate-500">Add a professor before assigning courses.</p>}</div></fieldset>
    </>;
    if (entity === 'semesters') return <>
      {textField('name', 'Cohort / section name')}{departmentSelect}{textField('semester', 'Semester number', true, 'number')}{textField('academicYear', 'Academic year', true, 'text', 'Format: 2026-2027')}
    </>;
    return <>
      {textField('name', 'Room name')}{textField('building', 'Building')}{textField('capacity', 'Capacity', true, 'number')}
      <label className={labelClass}>Room type<select className={fieldClass} value={form.type} onChange={(event) => setValue('type', event.target.value)}><option value="THEORY">Theory</option><option value="LABORATORY">Laboratory</option></select></label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.hasProjector} onChange={(event) => setValue('hasProjector', event.target.checked)} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" />Projector available</label>
    </>;
  };

  const getPrimary = (item: Row) => entity === 'students' || entity === 'professors' ? `${item.firstName} ${item.lastName}` : entity === 'courses' ? item.title : item.name;
  const getSecondary = (item: Row) => {
    if (entity === 'students') return `${item.rollNumber || 'No roll number'} · ${item.email}`;
    if (entity === 'professors') return item.email;
    if (entity === 'courses') return `${item.code} · ${item.credits} credits`;
    if (entity === 'semesters') return `Semester ${item.semester} · ${item.academicYear}`;
    return `${item.building} · Capacity ${item.capacity}`;
  };
  const getDetail = (item: Row) => {
    const department = item.departmentId?.code || item.departmentId?.name;
    if (entity === 'students') return <>{department || 'No department'}{item.batchId?.name && <span className="block text-xs text-slate-500">{item.batchId.name}</span>}</>;
    if (entity === 'professors') return department || 'No department';
    if (entity === 'courses') return <>{department || 'No department'}<span className="block text-xs text-slate-500">{(item.professorIds || []).length} assigned</span></>;
    if (entity === 'semesters') return department || 'No department';
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{item.type === 'LABORATORY' ? 'Laboratory' : 'Theory'}{item.hasProjector ? ' · Projector' : ''}</span>;
  };

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div><Link to="/admin" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-sky-700"><ArrowLeft className="h-4 w-4" />Admin dashboard</Link><h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Academic records</h1><p className="mt-1 text-sm text-slate-500">Manage the people, courses, semesters, and spaces used across your institution.</p></div>
      <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"><CirclePlus className="h-4 w-4" />Add {section.singular}</button>
    </div>

    <div className="mb-5 flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      {sections.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { setEntity(id); setSearch(''); setIsFormOpen(false); }} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${entity === id ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><Icon className="h-4 w-4" />{label}</button>)}
    </div>

    {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}<button aria-label="Dismiss error" className="ml-auto" onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div><h2 className="font-semibold text-slate-900">{section.label}</h2><p className="mt-0.5 text-xs text-slate-500">{items.length} record{items.length === 1 ? '' : 's'} · Inactive records are retained for historical data</p></div>
        <label className="relative block w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${section.label.toLowerCase()}...`} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></label>
      </div>
      {isLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading {section.label.toLowerCase()}...</div> : filteredItems.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500"><section.icon className="h-5 w-5" /></div><p className="font-medium text-slate-800">{search ? 'No matching records' : `No ${section.label.toLowerCase()} yet`}</p><p className="mt-1 text-sm text-slate-500">{search ? 'Try another search.' : `Add a ${section.singular} to get started.`}</p></div> : <div className="divide-y divide-slate-100">
        {filteredItems.map((item) => <div key={item._id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><section.icon className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-900">{getPrimary(item)}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.isActive === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{item.isActive === false ? 'Inactive' : 'Active'}</span></div><p className="truncate text-xs text-slate-500">{getSecondary(item)}</p></div></div>
          <div className="hidden min-w-32 text-sm text-slate-600 md:block">{getDetail(item)}</div>
          <div className="flex items-center gap-1"><button onClick={() => openEdit(item)} title={`Edit ${section.singular}`} className="rounded-lg p-2 text-slate-500 transition hover:bg-sky-50 hover:text-sky-700"><Pencil className="h-4 w-4" /></button>{item.isActive !== false && <button onClick={() => void handleRemove(item)} title={`Remove ${section.singular}`} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</div>
        </div>)}
      </div>}
    </section>

    {isFormOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="management-form-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6"><div><h2 id="management-form-title" className="text-lg font-bold text-slate-900">{editing ? 'Edit' : 'Add'} {section.singular}</h2><p className="mt-1 text-sm text-slate-500">Enter the details below. Required fields are marked by the browser.</p></div><button onClick={() => setIsFormOpen(false)} aria-label="Close form" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button></div>
        <form onSubmit={handleSave} className="p-5 sm:p-6">{error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}<div className="grid gap-4 sm:grid-cols-2">{renderFormFields()}</div><div className="mt-7 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isSaving ? 'Saving...' : editing ? 'Save changes' : `Add ${section.singular}`}</button></div></form>
      </div>
    </div>}
  </div>;
};
