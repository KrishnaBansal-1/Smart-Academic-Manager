import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Course } from '../models/Course';
import { Batch } from '../models/Batch';
import { Classroom } from '../models/Classroom';
import { Department } from '../models/Department';
import { ApiError, sendSuccess } from '../utils/response';

const asyncHandler = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

const entityModel = (entity: string): { model: any; filter: Record<string, string>; label: string } => {
  switch (entity) {
    case 'students': return { model: User, filter: { role: 'STUDENT' }, label: 'Student' };
    case 'professors': return { model: User, filter: { role: 'PROFESSOR' }, label: 'Professor' };
    case 'courses': return { model: Course, filter: {}, label: 'Course' };
    case 'semesters': return { model: Batch, filter: {}, label: 'Semester' };
    case 'rooms': return { model: Classroom, filter: {}, label: 'Room' };
    default: throw new ApiError(404, 'Management resource not found');
  }
};

const populatedUsers = (query: any) => query
  .populate('departmentId', 'name code')
  .populate('batchId', 'name semester academicYear');

const pick = (source: Record<string, any>, fields: string[]) =>
  Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));

export const listAdminResources = asyncHandler(async (req, res) => {
  const { entity } = req.params;
  if (entity === 'departments') {
    const departments = await Department.find().sort({ name: 1 });
    sendSuccess(res, { items: departments });
    return;
  }
  const config = entityModel(entity);
  let query: any = config.model.find(config.filter);
  if (entity === 'students' || entity === 'professors') query = populatedUsers(query);
  if (entity === 'courses') query = query.populate('departmentId', 'name code').populate('professorIds', 'firstName lastName email isActive');
  if (entity === 'semesters') query = query.populate('departmentId', 'name code');
  const items = await query.sort(entity === 'students' || entity === 'professors' ? { lastName: 1, firstName: 1 } : { name: 1, title: 1 });
  sendSuccess(res, { items });
});

export const createAdminResource = asyncHandler(async (req, res) => {
  const { entity } = req.params;
  const body = req.body;
  let item: any;
  if (entity === 'students' || entity === 'professors') {
    const passwordHash = await bcrypt.hash(body.password, 12);
    const fields = entity === 'students'
      ? ['firstName', 'lastName', 'email', 'departmentId', 'batchId', 'rollNumber']
      : ['firstName', 'lastName', 'email', 'departmentId'];
    item = await User.create({ ...pick(body, fields), passwordHash, role: entity === 'students' ? 'STUDENT' : 'PROFESSOR' });
    item = await populatedUsers(User.findById(item._id));
  } else if (entity === 'courses') {
    item = await Course.create(pick(body, ['code', 'title', 'departmentId', 'credits', 'weeklyTheoryHours', 'weeklyLabHours', 'professorIds']));
    item = await Course.findById(item._id).populate('departmentId', 'name code').populate('professorIds', 'firstName lastName email isActive');
  } else if (entity === 'semesters') {
    item = await Batch.create({ ...pick(body, ['name', 'departmentId', 'semester', 'academicYear']), studentCount: 0, students: [] });
    item = await Batch.findById(item._id).populate('departmentId', 'name code');
  } else if (entity === 'rooms') item = await Classroom.create(pick(body, ['name', 'building', 'capacity', 'type', 'hasProjector']));
  else throw new ApiError(404, 'Management resource not found');
  sendSuccess(res, { item }, `${entityModel(entity).label} created`, 201);
});

export const updateAdminResource = asyncHandler(async (req, res) => {
  const { entity, id } = req.params;
  const config = entityModel(entity);
  const fields: Record<string, string[]> = {
    students: ['firstName', 'lastName', 'email', 'departmentId', 'batchId', 'rollNumber'],
    professors: ['firstName', 'lastName', 'email', 'departmentId'],
    courses: ['code', 'title', 'departmentId', 'credits', 'weeklyTheoryHours', 'weeklyLabHours', 'professorIds'],
    semesters: ['name', 'departmentId', 'semester', 'academicYear'],
    rooms: ['name', 'building', 'capacity', 'type', 'hasProjector'],
  };
  const updates = pick(req.body, fields[entity] || []);
  const item = await config.model.findOneAndUpdate({ _id: id, ...config.filter }, updates, { new: true, runValidators: true });
  if (!item) throw new ApiError(404, `${config.label} not found`);
  if (entity === 'students' || entity === 'professors') await item.populate([{ path: 'departmentId', select: 'name code' }, { path: 'batchId', select: 'name semester academicYear' }]);
  if (entity === 'courses') await item.populate([{ path: 'departmentId', select: 'name code' }, { path: 'professorIds', select: 'firstName lastName email isActive' }]);
  if (entity === 'semesters') await item.populate('departmentId', 'name code');
  sendSuccess(res, { item }, `${config.label} updated`);
});

export const deactivateAdminResource = asyncHandler(async (req, res) => {
  const { entity, id } = req.params;
  const config = entityModel(entity);
  const item = await config.model.findOneAndUpdate({ _id: id, ...config.filter }, { isActive: false }, { new: true });
  if (!item) throw new ApiError(404, `${config.label} not found`);
  sendSuccess(res, { item }, `${config.label} removed`);
});

export const changeManagedUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    role: { $in: ['STUDENT', 'PROFESSOR'] },
  });
  if (!user) throw new ApiError(404, 'Student or professor not found');

  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  await user.save();
  sendSuccess(res, undefined, `Password updated for ${user.firstName} ${user.lastName}`);
});
