export type UserRole = 'ADMIN' | 'PROFESSOR' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: string | { _id: string; name: string; code: string };
  batchId?: string | { _id: string; name: string; semester: number };
  rollNumber?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
