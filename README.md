# Smart Academic Manager (SAM)

A scalable, extendable academic operations platform built with the MERN stack (MongoDB, Express.js, React 18+, Node.js v20+) and strict TypeScript.

## Core Modules
1. **Schedule Generator & Interactive Visual Editor**
   - Heuristic CSP + simulated annealing timetable solver.
   - Interactive administrative drag-and-drop schedule editor with real-time drop-maps.
   - Professor availability preferences, temporary class cancellation, and collision-free rescheduling.
   - Student and professor read-only timetable views.
2. **Attendance Records Keeper**
   - Real-time timetable-linked attendance marking for professors.
   - Attendance threshold tracking (≥80% Good, 70–79% Warning, <70% Critical).
   - Defaulter reporting, CSV exports, and immutable audit logs.
3. **Minor Exams Module**
   - Instant minor exam scheduling with automated clash detection.
   - Free slot booking or own-class displacement with automatic schedule updates.
   - Real-time notifications and student alerts.

---

## Getting Started

### Prerequisites
- Node.js v20+
- npm v10+
- Docker & Docker Compose (for local MongoDB replica set)

### 1. MongoDB Setup (Single-node Replica Set)
The application uses a MongoDB replica set (`rs0`) for multi-document ACID transactions.

Start the database with Docker Compose:
```bash
docker compose up -d
```
MongoDB will start and initialize `rs0` bound to `127.0.0.1:27018`.

### 2. Environment Setup
Configure server environment:
```bash
cp server/.env.example server/.env
```
Default connection string:
`mongodb://127.0.0.1:27018/smart_academic_manager?replicaSet=rs0&directConnection=true`

### 3. Install Dependencies
```bash
npm install
```

### 4. Seed Database
Seed the base dataset (NIT Warangal academic dataset with students, faculty, and departments):
```bash
npm run seed
```

### 5. Run Development Servers
Start both backend API (`http://localhost:5000`) and frontend client (`http://localhost:5173`):
```bash
npm run dev
```

---

## Test & Build Scripts

| Command | Action |
|---|---|
| `npm test` | Run all backend (Jest + in-memory Mongo replica set) and frontend (Vitest) test suites |
| `npm run test:server` | Run backend Jest test suite |
| `npm run test:client` | Run frontend Vitest test suite |
| `npm run lint` | Run ESLint across TypeScript codebase (`no-explicit-any` enforced) |
| `npm run build` | Build backend (`tsc`) and frontend (`vite build`) for production |
| `npm run seed` | Seed initial database records |

---

## Default Demo Accounts (After Seeding)

| Role | Email | Password | Description |
|---|---|---|---|
| **ADMIN** | `admin@sam.edu` | `Admin@123` | Institutional administrator portal |
| **PROFESSOR** | `prof.rimjhim@sam.edu` | `Password@123` | Faculty portal |
| **STUDENT** | `student.csea01@sam.edu` | `Password@123` | Student portal (CSE III-A section) |

*All seeded professor and student accounts use `Password@123`.*

---

## Documentation
- [CLAUDE.md](CLAUDE.md) — Master architectural blueprints, RBAC rules, data models, and API specifications.
- [implementation-plan.md](implementation-plan.md) — End-to-end implementation roadmap.
