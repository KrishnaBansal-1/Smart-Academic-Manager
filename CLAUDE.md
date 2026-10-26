# CLAUDE.md — Smart Academic Manager (SAM)

> **Architectural Blueprint & Development Manual**  
> **Core Focus:** Schedule Generator & Editor | Attendance Records Keeper  
> **Technology Stack:** MERN (MongoDB, Express.js, React 18+, Node.js v20+) with TypeScript

---

## 1. Project Overview & Architecture Vision

**Smart Academic Manager (SAM)** is an enterprise-grade, extensible academic operations platform designed for universities and colleges. The system is engineered around a **modular monolith** architecture, ensuring strong domain boundaries between subsystems while sharing a cohesive data plane and authentication layer.

### Initial Functional Scope
1. **Module 1: Schedule Generator & Editor**
   - Automated timetable generation powered by constraint-satisfaction heuristics.
   - Interactive drag-and-drop timetable visualizer/editor for administrative fine-tuning.
   - Professor preference and soft-constraint submission portal.
   - Temporary class cancellation and rescheduling workflows with real-time conflict validation.
   - Student view-only portal synchronized with schedule changes.
2. **Module 2: Attendance Records Keeper**
   - Administrative management for academic entities (Students, Professors, Batches, Courses, Classrooms).
   - Session-based attendance marking mapped directly to the generated timetable.
   - Student self-service attendance dashboard with threshold tracking and percentage indicators.
   - Audit trails, discrepancy logging, and attendance locking mechanisms.

### Role-Based Access Control (RBAC) Hierarchy
The platform strictly enforces three core roles:
- `ADMIN`: Institutional planner and registrar. Full access to generation, manual slot editing, entity management, and institutional analytics.
- `PROFESSOR`: Faculty member. Soft-constraint authoring, faculty schedule view, class cancellation/rescheduling, and attendance marking for assigned courses.
- `STUDENT`: Read-only consumer. Access limited to their assigned batch timetable and personal attendance statistics.

```
                      +-----------------------------+
                      |   Client: React + TS (SPA)  |
                      |  (Vite, Tailwind, Dnd-kit)  |
                      +--------------+--------------+
                                     |
                                     | HTTPS / REST / WebSockets
                                     v
                      +-----------------------------+
                      |  Backend: Express + Node.js |
                      |    (Modular Monolith API)   |
                      +--+-----------+-----------+--+
                         |           |           |
        +----------------+           |           +----------------+
        v                            v                            v
+---------------+            +---------------+            +---------------+
|  Auth & RBAC  |            |  Timetable &  |            |  Attendance   |
|    Module     |            |  Constraint   |            |    Module     |
| (JWT/Bcrypt)  |            |    Engine     |            |  (Sessions)   |
+-------+-------+            +-------+-------+            +-------+-------+
        |                            |                            |
        +--------------------+       |       +--------------------+
                             v       v       v
                      +-----------------------------+
                      |       MongoDB Database      |
                      |   (Mongoose ODM + Indexes)  |
                      +-----------------------------+
```

---

## 2. Technology Stack & Dependencies

### Backend (`/server`)
- **Runtime:** Node.js (v20+ LTS recommended)
- **Framework:** Express.js (v4.19+)
- **Language:** TypeScript / Modern ES2023 with strict typing
- **Database & ODM:** MongoDB (v6.0+) with Mongoose (v8.0+)
- **Security & Auth:** `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`, `express-rate-limit`
- **Validation:** `zod` or `express-validator` for strict boundary verification
- **Scheduler Engine:** Custom CSP/Genetic Algorithm solver (Node worker threads or modular service)
- **Real-Time / Events:** `socket.io` (for timetable conflict broadcasts and instant cancellation alerts)
- **Testing:** `jest`, `supertest`

### Frontend (`/client`)
- **Framework:** React 18+ bootstrapped with Vite
- **Language:** TypeScript
- **Routing:** React Router (v6+) with declarative RBAC route guards
- **Styling & UI:** Tailwind CSS, `lucide-react` icons, Shadcn UI / Radix primitives
- **Drag-and-Drop Grid:** `@dnd-kit/core` + `@dnd-kit/utilities` (accessible, high-performance HTML5 drag-and-drop)
- **Data Fetching & State:** `@tanstack/react-query` (server cache & optimistic updates) + `zustand` (client-side timetable session state)
- **Date/Time Utilities:** `date-fns` (lightweight date manipulation)
- **HTTP Client:** `axios` with global interceptors for token refresh

---

## 3. Directory Layout

The repository uses a clear two-tier structure (`client/` and `server/`) ready for monorepo tooling (like npm/yarn/pnpm workspaces or Turborepo) if desired:

```
Smart-Academic-Manager/
├── .gitignore
├── README.md
├── CLAUDE.md                     # This blueprint
├── docker-compose.yml            # Local dev setup (Mongo + Express + React)
│
├── server/                       # Express + Node.js Backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── src/
│   │   ├── config/               # DB connection, env variables, constants
│   │   │   ├── db.ts
│   │   │   └── env.ts
│   │   ├── controllers/          # Request handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── course.controller.ts
│   │   │   ├── classroom.controller.ts
│   │   │   ├── timetable.controller.ts
│   │   │   ├── constraint.controller.ts
│   │   │   └── attendance.controller.ts
│   │   ├── middlewares/          # Security, Auth, RBAC, Validation
│   │   │   ├── auth.middleware.ts
│   │   │   ├── rbac.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── validate.middleware.ts
│   │   ├── models/               # Mongoose Schemas & TypeScript interfaces
│   │   │   ├── User.ts
│   │   │   ├── Batch.ts
│   │   │   ├── Course.ts
│   │   │   ├── Classroom.ts
│   │   │   ├── SoftConstraint.ts
│   │   │   ├── Timetable.ts
│   │   │   ├── ScheduleSlot.ts
│   │   │   ├── ScheduleOverride.ts
│   │   │   ├── AttendanceSession.ts
│   │   │   └── AttendanceRecord.ts
│   │   ├── routes/               # Express API Route definitions
│   │   │   ├── auth.routes.ts
│   │   │   ├── user.routes.ts
│   │   │   ├── timetable.routes.ts
│   │   │   ├── constraint.routes.ts
│   │   │   └── attendance.routes.ts
│   │   ├── services/             # Core business logic
│   │   │   ├── scheduler/        # Timetable generation algorithm & validator
│   │   │   │   ├── algorithm.ts  # CSP / Genetic Algorithm solver
│   │   │   │   ├── conflicts.ts  # Conflict detector (hard & soft)
│   │   │   │   └── cost.ts       # Soft constraint cost evaluation
│   │   │   ├── attendance.service.ts
│   │   │   └── socket.service.ts
│   │   └── utils/                # Helpers, seeders, loggers
│   │       ├── logger.ts
│   │       └── seeder.ts
│   └── tests/
│
└── client/                       # React 18+ Frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── api/                  # Axios instances and endpoint contracts
        │   ├── client.ts
        │   ├── timetableApi.ts
        │   └── attendanceApi.ts
        ├── assets/
        ├── components/
        │   ├── common/           # Buttons, Modal, Toast, Navbar, ProtectedRoute
        │   ├── timetable/        # Drag & Drop Grid, SlotCard, ConflictModal
        │   │   ├── TimetableGrid.tsx
        │   │   ├── DraggableSlot.tsx
        │   │   ├── DroppableCell.tsx
        │   │   ├── ConstraintForm.tsx
        │   │   └── RescheduleModal.tsx
        │   └── attendance/       # Roster, StatsCard, MarkAttendanceSheet
        │       ├── RosterTable.tsx
        │       └── AttendanceStats.tsx
        ├── context/              # AuthContext & SocketContext
        ├── hooks/                # Custom React hooks
        │   ├── useAuth.ts
        │   ├── useTimetable.ts
        │   └── useAttendance.ts
        ├── pages/                # Page views segregated by user role
        │   ├── auth/Login.tsx
        │   ├── admin/
        │   │   ├── Dashboard.tsx
        │   │   ├── TimetableManager.tsx
        │   │   └── UserManagement.tsx
        │   ├── professor/
        │   │   ├── Dashboard.tsx
        │   │   ├── ConstraintsPortal.tsx
        │   │   ├── MySchedule.tsx
        │   │   └── MarkAttendance.tsx
        │   └── student/
        │       ├── Dashboard.tsx
        │       ├── BatchTimetable.tsx
        │       └── MyAttendance.tsx
        ├── store/                # Zustand client-state stores
        └── types/                # Shared TypeScript definitions
```

---

## 4. Role-Based Access Control (RBAC) Matrix

| Domain / Resource | Action | ADMIN | PROFESSOR | STUDENT | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Authentication** | Login, Refresh Token, Profile | Yes | Yes | Yes | JWT payload includes `id`, `role`, `batchId`, `departmentId` |
| **User Management** | Create / Import / Edit Profs & Students | Yes | No | No | CSV import supported for student roster |
| **Campus Infrastructure** | CRUD Classrooms, Courses, Batches | Yes | No | No | Defines capacities, lecture vs. lab room types |
| **Soft Constraints** | Create / Update Preferences | View All | Own Only | No | Professors define days-off, preferred time-bands |
| **Timetable Generation** | Trigger Algorithmic Generation | Yes | No | No | Triggers solver worker; generates draft timetable |
| **Timetable Editor** | Drag-and-Drop Slot Move / Swap | Yes | No | No | Real-time hard-collision block & soft-cost warning |
| **Timetable Publishing** | Publish Draft to Active State | Yes | No | No | Only published schedules are visible to students |
| **Timetable View** | View Weekly Matrix | All | Own + Dept | Enrolled Batch | Student cannot inspect unrelated faculty schedules |
| **Schedule Overrides** | Cancel Specific Scheduled Class | Yes | Own Only | No | Triggers student notifications & attendance exclusion |
| **Schedule Overrides** | Reschedule Specific Class | Yes | Own Only | No | Target slot must pass 3-way hard constraint check |
| **Attendance Session** | Open / Create Attendance Session | Yes | Own Classes | No | Auto-derived from timetable slots for given date |
| **Attendance Records** | Mark / Update Student Attendance | Yes (Audit) | Yes (Active) | No | Professor has edit window; Admin has override privilege |
| **Attendance View** | View Aggregate & History | Campus | Taught Class | Own Only | Student sees breakdown, percentages, alert badges |

### RBAC Implementation Pattern
```typescript
// server/src/middlewares/rbac.middleware.ts
export const authorize = (allowedRoles: Array<'ADMIN' | 'PROFESSOR' | 'STUDENT'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this resource.',
      });
    }
    next();
  };
};
```

---

## 5. Module 1: Schedule Generator & Editor Specification

### 5.1 System Entities & Core Parameters
- **Academic Week:** Monday to Friday (configurable 5 or 6 days).
- **Time Slots:** Default 8 periods/day (e.g., 09:00 - 17:00, 1-hour slots). Configurable lunch break (e.g., 13:00 - 14:00).
- **Course Load:** E.g., 3 Lecture hours + 2 Lab hours per week.
- **Batch / Section:** E.g., `CS-2026-Section-A` (50 students).
- **Classroom / Lab:** Has maximum capacity, type (`THEORY` or `LABORATORY`), projector/equipment tags.

### 5.2 Hard Constraints (Must NEVER Be Violated)
1. **Teacher Conflict:** A professor cannot be assigned to more than one class at the same time slot.
2. **Batch Conflict:** A student batch cannot attend more than one class at the same time slot.
3. **Room Conflict:** A classroom or laboratory cannot host more than one class at the same time slot.
4. **Room Capacity & Type:** Classroom capacity $\ge$ Batch student count. Lab courses *must* be scheduled in a `LABORATORY` room.
5. **Consecutive Lab Blocks:** Lab sessions must be scheduled in uninterrupted continuous blocks (e.g., 2 consecutive hours).
6. **Institutional Blocks:** No classes can be scheduled during designated college breaks (e.g., lunch hour, campus assembly).

### 5.3 Soft Constraints (Optimized via Objective / Penalty Function)
Professors submit soft constraints through their portal:
- **Preferred Time Windows:** E.g., "Prefers morning slots (09:00 - 12:00)".
- **Non-Teaching Blocks / Research Half-Days:** E.g., "Unavailable on Wednesday afternoons".
- **Daily Teaching Limit:** E.g., "Maximum 3 hours of lectures per day".
- **Compactness / Gap Minimization:** Minimize idle gap hours between classes for faculty and student batches.
- **Lecture Spread:** Distribute a course's weekly lectures evenly across different days (avoid 3 hours of same theory subject in one day).

### 5.4 Algorithmic Solver Strategy
The generation engine employs a **Heuristic Constraint Satisfaction Problem (CSP)** with Backtracking and MRV (Minimum Remaining Values), or a **Genetic Algorithm (GA)**:
- **Chromosome / State:** A 3D tensor/array `Schedule[Day][Slot][Batch] -> { Course, Professor, Classroom }`.
- **Fitness Evaluation:**
  $$\text{Fitness} = 1.0 - \left( \frac{W_{\text{hard}} \cdot N_{\text{hard}} + \sum W_i \cdot \text{SoftViolation}_i}{\text{MaxPenalty}} \right)$$
  *(Hard constraint violations set validity to 0; generator continues until $N_{\text{hard}} = 0$ and soft penalty is minimized).*
- **Asynchronous Execution:** Generation is triggered as an async job. The admin dashboard polls or receives a WebSocket event (`TIMETABLE_GENERATED`) with generation metrics (conflicts: 0, soft score: 94.2%).

### 5.5 Interactive Drag-and-Drop Editor
- **Grid Layout:** Columns = Days (Mon - Fri), Rows = Time Slots (Period 1 to 8).
- **Multi-View Selector:**
  - *By Batch:* View and edit the weekly schedule for a single student section.
  - *By Professor:* View schedule for a faculty member.
  - *By Classroom:* View room occupancy matrix.
- **Drag-and-Drop Interaction (`@dnd-kit`):**
  - Moving a slot triggers client-side and server-side **Collision Detection**:
    - **Green Drop Target:** No hard conflicts, zero soft penalties.
    - **Yellow Drop Target:** No hard conflicts, but violates professor's soft preference (shows warning badge with reason).
    - **Red Drop Target:** HARD CONFLICT (e.g., Prof. Sharma is already teaching Batch B at Tuesday 10:00). Drop is prohibited, or triggers a "Swap Conflict" resolution modal.
  - **Draft vs. Published Workflow:** Admin edits on a `DRAFT` timetable. Only when verified does the admin click "Publish Timetable", making it live for professors and students.

### 5.6 Professor Dynamic Operations (Overrides)
1. **Temporary Class Cancellation:**
   - Professor selects a scheduled slot for a specific calendar date.
   - Enters reason (e.g., "Sick leave", "Attending academic conference").
   - Creates a `ScheduleOverride` entry with status `CANCELLED`.
   - The slot is grayed out on the student schedule; no attendance session is generated.
2. **Temporary Rescheduling:**
   - Professor selects an existing class and initiates "Reschedule".
   - The system displays a **3-Way Free Slot Finder**:
     $$\text{Available Slots} = \text{FreeSlots}(\text{Prof}) \cap \text{FreeSlots}(\text{Batch}) \cap \text{FreeClassrooms}(\text{Type})$$
   - Professor picks from the list of valid slots and submits.
   - Creates a `ScheduleOverride` entry with status `RESCHEDULED`, notifying students via the app.

---

## 6. Module 2: Attendance Records Keeper Specification

### 6.1 Entity Management (Admin)
- Admin creates and manages:
  - **Departments** (e.g., Computer Science, Mechanical).
  - **Batches** (e.g., Year 2024, Semester 3, Section A).
  - **Students:** Enrolled into batches with Roll Number, Email, Name.
  - **Professors:** Assigned to departments and mapped to courses.

### 6.2 Attendance Lifecycle
1. **Session Instantiation:**
   - Daily/hourly cron or professor trigger queries the `Timetable` + `ScheduleOverride` for the active day.
   - If a class is scheduled for Course CS201 with Prof. Rao at 10:00 AM on 2026-10-27, an `AttendanceSession` is generated:
     - Status: `SCHEDULED` $\rightarrow$ `ACTIVE` (when prof starts).
2. **Marking Interface (Professor Portal):**
   - Professor clicks "Take Attendance" from their dashboard.
   - Screen renders the batch roster of enrolled students.
   - Rapid marking controls:
     - **"Mark All Present"** button (default state for high-speed marking).
     - Individual toggles: `PRESENT` (green), `ABSENT` (red), `LATE` (yellow), `EXCUSED` (blue).
   - Professor clicks "Submit Attendance".
   - Session status changes to `SUBMITTED`.
3. **Locking & Audit Trail:**
   - Sessions automatically lock after 24 hours to prevent retrospective tampering.
   - Any modification after locking requires an `ADMIN` override with a logged reason.

### 6.3 Student Attendance Dashboard
- Real-time aggregate view:
  $$\text{Percentage} = \frac{\text{Classes Present} + \text{Classes Late}}{\text{Total Conducted Classes}} \times 100$$
- Visual indicators:
  - $\ge 75\%$: **Good Standing** (Green)
  - $65\% - 74.9\%$: **Warning Zone** (Yellow)
  - $< 65\%$: **Critical Defaulter Alert** (Red)
- Detailed drill-down: Date-wise, subject-wise attendance logs with timestamps and status.

---

## 7. Database Schemas & Data Models (MongoDB / Mongoose)

```
+----------------------------------------------------------------------------------------------------+
|                                    CORE DATA RELATIONSHIPS                                         |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [User] (ADMIN | PROFESSOR | STUDENT)                                                              |
|     ^                                                                                              |
|     |-- (professorId) ------ [SoftConstraint]                                                      |
|     |-- (professorId) ------ [ScheduleSlot]                                                        |
|     +-- (studentIds) <-----+ [Batch]                                                               |
|                            |    ^                                                                  |
|                            |    |-- (batchId) -- [ScheduleSlot]                                    |
|                            |    +-- (batchId) -- [AttendanceSession]                               |
|                            +----------------------------+                                          |
|                                                         |                                          |
|  [Course] <---- (courseId) ----- [ScheduleSlot]         |                                          |
|  [Classroom] <- (classroomId) -- [ScheduleSlot]         v                                          |
|                                         |       [AttendanceSession]                                |
|                                         |               ^                                          |
|                                         v               |-- (sessionId) -- [AttendanceRecord]      |
|                                 [ScheduleOverride]      +-- (studentId) -- [User]                  |
+----------------------------------------------------------------------------------------------------+
```

### 7.1 User Schema (`User.ts`)
```typescript
import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'ADMIN' | 'PROFESSOR' | 'STUDENT';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: Types.ObjectId;
  batchId?: Types.ObjectId; // Only for students
  rollNumber?: string;      // Only for students
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['ADMIN', 'PROFESSOR', 'STUDENT'], required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
    rollNumber: { type: String, sparse: true, uppercase: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
```

### 7.2 Classroom Schema (`Classroom.ts`)
```typescript
export interface IClassroom extends Document {
  name: string; // e.g., "Room 301", "CS Lab 2"
  building: string;
  capacity: number;
  type: 'THEORY' | 'LABORATORY';
  hasProjector: boolean;
  isActive: boolean;
}

const ClassroomSchema = new Schema<IClassroom>({
  name: { type: String, required: true, unique: true },
  building: { type: String, required: true },
  capacity: { type: Number, required: true },
  type: { type: String, enum: ['THEORY', 'LABORATORY'], default: 'THEORY' },
  hasProjector: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
});
```

### 7.3 Course & Batch Schemas
```typescript
// Course.ts
export interface ICourse extends Document {
  code: string; // e.g., "CS302"
  title: string;
  departmentId: Types.ObjectId;
  credits: number;
  weeklyTheoryHours: number;
  weeklyLabHours: number;
}

// Batch.ts
export interface IBatch extends Document {
  name: string; // e.g., "BTech-CSE-2024-SecA"
  departmentId: Types.ObjectId;
  semester: number;
  academicYear: string; // e.g., "2026-2027"
  studentCount: number;
  students: Types.ObjectId[]; // Ref to User (STUDENT)
}
```

### 7.4 Professor Soft Constraint Schema (`SoftConstraint.ts`)
```typescript
export interface ITimeWindow {
  dayOfWeek: number; // 1 (Mon) - 5 (Fri)
  startSlot: number; // e.g., 1 (09:00)
  endSlot: number;   // e.g., 4 (13:00)
}

export interface ISoftConstraint extends Document {
  professorId: Types.ObjectId;
  academicYear: string;
  semester: number;
  preferredTimeWindows: ITimeWindow[];
  unavailableWindows: ITimeWindow[]; // Research half-days, leave
  maxDailyHours: number;             // e.g., max 3 lectures/day
  priorityWeight: number;            // 1 (low) to 5 (high)
}
```

### 7.5 Timetable & Schedule Slot Schemas (`Timetable.ts`, `ScheduleSlot.ts`)
```typescript
export interface ITimetable extends Document {
  title: string;
  academicYear: string;
  semester: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  generationScore?: number;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
}

export interface IScheduleSlot extends Document {
  timetableId: Types.ObjectId;
  dayOfWeek: number; // 1 to 5
  slotIndex: number; // 1 to 8 (e.g. 1 = 09:00-10:00)
  durationSlots: number; // 1 for theory, 2 for lab
  courseId: Types.ObjectId;
  professorId: Types.ObjectId;
  batchId: Types.ObjectId;
  classroomId: Types.ObjectId;
}

const ScheduleSlotSchema = new Schema<IScheduleSlot>({
  timetableId: { type: Schema.Types.ObjectId, ref: 'Timetable', required: true, index: true },
  dayOfWeek: { type: Number, required: true, min: 1, max: 7 },
  slotIndex: { type: Number, required: true, min: 1, max: 12 },
  durationSlots: { type: Number, default: 1 },
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  professorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
  classroomId: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
});

// Composite indexes to prevent hard conflicts at database level
ScheduleSlotSchema.index({ timetableId: 1, dayOfWeek: 1, slotIndex: 1, professorId: 1 }, { unique: true });
ScheduleSlotSchema.index({ timetableId: 1, dayOfWeek: 1, slotIndex: 1, batchId: 1 }, { unique: true });
ScheduleSlotSchema.index({ timetableId: 1, dayOfWeek: 1, slotIndex: 1, classroomId: 1 }, { unique: true });
```

### 7.6 Schedule Overrides Schema (`ScheduleOverride.ts`)
```typescript
export interface IScheduleOverride extends Document {
  originalSlotId: Types.ObjectId;
  overrideDate: Date; // Specific calendar date (YYYY-MM-DD)
  status: 'CANCELLED' | 'RESCHEDULED';
  // Populated if status === 'RESCHEDULED':
  rescheduledDate?: Date;
  newSlotIndex?: number;
  newClassroomId?: Types.ObjectId;
  reason: string;
  requestedBy: Types.ObjectId; // Professor ID
}

const ScheduleOverrideSchema = new Schema<IScheduleOverride>({
  originalSlotId: { type: Schema.Types.ObjectId, ref: 'ScheduleSlot', required: true },
  overrideDate: { type: Date, required: true, index: true },
  status: { type: String, enum: ['CANCELLED', 'RESCHEDULED'], required: true },
  rescheduledDate: { type: Date },
  newSlotIndex: { type: Number },
  newClassroomId: { type: Schema.Types.ObjectId, ref: 'Classroom' },
  reason: { type: String, required: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
```

### 7.7 Attendance Session & Record Schemas
```typescript
// AttendanceSession.ts
export interface IAttendanceSession extends Document {
  scheduleSlotId: Types.ObjectId;
  overrideId?: Types.ObjectId;
  courseId: Types.ObjectId;
  batchId: Types.ObjectId;
  professorId: Types.ObjectId;
  date: Date;
  status: 'SCHEDULED' | 'SUBMITTED' | 'LOCKED';
  submittedAt?: Date;
}

// AttendanceRecord.ts
export interface IAttendanceRecord extends Document {
  sessionId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
  markedBy: Types.ObjectId;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>({
  sessionId: { type: Schema.Types.ObjectId, ref: 'AttendanceSession', required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'], required: true },
  remarks: { type: String },
  markedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Prevent duplicate attendance records for the same student in the same session
AttendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
```

---

## 8. RESTful API Specification

### 8.1 Authentication Endpoints
- `POST /api/v1/auth/login` — Body: `{ email, password }` $\rightarrow$ `{ token, user }`
- `POST /api/v1/auth/refresh` — Issue fresh access token using HTTP-only cookie.
- `GET /api/v1/auth/me` — Return current authenticated user profile and roles.

### 8.2 Entity Management Endpoints (`ADMIN` only)
- `GET|POST /api/v1/users` — List or create users.
- `POST /api/v1/users/batch-import` — Upload CSV roster of students.
- `GET|POST|PUT /api/v1/classrooms` — Manage room capacities and types.
- `GET|POST|PUT /api/v1/courses` — Manage academic courses and required hours.
- `GET|POST|PUT /api/v1/batches` — Manage student batches and enrolments.

### 8.3 Module 1: Timetable Endpoints
- `POST /api/v1/timetable/generate` (`ADMIN`)
  - Body: `{ academicYear, semester, departmentId, config }`
  - Starts async scheduler worker, returns `{ jobId, status: 'GENERATING' }`.
- `GET /api/v1/timetable/:id` (`ADMIN`, `PROFESSOR`, `STUDENT`)
  - Returns complete slot matrix. Role-filtered if called by Student or Professor.
- `PUT /api/v1/timetable/:id/slots/:slotId` (`ADMIN`)
  - **Drag-and-Drop update handler:** Moves slot to new `(dayOfWeek, slotIndex, classroomId)`.
  - Validates hard conflicts. If collision exists, returns `409 Conflict` with conflict details `{ type: 'PROFESSOR_OVERLAP', details: ... }`.
- `POST /api/v1/timetable/:id/publish` (`ADMIN`)
  - Sets timetable status to `PUBLISHED`.
- `GET|POST /api/v1/constraints` (`PROFESSOR`)
  - View or submit soft constraints and non-teaching blocks.
- `POST /api/v1/timetable/slots/:slotId/cancel` (`PROFESSOR`, `ADMIN`)
  - Body: `{ date, reason }` $\rightarrow$ Creates `ScheduleOverride` (`CANCELLED`).
- `POST /api/v1/timetable/slots/:slotId/reschedule` (`PROFESSOR`, `ADMIN`)
  - Body: `{ originalDate, newDate, newSlotIndex, newClassroomId, reason }`
  - Validates slot availability before committing override.
- `GET /api/v1/timetable/slots/:slotId/available-reschedule-slots` (`PROFESSOR`)
  - Query: `?date=YYYY-MM-DD` $\rightarrow$ Returns available non-conflicting slots for prof, batch, and room.

### 8.4 Module 2: Attendance Endpoints
- `GET /api/v1/attendance/today` (`PROFESSOR`)
  - Returns classes scheduled for the logged-in professor for the current day.
- `GET /api/v1/attendance/sessions/:sessionId/roster` (`PROFESSOR`, `ADMIN`)
  - Returns list of students for the session's batch and current mark state.
- `POST /api/v1/attendance/sessions/:sessionId/records` (`PROFESSOR`, `ADMIN`)
  - Body: `{ records: [{ studentId, status: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED', remarks }] }`
  - Bulk upsert into `AttendanceRecord`, updates session status to `SUBMITTED`.
- `GET /api/v1/attendance/student/me` (`STUDENT`)
  - Returns student's personal summary (subject-wise attendance %, total, attended, defaulter status).
- `GET /api/v1/attendance/reports/batch/:batchId` (`ADMIN`, `PROFESSOR`)
  - Returns aggregate attendance matrix for an entire class.

---

## 9. Conflict Detection Algorithm & Engine Specification

The conflict resolution engine is located in `server/src/services/scheduler/conflicts.ts`. It provides reusable validation for both **automated timetable generation** and **real-time drag-and-drop operations**.

```typescript
export interface ConflictResult {
  hasHardConflict: boolean;
  violations: Array<{
    type: 'PROFESSOR_CLASH' | 'BATCH_CLASH' | 'ROOM_CLASH' | 'CAPACITY_MISMATCH' | 'ROOM_TYPE_MISMATCH';
    message: string;
    conflictingSlot?: IScheduleSlot;
  }>;
  softPenaltyScore: number;
  softWarnings: string[];
}

export async function validateSlotPlacement(
  timetableId: string,
  target: {
    slotIdToExclude?: string;
    dayOfWeek: number;
    slotIndex: number;
    durationSlots: number;
    professorId: string;
    batchId: string;
    classroomId: string;
    courseId: string;
  }
): Promise<ConflictResult> {
  const result: ConflictResult = {
    hasHardConflict: false,
    violations: [],
    softPenaltyScore: 0,
    softWarnings: [],
  };

  // 1. Hard Check: Query overlapping slots in the same timetable
  const overlaps = await ScheduleSlot.find({
    timetableId,
    _id: { $ne: target.slotIdToExclude },
    dayOfWeek: target.dayOfWeek,
    slotIndex: target.slotIndex,
    $or: [
      { professorId: target.professorId },
      { batchId: target.batchId },
      { classroomId: target.classroomId },
    ],
  }).populate('courseId professorId classroomId batchId');

  for (const slot of overlaps) {
    if (slot.professorId._id.toString() === target.professorId) {
      result.hasHardConflict = true;
      result.violations.push({
        type: 'PROFESSOR_CLASH',
        message: `Professor is already scheduled with another batch at this time.`,
        conflictingSlot: slot,
      });
    }
    if (slot.batchId._id.toString() === target.batchId) {
      result.hasHardConflict = true;
      result.violations.push({
        type: 'BATCH_CLASH',
        message: `Batch is already scheduled for another course at this time.`,
        conflictingSlot: slot,
      });
    }
    if (slot.classroomId._id.toString() === target.classroomId) {
      result.hasHardConflict = true;
      result.violations.push({
        type: 'ROOM_CLASH',
        message: `Classroom is occupied by another session at this time.`,
        conflictingSlot: slot,
      });
    }
  }

  // 2. Hard Check: Room capacity & type verification
  const [room, batch, course] = await Promise.all([
    Classroom.findById(target.classroomId),
    Batch.findById(target.batchId),
    Course.findById(target.courseId),
  ]);

  if (room && batch && room.capacity < batch.studentCount) {
    result.hasHardConflict = true;
    result.violations.push({
      type: 'CAPACITY_MISMATCH',
      message: `Classroom capacity (${room.capacity}) is lower than batch size (${batch.studentCount}).`,
    });
  }

  // 3. Soft Constraints Check: Professor preferences
  const softConstraint = await SoftConstraint.findOne({ professorId: target.professorId });
  if (softConstraint) {
    const isUnavailable = softConstraint.unavailableWindows.some(
      (w) => w.dayOfWeek === target.dayOfWeek && target.slotIndex >= w.startSlot && target.slotIndex <= w.endSlot
    );
    if (isUnavailable) {
      result.softPenaltyScore += 20 * softConstraint.priorityWeight;
      result.softWarnings.push('Violates professor marked unavailable/research time block.');
    }
  }

  return result;
}
```

---

## 10. Frontend Architecture & Drag-and-Drop Implementation

### 10.1 Timetable Drag-and-Drop Editor (`@dnd-kit`)
The drag-and-drop timetable grid uses `@dnd-kit/core` with coordinate collision detection:
- `DndContext`: Manages overall dragging state, active drag item, and drag end handlers.
- `DroppableCell`: Represents each `(dayOfWeek, slotIndex)` cell in the timetable grid.
- `DraggableSlot`: Renders the lecture/lab tile (Course code, Prof name, Room name, color coded by department/subject).

```tsx
// client/src/components/timetable/TimetableGrid.tsx
import React, { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { DroppableCell } from './DroppableCell';
import { DraggableSlot } from './DraggableSlot';
import { useTimetableStore } from '@/store/timetableStore';

export const TimetableGrid: React.FC = () => {
  const { slots, moveSlot, validateMove } = useTimetableStore();
  const [activeSlot, setActiveSlot] = useState<any | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSlot(null);
    if (!over) return;

    const slotId = active.id as string;
    const [targetDay, targetSlot] = (over.id as string).split('-').map(Number);

    // Run collision check before applying state
    const validation = await validateMove(slotId, targetDay, targetSlot);
    if (validation.hasHardConflict) {
      // Trigger conflict modal / alert user
      alert(`Cannot move: ${validation.violations[0].message}`);
      return;
    }

    // Apply optimistic move in Zustand store
    moveSlot(slotId, targetDay, targetSlot);
  };

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActiveSlot(e.active.data.current)} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-6 gap-2 p-4 bg-slate-50 rounded-xl">
        {/* Render header row & 5x8 grid of DroppableCells */}
      </div>
      <DragOverlay>
        {activeSlot ? <DraggableSlot slot={activeSlot} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
};
```

### 10.2 Attendance Roster Marking View
The professor attendance interface is built for speed on mobile or tablet devices:
- "Quick Mark" button sets all unmarked students to `PRESENT`.
- Single tap on a student tile cycles status: `PRESENT` $\rightarrow$ `ABSENT` $\rightarrow$ `LATE` $\rightarrow$ `EXCUSED`.
- Clear statistical footer updating in real-time (`42 Present, 6 Absent, 2 Late`).

---

## 11. Extensibility & Future Module Integration

SAM is architected to scale seamlessly into upcoming modules without rewriting core contracts:

```
                          Core Event Bus / EventEmitter
                                        |
       +-----------------+--------------+--------------+-----------------+
       |                 |                             |                 |
       v                 v                             v                 v
[Module 1: Schedule] [Module 2: Attendance]     [Module 3: Exams] [Module 4: Grades]
(Publishes:          (Listens to:               (Listens to:      (Listens to:
 CLASS_CANCELLED) ->  CLASS_CANCELLED ->        Free slots ->      Attendance % ->
                      Excludes Session)         Exam seating)      Eligibility check)
```

1. **Module 3: Exam Scheduler & Hall Allocator**
   - Leverages `Classroom` inventory and the existing CSP engine to allocate exam slots without room clashes.
2. **Module 4: Gradebook & Continuous Evaluation**
   - Connects to `AttendanceRecord` to automatically enforce attendance criteria (e.g., student must have $\ge 75\%$ attendance to sit for final exams).
3. **Module 5: Student & Faculty Leave Portal**
   - Approved faculty leaves automatically create `ScheduleOverride` instances and alert department heads to arrange substitute lectures.
4. **Event Bus Pattern (`EventEmitter` / Redis Pub-Sub):**
   - Decouple cross-module triggers. For example, when `timetableSlot.rescheduled` fires, the attendance service automatically re-assigns the corresponding session.

---

## 12. Development Workflow & Commands

### Prerequisites
- Node.js v20.x or higher
- MongoDB v6.0+ (local daemon or MongoDB Atlas URI)
- npm / yarn / pnpm

### Environment Variables

#### Backend (`server/.env`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/smart_academic_manager
JWT_SECRET=super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=super-refresh-secret-key
REFRESH_TOKEN_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

#### Frontend (`client/.env`):
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

### Setup & Execution Commands

```bash
# 1. Setup Backend
cd server
npm install
npm run seed        # Seeds initial Admin, Classrooms, Demo Batches & Profs
npm run dev         # Launches Express server on http://localhost:5000 with nodemon/ts-node

# 2. Setup Frontend
cd ../client
npm install
npm run dev         # Starts Vite dev server on http://localhost:5173

# 3. Running Tests
cd server && npm test
cd client && npm test

# 4. Production Build
cd server && npm run build
cd client && npm run build
```

---

## 13. Coding Conventions & Quality Standards

- **Strict Typing:** Never use `any`. Always create dedicated interfaces for Request bodies, Mongoose documents, and API responses.
- **Unified API Response Envelope:**
  ```typescript
  export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: any[];
  }
  ```
- **Error Handling:** Centralized Express error handler catches unhandled rejections, Zod validation errors, and MongoDB duplicate key errors (code 11000).
- **Security Protocols:**
  - Password hashing with `bcryptjs` using a minimum work factor of 12.
  - Rate limiting on `/api/v1/auth/*` endpoints.
  - CORS whitelist restricted to `CLIENT_URL`.
- **Database Indexing:** Ensure every foreign reference (`batchId`, `professorId`, `classroomId`, `timetableId`) is explicitly indexed in Mongoose schemas.
