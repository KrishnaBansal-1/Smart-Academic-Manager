import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  changeManagedUserPassword,
  createAdminResource,
  deactivateAdminResource,
  listAdminResources,
  reactivateAdminResource,
  updateAdminResource,
  importStudentsCSV,
} from '../controllers/admin.controller';
import { ApiError } from '../utils/response';

const router = Router();

const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record id');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Please select a valid option');
const name = z.string().trim().min(1, 'Name is required').max(100);
const email = z.string().trim().email('Please provide a valid email address').max(160);
const positiveInt = z.number().int().min(1);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(72, 'Password cannot exceed 72 characters');

// Creation Schemas
const studentCreateSchema = z.object({
  firstName: name,
  lastName: name,
  email,
  password,
  departmentId: objectId,
  batchId: objectId,
  rollNumber: z.string().trim().min(1).max(30).optional(),
});

const professorCreateSchema = z.object({
  firstName: name,
  lastName: name,
  email,
  password,
  departmentId: objectId,
});

const courseCreateSchema = z.object({
  code: z.string().trim().min(1).max(20),
  title: name,
  departmentId: objectId,
  credits: positiveInt,
  weeklyTheoryHours: z.number().int().min(0),
  weeklyLabHours: z.number().int().min(0),
  professorIds: z.array(objectId).default([]),
});

const semesterCreateSchema = z.object({
  name,
  departmentId: objectId,
  semester: positiveInt.max(12),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Use academic year format YYYY-YYYY'),
});

const roomCreateSchema = z.object({
  name,
  building: name,
  capacity: positiveInt,
  type: z.enum(['THEORY', 'LABORATORY']),
  hasProjector: z.boolean().default(true),
});

const departmentCreateSchema = z.object({
  name,
  code: z.string().trim().min(1).max(10),
  building: name.optional(),
});

const createSchemas: Record<string, z.ZodTypeAny> = {
  students: studentCreateSchema,
  professors: professorCreateSchema,
  courses: courseCreateSchema,
  semesters: semesterCreateSchema,
  rooms: roomCreateSchema,
  departments: departmentCreateSchema,
};

// Update Schemas
const updateSchemas: Record<string, z.ZodTypeAny> = {
  students: studentCreateSchema.omit({ password: true }).partial(),
  professors: professorCreateSchema.omit({ password: true }).partial(),
  courses: courseCreateSchema.partial(),
  semesters: semesterCreateSchema.partial(),
  rooms: roomCreateSchema.partial(),
  departments: departmentCreateSchema.partial(),
};

// Validate entity params
const entityListSchema = z.object({
  params: z.object({
    entity: z.enum(['students', 'professors', 'courses', 'semesters', 'rooms', 'departments']),
  }),
});

const entityItemSchema = z.object({
  params: z.object({
    entity: z.enum(['students', 'professors', 'courses', 'semesters', 'rooms', 'departments']),
    id,
  }),
});

const passwordSchema = z.object({
  params: z.object({ id }),
  body: z.object({ password }),
});

// Middleware for per-entity schema lookup
const validateEntityPayload = (schemas: Record<string, z.ZodTypeAny>) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const entity = req.params.entity;
    const schema = schemas[entity];
    if (!schema) {
      return next(new ApiError(404, `Unknown resource entity: '${entity}'`));
    }

    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
};

router.use(authenticate, authorize(['ADMIN']));

// Student CSV import
router.post('/students/import', importStudentsCSV);

// Password update for managed users
router.patch('/users/:id/password', validateRequest(passwordSchema), changeManagedUserPassword);

// Resource CRUD
router.get('/:entity', validateRequest(entityListSchema), listAdminResources);

router.post(
  '/:entity',
  validateRequest(entityListSchema),
  validateEntityPayload(createSchemas),
  createAdminResource
);

router.patch(
  '/:entity/:id',
  validateRequest(entityItemSchema),
  validateEntityPayload(updateSchemas),
  updateAdminResource
);

router.patch('/:entity/:id/reactivate', validateRequest(entityItemSchema), reactivateAdminResource);

router.delete('/:entity/:id', validateRequest(entityItemSchema), deactivateAdminResource);

export default router;
