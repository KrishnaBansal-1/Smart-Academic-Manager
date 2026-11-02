# CLAUDE.md — Smart Academic Manager (SAM)

> **Architectural Blueprint & Development Manual**  
> **Core Modules:** Schedule Generator & Visual Editor | Attendance Records Keeper | Minor Exams  
> **Technology Stack:** MERN (MongoDB 6.0+ Single-node Replica Set, Express.js, React 18+, Node.js v20+) with Strict TypeScript

---

## 1. Project Overview & Architecture Vision

**Smart Academic Manager (SAM)** is an academic operations platform designed for universities and colleges. The system is engineered as an extensible **modular monolith** with an npm workspaces monorepo structure, ensuring domain boundaries while sharing a cohesive data plane, authentication layer, and real-time event pipeline.

### Core Architecture Pillars

1. **One Arbiter of Occupancy (`Booking`):**
   - At publish time, weekly slots expand into concrete occupancy records per term date, period, and resource (`P:<id>` for professor, `B:<id>` for batch/section, `R:<id>` for room).
   - Overrides, cancellations, reschedules, and minor exams claim or release rows inside database transactions (`session.withTransaction`).
   - Unique multikey constraint on `(dateKey, period, resourceKey)` prevents double-booking at the database layer.

2. **One Schedule Resolver (`calendar.service.resolveRange`):**
   - Single source of truth for schedule resolution across date ranges.
   - Fixed precedence order:
     `Weekly Slots -> Minus Holidays -> Minus Moved-out/Cancelled -> Plus Moved-in -> Plus Minor Exams`

3. **Stable Class Identity (`lineageId, originalDateKey`):**
   - Each weekly slot has a `lineageId` that survives clones and draft revisions.
   - An occurrence is identified by `(lineageId, originalDateKey)`.

---

## 2. Updated Architecture & Data Models

### 2.1 Core Departures from Legacy Design

| Legacy CLAUDE.md Spec | Problem Identified | Updated Architecture |
|---|---|---|
| 3 compound unique indexes on start slot | Multi-hour lab slots collide without detection | Unique multikey index on per-period occupancy keys (`P:<id>:<day>:<period>`, etc.) |
| Single `professorId` on slot | Seeded labs have 2–3 co-teaching faculty | `professorIds[]` array on slots |
| Course holds faculty without linking batch | Timetable generator cannot know what batch takes what course | New `CourseOffering` model |
| Hard-coded periods without dates | No clock times, breaks, holidays, or term dates | `AcademicTerm` (grid, holidays, term dates) + `InstitutionSettings` singleton |
| Conflict checks only inside one timetable | Cross-department faculty can double-book | One institution-wide timetable per term |
| Dates stored as `Date` objects | Timezone shifts and differing time components break unique indexes | `dateKey` strings (`YYYY-MM-DD`) in institution timezone |
| `Batch.students` and `studentCount` arrays | Out-of-sync rosters and stale counts | Removed. `User.batchId` is single source of truth; counts computed |
| Event bus for notifications | Notifications lost on server crash | Notifications written in the same MongoDB transaction as the change |
| Contradictory attendance session states | Dual `isLocked` flag and conflicting status enums | Unified lifecycle: `SCHEDULED -> SUBMITTED -> LOCKED` (or `MISSED`, `CANCELLED`) |
| Unweighted attendance percentage formula | Excused absences artificially penalized student percentage | `percentage = (PRESENT + LATE) / (PRESENT + LATE + ABSENT) * 100` (`EXCUSED` excluded) |
| Generic `z.union` on admin routes | Field validation errors collapse into generic "Invalid input" | Per-entity schema lookup reporting exact field errors |

---

## 3. Data Models Specification

### 3.1 New Master Models
- **`InstitutionSettings` (Singleton):**
  - `timezone: 'Asia/Kolkata'`
  - `defaultGrid`, `defaultWorkingDays`
  - `attendanceGood: 80`, `attendanceWarning: 70`, `attendanceLockHours: 24`
  - `minorNoticeDays: 3`, `examReminderHours: 24`
- **`AcademicTerm`:**
  - `name`, `academicYear`, `semesterType: 'ODD' | 'EVEN'`
  - `startDate`, `endDate`, `workingDays: number[]`
  - `periods: [{ index, start, end, blocked, label }]`
  - `holidays: [{ dateKey, label }]`
  - `isActive: boolean`
  - `versions: [{ timetableId, effectiveFrom }]`
- **`CourseOffering`:**
  - `termId`, `courseId`, `batchId`, `professorIds: ObjectId[]`
  - `theoryHoursPerWeek`, `labBlocksPerWeek`, `labBlockLength`
  - `isActive: boolean`
  - Unique index: `(termId, courseId, batchId)`
- **`Booking`:**
  - `termId`, `dateKey`, `period`
  - `resourceKey: 'P:<id>' | 'B:<id>' | 'R:<id>'`
  - `ownerType: 'WEEKLY' | 'OVERRIDE' | 'EXAM'`, `ownerId: ObjectId`
  - Unique index: `(dateKey, period, resourceKey)`
- **`MinorExam`:**
  - `termId`, `offeringId`, `courseId`, `batchId`, `professorId`
  - `title`, `syllabus`, `dateKey`, `startPeriod`, `durationSlots`, `classroomId`
  - `displacedOverrideIds: ObjectId[]`
  - `status: 'SCHEDULED' | 'CANCELLED'`, `cancelReason`, `revision`, `createdBy`
- **`Notification`:**
  - `recipientId`, `type`, `title`, `body`, `link`, `payload`, `readAt`, `dedupeKey`
  - Unique index: `(recipientId, dedupeKey)`

### 3.2 Existing Models (Updated)
- **`User`:**
  - `email` (unique, lowercase), `passwordHash`, `firstName`, `lastName`
  - `role: 'ADMIN' | 'PROFESSOR' | 'STUDENT'`
  - `departmentId`, `batchId`, `rollNumber` (partial unique index for non-null strings)
  - `tokenVersion: number` (revocation & rotation)
  - `isActive: boolean`
- **`Batch` (Sections):**
  - `name`, `departmentId`, `semester`, `academicYear`, `isActive`
  - *(Note: `students` array and `studentCount` removed)*
- **`Department`:**
  - `name`, `code`, `building`, `isActive`
- **`Classroom`:**
  - `name`, `building`, `capacity`, `type: 'THEORY' | 'LABORATORY'`, `hasProjector`, `isActive`
- **`Timetable`:**
  - `termId`, `status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'`, `revision`, `generationJobId`, `softScore`
- **`ScheduleSlot`:**
  - `timetableId`, `lineageId`, `offeringId`, `kind: 'THEORY' | 'LAB'`
  - `dayOfWeek`, `slotIndex`, `durationSlots`
  - `courseId`, `professorIds: ObjectId[]`, `batchId`, `classroomId`
  - `pinned: boolean`, `placed: boolean`
  - `occupancyKeys: string[]` (indexed with partial filter on `placed: true`)

---

## 4. API Endpoints Specification

### 4.1 Authentication (`/api/v1/auth`)
- `POST /login` — Authenticate credentials. Returns `{ user, accessToken }` and sets HTTP-only `refreshToken` cookie.
- `POST /refresh` — Single-flight refresh token rotation using HTTP-only cookie.
- `POST /logout` — Clears HTTP-only `refreshToken` cookie.
- `GET /me` — Returns populated profile for authenticated user session.

### 4.2 Admin Management (`/api/v1/admin`)
- `GET /:entity` — List items for `students`, `professors`, `courses`, `semesters` (sections), `rooms`, `departments`.
- `POST /:entity` — Create entity with per-entity Zod validation and foreign reference validation.
- `PATCH /:entity/:id` — Update entity.
- `DELETE /:entity/:id` — Soft-deactivate entity (with published timetable conflict warning).
- `PATCH /:entity/:id/reactivate` — Reactivate deactivated entity.
- `PATCH /users/:id/password` — Update user password and increment `tokenVersion`.
- `POST /students/import` — Bulk import students via CSV.

### 4.3 Academic Setup (Phase 1)
- `GET|PATCH /api/v1/settings` — Institution settings singleton.
- `GET /api/v1/terms/active` — Active academic term and period grid.
- `GET|POST /api/v1/terms`, `PATCH /terms/:id` — Manage terms and grid.
- `POST /api/v1/terms/:id/holidays` — Manage term holidays.
- `GET|POST /api/v1/offerings`, `PATCH|DELETE /offerings/:id` — Manage course offerings per section.
- `GET|PUT /api/v1/constraints/me` — Professor time and slot preferences.

### 4.4 Scheduler & Editor (Phases 2 & 3)
- `POST /api/v1/timetables/preflight` — Pre-generation feasibility checks.
- `POST /api/v1/timetables/generate` — Start async solver worker.
- `GET /api/v1/timetables/:id` — Fetch complete timetable slot matrix.
- `GET /api/v1/timetables/:id/slots/:slotId/drop-map` — Server-calculated drop feasibility map (Green / Yellow / Red).
- `PATCH /api/v1/timetables/:id/slots/:slotId` — Move slot with revision check and collision validation.
- `POST /api/v1/timetables/:id/slots/swap` — Atomic two-slot swap transaction.
- `POST /api/v1/timetables/:id/publish` — Publish timetable version and expand into bookings.

### 4.5 Calendar, Schedule & Overrides (Phases 4 & 6)
- `GET /api/v1/schedule/week` — Resolved weekly schedule (role-filtered).
- `GET /api/v1/schedule/today` — Current day classes.
- `POST /api/v1/occurrences/:lineageId/:dateKey/cancel` — Cancel class occurrence.
- `GET /api/v1/occurrences/:lineageId/:dateKey/reschedule-options` — 3-way free slot finder.
- `POST /api/v1/occurrences/:lineageId/:dateKey/reschedule` — Reschedule class occurrence.

### 4.6 Attendance Records (Phase 7)
- `GET /api/v1/attendance/today` — Today's active sessions for professor.
- `GET /api/v1/attendance/sessions/:id/roster` — Section roster for session.
- `POST /api/v1/attendance/sessions/:id/records` — Submit attendance records.
- `GET /api/v1/attendance/student/me` — Student personal attendance percentages.
- `GET /api/v1/attendance/reports/offering/:id` — Offering attendance matrix (CSV export available).
- `GET /api/v1/attendance/reports/defaulters` — Campus-wide defaulter report (<80%, <70%).

### 4.7 Minor Exams (Phase 8)
- `GET /api/v1/exams/options` — Slot options for scheduling a minor exam (Free slots or Own-class).
- `POST /api/v1/exams` — Schedule minor exam (transactional booking & class displacement).
- `PATCH /api/v1/exams/:id` — Update minor exam details.
- `POST /api/v1/exams/:id/cancel` — Cancel minor exam and restore displaced classes.

---

## 5. Frontend Design System & Architecture

- **UI Components (`client/src/components/ui/`):**
  - Accessible, composable primitives extracted from institutional styling:
    `Button`, `Field`, `Select`, `Modal` (Radix UI `@radix-ui/react-dialog` with focus trap and escape support), `Banner`, `Badge`, `EmptyState`, `Skeleton`, `Toast` (Zustand-powered), `ConfirmDialog`, `Tabs`.
- **Layout Shell (`client/src/components/layout/AppShell.tsx`):**
  - Role-based header navigation (Admin, Professor, Student).
  - Mobile responsive drawer navigation.
  - Automatically hidden on `/login`.
- **State Management:**
  - `@tanstack/react-query`: Server state cache, optimistic updates, automatic refetching on window focus.
  - `zustand`: Toast notification store (`toastStore.ts`) and interactive timetable editor state (`timetableEditorStore.ts`).
- **Client Error Handling:**
  - Global `ErrorBoundary` around route tree.
  - Centralized error parser (`client/src/lib/errors.ts`) displaying server-side `errors[]` validation issues.

---

## 6. Testing Strategy & Harness

- **Backend:**
  - `jest` + `ts-jest` + `supertest`.
  - `MongoMemoryReplSet` harness (`server/src/__tests__/setup.ts`) supporting multi-document ACID transactions without requiring an external database.
  - Test coverage for auth rotation, revocation, rate limits, validation write-back, admin CRUD, timetable warning cascades, and CSV import.
- **Frontend:**
  - `vitest` with `jsdom` and `@testing-library/react`.
  - Root redirect, authentication persistence, and reload-at-root test coverage.
- **End-to-End:**
  - Playwright test skeleton configured in `client/playwright.config.ts`.
- **Linting & Code Quality:**
  - ESLint with TypeScript parser and `@typescript-eslint/no-explicit-any` strictly enforced across the monorepo.

---

## 7. Development Guidelines

1. **Transaction Integrity:** Any operation that mutates bookings, slot occupancy, overrides, minor exams, or notifications must use `session.withTransaction(...)`.
2. **Date Handling:** Never store raw local dates as ISO strings. Use `dateKey` strings (`YYYY-MM-DD`) generated via institutional timezone utilities.
3. **Thin Controllers, Rich Services:** Controllers handle input validation and HTTP responses. Business logic, collision checking, and transactional mutations reside in domain services (`services/`).
4. **No Explicit `any`:** Strict TypeScript typing must be maintained across all modules.
