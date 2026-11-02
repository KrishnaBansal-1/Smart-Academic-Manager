export type UserRole = 'ADMIN' | 'PROFESSOR' | 'STUDENT';

export interface DepartmentSummary {
  _id: string;
  name: string;
  code: string;
}

export interface BatchSummary {
  _id: string;
  name: string;
  semester: number;
  academicYear?: string;
}

export interface User {
  id: string;
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: string | DepartmentSummary;
  batchId?: string | BatchSummary;
  rollNumber?: string;
  tokenVersion?: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}
