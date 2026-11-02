import { Request, Response, NextFunction } from 'express';
import { Course } from '../models/Course';
import { User } from '../models/User';
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

export const getDepartmentFaculty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const deptId = (req.user?.departmentId as any)?._id || req.user?.departmentId;
    if (!deptId) {
      sendSuccess(res, { items: [] }, 'No department assigned');
      return;
    }
    const faculty = await User.find({
      departmentId: deptId,
      role: 'PROFESSOR',
      isActive: true,
    })
      .select('firstName lastName email departmentId')
      .sort({ firstName: 1 });
    sendSuccess(res, { items: faculty }, 'Department faculty fetched successfully');
  } catch (error) {
    next(error);
  }
};

