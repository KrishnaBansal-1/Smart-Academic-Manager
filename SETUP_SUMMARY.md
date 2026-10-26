# Smart Academic Manager (SAM) — Initial Setup & Implementation Report

> **Project:** Scalable & Extendable Smart Academic Manager  
> **Tech Stack:** MERN (MongoDB, Express.js, React 18+, Node.js v20+) with TypeScript  
> **Date:** October 26, 2026  
> **Status:** Phase 1 & Phase 2 Complete, Phase 3 Master Models Implemented  

---

## 1. Executive Summary

We have established the complete baseline architecture for the Smart Academic Manager (SAM) according to the architectural guidelines in `CLAUDE.md` and the approved `initial-setup-plan.md`. 

The system is configured as an extensible **modular monolith** with an npm workspaces monorepo structure. Both the Express backend and Vite+React frontend are fully wired with strict TypeScript typing, security middlewares, authentication, role-based access control (RBAC), database schemas with collision-prevention indexes, and role-specific dashboard views.

---

## 2. Directory Structure Implemented

```
Smart-Academic-Manager/
├── .gitignore                          # Exclusions for node_modules, envs, builds
├── package.json                        # Root npm workspaces configuration
├── docker-compose.yml                  # Local MongoDB 6.0 container setup
├── README.md                           # Project introduction & links
├── CLAUDE.md                           # Master architectural blueprint
├── SETUP_SUMMARY.md                    # This implementation summary
│
├── server/                             # Express + Node.js + Mongoose Backend
│   ├── package.json                    # Backend dependencies & run scripts
│   ├── tsconfig.json                   # Strict TypeScript compiler config
│   ├── .env.example                    # Sample environment template
│   ├── .env                            # Active development environment
│   └── src/
│       ├── app.ts                      # Express application setup & middleware stack
│       ├── server.ts                   # HTTP listener with graceful shutdown
│       ├── config/
│       │   ├── env.ts                  # Zod-validated environment schema
│       │   └── db.ts                   # Mongoose connection manager & listeners
│       ├── middlewares/
│       │   ├── auth.middleware.ts      # JWT Bearer token authenticator
│       │   ├── rbac.middleware.ts      # Role-based access authorization guard
│       │   ├── error.middleware.ts     # Global centralized error handler
│       │   └── validate.middleware.ts  # Zod request payload validator
│       ├── models/                     # Full Mongoose ODM collection models
│       │   ├── User.ts                 # Accounts with bcrypt password comparison
│       │   ├── Department.ts           # Academic departments
│       │   ├── Classroom.ts            # Rooms (Theory / Laboratory) & capacities
│       │   ├── Course.ts               # Academic courses & credit hours
│       │   ├── Batch.ts                # Student cohorts & enrolled students
│       │   ├── SoftConstraint.ts       # Faculty scheduling preferences
│       │   ├── Timetable.ts            # Timetable metadata (Draft / Published)
│       │   ├── ScheduleSlot.ts         # Timetable slots with conflict indexes
│       │   ├── ScheduleOverride.ts     # Class cancellations & reschedule entries
│       │   ├── AttendanceSession.ts    # Date-mapped attendance instances
│       │   └── AttendanceRecord.ts     # Individual student attendance logs
│       ├── controllers/
│       │   └── auth.controller.ts      # Login, token refresh, and profile logic
│       ├── routes/
│       │   └── auth.routes.ts          # Validated auth endpoints
│       └── utils/
│           ├── response.ts             # Standardized JSON response envelope
│           └── seeder.ts               # Master database seeder script
│
└── client/                             # React 18 + Vite + TypeScript Frontend
    ├── package.json                    # Frontend dependencies & run scripts
    ├── tsconfig.json                   # Client TypeScript configuration
    ├── tsconfig.node.json              # Vite tooling TS configuration
    ├── vite.config.ts                  # Vite config with path aliases & API proxy
    ├── index.html                      # HTML entry with modern typography
    ├── tailwind.config.js              # Tailwind styling configuration
    ├── postcss.config.js               # PostCSS plugins
    └── src/
        ├── main.tsx                    # React DOM root entry
        ├── App.tsx                     # Router and QueryClient provider wrapper
        ├── index.css                   # Global Tailwind style directives
        ├── api/
        │   └── client.ts               # Axios client with JWT interceptor & 401 handling
        ├── context/
        │   └── AuthContext.tsx         # User authentication & persistent state
        ├── types/
        │   ├── auth.ts                 # User & Auth contract types
        │   └── index.ts                # General domain entity types
        ├── components/
        │   └── common/
        │       ├── Navbar.tsx          # App header with role badges & logout
        │       └── ProtectedRoute.tsx  # Declarative RBAC route guard
        └── pages/
            ├── auth/
            │   └── Login.tsx           # Login screen with 1-click demo filler
            ├── admin/
            │   └── AdminDashboard.tsx  # Admin command center & module access
            ├── professor/
            │   └── ProfessorDashboard.tsx # Faculty portal (attendance & constraints)
            └── student/
                └── StudentDashboard.tsx # Timetable & 80/70 attendance tracker
```

---

## 3. What Has Been Built & Configured

### 3.1 Backend & Database Infrastructure
1. **Zod Environment Validation (`server/src/config/env.ts`):**
   - Strictly checks all required environment parameters (`PORT`, `MONGO_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `CLIENT_URL`) at startup, preventing runtime crashes due to missing configuration.
2. **Standardized Response Envelope (`server/src/utils/response.ts`):**
   - Every API endpoint returns a predictable contract:
     ```json
     {
       "success": true,
       "message": "Operation successful",
       "data": { ... }
     }
     ```
3. **Robust Error Handling (`server/src/middlewares/error.middleware.ts`):**
   - Automatically parses Zod validation failures into readable error messages.
   - Gracefully handles MongoDB duplicate key errors (code 11000) and invalid ObjectIDs.
   - Differentiates development stack traces from production error messages.
4. **JWT Authentication & RBAC Engine:**
   - Password hashing with `bcryptjs` using a minimum cost factor of 12.
   - Dual-token strategy: Short-lived access token + configurable refresh token.
   - `authenticate` middleware verifies tokens and validates that the account is active.
   - `authorize(['ADMIN', 'PROFESSOR', 'STUDENT'])` middleware guards routes by role.
5. **Database Models & Hard Integrity Safeguards:**
   - **`ScheduleSlot`**: Compound unique indexes (`{ timetableId, dayOfWeek, slotIndex, professorId }`, `{ timetableId, dayOfWeek, slotIndex, batchId }`, `{ timetableId, dayOfWeek, slotIndex, classroomId }`) ensure that double-booking is physically impossible at the database layer.
   - **`AttendanceRecord`**: Compound unique index (`{ sessionId, studentId }`) prevents duplicate records.
   - **`SoftConstraint`**: Stores faculty time preferences, non-teaching blocks, and daily lecture hour caps.
   - **`ScheduleOverride`**: Supports temporary class cancellations and 3-way rescheduling.
6. **Master Seed Script (`server/src/utils/seeder.ts`):**
   - Populates departments, classrooms (theory & labs), courses, batches, and demo accounts across all three user roles.

---

### 3.2 Frontend Architecture & User Experience
1. **Vite + Tailwind CSS + Lucide Icons:**
   - Modern, high-performance client build with path alias support (`@/*`).
   - Reverse proxy in `vite.config.ts` transparently routes `/api/*` to the Express backend (`http://localhost:5000`).
2. **API Client & Interceptors (`client/src/api/client.ts`):**
   - Automatically injects the JWT bearer token into the `Authorization` header for all outgoing requests.
   - Detects `401 Unauthorized` responses and safely flushes local session state, redirecting to the login portal.
3. **Session Management (`client/src/context/AuthContext.tsx`):**
   - Manages user profile, token persistence in `localStorage`, and role-based redirect resolution.
4. **Protected Routing (`client/src/components/common/ProtectedRoute.tsx`):**
   - Guards routes and redirects unauthorized roles to their respective dashboards.
5. **Role-Tailored Dashboards:**
   - **Login Page (`Login.tsx`)**: Includes single-click demo credential autofill for Admin, Professor, and Student.
   - **Admin Dashboard (`AdminDashboard.tsx`)**: Institutional statistics and launching points for Timetable Generation & Visual Drag-and-Drop Editor.
   - **Professor Dashboard (`ProfessorDashboard.tsx`)**: Displays daily teaching assignments, quick "Take Attendance" triggers, and soft constraint controls.
   - **Student Dashboard (`StudentDashboard.tsx`)**: View-only batch timetable and subject-wise attendance tracking with color-coded status badges reflecting the updated criteria:
     - **$\ge 80\%$**: `Good Standing` (Green)
     - **$70\% - 79.99\%$**: `Warning Zone` (Yellow)
     - **$< 70\%$**: `Critical Defaulter Alert` (Red)

---

## 4. Default Seed Accounts for Testing

Once seeded via `npm run seed`, the following accounts are ready for testing:

| Role | Email | Password | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@sam.edu` | `Admin@123` | Master control, schedule generation, drag-drop editor |
| **PROFESSOR** | `prof.sharma@sam.edu` | `Password@123` | View assigned lectures, mark attendance, submit preferences |
| **PROFESSOR** | `prof.patel@sam.edu` | `Password@123` | Secondary faculty for conflict/room allocation testing |
| **STUDENT** | `student.aarav@sam.edu` | `Password@123` | View batch timetable & personal attendance percentage |

---

## 5. How to Run the Project

### Step 1: Install Dependencies
```bash
# Install root, backend, and frontend dependencies
cd server && npm install
cd ../client && npm install
```

### Step 2: Start MongoDB
If using Docker:
```bash
docker compose up -d
```
*(Or ensure your local MongoDB daemon is active on port 27017).*

### Step 3: Seed Database
```bash
cd server
npm run seed
```

### Step 4: Run Development Environment
From the repository root:
```bash
npm run dev
```
- **Backend API:** `http://localhost:5000` (Health check: `http://localhost:5000/api/health`)
- **Frontend App:** `http://localhost:5173`

---

## 6. Next Steps on the Implementation Plan

With the foundational plumbing, auth, models, and UI shells completed:

1. **Module 1 (Schedule Generator & Editor):**
   - Implement the CSP/Backtracking algorithmic solver in `server/src/services/scheduler/algorithm.ts`.
   - Build the interactive `@dnd-kit` drag-and-drop timetable grid in `client/src/components/timetable/TimetableGrid.tsx`.
   - Implement the temporary class cancellation and 3-way reschedule modal.
2. **Module 2 (Attendance Records Keeper):**
   - Implement the automatic daily session generation service.
   - Build the rapid roster attendance marking view with "Mark All Present" default.
   - Implement the 24-hour attendance locking and admin override flow.
