import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { Course } from '../models/Course';
import { Batch } from '../models/Batch';
import { Classroom } from '../models/Classroom';
import { Department } from '../models/Department';
import { Timetable } from '../models/Timetable';
import { ScheduleSlot } from '../models/ScheduleSlot';
import { ApiError, sendSuccess } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';

const entityLabel = (entity: string): string => {
  switch (entity) {
    case 'students':
      return 'Student';
    case 'professors':
      return 'Professor';
    case 'courses':
      return 'Course';
    case 'semesters':
      return 'Semester';
    case 'rooms':
      return 'Room';
    case 'departments':
      return 'Department';
    default:
      throw new ApiError(404, `Management resource '${entity}' not found`);
  }
};

const pick = <T extends Record<string, unknown>>(source: T, fields: string[]): Partial<T> =>
  Object.fromEntries(
    fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]])
  ) as Partial<T>;

const validateReferences = async (
  entity: string,
  body: Record<string, unknown>
): Promise<void> => {
  if (typeof body.departmentId === 'string') {
    const dept = await Department.findById(body.departmentId);
    if (!dept) {
      throw new ApiError(400, 'Selected department does not exist');
    }
  }

  if (entity === 'students' && typeof body.batchId === 'string') {
    const batch = await Batch.findById(body.batchId);
    if (!batch) {
      throw new ApiError(400, 'Selected cohort/section does not exist');
    }
  }

  if (entity === 'courses' && Array.isArray(body.professorIds) && body.professorIds.length > 0) {
    for (const profId of body.professorIds) {
      const professor = await User.findOne({ _id: profId, role: 'PROFESSOR' });
      if (!professor) {
        throw new ApiError(400, `Referenced professor ID '${profId}' is invalid or not a faculty member`);
      }
    }
  }
};

const checkActiveTimetableReference = async (
  entity: string,
  id: string
): Promise<string | null> => {
  const publishedTimetables = await Timetable.find({ status: 'PUBLISHED' }).select('_id');
  if (publishedTimetables.length === 0) return null;

  const timetableIds = publishedTimetables.map((t) => t._id);

  if (entity === 'professors') {
    const inUse = await ScheduleSlot.exists({
      timetableId: { $in: timetableIds },
      $or: [{ professorIds: id }, { professorId: id }],
    });
    if (inUse) return 'Warning: This professor is currently assigned to classes in a published timetable.';
  } else if (entity === 'courses') {
    const inUse = await ScheduleSlot.exists({ timetableId: { $in: timetableIds }, courseId: id });
    if (inUse) return 'Warning: This course is currently scheduled in a published timetable.';
  } else if (entity === 'semesters') {
    const inUse = await ScheduleSlot.exists({ timetableId: { $in: timetableIds }, batchId: id });
    if (inUse) return 'Warning: This section is currently scheduled in a published timetable.';
  } else if (entity === 'rooms') {
    const inUse = await ScheduleSlot.exists({ timetableId: { $in: timetableIds }, classroomId: id });
    if (inUse) return 'Warning: This room is currently assigned to classes in a published timetable.';
  }

  return null;
};

const updateEntity = async (
  entity: string,
  id: string,
  update: Record<string, unknown>
) => {
  switch (entity) {
    case 'students':
      return User.findOneAndUpdate({ _id: id, role: 'STUDENT' }, update, {
        new: true,
        runValidators: true,
      });
    case 'professors':
      return User.findOneAndUpdate({ _id: id, role: 'PROFESSOR' }, update, {
        new: true,
        runValidators: true,
      });
    case 'courses':
      return Course.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    case 'semesters':
      return Batch.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    case 'rooms':
      return Classroom.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    case 'departments':
      return Department.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    default:
      throw new ApiError(404, `Management resource '${entity}' not found`);
  }
};

export const listAdminResources = asyncHandler(async (req: Request, res: Response) => {
  const { entity } = req.params;

  let items: unknown[];
  if (entity === 'students') {
    items = await User.find({ role: 'STUDENT' })
      .populate('departmentId', 'name code')
      .populate('batchId', 'name semester academicYear')
      .sort({ lastName: 1, firstName: 1 });
  } else if (entity === 'professors') {
    items = await User.find({ role: 'PROFESSOR' })
      .populate('departmentId', 'name code')
      .populate('batchId', 'name semester academicYear')
      .sort({ lastName: 1, firstName: 1 });
  } else if (entity === 'courses') {
    items = await Course.find()
      .populate('departmentId', 'name code')
      .populate('professorIds', 'firstName lastName email isActive')
      .sort({ code: 1, title: 1 });
  } else if (entity === 'semesters') {
    items = await Batch.find()
      .populate('departmentId', 'name code')
      .sort({ name: 1 });
  } else if (entity === 'rooms') {
    items = await Classroom.find().sort({ name: 1 });
  } else if (entity === 'departments') {
    items = await Department.find().sort({ name: 1 });
  } else {
    throw new ApiError(404, `Management resource '${entity}' not found`);
  }

  sendSuccess(res, { items });
});

export const createAdminResource = asyncHandler(async (req: Request, res: Response) => {
  const { entity } = req.params;
  const body = req.body;

  await validateReferences(entity, body);

  let item: unknown;
  if (entity === 'students' || entity === 'professors') {
    const passwordHash = await bcrypt.hash(body.password, 12);
    const fields =
      entity === 'students'
        ? ['firstName', 'lastName', 'email', 'departmentId', 'batchId', 'rollNumber']
        : ['firstName', 'lastName', 'email', 'departmentId'];

    const newRecord = await User.create({
      ...pick(body, fields),
      passwordHash,
      role: entity === 'students' ? 'STUDENT' : 'PROFESSOR',
    });
    item = await User.findById(newRecord._id)
      .populate('departmentId', 'name code')
      .populate('batchId', 'name semester academicYear');
  } else if (entity === 'courses') {
    const newRecord = await Course.create(
      pick(body, [
        'code',
        'title',
        'departmentId',
        'credits',
        'weeklyTheoryHours',
        'weeklyLabHours',
        'professorIds',
      ])
    );
    item = await Course.findById(newRecord._id)
      .populate('departmentId', 'name code')
      .populate('professorIds', 'firstName lastName email isActive');
  } else if (entity === 'semesters') {
    const newRecord = await Batch.create(
      pick(body, ['name', 'departmentId', 'semester', 'academicYear'])
    );
    item = await Batch.findById(newRecord._id).populate('departmentId', 'name code');
  } else if (entity === 'rooms') {
    item = await Classroom.create(
      pick(body, ['name', 'building', 'capacity', 'type', 'hasProjector'])
    );
  } else if (entity === 'departments') {
    item = await Department.create(pick(body, ['name', 'code', 'building']));
  } else {
    throw new ApiError(404, 'Management resource not found');
  }

  sendSuccess(res, { item }, `${entityLabel(entity)} created`, 201);
});

export const updateAdminResource = asyncHandler(async (req: Request, res: Response) => {
  const { entity, id } = req.params;
  const label = entityLabel(entity);

  await validateReferences(entity, req.body);

  const fields: Record<string, string[]> = {
    students: ['firstName', 'lastName', 'email', 'departmentId', 'batchId', 'rollNumber'],
    professors: ['firstName', 'lastName', 'email', 'departmentId'],
    courses: ['code', 'title', 'departmentId', 'credits', 'weeklyTheoryHours', 'weeklyLabHours', 'professorIds'],
    semesters: ['name', 'departmentId', 'semester', 'academicYear'],
    rooms: ['name', 'building', 'capacity', 'type', 'hasProjector'],
    departments: ['name', 'code', 'building'],
  };

  const updates = pick(req.body, fields[entity] || []);
  const item = await updateEntity(entity, id, updates);

  if (!item) {
    throw new ApiError(404, `${label} not found`);
  }

  if (entity === 'students' || entity === 'professors') {
    const user = await User.findById(id)
      .populate('departmentId', 'name code')
      .populate('batchId', 'name semester academicYear');
    sendSuccess(res, { item: user }, `${label} updated`);
    return;
  }

  if (entity === 'courses') {
    const course = await Course.findById(id)
      .populate('departmentId', 'name code')
      .populate('professorIds', 'firstName lastName email isActive');
    sendSuccess(res, { item: course }, `${label} updated`);
    return;
  }

  if (entity === 'semesters') {
    const batch = await Batch.findById(id).populate('departmentId', 'name code');
    sendSuccess(res, { item: batch }, `${label} updated`);
    return;
  }

  sendSuccess(res, { item }, `${label} updated`);
});

export const deactivateAdminResource = asyncHandler(async (req: Request, res: Response) => {
  const { entity, id } = req.params;
  const label = entityLabel(entity);

  const item = await updateEntity(entity, id, { isActive: false });

  if (!item) {
    throw new ApiError(404, `${label} not found`);
  }

  const warning = await checkActiveTimetableReference(entity, id);
  const message = warning
    ? `${label} deactivated. ${warning}`
    : `${label} removed`;

  sendSuccess(res, { item, warning }, message);
});

export const reactivateAdminResource = asyncHandler(async (req: Request, res: Response) => {
  const { entity, id } = req.params;
  const label = entityLabel(entity);

  const item = await updateEntity(entity, id, { isActive: true });

  if (!item) {
    throw new ApiError(404, `${label} not found`);
  }

  sendSuccess(res, { item }, `${label} reactivated`);
});

export const changeManagedUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findOne({
    _id: req.params.id,
    role: { $in: ['STUDENT', 'PROFESSOR'] },
  });

  if (!user) {
    throw new ApiError(404, 'Student or professor not found');
  }

  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  // Increment tokenVersion so existing active sessions are revoked
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  sendSuccess(res, undefined, `Password updated for ${user.firstName} ${user.lastName}`);
});

/**
 * CSV Import for Students: POST /admin/students/import
 * CSV columns: firstName, lastName, email, rollNumber, departmentCode, batchName, password
 */
export const importStudentsCSV = asyncHandler(async (req: Request, res: Response) => {
  const csvContent: string =
    typeof req.body === 'string'
      ? req.body
      : typeof req.body?.csv === 'string'
      ? req.body.csv
      : '';

  if (!csvContent.trim()) {
    throw new ApiError(400, 'CSV content is required');
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new ApiError(400, 'CSV file must include a header and at least one student row');
  }

  const headerLine = lines[0];
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(headerLine).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const findCol = (names: string[]): number => {
    return headers.findIndex((h) => names.includes(h));
  };

  const firstIdx = findCol(['firstname', 'first']);
  const lastIdx = findCol(['lastname', 'last']);
  const emailIdx = findCol(['email', 'emailaddress']);
  const rollIdx = findCol(['rollnumber', 'roll', 'rollno']);
  const deptIdx = findCol(['department', 'departmentcode', 'dept', 'deptcode']);
  const batchIdx = findCol(['batch', 'batchname', 'section', 'cohort']);
  const passIdx = findCol(['password', 'pass']);

  if (firstIdx === -1 || lastIdx === -1 || emailIdx === -1) {
    throw new ApiError(
      400,
      'CSV header must include at least: firstName, lastName, email'
    );
  }

  const importedStudents: Array<{ id: string; email: string }> = [];
  const errors: Array<{ row: number; email?: string; error: string }> = [];

  // Cache departments and batches
  const departments = await Department.find();
  const batches = await Batch.find();

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    const rowNumber = i + 1;

    const firstName = row[firstIdx]?.trim();
    const lastName = row[lastIdx]?.trim();
    const email = row[emailIdx]?.trim().toLowerCase();
    const rollNumber = rollIdx !== -1 ? row[rollIdx]?.trim().toUpperCase() : undefined;
    const deptValue = deptIdx !== -1 ? row[deptIdx]?.trim() : undefined;
    const batchValue = batchIdx !== -1 ? row[batchIdx]?.trim() : undefined;
    const rawPassword = passIdx !== -1 && row[passIdx]?.trim() ? row[passIdx].trim() : 'Password@123';

    if (!firstName || !lastName || !email) {
      errors.push({ row: rowNumber, email, error: 'Missing required field (firstName, lastName, or email)' });
      continue;
    }

    // Resolve department
    let departmentId: Types.ObjectId | undefined;
    if (deptValue) {
      const match = departments.find(
        (d) => d.code.toLowerCase() === deptValue.toLowerCase() || d.name.toLowerCase() === deptValue.toLowerCase() || d._id.toString() === deptValue
      );
      if (!match) {
        errors.push({ row: rowNumber, email, error: `Department '${deptValue}' not found` });
        continue;
      }
      departmentId = match._id;
    }

    // Resolve batch
    let batchId: Types.ObjectId | undefined;
    if (batchValue) {
      const match = batches.find(
        (b) => b.name.toLowerCase() === batchValue.toLowerCase() || b._id.toString() === batchValue
      );
      if (!match) {
        errors.push({ row: rowNumber, email, error: `Batch/Section '${batchValue}' not found` });
        continue;
      }
      batchId = match._id;
    }

    try {
      const passwordHash = await bcrypt.hash(rawPassword, 12);
      const student = await User.create({
        firstName,
        lastName,
        email,
        rollNumber: rollNumber || undefined,
        departmentId,
        batchId,
        passwordHash,
        role: 'STUDENT',
      });
      importedStudents.push({ id: student._id.toString(), email: student.email });
    } catch (err: unknown) {
      const errorObj = err as { code?: number; message?: string };
      errors.push({
        row: rowNumber,
        email,
        error: errorObj.code === 11000 ? 'Duplicate email or roll number' : errorObj.message || 'Creation failed',
      });
    }
  }

  sendSuccess(
    res,
    {
      importedCount: importedStudents.length,
      failedCount: errors.length,
      errors,
    },
    `Successfully imported ${importedStudents.length} student(s) with ${errors.length} error(s)`
  );
});
