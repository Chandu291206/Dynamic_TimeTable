# 📅 Timetable Management System

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

A modern, full-stack college timetable management platform designed for academic institutions. It enables public access to weekly class schedules, allows Class Representatives (CRs) to post real-time day overrides (substitutions, room swaps, faculty changes), and equips administrators with comprehensive tools for managing classes, faculty sync, subject catalogues, slot assignments, and audit logging.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#1-backend-setup)
  - [Frontend Setup](#2-frontend-setup)
- [Default Credentials](#-default-credentials)
- [Environment Variables](#-environment-variables)
- [Available Scripts](#-available-scripts)
- [API Endpoints Overview](#-api-endpoints-overview)
- [Production Deployment](#-production-deployment)
- [Contributing & License](#-contributing--license)

---

## ✨ Key Features

### 🌐 Public Timetable Portal
- **Interactive Schedule Viewer**: Browse weekly schedules dynamically filtered by Academic Year, Branch, and Section.
- **Current Period Highlighting**: Visual indicators highlight ongoing periods, upcoming breaks, and active slots based on local system time.
- **Faculty Previews**: View faculty details, designations, departments, contact info, and official profile pictures directly in an accessible modal dialog.
- **Responsive Timetable Grid**: Fully responsive layout optimized for mobile screens, tablets, and desktop workstations.

### 🧑‍🎓 Class Representative (CR) Dashboard
- **Day-Specific Schedule Overrides**: Temporarily substitute faculty, swap subjects, reschedule periods, or cancel slots for specific dates without mutating the master timetable.
- **Override Management**: Create, view, edit, and withdraw date-specific overrides with validation ensuring dates fall within acceptable ranges.
- **Live Classroom Sync**: Overrides automatically reflect on the public weekly grid for students of that designated section.

### 🛠️ Administrative Control Center
- **Classroom Management**: Create and configure classes by year, branch, section, academic year, semester, and effective start dates.
- **Master Slot Scheduling**: Interactive time slot and period configuration mapping subjects and faculty across weekdays (Monday–Saturday).
- **Interactive Timetable Designer & Clash Engine (New)**:
  - Visual weekly scheduling grid (`/admin/designer`) supporting multi-period lab spanning (`colSpan`).
  - Draft &rarr; Publish lifecycle preventing student disruption while administrators construct upcoming schedules.
  - Real-time clash prevention engine blocking class overlaps and faculty double-booking (including Batch A and Batch B lab faculty).
  - Serialized concurrency control with PostgreSQL advisory locks (`pg_advisory_xact_lock`).
  - Atomic diff-based publish preserving unchanged slot IDs and reporting any future override impact warnings.
- **Conflicts & Availability Reporting**:
  - Live conflicts inspection (`/api/admin/conflicts`) highlighting any historical or cross-class double-bookings.
  - Faculty availability lookup (`/api/admin/faculty-busy-map`) disabling busy professors in the scheduling UI with exact clash reasons.
- **Subject Directory**: Centralized catalogue of courses with unique subject codes, short forms, and full titles.
- **Faculty Directory & Automated Scraper**:
  - Strict identification by normalized `staffId` with zero name-matching ambiguity.
  - Automated institutional directory scraper fetching faculty information, designations, emails, and profile photographs directly from department websites.
  - Built-in PDF/directory synchronization engine with audit tracking (`FacultySyncRun`).
- **Class Representative Account Provisioning**: Generate, activate, suspend, or reset credentials for section-specific CR accounts.
- **Bulk Excel / JSON Timetable Importer**: Upload and parse Excel (`.xlsx`) spreadsheets or structured JSON files with instant schema validation and preview.
- **Audit Logging**: Comprehensive activity tracking detailing administrative changes, slot creations, deletions, and overrides with timestamped user records.

### 🛡️ Enterprise Security & Data Integrity
- **Role-Based Access Control (RBAC)**: Enforced via stateless JSON Web Tokens (JWT) for `ADMIN`, `CR`, and unauthenticated `PUBLIC` access.
- **Strict Data Validation**: Backend payloads strictly validated using [Zod](https://zod.dev/) schemas before hitting business logic.
- **Password Security**: Passwords salted and hashed with `bcrypt`.
- **Security Headers & Rate Limiting**: Custom security headers and configurable IP-based request throttling to prevent brute-force attacks.
- **Disaster Recovery Tools**: Automated database backup, SQL dump generation, and restore verification CLI utilities included.

---

## 🏛️ System Architecture

```text
                                 ┌────────────────────────┐
                                 │   Web Clients / App    │
                                 │   (Desktop & Mobile)   │
                                 └───────────┬────────────┘
                                             │ HTTPS
                                             ▼
                                 ┌────────────────────────┐
                                 │  Nginx Reverse Proxy   │
                                 │     (Port 80/443)      │
                                 └─────┬────────────┬─────┘
                     Static Assets     │            │  /api Proxy
              ┌────────────────────────┘            └────────────────────────┐
              ▼                                                              ▼
   ┌──────────────────────┐                                       ┌──────────────────────┐
   │  React 19 + Vite UI  │                                       │ Express.js 5 Backend │
   │  (SPA Client Build)  │                                       │ (REST API on :5000)  │
   └──────────────────────┘                                       └──────────┬───────────┘
                                                                             │ Prisma ORM
                                                                             ▼
                                                                  ┌──────────────────────┐
                                                                  │ PostgreSQL Database  │
                                                                  │ (Local / Supabase)   │
                                                                  └──────────────────────┘
```

---

## 💻 Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | [React 19](https://react.dev/) | Component-based reactive UI library |
| | [Vite 8](https://vitejs.dev/) | Next-generation frontend tooling and bundler |
| | [React Router 7](https://reactrouter.com/) | Client-side routing and protected navigation |
| | [XLSX](https://sheetjs.com/) | Client-side Excel parsing for timetable import |
| **Backend** | [Node.js 20+](https://nodejs.org/) | Server JavaScript runtime |
| | [Express.js 5](https://expressjs.com/) | Robust RESTful HTTP framework |
| | [Prisma 6](https://www.prisma.io/) | Next-generation TypeScript/JavaScript ORM |
| | [Zod](https://zod.dev/) | TypeScript-first schema declaration and validation |
| | [JWT](https://jwt.io/) & [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Stateless authorization and cryptographic password hashing |
| | [PDF-Parse](https://www.npmjs.com/package/pdf-parse) | Institutional PDF directory parsing |
| **Database** | [PostgreSQL 15+](https://www.postgresql.org/) | Relational database (Local or Cloud/Supabase) |

---

## 📂 Project Structure

```text
Timetable/
├── backend/
│   ├── prisma/
│   │   ├── migrations/             # Database schema migrations
│   │   ├── schema.prisma           # Prisma data models & relations
│   │   └── seed.js                 # Initial admin & demo data seed script
│   ├── scripts/
│   │   ├── db-backup.js            # Automated database backup script
│   │   ├── db-restore.js           # Database restore utility
│   │   └── verify-backup.js        # Backup integrity validation
│   ├── src/
│   │   ├── config/                 # Database & environment configurations
│   │   ├── controllers/            # Route request/response handlers
│   │   ├── middleware/             # Auth, error handling, rate limiting & logging
│   │   ├── routes/                 # Express API route declarations
│   │   ├── services/               # Core business logic & scraper engines
│   │   ├── utils/                  # Date helpers, password hashing & formatters
│   │   ├── validators/             # Zod input validation schemas
│   │   ├── app.js                  # Express app setup and middleware chain
│   │   └── server.js               # HTTP server entry point
│   └── test/                       # Unit & integration test suites
├── frontend/
│   ├── src/
│   │   ├── admin/                  # Admin portal management views
│   │   ├── api/                    # Axios/fetch API client modules
│   │   ├── components/             # Reusable UI elements (Grids, Modals, Avatars)
│   │   ├── hooks/                  # Custom React hooks (useAuth, useTimetable)
│   │   ├── pages/                  # Top-level page components
│   │   ├── utils/                  # Client-side Excel & date formatters
│   │   ├── App.jsx                 # Route definitions & layout wrappers
│   │   └── main.jsx                # Application root DOM mount
│   ├── index.html
│   └── vite.config.js              # Vite configuration & dev proxy
├── deploy/
│   ├── nginx.conf                  # Production reverse proxy template
│   ├── timetable-backend.service   # Systemd unit file for Node backend
│   └── README.md                   # Bare-metal / VPS production deployment guide
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have installed:
- **[Node.js](https://nodejs.org/)** (v20.0.0 or higher)
- **npm** (bundled with Node.js)
- **[PostgreSQL](https://www.postgresql.org/)** (v14 or higher) running locally or hosted on [Supabase](https://supabase.com/)

---

### 1. Backend Setup

1. **Navigate to the backend directory and install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env    # On Linux/macOS
   # or on Windows PowerShell:
   Copy-Item .env.example .env
   ```

3. **Update `backend/.env` with your database credentials**:
   ```env
   DATABASE_URL="postgresql://postgres:your_password@localhost:5432/timetable_db"
   JWT_SECRET="super_secret_jwt_key_change_me_in_production"
   PORT=5000
   ```

4. **Initialize the database (Migrations, Client Generation & Seeding)**:
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   npm run prisma:seed
   ```

5. **Start the backend development server**:
   ```bash
   npm run dev
   ```
   *The backend will be running at [http://localhost:5000](http://localhost:5000). Verify via [http://localhost:5000/api/health](http://localhost:5000/api/health).*

---

### 2. Frontend Setup

1. **Open a new terminal, navigate to the frontend directory, and install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Start the frontend development server**:
   ```bash
   npm run dev
   ```
   *The application will open at [http://localhost:5173](http://localhost:5173). The Vite dev server automatically proxies `/api` calls to port `5000`.*

---

## 🔐 Default Credentials

When running `npm run prisma:seed`, the following accounts are bootstrapped:

| Portal | Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/login` | **Administrator** | `admin` | `admin123` | Full system access |
| `/cr/login` | **Class Representative** | `cr1` | `crpass` | Assigned to default seeded class |

> [!WARNING]
> Remember to change default credentials in `backend/.env` and reset database passwords prior to deploying to any production environment!

---

## ⚙️ Environment Variables

The backend requires the following configuration variables inside `backend/.env`:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:pass@localhost:5432/timetable_db` |
| `JWT_SECRET` | Secret key used to sign access tokens | `your_secret_key` |
| `JWT_EXPIRES_IN` | Token validity duration | `8h` |
| `PORT` | HTTP server listening port | `5000` |
| `NODE_ENV` | Environment identifier | `development` / `production` |
| `FRONTEND_URL` | Origin permitted by CORS | `http://localhost:5173` |
| `ADMIN_USERNAME` | Bootstrap Administrator username | `admin` |
| `ADMIN_PASSWORD` | Bootstrap Administrator password | `admin123` |
| `CR_INITIAL_USERNAME` | Default CR username | `cr1` |
| `CR_INITIAL_PASSWORD` | Default CR password | `crpass` |
| `GRIET_FACULTY_SOURCE_URL` | Institutional faculty source PDF/URL | `https://www.griet.ac.in/...` |

---

## 📜 Available Scripts

### Backend (`/backend`)

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts server with `nodemon` hot reloading |
| `npm start` | Starts server in production mode |
| `npm run prisma:generate` | Generates the Prisma Client |
| `npm run prisma:migrate` | Runs Prisma schema migrations |
| `npm run prisma:seed` | Seeds database with initial accounts and classes |
| `npm run prisma:verify` | Verifies database connectivity and model integrity |
| `npm test` | Runs the full Node test runner test suite |
| `npm run test:unit` | Executes unit tests |
| `npm run test:integration` | Runs API endpoint integration tests |
| `npm run db:backup` | Takes a JSON snapshot backup of all tables |
| `npm run db:backup:sql` | Takes an SQL dump backup using `pg_dump` |
| `npm run db:restore` | Restores database from a previous backup |
| `npm run db:verify-backup` | Verifies integrity and record count of backups |

### Frontend (`/frontend`)

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts Vite local development server with HMR |
| `npm run build` | Compiles and optimizes assets into `dist/` |
| `npm run preview` | Locally previews production build |
| `npm run lint` | Runs `oxlint` fast JavaScript/JSX linting |

---

## 🔌 API Endpoints Overview

```text
/api
├── /health               GET     System health check & DB status
├── /auth
│   ├── /login            POST    Unified login (returns JWT + role)
│   ├── /me               GET     Verify active session & role
│   └── /logout           POST    Terminates session
├── /classes              GET     List all classes (year, branch, section)
├── /timetable
│   └── /:classId         GET     Retrieve weekly timetable + active overrides
├── /cr
│   ├── /dashboard        GET     CR class details & current schedule
│   ├── /overrides        GET     List class overrides
│   ├── /overrides        POST    Create date-specific period override
│   └── /overrides/:id    DELETE  Delete an existing override
└── /admin
    ├── /classes          CRUD    Manage class definitions
    ├── /subjects         CRUD    Manage subject catalogue
    ├── /faculty          CRUD    Manage faculty & trigger web scrapers
    ├── /faculty/sync     POST    Initiate faculty sync from directory
    ├── /slots            CRUD    Configure master timetable grid slots (clash-verified)
    ├── /conflicts        GET     Real-time conflict detection across all classes
    ├── /faculty-busy-map GET     Global faculty availability schedule
    ├── /designer/drafts  CRUD    Draft lifecycle, cell editing, availability, publish
    ├── /timetable/upload POST    Bulk upload timetable from Excel / JSON
    ├── /crs              CRUD    Manage and issue CR credentials
    └── /logs             GET     View timestamped administrative audit trail
```

---

## 🌐 Production Deployment

This project is built for streamlined direct deployment on bare-metal or virtual private servers (Debian/Ubuntu, Rocky Linux, or Amazon Linux) with **Nginx**, **Node.js (PM2)**, and native **PostgreSQL**.

For complete step-by-step production setup instructions, Nginx reverse proxy configurations, SSL installation, and Systemd service management, consult the [Production Deployment Guide](file:///c:/3rd%20year/Timetable/deploy/README.md).

---

## 🤝 Contributing & License

1. Fork the Project repository.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Distributed under the **ISC License**.
