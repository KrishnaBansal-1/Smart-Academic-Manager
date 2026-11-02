# SAM: End-to-End Implementation Plan

## 1. Context

SAM currently has working login, admin record CRUD, and a professor course list. Everything else is a shell: `Timetable`, `ScheduleSlot`, `ScheduleOverride`, `SoftConstraint`, `AttendanceSession` and `AttendanceRecord` are models used only by the seeder, and the dashboards show static empty states and dead buttons.

**Goal:** a working product covering:

1. Timetable generator and drag-and-drop editor
2. Attendance, for professors (marking) and students (view)
3. A new Minor Exam module with notifications
4. Everything left incomplete so far (§10)

**No slot or attendance data exists yet, so schemas can change freely with no migration.** This is the moment to fix the model.

### Decisions you made

| Topic | Decision |
|---|---|
| Minor exam slots | Free slots **or** the professor's own class hour with that section (that class is auto-cancelled for the date) |
| Approval | None. Booking is instant, subject to a minimum notice (default 3 days, admin-configurable). Admin can view and cancel |
| Notifications | In-app (bell, page) plus live Socket.IO, stored in the database. No email |
| Attendance weight | Each session counts as 1, whatever its length |

### Where this plan departs from CLAUDE.md

CLAUDE.md gets rewritten in Phase 0 and kept current. Each change below fixes a real problem.

| CLAUDE.md says | Problem | Plan |
|---|---|---|
| 3 unique indexes on the start slot; `validateSlotPlacement` matches exact `slotIndex` | A 2-hour lab at P3 and a lecture at P4 can double-book | One unique multikey index on per-period occupancy keys |
| Single `professorId` on a slot | Seeded labs have 2–3 faculty | `professorIds[]` |
| Course holds faculty, nothing links course to batch | **The generator can't know what a batch takes. This is the biggest blocker** | New `CourseOffering` |
| Hard-coded periods and semester number | No clock times, breaks, holidays or term dates | `AcademicTerm` with a period grid and holidays, plus `InstitutionSettings` |
| Conflict checks only inside one timetable | Prof. Sangharatna teaches in both CSE and AIDS and could double-book | One institution-wide timetable per term |
| Dates as `Date` | The unique key breaks on differing time components; IST day shifts | `dateKey` strings (`YYYY-MM-DD`) computed in the institution's timezone |
| `Batch.students` and `studentCount` | Admin CRUD never maintains them, so rosters and capacity checks would be wrong | Remove both. `User.batchId` is the single source; counts are computed |
| EventEmitter bus or Redis | Events die on a crash, so students may never be told | Notifications written in the same transaction as the change |
| Session `ACTIVE` state vs enum without it; `isLocked` + `LOCKED` | Contradictory and duplicated | One lifecycle (§7) |
| shadcn/Radix | Not installed; only one primitive is really needed | Small Tailwind UI kit plus `@radix-ui/react-dialog` |
| `/users`, `/classrooms`, `{ token, user }` | Doesn't match the actual code | Document what exists; extend from there |
| GA or CSP solver | Two approaches and no decision | CSP construction, then simulated annealing |
| Priority weight set by professor | Everyone would pick 5 | Admin-set |

---

## 2. Core architecture

### 2.1 Three ideas everything rests on

**A. One arbiter of occupancy: `Booking`.** At publish time, weekly slots expand into one row per term date, per period, per resource (professor, batch, room). Cancels, reschedules and exams claim or release rows inside a transaction.

```
Booking { termId, dateKey, period, resourceKey: 'P:<id>'|'B:<id>'|'R:<id>',
          ownerType: 'WEEKLY'|'OVERRIDE'|'EXAM', ownerId }
unique (dateKey, period, resourceKey)
```

Size is modest: about 3 batches × 30 periods × 4 keys × 16 weeks ≈ 6k rows. Free-slot finders become simple set lookups. Races lose at the unique index and return 409.

**B. One resolver: `calendar.service.resolveRange(from, to, scope)`.** It's the only code that answers "what's happening on this date". The order is fixed:

`weekly slots → minus holidays → minus moved-out/cancelled → plus moved-in → plus exams`

Student and professor views, finders and session creation all use it.

**C. Stable class identity: `(lineageId, originalDateKey)`.** Each slot has a `lineageId` that survives clone-to-draft. An occurrence is the slot lineage plus its scheduled date. Overrides and sessions key on this, so rescheduling twice or republishing mid-term doesn't lose history.

### 2.2 Infrastructure

- **Mongo becomes a single-node replica set** (`--replSet rs0`, init via compose healthcheck) so `withTransaction` works. It's a small change and removes most manual rollback code. Atlas already supports this. Tests use `MongoMemoryReplSet`.
- **Date handling:** `server/src/utils/dateKey.ts` using `date-fns` + `date-fns-tz`. It validates real dates (rejects `2026-02-31`), uses ISO weekdays (1 = Mon), and provides `today(tz)` and `periodToInstant(dateKey, period, grid)`.
- **Routers:** new ones mount on their own paths, **not** under `/admin`, because `/admin/:entity` is a catch-all that returns 400 for unknown entities.
- **New server dependencies:** `socket.io`, `express-rate-limit`, `cookie-parser`, `node-cron`, `date-fns`, `date-fns-tz`, `ts-node`.
- **New server dev dependencies:** `jest`, `ts-jest`, `supertest`, `mongodb-memory-server`.
- **New client dependencies:** `socket.io-client`, `@radix-ui/react-dialog`.
- **New client dev dependencies:** `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@playwright/test`, `@types/node`.

### 2.3 Data model

**New models**

| Model | Key fields | Key indexes |
|---|---|---|
| `InstitutionSettings` (singleton) | `timezone: 'Asia/Kolkata'`, `defaultGrid`, `defaultWorkingDays`, `attendanceGood: 80`, `attendanceWarning: 70`, `attendanceLockHours: 24`, `minorNoticeDays: 3`, `examReminderHours: 24` | — |
| `AcademicTerm` | `name`, `academicYear`, `semesterType: ODD\|EVEN`, `startDate`, `endDate`, `workingDays[]`, `periods[{index,start,end,blocked,label}]`, `holidays[{dateKey,label}]`, `isActive`, `versions[{timetableId,effectiveFrom}]` | one active term (partial unique) |
| `CourseOffering` | `termId`, `courseId`, `batchId`, `professorIds[]`, `theoryHoursPerWeek`, `labBlocksPerWeek`, `labBlockLength`, `isActive` | unique `(termId,courseId,batchId)`; `(termId,professorIds)` |
| `GenerationJob` | `termId`, `status: QUEUED\|RUNNING\|DONE\|FAILED`, `progress`, `config`, `seed`, `metrics{placed,unplaced,softScore,durationMs}`, `unplaced[{offeringId,kind,reason}]`, `timetableId`, `error` | one running per term (partial unique) |
| `Booking` | see §2.1 | as above |
| `MinorExam` | `termId`, `offeringId`, `courseId`, `batchId`, `professorId`, `title`, `syllabus`, `dateKey`, `startPeriod`, `durationSlots`, `classroomId`, `displacedOverrideIds[]`, `status: SCHEDULED\|CANCELLED`, `cancelReason`, `revision`, `createdBy` | `(batchId,dateKey)`, `(professorId,dateKey)`, `(status,dateKey)` |
| `Notification` | `recipientId`, `type`, `title`, `body`, `link`, `payload`, `readAt`, `dedupeKey` | unique `(recipientId,dedupeKey)`; `(recipientId,readAt,createdAt)` |
| `AttendanceAuditLog` | `sessionId`, `studentId`, `oldStatus`, `newStatus`, `actorId`, `actorRole`, `reason`, `kind: EDIT\|ADMIN_OVERRIDE\|CANCEL\|RESTORE` | `(sessionId,createdAt)` |

`COMPLETED` for exams is derived from the date, not stored.

**Changes to existing models**

| Model | Change |
|---|---|
| `Timetable` | Replace `academicYear/semester/departmentId` with `termId`. Add `revision`, `basedOnTimetableId`, `generationJobId`, `softScore`. Multiple `PUBLISHED` per term are allowed; `term.versions` decides which applies on a given date |
| `ScheduleSlot` | Add `lineageId`, `offeringId`, `kind: THEORY\|LAB`, `professorIds[]` (replaces `professorId`), `pinned`, `placed`, `occupancyKeys[]` (`P:<id>:<day>:<period>`, etc.). Unique index `(timetableId, occupancyKeys)` partial on `placed: true`, replacing the three broken ones. Keys come from a single function in `services/scheduler/occupancy.ts`, because bulk updates skip hooks |
| `ScheduleOverride` | Key on `(lineageId, originalDateKey)` unique. `status: CANCELLED\|RESCHEDULED\|REVERTED\|ORPHANED`. `source: MANUAL\|EXAM\|HOLIDAY`. Add `target{dateKey,period,classroomId}`, `examId` |
| `AttendanceSession` | Identity `(lineageId, originalDateKey)` unique. Add `termId`, `actualDateKey`, `period`, `durationSlots`, `classroomId`, `professorIds[]`, `lockAt`, `submittedBy`, `revision`, `statusBeforeCancel`. Status is `SCHEDULED\|SUBMITTED\|LOCKED\|MISSED\|CANCELLED`. Remove `isLocked`, `date`, `professorId`. Indexes `(professorIds,actualDateKey)`, `(batchId,actualDateKey)`, `(status,lockAt)` |
| `AttendanceRecord` | Denormalise `termId, courseId, batchId, dateKey`, add `counted: true`. Index `(studentId,termId,courseId)` |
| `SoftConstraint` | Unique `(professorId, termId)`, replacing year and semester, since a professor teaching semesters 3 and 5 has no single semester. Validate `startSlot ≤ endSlot` and windows against the grid |
| `Batch` | Remove `students`, `studentCount`. Fix semester consistency |
| `Course` | `professorIds` stays as the *eligible faculty* pool, used to pre-fill offerings |
| `User` | Add `tokenVersion`. Partial unique index on `rollNumber`. Remove the redundant email index |

---

## 3. Phase 0: Foundations and repair

Everything later depends on this. **Deliverable: the app runs from a clean checkout and tests can run.**

**Server**
- `docker-compose.yml`: replica set, healthcheck init, bind to `127.0.0.1`. Align port 27018 in `.env.example` and `config/env.ts`, with `?replicaSet=rs0&directConnection=true`.
- `validate.middleware.ts`: write parsed values back to `req`, so `.default()` and `.coerce` work. New routes will rely on this.
- `utils/asyncHandler.ts`: move the local helper out of `admin.controller.ts:10` and use it everywhere.
- `error.middleware.ts`: add Mongoose `ValidationError` → 400; honour `err.status` for bad JSON and oversized bodies; `ApiError` accepts structured `errors` for conflict details.
- **Auth:**
  - Rate-limit `/auth/login` and `/auth/refresh`.
  - Access token lasts 15 minutes. Refresh token moves to an HTTP-only cookie, with rotation via `tokenVersion`.
  - Add `POST /auth/logout`.
  - Admin password change bumps `tokenVersion`, so old sessions die.
  - Pin the JWT algorithm. Equalise the login timing path and inactive-account response.
- `/auth/me` and login return the same shape, with `batchId` populated.
- `admin.routes.ts`: replace `z.union` with a per-entity schema lookup, since field errors currently collapse into "Invalid input".
- `admin.controller.ts`:
  - Add a reactivate action.
  - Check referenced IDs exist and have the right role.
  - Remove `any`.
  - Warn when deactivating anything used by an active timetable.
  - Add `Department` CRUD and `POST /admin/students/import` (CSV).
- `server.ts`: close Mongoose on shutdown, add unhandled rejection handlers, and create the `http.Server` before listening, so sockets can attach later.
- `app.ts`: localhost CORS origins only in development; morgan `combined` in production.
- `config/env.ts`: reject example secrets in production and require the two secrets to differ.
- `seeder.ts`: refuse to run in production.
- `zod` passwords capped at 72 bytes, and login minimum aligned with creation.

**Client**
- `api/client.ts`: 401 → single-flight refresh → retry, else log out. Remove `refreshToken` from the client.
- `AuthContext`: validate the session with `/auth/me` at boot, normalise `id`/`_id`, and memoise the provider value.
- `App.tsx`:
  - `RootRedirect` respects `isLoading` (fixes logged-in users landing on `/login` after reload).
  - `Login` redirects users who are already logged in.
  - `ProtectedRoute` keeps the original URL.
  - Add an error boundary and lazy-load routes.
- **`components/ui/`** (extract classes from `AdminManagement.tsx`, don't reinvent them): `Button`, `Field`, `Select`, `Modal` (Radix; Escape and focus trap), `Banner`, `Badge`, `EmptyState`, `Skeleton`, `Toast` (zustand), `ConfirmDialog`, `Tabs`.
- **`components/layout/AppShell.tsx`:** role-based nav, mobile drawer, no navbar on `/login`.
- `lib/errors.ts`: `getErrorMessage` shows the server's `errors[]` list.
- `AdminManagement.tsx`:
  - Fix stale dropdowns after delete, tab-switch races, search matching hidden fields, and inactive-professor counts.
  - Fix `min`/`max` input limits and the uncontrolled select warning.
  - Fix double error display, and discarding input on an outside click.
  - Rename "Semesters" to "Sections" in the UI.
  - Add Department tab, CSV import, and reactivate.
  - Replace `Row = Record<string, any>` with proper types.
- `Login.tsx`: show demo credentials only when `import.meta.env.DEV`.
- `vite.config.ts`: add `/socket.io` proxy with `ws: true`.
- Remove dead code: `types/index.ts` domain types (replaced in later phases), the unused `brand` colours or start using them, the unused `@` alias or start using it consistently, and fix the missing favicon.

**Tooling and docs**
- Jest + supertest + `MongoMemoryReplSet` harness on the existing `createApp()`; vitest + Testing Library; Playwright skeleton; ESLint with `no-explicit-any`.
- Rewrite `CLAUDE.md` per §1. Delete `SETUP_SUMMARY.md` and `initial-setup-plan.md` once anything useful is folded into the README.

**Tests:** auth (rotation, revocation, rate limit), validate write-back, admin CRUD regressions, CSV import, reload-at-root behaviour.

---

## 4. Phase 1: Academic setup and seed

**Deliverable: an admin can define the term, the period grid, and who teaches what to which section.**

**API**
```
GET|PATCH  /api/v1/settings                       ADMIN
GET        /api/v1/terms/active                   ALL
GET|POST   /api/v1/terms   PATCH /terms/:id       ADMIN (grid frozen once published)
POST       /api/v1/terms/:id/holidays/preview     ADMIN (lists affected classes)
POST       /api/v1/terms/:id/holidays             ADMIN
GET|POST   /api/v1/offerings   PATCH|DELETE /:id  ADMIN
POST       /api/v1/offerings/bulk-from-department ADMIN
GET|PUT    /api/v1/constraints/me                 PROFESSOR
GET        /api/v1/constraints?termId=            ADMIN
PATCH      /api/v1/constraints/:id/priority       ADMIN
GET        /api/v1/professor/offerings            PROFESSOR
```
`/professor/courses` is replaced by `/professor/offerings`, so the dashboard shows the course **and** the section.

**Client pages**
- `/admin/academics`: tabs for Term and Grid, Holidays, Offerings. The offerings tab is a matrix of courses against sections, with weekly hours and faculty, and warns about empty faculty or impossible hours.
- `/professor/preferences`: a paintable week grid (Preferred, Unavailable, Neutral) plus a daily limit. Uses `TimetableGridShell`, built here and reused by the editor.

**Seed overhaul (`utils/seeder.ts`)**
- Active term 2026-27 Odd, 3 Aug – 11 Dec 2026, 8 periods 09:00–17:00 with 13:00 lunch blocked.
- `semester: 5` for the III-year sections (currently `1`).
- Remove double-counted lab hours: `CS1303` and `CS2301` get `weeklyLabHours: 0`, because their `-LAB` courses exist.
- Create offerings. **Assumption to check against your real timetable PDFs:** where a *theory* course lists 2 faculty, they teach separate sections; *lab* faculty co-teach.
- Fractal courses (`CS1381`, `CS2381`) have no faculty. Their offerings are created inactive, and preflight names them.
- Grow each section to 30 students (first accounts unchanged).
- Add sample `SoftConstraint`s, and clear all new collections.
- `npm run seed:demo` also generates and publishes a timetable and creates past attendance, a cancellation, a reschedule and an upcoming minor.

**Tests:** term grid validation, grid freezing, offering uniqueness, seed integrity.

---

## 5. Phase 2: Solver and generation jobs

**Deliverable: a tested solver producing complete drafts.**

**Pure code with no Mongoose (`server/src/services/scheduler/`)**

| File | Purpose |
|---|---|
| `types.ts` | `SolverInput`, `SolverOutput`, plain JSON with integer indices |
| `occupancy.ts` | The one `buildOccupancyKeys(slot, grid)`, shared with the model layer |
| `conflicts.ts` | `checkPlacement(state, candidate)` → hard violations with types `PROFESSOR_CLASH`, `BATCH_CLASH`, `ROOM_CLASH`, `CAPACITY`, `ROOM_TYPE`, `BLOCKED_PERIOD`, `BLOCK_STRADDLES_BREAK`, `DAY_OVERFLOW`, using **range overlap** across each period |
| `cost.ts` | Soft cost per term below, returning a breakdown so warnings can state a reason |
| `preflight.ts` | Reasons a run can't succeed, before starting |
| `construct.ts` | CSP: labs first, MRV, forward checking, bounded backtracking with restarts |
| `anneal.ts` | Simulated annealing over feasible moves (move, swap, room change), time-limited, seedable |
| `algorithm.ts` | `solve(input, onProgress)` orchestration |
| `worker.ts` | `worker_threads` wrapper |

**Soft cost terms**

| Term | Weight basis |
|---|---|
| Professor's unavailable window | Very high × `priorityWeight`. Avoided unless nothing else fits; yellow with strong warning in the editor |
| Over `maxDailyHours` | High × `priorityWeight` |
| Outside preferred window | Low × `priorityWeight` |
| Idle gaps (professor and batch) | Medium |
| Same theory course twice in a day | Medium |

`softScore = 100 × (1 − cost / maxCost)`, computed from a fixed baseline so scores are comparable.

**Preflight errors (each must name the fix):**
- Offering with no faculty
- Batch hours exceed usable periods
- Professor hours exceed availability
- No room large enough
- No lab large enough. **Batches are not split into lab groups in this version**, so a section over 45 students with 45-seat labs fails with a clear message
- Lab block longer than any contiguous free run

**Unplaced items:** if a class can't fit, the run still finishes. The item is saved as `placed: false` with a reason, shows in the editor's tray, and blocks publishing.

**Job flow**
```
POST /api/v1/timetables/preflight        ADMIN  → errors, warnings
POST /api/v1/timetables/generate         ADMIN  → { jobId }  (409 if one running)
GET  /api/v1/generation-jobs/:id         ADMIN  (polling fallback)
```
The main thread loads the data and passes JSON to the worker. Progress is written to the job (and pushed by socket after Phase 5). Output goes into a **new draft**, so it never overwrites edits. `worker.terminate()` enforces the time limit. `RUNNING` jobs are marked `FAILED` at startup, since `ts-node-dev` respawns kill workers.

**Worker path:** resolve with `path.extname(__filename)`; in dev pass `execArgv: ['-r', 'ts-node/register/transpile-only']`; use relative imports. Prove this early with a smoke test, in both dev and built modes.

**Regenerate with pins:** pinned slots from an existing draft are fixed inputs.

**Tests (highest priority in the project):**
- An **independent checker**, not sharing `conflicts.ts`, verifies each output has no hard violation, across many seeds.
- Labs are contiguous and in `LABORATORY` rooms; nothing in blocked periods; every placed hour matches the offering.
- Infeasible fixtures produce the right preflight error or unplaced reason.
- Same seed gives the same result.
- The seed dataset solves with zero unplaced in **under 30 seconds**.

---

## 6. Phase 3: Editor and publish

**Deliverable: the admin generates, edits and publishes.**

**API**
```
GET  /api/v1/timetables?termId=                       ADMIN
GET  /api/v1/timetables/:id?batchId|professorId|roomId ADMIN
GET  /api/v1/timetables/:id/slots/:slotId/drop-map    ADMIN
PATCH /api/v1/timetables/:id/slots/:slotId            ADMIN  { day, period, classroomId?, pinned?, revision }
POST /api/v1/timetables/:id/slots/swap                ADMIN  { slotA, slotB, revision }
POST /api/v1/timetables/:id/clone                     ADMIN
POST /api/v1/timetables/:id/validate                  ADMIN
POST /api/v1/timetables/:id/publish                   ADMIN
DELETE /api/v1/timetables/:id                         ADMIN  (drafts only)
```

**Rules**
- Every mutation sends `revision`. A stale one gets 409 and the client reloads, which covers two admins and undo.
- A published timetable can't be edited; use clone-to-draft.
- A conflict returns `409 { violations: [...] }`.
- Swap runs in one transaction, moving A's keys to `TMP:<id>`, then B, then A.
- **Publish (one transaction):** check no `unplaced`, re-run a full hard check, expand to `Booking`, add to `term.versions`, set status, and notify all affected students and professors.

**`drop-map`** returns a state per `(day, period)`:

| State | Meaning | Includes |
|---|---|---|
| `GREEN` | No hard conflict, no soft penalty | suggested room |
| `YELLOW` | Allowed, with soft warnings | reasons, e.g. "Room changes to A306", "Outside Prof. X's preferred time" |
| `RED` | Hard conflict | reasons, and whether a swap with the occupant is valid |

It's computed server-side once at drag start, so hovering is instant and the rules live in one place. The `PATCH` re-validates, since the client is never trusted.

**Client: `/admin/timetable`** (`pages/admin/TimetableManager.tsx`)
- Header: draft selector, Generate (preflight → job progress → result), score, Validate, Publish.
- `components/timetable/`: `TimetableGridShell`, `TimetableGrid` (`DndContext` with pointer and **keyboard** sensors), `DroppableCell`, `DraggableSlot`, `UnplacedTray`, `ViewSelector` (Batch, Professor, Room), `SlotDetailsPanel` (room picker, pin), `SwapConflictModal`, `PublishDialog`, `GenerationProgress`.
- `store/timetableEditorStore.ts` (zustand): view, active drag, drop map, undo/redo as inverse operations. Server data stays in React Query, so the store never holds a second copy of slots.
- Multi-period labs span grid rows; dropping a lab checks all of its periods.
- Below 1024 px the grid is read-only with a note, since drag editing isn't usable on phones.
- Wire `AdminDashboard` "Generate Timetable" and "Open Visual Editor" to this page.

**Tests:**
- API: move, conflict 409, stale revision, swap, crash mid-swap leaves the slot visibly invalid, publish blocked by unplaced, Booking count correct.
- Component: drop-map colours, keyboard move.
- Playwright: generate, drag, publish.

---

## 7. Phases 4–7: Calendar, notifications, overrides, attendance

### Phase 4: Calendar and read-only views

**Deliverable: students and professors see the real schedule.**

```
GET /api/v1/schedule/week?weekOf=YYYY-MM-DD[&batchId|&professorId|&roomId]
GET /api/v1/schedule/today
```
- Students are forced to their own batch; a query for another returns 403. Professors see their own and, by choice, others in their department (per the RBAC matrix). Admins see all.
- Entries carry `state: NORMAL|CANCELLED|MOVED_OUT|MOVED_IN|EXAM`, a date, clock times and reason. Each has a stable occurrence ID.
- Before publication the endpoints return an explicit "no published schedule" state, so the current fake empty states become real ones.

**Client**
- `components/timetable/WeekView.tsx` (read-only; desktop grid, mobile day list), week navigator, legend, cancelled and moved classes visibly distinct, exam badges.
- Pages: `/student/timetable`, `/professor/schedule`.
- Dashboards show "today" from real data, replacing the static panels.

**Tests:** resolver order with each override type, holidays, RBAC, IST boundary (23:59 and 00:01), term boundary.

### Phase 5: Notifications

Comes before overrides and exams so they notify from their first release.

**Reliability approach:** `notification.service.notify(session, recipients, {...})` writes `Notification` rows **inside the same transaction as the change**. After commit, it pushes over the socket as a best effort. If the push is lost, the row is still there and clients refetch on reconnect. So no outbox or redelivery cron is needed. `insertMany` with `ordered: false` and `dedupeKey` prevents duplicates.

```
GET   /api/v1/notifications?cursor=&unread=     ALL (own only)
GET   /api/v1/notifications/unread-count        ALL
PATCH /api/v1/notifications/:id/read            ALL
POST  /api/v1/notifications/read-all            ALL
```

**Socket (`services/socket.service.ts`):** JWT handshake, room `user:<id>`, events `notification:new` and `generation:update`. Reconnects with a fresh token after refresh, and disconnects on logout. CORS matches Express.

**Types:** `TIMETABLE_PUBLISHED`, `CLASS_CANCELLED`, `CLASS_RESCHEDULED`, `CLASS_RESTORED`, `MINOR_SCHEDULED`, `MINOR_CHANGED`, `MINOR_CANCELLED`, `MINOR_REMINDER`, `ATTENDANCE_MISSED` (to professor), `ATTENDANCE_LOW` (to student, when crossing a threshold).

**Client:** `context/SocketContext.tsx`; `NotificationBell` in `AppShell` with unread count and latest items; `/notifications` page with filter and mark-all-read. A new notification invalidates React Query keys by type (`schedule`, `exams`, `attendance`) and shows a toast.

**Tests:** transaction rollback leaves no notifications; dedupe; only your own are readable; socket auth rejected without a valid token; two clients receive a push.

### Phase 6: Cancel and reschedule

```
POST /api/v1/occurrences/:lineageId/:dateKey/cancel        PROFESSOR(own), ADMIN  { reason }
GET  /api/v1/occurrences/:lineageId/:dateKey/reschedule-options?targetDate=   PROFESSOR(own), ADMIN
POST /api/v1/occurrences/:lineageId/:dateKey/reschedule    PROFESSOR(own), ADMIN  { targetDate, period, classroomId, reason }
POST /api/v1/occurrences/:lineageId/:dateKey/revert        PROFESSOR(own), ADMIN
```

**Rules**
- Options are `free(professors) ∩ free(batch) ∩ free(rooms of the right type and capacity)`, contiguous and unblocked, from `Booking`.
- Target must be a working non-holiday date in the term, not in the past.
- Rescheduling a class that's already rescheduled updates the same override in place. In one transaction, release its keys, then claim the new ones, so overlapping moves don't collide with themselves.
- Revert re-claims the original keys. If taken → 409 with the reason, and the class stays as it is.
- Any co-teacher can act on a co-taught class.
- Once a session is `SUBMITTED` or `LOCKED`, professors can't cancel it. Admins can, with a reason: session → `CANCELLED`, `record.counted = false`, audit entry, and `statusBeforeCancel` allows a restore.
- Holiday added after publish: preview lists affected classes; confirmed classes get `source: HOLIDAY` overrides and notifications. Moved-in classes or exams on that date must be resolved first.

**Client:** `CancelClassModal`, `RescheduleModal` (date picker → options list → confirm) from `WeekView` on `/professor/schedule`; admin gets the same actions on any schedule.

**Tests:** full 3-way finder; race (two concurrent claims → one 409); reschedule twice; revert after the slot is taken; cancel after submission for each role; another professor's class → 403.

### Phase 7: Attendance

**Deliverable: end-to-end marking, student view, reports and audit.**

**Lifecycle**
```
SCHEDULED ──submit──▶ SUBMITTED ──lockAt──▶ LOCKED
    │                                         ▲
    └──lockAt, no submit──▶ MISSED ──admin────┘
any state ──class cancelled──▶ CANCELLED
```
- Sessions are created by a daily cron (00:05 IST) with startup catch-up, plus an ensure-today on `/attendance/today`. Cancelled occurrences get none; a reschedule updates `actualDateKey` and `lockAt`.
- `lockAt = class end + attendanceLockHours`. Stored, so changing the setting doesn't rewrite history. A 15-minute cron sweeps; writes also check `lockAt`.
- Marking opens at class start. Conditional updates on `revision` prevent co-teachers overwriting each other.
- Post-submit edits within the window write an audit entry. After lock, only an admin can edit, with a **required reason**.
- Roster is `User.find({ batchId, role: 'STUDENT', isActive: true })`.

**Calculation**
```
percentage = (PRESENT + LATE) / (PRESENT + LATE + ABSENT) × 100
```
**`EXCUSED` is left out of the denominator**, a deliberate change from CLAUDE.md: otherwise an excused absence would lower the percentage just like an absence. Only `counted: true` records count. Thresholds come from settings (≥80 good, 70–79.99 warning, <70 critical).

```
GET  /attendance/today                       PROFESSOR
GET  /attendance/sessions?from&to&status     PROFESSOR(own), ADMIN
GET  /attendance/sessions/:id/roster         PROFESSOR(own), ADMIN
POST /attendance/sessions/:id/records        PROFESSOR(own, in window), ADMIN { records, revision, reason? }
GET  /attendance/sessions/:id/audit          PROFESSOR(own), ADMIN
GET  /attendance/student/me                  STUDENT  (per-course summary)
GET  /attendance/student/me/courses/:id      STUDENT  (date-wise log)
GET  /attendance/reports/offering/:id        PROFESSOR(own), ADMIN  (matrix, ?format=csv)
GET  /attendance/reports/defaulters?band=&departmentId=&batchId=   ADMIN (?format=csv)
GET  /attendance/reports/missed              ADMIN
```

**Professor client**
- `/professor/attendance`: today's classes with status, plus past unsubmitted ones within the window, each showing the time left to edit.
- `/professor/attendance/:sessionId` (`MarkAttendance.tsx`), mobile-first:
  - All students start as `PRESENT`; tap cycles Present → Absent → Late → Excused.
  - Sticky footer with live counts ("27 Present, 2 Absent, 1 Late").
  - Search by name or roll, optional remarks, Submit. Locked sessions are read-only.
  - Colour is always paired with a letter or label for colour-blind users.
- `/professor/reports`: matrix per offering, CSV export.

**Student client (view-only)**
- `/student/attendance`: overall figure, a per-course card with percentage, band colour, present/total, and **"can miss N more" or "must attend N more"** to stay at or reach 80%.
- Course drill-down: date-wise log (date, time, status, remarks).
- Dashboard's attendance tile uses real data.

**Admin client**
- `/admin/attendance`: defaulters, missed sessions, and session lookup with override form and history.
- Wire "View Defaulter Reports" and "Manage Student Rosters" (→ `/admin/manage`, Students tab filtered by section).

**Tests:** full lifecycle; lock at the exact boundary; each role at each stage; percentages (Excused, cancelled, no sessions); co-teacher race; transfer between sections; student can't read another's data; audit written; CSV escaping (protect against formula injection).

---

## 8. Phase 8: Minor Exams

**Deliverable: a professor schedules a minor; students see and are notified of it.**

### Rules

An exam belongs to an offering the professor teaches, and runs for one section.

**Date:** in the term, a working non-holiday day, at least `minorNoticeDays` calendar days ahead.

**Each exam period must be one of:**
- **Free:** batch and professor both free.
- **Own class:** the batch is in a class that this professor teaches, regardless of offering (so `CS1303` and `CS1303-LAB` both count).

Another professor's class can **never** be displaced.

**Partial overlap:** a session counts as 1, so overlapping any period cancels the **whole** class occurrence. The remainder of that occurrence is released. Example: a 1-hour exam over the first hour of a 2-hour lab cancels the whole lab, and the finder states this up front.

**Room:** active, capacity ≥ batch size, free for all exam periods (or being vacated by the displaced class). Theory rooms are preferred. The room is suggested and can be changed.

**Same-day minors:** another minor for the batch that day shows a warning but doesn't block. Clashing periods are impossible.

### Booking, cancelling and changing (all transactional)

- **Book:** create the exam, a `source: EXAM` override per displaced class, release those keys, claim the exam's keys, cancel any existing session, and notify.
- **Cancel:** a reason is required, up to the exam's start. Release keys, then try re-claiming each displaced class's keys. If one has been taken in the meantime, that class stays cancelled and the professor is told.
- **Change:** allowed in the same transaction, re-checking all rules, including the notice rule when the date or time changes. Increments `revision` and sends a before-and-after notification.
- A displaced class that already has a manual override: the finder treats that occurrence as not at its original time, so nothing is cancelled.
- A displaced class with co-teachers: they are notified.

### API
```
GET  /api/v1/exams/options?offeringId&date&duration   PROFESSOR(own), ADMIN
POST /api/v1/exams                                    PROFESSOR(own)
GET  /api/v1/exams?from&to&batchId&status             role-filtered
GET  /api/v1/exams/:id                                role-filtered
PATCH /api/v1/exams/:id                               PROFESSOR(own), ADMIN
POST /api/v1/exams/:id/cancel                         PROFESSOR(own), ADMIN  { reason }
```
`options` returns, for each start period, a `FREE` or `OWN_CLASS` label, which classes would be cancelled, valid rooms, and warnings.

### Notifications

| Event | Goes to | Content |
|---|---|---|
| Booked | Students in the section, co-teachers of displaced classes | Course, date, time, room, syllabus; also "this replaces your CS1305 class at 10:00" when one is displaced (one notification, not two) |
| Changed | Same | Old and new values |
| Cancelled | Same | Reason; whether the displaced class is back on |
| Reminder | Students, professor | Hourly cron, sent `examReminderHours` ahead; `dedupeKey = exam:<id>:v<revision>:reminder`, so a changed exam gets a fresh reminder |

### Client
- `/professor/exams`: upcoming and past list, "Schedule minor" button.
- `components/exams/ScheduleMinorWizard.tsx`: (1) course and section, (2) date (with notice rule), duration, (3) options grouped into **Free** and **Your class**, with a clear warning for any class that will be cancelled, (4) room, title, syllabus, and confirm.
- `ExamCard`, `CancelExamModal`, edit flow reusing the wizard.
- `/student/exams`: upcoming minors with a countdown, and past ones. Exams also appear in `WeekView` and on the student dashboard.
- `/admin/exams`: all exams with filters and cancel. The notice setting is in `/admin/academics`.

**Out of scope:** marks and grading, seating plans, invigilators, multi-section or multi-room exams.

**Tests:** each slot class; own-class partial overlap; another professor's class rejected; notice boundary (exactly 3 days, IST); room vacated by the displaced class is offered; race for the same room → 409; cancel restores class; cancel when the slot's been taken; attendance excluded for the displaced date; recipient lists; reminder fires once and again after a change.

---

## 9. Phase 9: Mid-term republish and hardening

**Republish flow.** The schema (`versions[]`, `lineageId`) is built in Phases 1–3; this flow ships last.

1. Admin clones the published timetable into a draft and edits it.
2. Publish asks for `effectiveFrom`, which must be in the future.
3. **Impact report:** future exams or moved-in classes that now collide (**these block publishing**), and overrides whose lineage no longer exists.
4. In one transaction: delete `WEEKLY` bookings from `effectiveFrom`, expand the new version, add it to `term.versions`, and mark lost overrides `ORPHANED`. Notify affected people.

`resolveRange` picks the version per date, so past dates and attendance keep their history.

**Hardening**
- Pagination on admin lists and reports.
- Replace four-list fetch in `AdminDashboard` with `GET /admin/stats`, and use the real term for "Current Term".
- Indexes reviewed with `explain` on the main queries; every foreign key indexed.
- `npm audit`, helmet and CORS review, RBAC test sweep (every route × every role).
- README: setup, demo walkthrough, env. Final CLAUDE.md update.

---

## 10. Incomplete work and where it's handled

| Item | Evidence | Phase |
|---|---|---|
| Mongo port mismatch | `docker-compose.yml:9` vs `.env.example:3` | 0 |
| `npm test` fails; no tests | `jest` not installed | 0 |
| No rate limit; irrevocable refresh; no logout | `auth.routes.ts:22-23`, `auth.controller.ts:71-92` | 0 |
| Password change doesn't end sessions | `admin.controller.ts:105` | 0 |
| Logged-in user bounced to login on reload | `App.tsx:22-28` | 0 |
| Student's section never displays | `StudentDashboard.tsx:7`, `auth.controller.ts:59` | 0 |
| Client ignores refresh; `id` vs `_id` | `AuthContext.tsx:58` | 0 |
| Parsed validation discarded | `validate.middleware.ts:7` | 0 |
| Mongoose validation → 500 | `error.middleware.ts` | 0 |
| `z.union` hides field errors | `admin.routes.ts:27-40` | 0 |
| `Batch.students`/`studentCount` stale | `admin.controller.ts:58,82,93` | 0, 1 |
| Soft delete can't be undone | `admin.controller.ts:74-80` | 0 |
| No Department CRUD or CSV import | `admin.routes.ts:21` | 0 |
| Duplicate roll numbers allowed | `User.ts:63-68` | 0 |
| No references check, no cascade warning | `admin.controller.ts:58-64,90-96` | 0 |
| `AdminManagement` bugs and `any` | see Phase 0 | 0 |
| Demo credentials always visible | `Login.tsx:108-136` | 0 |
| Destructive seed with no guard | `seeder.ts:90-102` | 0 |
| Stale docs | `SETUP_SUMMARY.md`, `initial-setup-plan.md`, CLAUDE.md §8 | 0 |
| No course-to-batch mapping | `Course.ts` | 1 |
| No grid, holidays or terms | — | 1 |
| Seed errors: semester 1, double labs, no faculty on Fractal | `seeder.ts:58,63,66,67,72,75,155` | 1 |
| Broken overlap indexes | `ScheduleSlot.ts:30-32` | 1–3 |
| Dead admin buttons | `AdminDashboard.tsx:112,116,137,140` | 3, 7 |
| Static placeholder panels | `ProfessorDashboard.tsx:27,43-44`, `StudentDashboard.tsx:19,31-32,44-45` | 4, 7 |
| Misleading "Current Term" | `AdminDashboard.tsx:25,30` | 9 |
| No pagination | `admin.controller.ts:41-45` | 9 |
| Professor and student nav missing | `Navbar.tsx:37` | 0 |

---

## 11. Critical files

**Rewritten or heavily changed:** `server/src/models/{ScheduleSlot,ScheduleOverride,AttendanceSession,AttendanceRecord,Timetable,SoftConstraint,Batch,User}.ts`, `server/src/utils/seeder.ts`, `server/src/server.ts`, `server/src/app.ts`, `docker-compose.yml`, `CLAUDE.md`, `client/src/App.tsx`, `client/src/api/client.ts`, `client/src/context/AuthContext.tsx`.

**Reuse as they are:** `sendSuccess`/`ApiError` (`utils/response.ts`), `authenticate`, `authorize`, `createApp()`, `config/env.ts` pattern, `ProtectedRoute`, the Tailwind patterns in `AdminManagement.tsx` (`fieldClass`, banners, modal).

**New server layout**
```
server/src/
  routes|controllers/  settings, term, offering, constraint, timetable, schedule,
                       occurrence, attendance, exam, notification
  services/
    scheduler/         types, occupancy, conflicts, cost, preflight, construct, anneal, algorithm, worker
    calendar.service, booking.service, override.service, attendance.service,
    exam.service, notification.service, socket.service, cron.service
  utils/               asyncHandler, dateKey
```
Controllers stay thin; rules live in services, so they can be tested and reused.

**New client layout**
```
client/src/
  api/         one module per domain; hooks/ wraps them with React Query
  components/  ui, layout, timetable, attendance, exams, notifications
  context/     SocketContext
  store/       timetableEditorStore, toastStore
  types/       one file per domain
  pages/       admin, professor, student, shared/Notifications
```

---

## 12. Verification

**Automated, in every phase:** `npm test` (server, client), `npm run build` (both), lint.

**End-to-end (Playwright, on seed data):**
1. Admin: set up the term → preflight → generate → drag a class (green, yellow, red) → publish.
2. Professor: mark attendance → submit → edit in window → locked after the window (clock mocked).
3. Student: sees the timetable and the percentage change.
4. Professor cancels a class: student gets a live notification, the class is grey, no session is created.
5. Professor reschedules: only valid options are listed; the class appears at its new time.
6. Professor books a minor in a free slot, and another over their own class: students notified live; the class is cancelled; attendance excludes it.
7. Professor cancels that minor: the class returns; students notified.
8. Two browser sessions book the same room and period: one gets a clear 409.

**Manual demo:** `docker compose up -d`, `npm run seed:demo`, `npm run dev`, then log in as `admin@sam.edu`, `prof.rimjhim@sam.edu` and `student.csea01@sam.edu` in separate browser profiles.

**Done means:**
- No solver output has a hard violation across seeds.
- Every route has an RBAC test.
- No dead buttons or fake empty states remain.
- `any` is gone (ESLint enforced).
- CLAUDE.md matches the code.

**Delivery:** one branch and PR per phase, in order. Each leaves the app working. Phases 4 and 5 could run in parallel; everything else depends on what comes before it.

---

## 13. Assumptions to confirm

1. **Faculty mapping in the seed:** two faculty on a theory course means separate sections; lab faculty co-teach. Please correct against your real timetables.
2. **`EXCUSED` is left out of the percentage**, which differs from the CLAUDE.md formula.
3. **Labs aren't split into groups.** A section larger than a lab's capacity fails preflight with a clear message.
4. **"Unavailable" stays a very strong soft constraint** rather than a hard one, so a timetable is still possible when faculty over-restrict. The editor flags it clearly.
5. **Not included:** exam marks, seating, invigilators, email, faculty substitution during a term (use republish), and rooms in anything other than single-campus use.
