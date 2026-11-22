# Column Usage Matrix (`docs/COLUMN_USAGE_MATRIX.md`)

> **Generated:** Phase 0 Discovery  
> **Status:** Executed & Verified in Phase 8 (`migration 20261122_phase8_cleanup`)  
> **Pre-Drop Backups:** `backups/timetable_backup_20261122_222555.dump`, `backups/timetable_backup_20261122_222604.sql`  
> **Verified Result:** 0 obsolete columns remain in PostgreSQL database; all 120 tests pass.

---

## 1. Summary of Recommendations

| Table | Total Columns | KEEP | MERGE / RENAME | DROP (Candidate) |
|---|---|---|---|---|
| `Faculty` | 17 | 15 | 0 | 2 (`phone`, `sourceUpdatedAt`) |
| `Subject` | 6 | 5 | 1 (`shortform` into `code`) | 0 |
| `ClassRoom` | 10 | 10 | 0 | 0 |
| `TimetableSlot` | 10 | 9 | 1 (`periods` derived dynamically) | 0 |
| `TimetableOverride` | 10 | 10 | 0 | 0 |
| `User` | 8 | 8 | 0 | 0 |
| `FacultySyncRun` | 11 | 11 | 0 | 0 |
| `TimetableLog` | 10 | 10 | 0 | 0 |

---

## 2. Model-by-Model Analysis

### 2.1 Model: `Faculty`

| Column | Type | DB Rows | DB % NULL | Distinct | Code Reads | Code Writes | API Exposed | Frontend | Validators | Tests | Recommendation | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `id` | Int | 54 | 0.0% | 54 | Yes | Auto | Yes | Yes | No | Yes | **KEEP** | Primary key. |
| `name` | String | 54 | 0.0% | 54 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Core display attribute. |
| `staffId` | String? | 54 | 0.0% | 54 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Natural key; required in Phase 1. |
| `department` | String? | 54 | 0.0% | 4 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Core categorization attribute. |
| `designation` | String? | 54 | 0.0% | 6 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Profile attribute. |
| `qualification`| String? | 54 | 68.5% | 7 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Scraped academic qualification. |
| `email` | String? | 54 | 81.5% | 11 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Contact information. |
| `phone` | String? | 54 | **100.0%**| 1 | No | No | No | Minimal | Yes | No | **DROP** | 100% NULL; phone numbers are not published on official college directory. |
| `imageData` | Bytes? | 54 | 100.0% | 1 | Yes | Yes | Binary | No | No | No | **KEEP** | Core requirement for Postgres image storage. |
| `imageMimeType`| String? | 54 | 100.0% | 1 | Yes | Yes | Yes | No | No | No | **KEEP** | Required companion for binary `imageData`. |
| `imageSourceUrl`| String? | 54 | 72.2% | 16 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Source traceability & fallback image display. |
| `profileSourceUrl`| String? | 54 | 81.5% | 11 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Official profile link. |
| `sourceUpdatedAt`| DateTime?| 54 | **100.0%**| 1 | No | No | No | No | No | No | **DROP** | 100% NULL; redundant with `lastScrapedAt`. |
| `lastScrapedAt`| DateTime?| 54 | 57.4% | 24 | Yes | Yes | Yes | No | No | No | **KEEP** | Sync timestamp. |
| `imageHash` | String? | 54 | 100.0% | 1 | Yes | Yes | No | No | No | No | **KEEP** | Required for image caching & diff check. |
| `createdAt` | DateTime | 54 | 0.0% | 54 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |
| `updatedAt` | DateTime | 54 | 0.0% | 29 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |

---

### 2.2 Model: `Subject`

| Column | Type | DB Rows | DB % NULL | Distinct | Code Reads | Code Writes | API Exposed | Frontend | Validators | Tests | Recommendation | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `id` | Int | 80 | 0.0% | 80 | Yes | Auto | Yes | Yes | No | Yes | **KEEP** | Primary key. |
| `code` | String? | 80 | 28.7% | 50 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Natural key to be enforced `@unique`. |
| `shortform` | String? | 80 | 7.5% | 75 | Yes | Yes | Yes | No | Yes | Yes | **MERGE** | Redundant with `code`; backfill into `code`. |
| `name` | String | 80 | 0.0% | 80 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Display title (non-unique). |
| `createdAt` | DateTime | 80 | 0.0% | 73 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |
| `updatedAt` | DateTime | 80 | 0.0% | 76 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |

---

### 2.3 Model: `ClassRoom`

| Column | Type | DB Rows | DB % NULL | Distinct | Code Reads | Code Writes | API Exposed | Frontend | Validators | Tests | Recommendation | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `id` | Int | 15 | 0.0% | 15 | Yes | Auto | Yes | Yes | No | Yes | **KEEP** | Primary key. |
| `year` | Int | 15 | 0.0% | 3 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Year (1-4). Part of unique key. |
| `branch` | String | 15 | 0.0% | 3 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Department branch. Part of unique key. |
| `section` | String | 15 | 0.0% | 5 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Section (A-D). Part of unique key. |
| `academicYear`| String?| 15 | 0.0% | 1 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Confirmed 4th element of unique key (`'2026-27'`). |
| `semester` | String? | 15 | 0.0% | 3 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Academic semester description. |
| `effectiveFrom`| String?| 15 | 0.0% | 3 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Semester commencement date. |
| `metadata` | Json? | 15 | 0.0% | 15 | Yes | Yes | Yes | Yes | No | Yes | **KEEP** | Stores working hours, rooms, and lab venues. |
| `createdAt` | DateTime | 15 | 0.0% | 15 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |
| `updatedAt` | DateTime | 15 | 0.0% | 15 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |

---

### 2.4 Model: `TimetableSlot`

| Column | Type | DB Rows | DB % NULL | Distinct | Code Reads | Code Writes | API Exposed | Frontend | Validators | Tests | Recommendation | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `id` | Int | 382 | 0.0% | 382 | Yes | Auto | Yes | Yes | No | Yes | **KEEP** | Primary key. |
| `classId` | Int | 382 | 0.0% | 15 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | FK to ClassRoom. |
| `day` | Int | 382 | 0.0% | 6 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Day index (0-5). |
| `startTime` | String | 382 | 0.0% | 19 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Strict 24-hr `HH:MM`. |
| `endTime` | String | 382 | 0.0% | 20 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Strict 24-hr `HH:MM`. |
| `periods` | String? | 382 | 15.7% | 22 | Yes | Yes | Yes | Yes | Yes | Yes | **DERIVE** | In Phase 5, periods are dynamically mapped from the `Period` table. |
| `subjectId` | Int? | 382 | 0.0% | 59 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | FK to Subject. |
| `facultyId` | Int? | 382 | 40.1% | 49 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | FK to Faculty (Batch A / primary). |
| `createdAt` | DateTime | 382 | 0.0% | 382 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |
| `updatedAt` | DateTime | 382 | 0.0% | 382 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |

---

### 2.5 Model: `TimetableOverride`

| Column | Type | DB Rows | DB % NULL | Distinct | Code Reads | Code Writes | API Exposed | Frontend | Validators | Tests | Recommendation | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `id` | Int | 1 | 0.0% | 1 | Yes | Auto | Yes | Yes | No | Yes | **KEEP** | Primary key. |
| `classId` | Int | 1 | 0.0% | 1 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | FK to ClassRoom. |
| `date` | DateTime | 1 | 0.0% | 1 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Specific date for override. |
| `startTime` | String | 1 | 0.0% | 1 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Strict 24-hr `HH:MM`. |
| `endTime` | String | 1 | 0.0% | 1 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Strict 24-hr `HH:MM`. |
| `subjectId` | Int? | 1 | 0.0% | 1 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | FK to Subject. |
| `facultyId` | Int? | 1 | 0.0% | 1 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | FK to Faculty. |
| `createdAt` | DateTime | 1 | 0.0% | 1 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |
| `updatedAt` | DateTime | 1 | 0.0% | 1 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |

---

### 2.6 Model: `User`

| Column | Type | DB Rows | DB % NULL | Distinct | Code Reads | Code Writes | API Exposed | Frontend | Validators | Tests | Recommendation | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `id` | Int | 2 | 0.0% | 2 | Yes | Auto | Yes | Yes | No | Yes | **KEEP** | Primary key. |
| `username` | String | 2 | 0.0% | 2 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Login credential. |
| `passwordHash`| String | 2 | 0.0% | 2 | Yes | Yes | No | No | Yes | Yes | **KEEP** | Auth security. |
| `role` | UserRole | 2 | 0.0% | 2 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | RBAC (`ADMIN`, `CR`). |
| `isActive` | Boolean | 2 | 0.0% | 1 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | Account state. |
| `classId` | Int? | 2 | 50.0% | 2 | Yes | Yes | Yes | Yes | Yes | Yes | **KEEP** | CR scope binding. |
| `createdAt` | DateTime | 2 | 0.0% | 2 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |
| `updatedAt` | DateTime | 2 | 0.0% | 2 | Yes | Auto | Yes | No | No | Yes | **KEEP** | Audit metadata. |

---

### 2.7 Model: `FacultySyncRun` & `TimetableLog`
* Both models are append-only audit logs. All columns (`status`, `sourceUrl`, `created`, `updated`, `unchanged`, `failed`, `skipped`, `error`, `startedAt`, `finishedAt`, `action`, `performedBy`, `details`, etc.) are actively written and exposed in admin audit interfaces.
* **Recommendation:** **KEEP ALL** columns.
