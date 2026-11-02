import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, ApiError } from '../utils/response';
import { CourseOffering } from '../models/CourseOffering';
import { AcademicTerm } from '../models/AcademicTerm';
import { Course } from '../models/Course';
import { Batch } from '../models/Batch';
import { User } from '../models/User';

export const createOfferingSchema = z.object({
  termId: z.string().min(1, 'termId is required'),
  courseId: z.string().min(1, 'courseId is required'),
  batchId: z.string().min(1, 'batchId is required'),
  professorIds: z.array(z.string()).default([]),
  theoryHoursPerWeek: z.number().int().min(0).default(3),
  labBlocksPerWeek: z.number().int().min(0).default(0),
  labBlockLength: z.number().int().min(1).max(4).default(2),
  isActive: z.boolean().default(true),
});

export const updateOfferingSchema = z.object({
  professorIds: z.array(z.string()).optional(),
  theoryHoursPerWeek: z.number().int().min(0).optional(),
  labBlocksPerWeek: z.number().int().min(0).optional(),
  labBlockLength: z.number().int().min(1).max(4).optional(),
  isActive: z.boolean().optional(),
});

export const bulkDepartmentSchema = z.object({
  termId: z.string().min(1, 'termId is required'),
  departmentId: z.string().min(1, 'departmentId is required'),
});

export const listOfferings = asyncHandler(async (req: Request, res: Response) => {
  const { termId, batchId, courseId } = req.query;

  const query: Record<string, unknown> = {};
  if (termId) {
    query.termId = termId;
  }
  if (batchId) {
    query.batchId = batchId;
  }
  if (courseId) {
    query.courseId = courseId;
  }

  const offerings = await CourseOffering.find(query)
    .populate('courseId', 'code title credits departmentId weeklyTheoryHours weeklyLabHours')
    .populate('batchId', 'name semester academicYear departmentId')
    .populate('professorIds', 'firstName lastName email departmentId role')
    .populate('termId', 'name academicYear semesterType isActive')
    .sort({ createdAt: -1 });

  sendSuccess(res, { items: offerings }, 'Offerings fetched successfully');
});

export const createOffering = asyncHandler(async (req: Request, res: Response) => {
  const {
    termId,
    courseId,
    batchId,
    professorIds = [],
    theoryHoursPerWeek,
    labBlocksPerWeek,
    labBlockLength,
    isActive = true,
  } = req.body;

  // Validate term existence
  const term = await AcademicTerm.findById(termId);
  if (!term) {
    throw new ApiError(404, 'Academic term not found');
  }

  // Validate course existence
  const course = await Course.findById(courseId);
  if (!course || !course.isActive) {
    throw new ApiError(404, 'Course not found or inactive');
  }

  // Validate batch existence
  const batch = await Batch.findById(batchId);
  if (!batch || !batch.isActive) {
    throw new ApiError(404, 'Batch/Section not found or inactive');
  }

  // Validate professorIds
  if (professorIds.length > 0) {
    const professors = await User.find({
      _id: { $in: professorIds },
      role: 'PROFESSOR',
      isActive: true,
    });
    if (professors.length !== professorIds.length) {
      throw new ApiError(400, 'One or more professor IDs are invalid or not active faculty');
    }
  }

  // Check unique compound constraint
  const existing = await CourseOffering.findOne({ termId, courseId, batchId });
  if (existing) {
    throw new ApiError(409, 'An offering for this course and section already exists in this term');
  }

  const offering = await CourseOffering.create({
    termId,
    courseId,
    batchId,
    professorIds,
    theoryHoursPerWeek: theoryHoursPerWeek ?? course.weeklyTheoryHours,
    labBlocksPerWeek: labBlocksPerWeek ?? (course.weeklyLabHours > 0 ? 1 : 0),
    labBlockLength: labBlockLength ?? (course.weeklyLabHours > 0 ? course.weeklyLabHours : 2),
    isActive: isActive && professorIds.length > 0,
  });

  const populated = await CourseOffering.findById(offering._id)
    .populate('courseId', 'code title credits departmentId')
    .populate('batchId', 'name semester')
    .populate('professorIds', 'firstName lastName email');

  sendSuccess(res, populated, 'Course offering created successfully', 201);
});

export const updateOffering = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const offering = await CourseOffering.findById(id);
  if (!offering) {
    throw new ApiError(404, 'Course offering not found');
  }

  const { professorIds, theoryHoursPerWeek, labBlocksPerWeek, labBlockLength, isActive } = req.body;

  if (professorIds !== undefined) {
    if (professorIds.length > 0) {
      const professors = await User.find({
        _id: { $in: professorIds },
        role: 'PROFESSOR',
        isActive: true,
      });
      if (professors.length !== professorIds.length) {
        throw new ApiError(400, 'One or more professor IDs are invalid or not active faculty');
      }
    }
    offering.professorIds = professorIds.map((pId: string) => new Types.ObjectId(pId));
  }

  if (theoryHoursPerWeek !== undefined) offering.theoryHoursPerWeek = theoryHoursPerWeek;
  if (labBlocksPerWeek !== undefined) offering.labBlocksPerWeek = labBlocksPerWeek;
  if (labBlockLength !== undefined) offering.labBlockLength = labBlockLength;
  if (isActive !== undefined) offering.isActive = isActive;

  await offering.save();

  const populated = await CourseOffering.findById(offering._id)
    .populate('courseId', 'code title credits departmentId')
    .populate('batchId', 'name semester')
    .populate('professorIds', 'firstName lastName email');

  sendSuccess(res, populated, 'Course offering updated successfully');
});

export const deleteOffering = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const offering = await CourseOffering.findById(id);
  if (!offering) {
    throw new ApiError(404, 'Course offering not found');
  }

  offering.isActive = false;
  await offering.save();

  sendSuccess(res, { id: offering._id }, 'Course offering deactivated successfully');
});

export const bulkFromDepartment = asyncHandler(async (req: Request, res: Response) => {
  const { termId, departmentId } = req.body;

  const term = await AcademicTerm.findById(termId);
  if (!term) {
    throw new ApiError(404, 'Academic term not found');
  }

  const courses = await Course.find({ departmentId, isActive: true });
  const batches = await Batch.find({ departmentId, isActive: true }).sort({ name: 1 });

  if (courses.length === 0 || batches.length === 0) {
    throw new ApiError(400, 'No active courses or sections found for this department');
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const course of courses) {
    for (let bIndex = 0; bIndex < batches.length; bIndex += 1) {
      const batch = batches[bIndex];
      const existing = await CourseOffering.findOne({
        termId: term._id,
        courseId: course._id,
        batchId: batch._id,
      });

      if (existing) {
        skippedCount += 1;
        continue;
      }

      // Assign faculty:
      // If course is a lab (e.g. weeklyLabHours > 0 or code ends in -LAB), all eligible faculty co-teach
      // If course is a theory course with multiple faculty, assign faculty according to section index
      let assignedProfessors: Types.ObjectId[] = [];
      const eligible = course.professorIds || [];

      if (eligible.length === 0) {
        assignedProfessors = [];
      } else if (course.weeklyLabHours > 0 || course.code.endsWith('-LAB')) {
        assignedProfessors = [...eligible];
      } else {
        // Theory course: assign one faculty per section if multiple available
        assignedProfessors = eligible.length > bIndex ? [eligible[bIndex]] : [eligible[0]];
      }

      const isFractal = eligible.length === 0;

      await CourseOffering.create({
        termId: term._id,
        courseId: course._id,
        batchId: batch._id,
        professorIds: assignedProfessors,
        theoryHoursPerWeek: course.weeklyTheoryHours,
        labBlocksPerWeek: course.weeklyLabHours > 0 ? 1 : 0,
        labBlockLength: course.weeklyLabHours > 0 ? course.weeklyLabHours : 2,
        isActive: !isFractal,
      });

      createdCount += 1;
    }
  }

  sendSuccess(
    res,
    { createdCount, skippedCount, totalProcessed: createdCount + skippedCount },
    `Bulk creation finished: ${createdCount} created, ${skippedCount} skipped (already existed)`
  );
});

export const getProfessorOfferings = asyncHandler(async (req: Request, res: Response) => {
  const professorId = req.user!._id;

  const offerings = await CourseOffering.find({
    professorIds: professorId,
    isActive: true,
  })
    .populate('courseId', 'code title credits departmentId weeklyTheoryHours weeklyLabHours')
    .populate('batchId', 'name semester academicYear')
    .populate('professorIds', 'firstName lastName email')
    .populate('termId', 'name academicYear semesterType isActive')
    .sort({ 'courseId.code': 1 });

  sendSuccess(res, { items: offerings }, 'Assigned offerings fetched successfully');
});
