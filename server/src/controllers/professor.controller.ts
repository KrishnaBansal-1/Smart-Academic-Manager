import { Request, Response, NextFunction } from 'express';
import { Course } from '../models/Course';
import { sendSuccess } from '../utils/response';

export const getAssignedCourses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const courses = await Course.find({ professorIds: req.user!._id, isActive: true })
      .populate('departmentId', 'name code')
      .sort({ code: 1 });
    sendSuccess(res, { items: courses }, 'Assigned courses fetched successfully');
  } catch (error) {
    next(error);
  }
};
