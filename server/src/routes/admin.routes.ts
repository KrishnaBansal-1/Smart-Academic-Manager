import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validateRequest } from '../middlewares/validate.middleware';
import { createAdminResource, deactivateAdminResource, listAdminResources, updateAdminResource } from '../controllers/admin.controller';

const router = Router();
const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record id');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Please select a valid option');
const name = z.string().trim().min(1).max(100);
const email = z.string().trim().email().max(160);
const positiveInt = z.number().int().min(1);
const professor = z.object({ firstName: name, lastName: name, email, password: z.string().min(8).max(100), departmentId: objectId });
const student = professor.extend({ batchId: objectId, rollNumber: z.string().trim().min(1).max(30) });
const professorUpdate = professor.omit({ password: true }).partial();
const studentUpdate = student.omit({ password: true }).partial();
const course = z.object({ code: z.string().trim().min(1).max(20), title: name, departmentId: objectId, credits: positiveInt, weeklyTheoryHours: z.number().int().min(0), weeklyLabHours: z.number().int().min(0), professorIds: z.array(objectId).default([]) });
const semester = z.object({ name, departmentId: objectId, semester: positiveInt.max(12), academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/, 'Use academic year format YYYY-YYYY') });
const room = z.object({ name, building: name, capacity: positiveInt, type: z.enum(['THEORY', 'LABORATORY']), hasProjector: z.boolean() });
const entitySchema = z.object({ params: z.object({ entity: z.enum(['students', 'professors', 'courses', 'semesters', 'rooms', 'departments']) }), body: z.object({}).passthrough(), query: z.object({}).passthrough() });
const itemSchema = z.object({ params: z.object({ entity: z.enum(['students', 'professors', 'courses', 'semesters', 'rooms']), id }), body: z.object({}).passthrough(), query: z.object({}).passthrough() });

router.use(authenticate, authorize(['ADMIN']));
router.get('/:entity', validateRequest(entitySchema), listAdminResources);
router.post('/:entity', validateRequest(z.union([
  z.object({ params: z.object({ entity: z.literal('students') }), body: student, query: z.object({}).passthrough() }),
  z.object({ params: z.object({ entity: z.literal('professors') }), body: professor, query: z.object({}).passthrough() }),
  z.object({ params: z.object({ entity: z.literal('courses') }), body: course, query: z.object({}).passthrough() }),
  z.object({ params: z.object({ entity: z.literal('semesters') }), body: semester, query: z.object({}).passthrough() }),
  z.object({ params: z.object({ entity: z.literal('rooms') }), body: room, query: z.object({}).passthrough() }),
])) , createAdminResource);
router.patch('/:entity/:id', validateRequest(z.union([
  z.object({ params: z.object({ entity: z.literal('students'), id }), body: studentUpdate, query: z.object({}).passthrough() }),
  z.object({ params: z.object({ entity: z.literal('professors'), id }), body: professorUpdate, query: z.object({}).passthrough() }),
  z.object({ params: z.object({ entity: z.literal('courses'), id }), body: course.partial(), query: z.object({}).passthrough() }),
  z.object({ params: z.object({ entity: z.literal('semesters'), id }), body: semester.partial(), query: z.object({}).passthrough() }),
  z.object({ params: z.object({ entity: z.literal('rooms'), id }), body: room.partial(), query: z.object({}).passthrough() }),
])), updateAdminResource);
router.delete('/:entity/:id', validateRequest(itemSchema), deactivateAdminResource);

export default router;
