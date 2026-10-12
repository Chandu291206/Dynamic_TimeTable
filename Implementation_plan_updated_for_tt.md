# Timetable Management System — Implementation Plan

## 1. Project Overview

Build a production-ready, responsive web-based timetable management system for educational institutions.

The system has three primary user groups:

1. **Students / Public Users**
   - Browse active classes.
   - View recurring weekly timetables.
   - Select a specific date.
   - See date-specific overrides.
   - View subject, faculty, faculty image, and override indicators.

2. **Class Representatives (CRs)**
   - Authenticate using JWT-based authentication.
   - Access only their assigned class.
   - Create date-specific timetable overrides.
   - View upcoming overrides.
   - Preview their class timetable with overrides applied.

3. **Administrators**
   - Authenticate using JWT-based authentication.
   - Manage faculty, subjects, classes, and recurring timetable slots.
   - Manage CR accounts and CR-to-class assignments.
   - View/manage all CR overrides.
   - Manually trigger faculty synchronization from the official GRIET website.

4. **Faculty Data Synchronization**
   - Source faculty data from the official GRIET website: `https://www.griet.ac.in/`.
   - The current official site exposes a “GRIET Faculty” link to an official staff-list PDF, so the scraper must support official PDF and HTML sources.
   - Synchronization is manual/admin-triggered only in the initial version.
   - Official faculty images are downloaded and stored in PostgreSQL where available.

### Recommended Stack

Use a modern separated frontend/backend architecture:

- **Frontend:** React + Vite
- **UI:** Tailwind CSS
- **Backend:** Node.js + Express
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Optional infrastructure:** Redis only if a demonstrated requirement needs caching, background jobs, or similar workloads.
- **Authentication:** JWT + secure password hashing
- **Validation:** Zod
- **Environment:** dotenv
- **Development:** concurrently / npm scripts
- **Production:** Nginx + Node.js + PostgreSQL

PostgreSQL is the required database. Do not add SQLite as a second database target.

**No Docker:** Docker and Docker Compose are not used anywhere in the project. Development and production use directly installed Node.js and PostgreSQL services.

---

# 2. High-Level Architecture

```text
                         ┌─────────────────────┐
                         │      Browser        │
                         │ React + Tailwind CSS   │
                         └──────────┬──────────┘
                                    │
                              HTTP / JSON
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Express Server    │
                         ├─────────────────────┤
                         │ Public Routes       │
                         │ CR Routes           │
                         │ Admin Routes        │
                         │ Authentication      │
                         │ Validation          │
                         │ Business Logic      │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       Prisma        │
                         │        ORM          │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │     PostgreSQL      │
                         └─────────────────────┘
```

## 2.1 Request Flow

```text
React Component
      │
      ▼
API Service
      │
      ▼
Express Router
      │
      ▼
Authentication Middleware
      │
      ▼
Validation Middleware
      │
      ▼
Controller
      │
      ▼
Service / Business Logic
      │
      ▼
Prisma
      │
      ▼
PostgreSQL
```

---

# 3. Recommended Repository Structure

```text
timetable-management/
│
├── README.md
├── .gitignore
├── .env.example
│
├── backend/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   │
│   └── src/
│       ├── server.js
│       ├── app.js
│       │
│       ├── config/
│       │   ├── env.js
│       │   └── database.js
│       │
│       ├── middleware/
│       │   ├── auth.js
│       │   ├── errorHandler.js
│       │   ├── validation.js
│       │   └── notFound.js
│       │
│       ├── routes/
│       │   ├── public.routes.js
│       │   ├── auth.routes.js
│       │   ├── cr.routes.js
│       │   └── admin.routes.js
│       │
│       ├── controllers/
│       │   ├── public.controller.js
│       │   ├── auth.controller.js
│       │   ├── cr.controller.js
│       │   └── admin.controller.js
│       │
│       ├── services/
│       │   ├── timetable.service.js
│       │   ├── override.service.js
│       │   ├── faculty.service.js
│       │   ├── facultyScraper.service.js
│       │   ├── facultyParser.service.js
│       │   ├── facultyImage.service.js
│       │   ├── subject.service.js
│       │   ├── class.service.js
│       │   └── slot.service.js
│       │
│       ├── validators/
│       │   ├── auth.schema.js
│       │   ├── override.schema.js
│       │   ├── faculty.schema.js
│       │   ├── subject.schema.js
│       │   ├── class.schema.js
│       │   └── slot.schema.js
│       │
│       └── utils/
│           ├── time.js
│           ├── dates.js
│           └── password.js
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    │
    └── src/
        ├── main.jsx
        ├── App.jsx
        │
        ├── api/
        │   ├── client.js
        │   ├── public.js
        │   ├── auth.js
        │   ├── cr.js
        │   └── admin.js
        │
        ├── components/
        │   ├── Navbar.jsx
        │   ├── Footer.jsx
        │   ├── ClassSelector.jsx
        │   ├── DateSelector.jsx
        │   ├── TimetableGrid.jsx
        │   ├── TimetableCell.jsx
        │   ├── FacultyAvatar.jsx
        │   ├── OverrideBadge.jsx
        │   ├── Loading.jsx
        │   ├── ErrorMessage.jsx
        │   └── ConfirmDialog.jsx
        │
        ├── pages/
        │   ├── Home.jsx
        │   ├── Timetable.jsx
        │   ├── CRLogin.jsx
        │   ├── CRDashboard.jsx
        │   ├── AdminLogin.jsx
        │   └── AdminDashboard.jsx
        │
        ├── admin/
        │   ├── FacultyManagement.jsx
        │   ├── SubjectManagement.jsx
        │   ├── ClassManagement.jsx
        │   └── SlotManagement.jsx
        │
        ├── cr/
        │   ├── OverrideForm.jsx
        │   └── OverrideList.jsx
        │
        ├── hooks/
        │   ├── useAuth.js
        │   └── useTimetable.js
        │
        ├── utils/
        │   ├── date.js
        │   ├── time.js
        │   └── constants.js
        │
        └── styles/
            ├── global.css
            └── timetable.css
```

---

# 4. Database Design

## 4.0 Time Representation

All timetable and override times use strict 24-hour `HH:MM` strings.

Examples:

```text
09:00
09:50
14:30
16:30
```

Rules:

- Exactly two digits for hours and minutes.
- Hours `00`–`23`.
- Minutes `00`–`59`.
- No seconds.
- No AM/PM.
- No timezone component.
- Convert to minutes-from-midnight for comparisons and overlap calculations.
- Every timetable API must return the same `HH:MM` format.

---

## 4.1 Faculty

Fields:

```text
id
name
staffId
department
designation
qualification
email
phone
imageData
imageMimeType
imageSourceUrl
profileSourceUrl
sourceUpdatedAt
lastScrapedAt
imageHash
createdAt
updatedAt
```

Constraints and behavior:

- `name` required.
- `staffId` unique when supplied.
- Only officially sourced details should be populated; never invent missing fields.
- `imageData` stores the official faculty image as PostgreSQL binary data (`Bytes` / `bytea`) when available.
- `imageMimeType` is required when `imageData` exists.
- `imageSourceUrl` and `profileSourceUrl` preserve official source traceability.
- `lastScrapedAt` records the latest synchronization.
- `imageHash` prevents unnecessary rewrites of unchanged images.
- Enforce a reasonable maximum image size.
- If an official image is unavailable, keep the image fields null and use an initials/placeholder avatar.
- The browser must receive images through the application's API rather than hotlinking the college website.


---

## 4.2 Subject

Fields:

```text
id
name
createdAt
updatedAt
```

Constraints:

- `name` required.
- Maximum length: 120.

---

## 4.3 ClassRoom

Fields:

```text
id
year
branch
section
createdAt
updatedAt
```

Example:

```text
year = 3
branch = AIML
section = B
```

Display:

```text
Y3 - AIML - B
```

Implement a backend/frontend utility for generating the label consistently.

Recommended uniqueness constraint:

```text
(year, branch, section)
```

---

## 4.4 TimetableSlot

Fields:

```text
id
classId
day
startTime
endTime
subjectId
facultyId
createdAt
updatedAt
```

Day values:

```text
0 = Monday
1 = Tuesday
2 = Wednesday
3 = Thursday
4 = Friday
5 = Saturday
```

Validation:

- `day` must be 0–5.
- `startTime` must be exactly `HH:MM` in 24-hour format.
- `endTime` must be exactly `HH:MM` in 24-hour format.
- Store no seconds or AM/PM strings.
- `startTime < endTime`.
- Class must exist.
- Subject and faculty should exist when supplied.
- Prevent duplicate/conflicting recurring slots for the same class/day where possible.

---

## 4.5 TimetableOverride

Fields:

```text
id
classId
date
startTime
endTime
subjectId
facultyId
createdAt
updatedAt
```

Validation:

- Date required.
- Start and end time required.
- Start must be before end.
- CR can only create overrides for their own class.
- Subject and faculty are optional.
- Override must overlap at least one existing timetable slot.

---

## 4.6 CRUser

Fields:

```text
id
username
passwordHash
role
classId
createdAt
updatedAt
```

Rules:

- Username unique.
- Password is never stored in plaintext.
- `role` is `CR` for CR accounts.
- `classId` is required for CR accounts.
- ADMIN accounts are not class-scoped.
- Administrators can create, deactivate, reassign, reset, and remove CR accounts.


---

## 4.7 Recommended Prisma Relationship Design

Use explicit relationships:

```text
ClassRoom
 ├── TimetableSlot[]
 ├── TimetableOverride[]
 └── CRUser[]

Subject
 ├── TimetableSlot[]
 └── TimetableOverride[]

Faculty
 ├── TimetableSlot[]
 └── TimetableOverride[]
```

Use cascade behavior carefully. Deleting a subject/faculty that is referenced by historical overrides may be undesirable. Prefer deactivation/soft deletion if future audit/history requirements are expected.

## 4.7 Faculty Scraping and Synchronization

Official source:

```text
https://www.griet.ac.in/
```

The current GRIET home page exposes a “GRIET Faculty” link which points to an official staff-list PDF. The implementation therefore needs an adaptable scraper that can consume official HTML and PDF sources rather than relying on one hard-coded page format. citeturn0view1turn1view0

Pipeline:

```text
Official GRIET URL
      ↓
Discover official faculty source
      ↓
HTML/PDF parser
      ↓
Normalize faculty details
      ↓
Resolve official profile/image source where available
      ↓
Download image
      ↓
Store image bytes + metadata in PostgreSQL
      ↓
Upsert faculty records
```

Recommended packages:

```text
axios
cheerio
pdf-parse
```

Add another parser only if the official source format requires it.

### Synchronization rules

1. Synchronization is **manual/admin-triggered only** initially.
2. Never scrape during a timetable request.
3. Respect the official website's usage policies and use a reasonable request rate.
4. Follow only official GRIET domains/URLs configured in the scraper.
5. Prefer staff ID as the identity key; fall back to normalized name + department.
6. Update changed official fields without creating duplicates.
7. Download and store official images in PostgreSQL.
8. Preserve source URLs and synchronization timestamps.
9. Do not delete the last known-good image because a temporary scrape failed.
10. Record created, updated, unchanged, failed, and skipped counts.
11. If synchronization fails, the application continues using the last successful dataset.

Admin endpoints:

```http
POST /api/admin/faculty/sync
GET  /api/admin/faculty/sync/status
```


---

# 5. Environment Configuration

Create:

```text
backend/.env
```

Example:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/timetable_db"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="adminpass"
JWT_SECRET="change-this-in-production"
JWT_EXPIRES_IN="8h"
PORT=5000
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
```

`.env.example`:

```env
DATABASE_URL=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=adminpass
JWT_SECRET=dev_jwt_secret
JWT_EXPIRES_IN=8h
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Never commit `.env`.

---

# 6. Phase 1 — Project Initialization

## Goal

Create the basic frontend/backend workspace and verify that all technologies work together.

## Tasks

### Backend

Initialize:

```bash
mkdir timetable-management
cd timetable-management

mkdir backend frontend

cd backend
npm init -y
```

Install:

```bash
npm install express cors dotenv jsonwebtoken bcrypt zod
npm install @prisma/client
npm install -D prisma nodemon
```

Initialize Prisma:

```bash
npx prisma init
```

### Frontend

Create React/Vite application:

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

Install:

```bash
npm install react-router-dom
```

Optional:

```bash
npm install lucide-react
```

### Success Criteria

- Backend starts.
- Frontend starts.
- React can call `/api/health`.
- PostgreSQL connection works.
- Environment variables load correctly.

---

# 7. Phase 2 — PostgreSQL and Prisma

## Goal

Create the complete database layer.

## Tasks

1. Configure PostgreSQL.
2. Create database `timetable_db`.
3. Write Prisma schema.
4. Create migrations.
5. Run migration.
6. Generate Prisma Client.
7. Create seed script.

Commands:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Later:

```bash
npx prisma migrate deploy
```

---

# 8. Phase 3 — Seed Data

## Goal

Make the application immediately usable after installation.

Seed:

### Class

```text
Y3 - AIML - B
```

### Faculty

Insert 12 faculty records.

Important:

- Use verified institutional/public profile information.
- Store only profile image URLs that are legally appropriate for application use.
- If official profile images are unavailable, use neutral placeholder images rather than fabricating institutional identities.

### Subjects

```text
CN
AI
DWDM
FLAT
IIOT
DWDM LAB
AI LAB
RP LAB
T&P
LUNCH
```

### Time Periods

Seed the 8 predefined periods.

Example:

```text
09:00 - 09:50
09:50 - 10:40
10:40 - 11:30
11:30 - 12:20
12:20 - 13:10
14:00 - 14:50
14:50 - 15:40
15:40 - 16:30
```

The exact times should be configurable rather than hard-coded throughout the application.

### CR

```text
username: cr1
password: crpass
class: Y3 - AIML - B
```

Hash the password before insertion.

---

# 9. Phase 4 — Backend Foundation

## Goal

Build a clean Express API.

Create:

```text
app.js
server.js
```

Middleware order:

```text
dotenv
   ↓
Express
   ↓
CORS
   ↓
JSON parser
   ↓
Session
   ↓
Routes
   ↓
404 handler
   ↓
Error handler
```

Create health endpoint:

```http
GET /api/health
```

Response:

```json
{
  "status": "ok"
}
```

---

# 10. Phase 5 — Public Timetable API

## Goal

Implement all public timetable functionality.

## Endpoints

### Get active classes

```http
GET /api/classes
```

Response:

```json
[
  {
    "id": 1,
    "year": 3,
    "branch": "AIML",
    "section": "B",
    "label": "Y3 - AIML - B"
  }
]
```

### Get timetable

```http
GET /api/timetable/:classId?date=YYYY-MM-DD
```

Behavior:

1. Validate class.
2. Determine requested date.
3. Determine weekday.
4. Fetch recurring slots for that weekday.
5. Fetch overrides for the class/date.
6. Apply override algorithm.
7. Return normalized timetable.

Example response:

```json
{
  "class": {
    "id": 1,
    "label": "Y3 - AIML - B"
  },
  "date": "2026-10-05",
  "day": 0,
  "slots": [
    {
      "startTime": "09:00",
      "endTime": "09:50",
      "subject": {
        "id": 1,
        "name": "CN"
      },
      "faculty": {
        "id": 1,
        "name": "Faculty Name",
        "designation": "Assistant Professor",
        "department": "CSE-AIML",
        "qualification": "M.Tech",
        "imageUrl": "/api/faculty/1/image"
      },
      "isOverride": false
    }
  ]
}
```

---

### Faculty image

```http
GET /api/faculty/:id/image
```

Stream the stored PostgreSQL binary image using its saved MIME type. Do not return image binary data inside normal timetable JSON.

# 11. Phase 6 — Override Engine

This is one of the most important pieces of business logic.

## 11.1 Basic Rule

An override applies when:

```text
override.start < slot.end
AND
override.end > slot.start
```

Equivalent:

```javascript
function overlaps(override, slot) {
  return (
    override.startTime < slot.endTime &&
    override.endTime > slot.startTime
  );
}
```

Do not compare time strings blindly unless they are guaranteed to be normalized HH:MM values. Prefer converting them to minutes from midnight.

Example:

```text
09:50 → 590 minutes
```

---

## 11.2 Partial Override

Example:

```text
Normal:
09:00 - 09:50 CN

Override:
09:30 - 11:00 AI
```

The override overlaps the normal slot.

The UI should indicate that the scheduled slot is overridden.

---

## 11.3 Full Override

Example:

```text
Normal:
10:00 - 11:00 CN

Override:
10:00 - 11:00 AI
```

Show the override completely.

---

## 11.4 Multiple Overrides

If multiple overrides overlap the same slot, define deterministic behavior.

Recommended rule:

```text
1. Exact matching override
2. Most recently created override
3. Otherwise reject conflicting override creation
```

For simplicity and predictability, the preferred implementation is to **reject overlapping overrides belonging to the same class/date** when they overlap each other.

This prevents ambiguous timetable results.

---

# 12. Phase 7 — JWT Authentication

## Goal

Use one JWT authentication system for CR and ADMIN accounts.

Login:

```http
POST /api/auth/login
```

Request:

```json
{
  "username": "cr1",
  "password": "crpass"
}
```

Process:

1. Find the account.
2. Compare password hash.
3. Generate a signed JWT.
4. Include minimal claims:
   - `sub` = user ID
   - `role` = `CR` or `ADMIN`
   - `classId` for CR users
5. Return the token and safe user information.

Example:

```json
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "user": {
      "id": 1,
      "username": "cr1",
      "role": "CR",
      "classId": 1
    }
  }
}
```

Environment:

```env
JWT_SECRET="strong-production-secret"
JWT_EXPIRES_IN="8h"
```

Preferred browser delivery:

- Prefer an `httpOnly`, `secure` cookie containing the JWT where deployment permits.
- If Bearer headers are used instead, avoid persistent localStorage unless there is a documented reason.
- Never expose `JWT_SECRET` to the frontend.

Auth endpoints:

```http
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

# 13. Phase 8 — Role-Based Authorization

Create:

```text
authenticateJWT
requireCR
requireAdmin
requireAdminOrCR
requireCRClassAccess
```

Rules:

- Missing/invalid JWT → 401.
- CR → only CR-authorized operations.
- ADMIN → all admin operations and full access to CR management/overrides.
- CR cannot manipulate another class.
- ADMIN is not class-scoped.
- For CR mutations, derive class scope from the authenticated account/database record, not a client-supplied class ID.
- Re-check sensitive authorization against current database state so a stale JWT cannot preserve an old class assignment.

# 14. Phase 9 — CR Dashboard

Create:

```text
/cr/login
/cr/dashboard
```

Dashboard should show:

```text
Welcome, CR

Assigned Class:
Y3 - AIML - B

[View Timetable]

Create Override

Date
Start Time
End Time
Subject
Faculty
[Create Override]

Upcoming Overrides
```

---

# 15. Phase 10 — Override API

## Create

```http
POST /api/cr/overrides
```

Request:

```json
{
  "date": "2026-10-06",
  "startTime": "10:00",
  "endTime": "11:30",
  "subjectId": 2,
  "facultyId": 4
}
```

Backend must:

1. Authenticate CR.
2. Determine class from session.
3. Validate input.
4. Confirm subject if supplied.
5. Confirm faculty if supplied.
6. Confirm the date.
7. Confirm start < end.
8. Confirm at least one scheduled slot is overlapped.
9. Check conflicting overrides.
10. Insert override.
11. Return created record.

---

## List upcoming overrides

```http
GET /api/cr/overrides?days=7
```

Return overrides:

```text
today → today + 7 days
```

Sort:

```text
date ASC
startTime ASC
```

---

# 16. Phase 11 — Admin Authentication

Admins use the same JWT authentication system with `role = ADMIN`.

Initial bootstrap credentials:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=adminpass
JWT_SECRET=change-this-in-production
JWT_EXPIRES_IN=8h
```

Use a secure bootstrap process in production and rotate credentials as required.

Login:

```http
POST /api/auth/login
```

All `/api/admin/*` routes require `requireAdmin`.

**Admin access:** Administrators have full access to CR management, CR assignments, all classes, and all CR overrides.

# 17. Phase 12 — Admin CR Management

Administrators must have full access to CR management.

Endpoints:

```http
GET    /api/admin/crs
POST   /api/admin/crs
PUT    /api/admin/crs/:id
DELETE /api/admin/crs/:id
PUT    /api/admin/crs/:id/class
```

Admin capabilities:

- View every CR.
- Create CR accounts.
- Reset/change CR passwords.
- Activate/deactivate CR accounts.
- Assign/reassign a CR to a class.
- Remove a CR assignment.
- View all CR overrides.
- Edit/delete overrides when an administrative correction is required.
- Access any class timetable.

Add a dedicated **CR Management** section to the Admin Dashboard.

# 18. Phase 13 — Admin Faculty Management

## Endpoints

```http
GET    /api/admin/faculty
GET    /api/admin/faculty/:id
POST   /api/admin/faculty
PUT    /api/admin/faculty/:id
DELETE /api/admin/faculty/:id
POST   /api/admin/faculty/sync
GET    /api/admin/faculty/sync/status
GET    /api/faculty/:id/image
```

The admin faculty screen supports:

1. Reviewing/editing locally stored faculty data.
2. Manually starting synchronization from the official GRIET website.
3. Reviewing sync results.
4. Uploading an official image manually when a scraper cannot resolve one.

UI:

```text
Faculty Management

[Sync Faculty From Official GRIET Website]

Last Sync: ...
Created: ... | Updated: ... | Unchanged: ... | Failed: ...

Name | Department | Designation | Image | Source | Actions
```

Images uploaded or scraped into the system use the same PostgreSQL binary storage model.

Before deleting faculty, check timetable references. Prefer deactivation/soft deletion for referenced records.


# 19. Phase 14 — Admin Subject Management

Endpoints:

```http
GET    /api/admin/subjects
POST   /api/admin/subjects
PUT    /api/admin/subjects/:id
DELETE /api/admin/subjects/:id
```

UI:

```text
Subject Name
[Add Subject]

Existing Subjects
```

Validate duplicate names where appropriate.

---

# 20. Phase 15 — Admin Class Management

Endpoints:

```http
GET    /api/admin/classes
POST   /api/admin/classes
PUT    /api/admin/classes/:id
DELETE /api/admin/classes/:id
```

Create:

```json
{
  "year": 3,
  "branch": "AIML",
  "section": "B"
}
```

Display:

```text
Y3 - AIML - B
```

Recommended uniqueness:

```text
year + branch + section
```

---

# 21. Phase 16 — Admin Timetable Slot Management

Endpoints:

```http
GET    /api/admin/slots
POST   /api/admin/slots
PUT    /api/admin/slots/:id
DELETE /api/admin/slots/:id
```

Create:

```json
{
  "classId": 1,
  "day": 0,
  "startTime": "09:00",
  "endTime": "09:50",
  "subjectId": 1,
  "facultyId": 2
}
```

Validation:

- Valid class.
- Valid day.
- Valid time.
- Start < end.
- Valid subject.
- Valid faculty.
- Detect overlapping slots for same class/day.

---

# 22. Phase 17 — Frontend Foundation

Configure React Router:

```text
/
 /timetable/:classId
 /cr/login
 /cr/dashboard
 /admin/login
 /admin/dashboard
```

Global layout:

```text
Navbar
Main Content
Footer
```

Navbar:

```text
Timetable

Classes
CR Login
Admin Login
```

---

# 23. Phase 18 — Public Homepage

Homepage requirements:

```text
Timetable Management System

Select Class
[ Y3 - AIML - B ▼ ]

[View Timetable]
```

The class list should come from the backend.

No class names should be hard-coded into React.

---

# 24. Phase 19 — Timetable UI

## Desktop

Use a responsive grid/timetable built entirely with Tailwind CSS.

```text
┌────────────┬──────────┬──────────┬──────────┬──────────┐
│ Day / Time │ 09:00    │ 09:50    │ 10:40    │ 11:30    │
├────────────┼──────────┼──────────┼──────────┼──────────┤
│ Monday     │ CN       │ AI       │ DWDM     │ FLAT     │
├────────────┼──────────┼──────────┼──────────┼──────────┤
│ Tuesday    │ AI       │ CN       │ LAB      │ ...      │
└────────────┴──────────┴──────────┴──────────┴──────────┘
```

Each timetable cell should show compact information:

```text
Subject
Faculty name
Small faculty avatar
Override badge when applicable
```

### Required cell interaction — faculty details popup

When a user **clicks a timetable cell**, open a **popover/dialog-style faculty details popup** associated with that cell.

Display, when officially available:

```text
[Faculty Image]

Faculty Name
Designation
Department
Qualification
Staff ID
Other verified official details
```

Also show contextual timetable information:

```text
Subject
Day
Start Time – End Time
Override status
```

Behavior:

- Popup opens without leaving the timetable page.
- Clicking outside closes it.
- `Esc` closes it.
- It is keyboard accessible.
- Focus moves into the popup and returns to the triggering cell when closed.
- On mobile, use a bottom-sheet/dialog variant if an anchored popover would overflow the viewport.
- Use Tailwind CSS for the complete popup styling.


# 25. Phase 20 — Responsive Timetable

Breakpoints:

### Desktop

```text
> 900px
```

Day column:

```text
200px
```

Faculty image:

```text
100x100px
```

### Tablet

```text
600px - 900px
```

Day column:

```text
120px
```

### Mobile

```text
< 600px
```

Day column:

```text
100px
```

Faculty image:

```text
28x28px
```

Use horizontal scrolling where required rather than compressing timetable cells until they become unreadable.

---

# 26. Phase 21 — Date Selection

Timetable page:

```text
Class: Y3 - AIML - B

Date:
[ 2026-10-05 ]

Monday
```

Behavior:

- Default date = current date.
- Changing date triggers API request.
- Display selected date.
- Automatically use the correct weekday.
- Show overrides for that date.
- Disable or hide Sunday if timetable is Monday–Saturday only, unless future requirements introduce Sunday schedules.

---

# 27. Phase 22 — Timetable Cell Rendering

Rules:

### Subject missing

```text
---
```

### Faculty missing

```text
TBA
```

### Faculty image missing

Use a generated initials/avatar placeholder.

### Override

Show:

```text
OVERRIDE
```

Use a visually distinct but accessible badge.

Do not rely solely on color to communicate overrides.

---

# 28. Phase 23 — CR UI

Create:

```text
CRLogin.jsx
CRDashboard.jsx
OverrideForm.jsx
OverrideList.jsx
```

Override form:

```text
Date
Start Time
End Time
Subject
Faculty

[Create Override]
```

Subject and faculty:

```text
Optional
```

The frontend should show validation errors before submitting, but backend validation remains authoritative.

---

# 29. Phase 24 — Admin Dashboard

Use tabs/cards:

```text
Admin Dashboard

┌───────────────┐
│ Faculty       │
└───────────────┘

┌───────────────┐
│ Subjects      │
└───────────────┘

┌───────────────┐
│ Classes       │
└───────────────┘

┌───────────────┐
│ Timetable     │
└───────────────┘
```

Each management area should support:

- List
- Create
- Edit
- Delete where safe
- Validation
- Success/error messages

---

# 30. Phase 25 — API Error Handling

Standardize API responses.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Validation error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid start time",
    "fields": {
      "startTime": "Start time must be before end time"
    }
  }
}
```

Unauthorized:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

Forbidden:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this class"
  }
}
```

---

# 31. Phase 26 — Security

Implement:

- Password hashing with bcrypt or Argon2.
- JWT authentication with secure HTTP-only cookies where cookie delivery is used.
- Secure cookies in production.
- Strong production session secret.
- CORS restricted to frontend origin.
- Input validation with Zod.
- SQL injection protection through Prisma.
- Authorization checks on every protected route.
- Rate limiting for authentication endpoints.
- Do not expose password hashes.
- Do not expose `ADMIN_PASSWORD`.
- Do not trust class IDs supplied by CR clients.
- Validate URLs before storing faculty image URLs.
- Sanitize/escape displayed user-controlled values.

---

# 32. Phase 27 — Testing

## Backend Unit Tests

Test:

### Time conversion

```text
09:00 → 540
10:30 → 630
```

### Time validation

```text
09:00 < 10:00 → valid
10:00 < 09:00 → invalid
```

### Override overlap

```text
09:00-09:50
09:20-10:00
→ overlap
```

```text
09:00-09:50
09:50-10:40
→ no overlap
```

### Date → weekday

Verify Monday–Saturday mapping.

---

# 33. Phase 28 — API Integration Tests

Test:

```text
GET /api/classes
GET /api/timetable/:classId
POST /api/auth/cr/login
GET /api/cr/me
POST /api/cr/overrides
GET /api/cr/overrides
POST /api/auth/admin/login
GET /api/admin/faculty
POST /api/admin/faculty
GET /api/admin/subjects
POST /api/admin/subjects
GET /api/admin/classes
POST /api/admin/classes
GET /api/admin/slots
POST /api/admin/slots
```

Test unauthorized access to every protected endpoint.

---

# 34. Phase 29 — Frontend Testing

Verify:

- Homepage loads.
- Classes load dynamically.
- Timetable loads.
- Date changes work.
- Faculty images display.
- Missing faculty displays TBA.
- Overrides display correctly.
- CR login works.
- CR dashboard loads.
- CR cannot access another class.
- Override form works.
- Admin login works.
- Admin CRUD works.
- Logout works.
- Validation messages display.
- Mobile layout works.

---

# 35. Phase 30 — Responsive Testing

Test at:

```text
1920 × 1080
1440 × 900
1280 × 720
1024 × 768
768 × 1024
600 × 800
430 × 932
390 × 844
```

Check:

- Horizontal overflow.
- Timetable readability.
- Navbar.
- Dropdowns.
- Forms.
- Buttons.
- Faculty images.
- Date picker.
- CR dashboard.
- Admin dashboard.

---

# 36. Phase 31 — Direct Deployment Configuration

## Goal

Deploy without Docker or containerization.

Development prerequisites:

```text
Node.js
PostgreSQL
npm
```

Production:

```text
Internet
   │
   ▼
Nginx
   │
   ├── /        → React static files
   │
   └── /api     → Express
                     │
                     ▼
                 PostgreSQL
```

Use PM2 or systemd for the Node.js backend.

No `Dockerfile`, `docker-compose.yml`, Docker volume, or container-specific command belongs in this project.



# 37. Phase 32 — Production Configuration

Recommended production architecture:

```text
Internet
   │
   ▼
Nginx
   │
   ├── /        → React static files
   │
   └── /api     → Express
                     │
                     ▼
                 PostgreSQL
```

Enable:

- HTTPS.
- Secure HTTP-only JWT cookies if cookie delivery is used.
- Strong production JWT secret.
- Restricted CORS.
- Restricted CORS.
- PostgreSQL backups.
- Process manager such as PM2 or systemd.
- Log rotation.
- Error monitoring.

---

# 38. Phase 33 — Database Backup Strategy

At minimum:

```bash
pg_dump timetable_db > timetable_backup.sql
```

Restore:

```bash
psql timetable_db < timetable_backup.sql
```

For production:

- Automated daily backup.
- Retention policy.
- Periodic restore testing.

---

# 39. Phase 34 — Logging and Monitoring

Backend logs should include:

```text
timestamp
HTTP method
endpoint
status
response duration
user role where appropriate
```

Never log:

```text
passwords
session secrets
password hashes
```

Log important events:

```text
CR login success/failure
Admin login success/failure
Override created
Faculty created
Subject created
Class created
Timetable slot created
```

---

# 40. Phase 35 — Data Integrity Rules

Enforce these rules server-side:

### Class

```text
year > 0
branch non-empty
section non-empty
```

### Slot

```text
start < end
day ∈ [0,5]
```

### Override

```text
start < end
date valid
overlaps at least one timetable slot
```

### Faculty

```text
name required
```

### Subject

```text
name required
```

---

# 41. Phase 36 — UX Improvements

After the core application works, add:

- Loading indicators.
- Empty states.
- Confirmation dialogs.
- Toast notifications.
- Skeleton loading for timetable.
- Retry button for failed API calls.
- Faculty image fallback.
- Mobile-friendly navigation.
- Sticky timetable headers where useful.
- Current-day highlighting.
- Current-time indicator as an optional enhancement.

---

# 42. Phase 37 — Optional Future Features

Do not implement these until the core version is stable.

Potential extensions:

```text
Faculty availability
Room management
Room allocation
Multiple departments
Multiple administrators
CR management
Bulk timetable import
Excel/CSV timetable import
Export timetable as PDF
Export timetable as image
Faculty timetable view
Student personal timetable
Announcements
Holiday calendar
Academic calendar
Attendance integration
Google Calendar integration
Push notifications
Email notifications
WhatsApp notifications
Audit logs
Role-based permissions
Soft deletion
Timetable conflict visualization
```

---

# 42. Recommended API Map

## Public

```text
GET /api/health

GET /api/classes

GET /api/timetable/:classId
```

## Authentication

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## CR

```text
GET  /api/cr/dashboard
GET  /api/cr/overrides
POST /api/cr/overrides
DELETE /api/cr/overrides/:id
```

## Admin — Faculty

```text
GET    /api/admin/faculty
POST   /api/admin/faculty
PUT    /api/admin/faculty/:id
DELETE /api/admin/faculty/:id
```

## Admin — Subjects

```text
GET    /api/admin/subjects
POST   /api/admin/subjects
PUT    /api/admin/subjects/:id
DELETE /api/admin/subjects/:id
```

## Admin — Classes

```text
GET    /api/admin/classes
POST   /api/admin/classes
PUT    /api/admin/classes/:id
DELETE /api/admin/classes/:id
```

## Admin — Slots

```text
GET    /api/admin/slots
POST   /api/admin/slots
PUT    /api/admin/slots/:id
DELETE /api/admin/slots/:id
```

---

# 43. Development Order

The project should be implemented in this exact order:

```text
Phase 1
Project setup
        ↓
Phase 2
Database + Prisma
        ↓
Phase 3
Seed data
        ↓
Phase 4
Express foundation
        ↓
Phase 5
Public timetable API
        ↓
Phase 6
Override engine
        ↓
Phase 7
CR authentication
        ↓
Phase 8
CR authorization
        ↓
Phase 9
CR dashboard
        ↓
Phase 10
Override API
        ↓
Phase 11
Admin authentication
        ↓
Phase 12–15
Admin CRUD
        ↓
Phase 16–21
React public UI
        ↓
Phase 22–23
CR/Admin UI
        ↓
Phase 24–25
Errors + security
        ↓
Phase 26–28
Testing
        ↓
Phase 29
Responsive QA
        ↓
Phase 30–32
Deployment + backups
        ↓
Phase 33–35
Monitoring + UX polish
        ↓
Phase 36
Optional extensions
```

---

# 44. Definition of Done

The project is considered complete when all of the following work.

## Public

- [ ] Homepage loads.
- [ ] Active classes load from database.
- [ ] User can select a class.
- [ ] User can select a date.
- [ ] Timetable loads for selected date.
- [ ] Monday–Saturday work.
- [ ] Subject names display.
- [ ] Faculty names display.
- [ ] Faculty images display.
- [ ] Missing faculty displays TBA.
- [ ] Missing subject displays `---`.
- [ ] Override badge displays.
- [ ] Override timetable data replaces normal schedule appropriately.
- [ ] Mobile layout works.

## CR

- [ ] CR login works.
- [ ] Password is hashed.
- [ ] JWT is issued and validated.
- [ ] CR sees assigned class.
- [ ] CR cannot access another class.
- [ ] CR can create overrides.
- [ ] Invalid overrides are rejected.
- [ ] Non-overlapping overrides are rejected.
- [ ] Conflicting overrides are handled deterministically.
- [ ] Upcoming overrides display.
- [ ] CR can view timetable.
- [ ] CR logout works.

## Admin

- [ ] Admin login works.
- [ ] Admin bootstrap credentials are stored/configured securely.
- [ ] Unauthenticated users cannot access admin APIs.
- [ ] Faculty CRUD works.
- [ ] Subject CRUD works.
- [ ] Class CRUD works.
- [ ] Slot CRUD works.
- [ ] Slot conflicts are validated.
- [ ] Admin logout works.

## Faculty Synchronization

- [ ] Official GRIET source URL is configured.
- [ ] Official faculty PDF/HTML source can be parsed.
- [ ] Faculty details are normalized.
- [ ] Official images are downloaded where available.
- [ ] Images are stored in PostgreSQL.
- [ ] Admin-triggered synchronization works.
- [ ] Failed synchronization preserves the last good dataset.
- [ ] Sync results are visible to administrators.

## Database

- [ ] PostgreSQL works.
- [ ] Prisma migrations work.
- [ ] Seed script works.
- [ ] Initial class exists.
- [ ] 12 faculty records exist.
- [ ] 10 subjects exist.
- [ ] 8 periods are seeded.
- [ ] Weekly timetable exists.
- [ ] CR account exists.
- [ ] Database backup/restore works.

## Security

- [ ] Passwords are hashed.
- [ ] Secrets are environment variables.
- [ ] Protected routes enforce authentication.
- [ ] CR class authorization is enforced server-side.
- [ ] Admin authorization is enforced server-side.
- [ ] Input validation exists.
- [ ] CORS is restricted in production.
- [ ] Production cookies are secure.
- [ ] Authentication endpoints have rate limiting.

## Deployment

- [ ] Production build succeeds.
- [ ] Backend starts from production command.
- [ ] Frontend serves correctly.
- [ ] PostgreSQL persists data.
- [ ] HTTPS is configured.
- [ ] Database backups are configured.
- [ ] Logs are available.
- [ ] Application can be restarted without losing data.

---

# 45. Suggested Milestone Schedule

## Milestone 1 — Foundation

Deliver:

```text
React + Express + PostgreSQL + Prisma
```

Status target:

```text
Application starts
Database connects
Migration works
Seed works
```

---

## Milestone 2 — Public Timetable

Deliver:

```text
Class selection
Date selection
Timetable API
Responsive timetable
Faculty images
```

---

## Milestone 3 — CR System

Deliver:

```text
CR login
CR session
CR dashboard
Override creation
Override display
```

---

## Milestone 4 — Admin System

Deliver:

```text
Admin login
Faculty management
Subject management
Class management
Slot management
```

---

## Milestone 5 — Production Hardening

Deliver:

```text
Validation
Security
Error handling
Testing
Responsive QA
```

---

## Milestone 6 — Deployment

Deliver:

```text
Production PostgreSQL
Nginx
HTTPS
Backups
Monitoring
```

---

# 46. Final Recommended Technology Stack

```text
Frontend
├── React
├── Vite
├── React Router
├── Tailwind CSS
└── CSS

Backend
├── Node.js
├── Express
├── Prisma
├── Zod
├── jsonwebtoken
└── bcrypt / Argon2

Database
└── PostgreSQL 16+

Development
├── Git
├── Node.js
├── PostgreSQL
└── npm

Optional
└── Redis — only if a concrete requirement justifies caching/background jobs/rate limiting

Production
├── Nginx
├── Node.js
├── PostgreSQL
├── PM2/systemd
└── HTTPS
```

---

# 47. Implementation Principle

Build the application incrementally.

Do **not** start by building every UI page.

The recommended development loop is:

```text
Database
   ↓
Backend API
   ↓
Test API
   ↓
Frontend
   ↓
Integrate
   ↓
Test
   ↓
Polish
```

The most important business rule is the timetable/override engine. Implement and test that independently before building complex dashboard functionality.

The final system should have a clean separation between:

```text
Presentation
    ↓
API
    ↓
Business Logic
    ↓
Data Access
    ↓
Database
```

This structure will make the application easier to extend later with rooms, faculty schedules, attendance, notifications, calendar integration, imports, and additional institutional roles.
