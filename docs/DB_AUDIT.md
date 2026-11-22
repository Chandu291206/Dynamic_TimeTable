# Database Schema Audit (`docs/DB_AUDIT.md`)

> **Generated:** Phase 0 Discovery  
> **Source Schema:** `backend/prisma/schema.prisma`  
> **Target Database:** PostgreSQL 15+  
> **Verification Status:** Verified against active database and migrations.

---

## 1. Executive Summary & Model Overview

| Model | Table Name | Total Columns | Primary Key | Foreign Keys | Unique Constraints / Indexes |
|---|---|---|---|---|---|
| `Faculty` | `Faculty` | 17 | `id` (Int, Autoincrement) | None | `staffId` (Unique, Nullable) |
| `FacultySyncRun` | `FacultySyncRun` | 11 | `id` (Int, Autoincrement) | None | `startedAt` (Index) |
| `Subject` | `Subject` | 6 | `id` (Int, Autoincrement) | None | `name` (Unique, VarChar 120) |
| `ClassRoom` | `ClassRoom` | 10 | `id` (Int, Autoincrement) | None | `(year, branch, section)` (Unique) |
| `TimetableSlot` | `TimetableSlot` | 10 | `id` (Int, Autoincrement) | `classId`, `subjectId`, `facultyId` | `(classId, day)` (Index), `(classId, day, startTime, endTime)` (Unique) |
| `TimetableOverride` | `TimetableOverride` | 10 | `id` (Int, Autoincrement) | `classId`, `subjectId`, `facultyId` | `(classId, date)` (Index) |
| `User` | `User` | 8 | `id` (Int, Autoincrement) | `classId` | `username` (Unique), `(role, classId)` (Index) |
| `TimetableLog` | `TimetableLog` | 10 | `id` (Int, Autoincrement) | None | `timestamp(sort: Desc)` (Index) |

---

## 2. Detailed Model Specifications

### 2.1 `Faculty`
Stores official faculty profile details, contact information, and scraped portrait data.

| Column | Type | Nullable | Default | Constraints / Attributes |
|---|---|---|---|---|
| `id` | `Int` | No | `autoincrement()` | `@id` |
| `name` | `String` | No | None | Text |
| `staffId` | `String?` | **Yes** | None | `@unique` (Currently nullable!) |
| `department` | `String?` | Yes | None | Text |
| `designation` | `String?` | Yes | None | Text |
| `qualification` | `String?` | Yes | None | Text |
| `email` | `String?` | Yes | None | Text |
| `phone` | `String?` | Yes | None | Text (100% NULL in data) |
| `imageData` | `Bytes?` | Yes | None | Binary image payload |
| `imageMimeType` | `String?` | Yes | None | e.g. `image/jpeg` |
| `imageSourceUrl` | `String?` | Yes | None | URL of source image |
| `profileSourceUrl`| `String?` | Yes | None | URL of profile page |
| `sourceUpdatedAt` | `DateTime?`| Yes | None | Timestamp (100% NULL in data) |
| `lastScrapedAt` | `DateTime?`| Yes | None | Timestamp |
| `imageHash` | `String?` | Yes | None | Hash to prevent unnecessary rewrites |
| `createdAt` | `DateTime` | No | `now()` | Standard audit |
| `updatedAt` | `DateTime` | No | `@updatedAt` | Standard audit |

* **Relations:**
  * `timetableSlots`: `TimetableSlot[]` (1-to-many)
  * `overrides`: `TimetableOverride[]` (1-to-many)
* **Required Phase 1 Actions:**
  * Change `staffId` from `String?` to `String` (`NOT NULL` + `@unique`).
  * Add `isActive Boolean @default(true)`.
  * Support Batch B lab assignment relation (`TimetableSlot.batchBFaculty`).

---

### 2.2 `Subject`
Catalogue of academic subjects, labs, and session breaks.

| Column | Type | Nullable | Default | Constraints / Attributes |
|---|---|---|---|---|
| `id` | `Int` | No | `autoincrement()` | `@id` |
| `code` | `String?` | **Yes** | None | `@db.VarChar(50)` (Currently nullable, not unique) |
| `shortform` | `String?` | Yes | None | `@db.VarChar(50)` (Redundant with code) |
| `name` | `String` | No | None | `@unique @db.VarChar(120)` |
| `createdAt` | `DateTime` | No | `now()` | Standard audit |
| `updatedAt` | `DateTime` | No | `@updatedAt` | Standard audit |

* **Relations:**
  * `timetableSlots`: `TimetableSlot[]` (1-to-many)
  * `overrides`: `TimetableOverride[]` (1-to-many)
* **Required Phase 1 Actions:**
  * Backfill null codes using `coalesce(code, shortform, name)`.
  * Set `code` to `String @unique @db.VarChar(50)`.
  * Drop `@unique` from `name` (full title can repeat across codes).
  * Add `isBreak Boolean @default(false)` to identify breaks without hardcoded `"LUNCH"` strings.
  * Add `isActive Boolean @default(true)`.

---

### 2.3 `ClassRoom`
Classroom section definitions.

| Column | Type | Nullable | Default | Constraints / Attributes |
|---|---|---|---|---|
| `id` | `Int` | No | `autoincrement()` | `@id` |
| `year` | `Int` | No | None | Year (1-4) |
| `branch` | `String` | No | None | e.g. `DS`, `CSBS`, `AIML` |
| `section` | `String` | No | None | e.g. `A`, `B`, `C` |
| `academicYear` | `String?` | Yes | None | e.g. `'2026-27'` (All 15 classes populated) |
| `semester` | `String?` | Yes | None | e.g. `'II Year I Semester'` |
| `effectiveFrom` | `String?` | Yes | None | Effective start date string |
| `metadata` | `Json?` | Yes | None | Working hours, theory room, lab rooms |
| `createdAt` | `DateTime` | No | `now()` | Standard audit |
| `updatedAt` | `DateTime` | No | `@updatedAt` | Standard audit |

* **Constraints & Indexes:**
  * Current: `@@unique([year, branch, section])`
* **Relations:**
  * `slots`: `TimetableSlot[]` (Cascade on delete)
  * `overrides`: `TimetableOverride[]` (Cascade on delete)
  * `users`: `User[]` (SetNull on delete)
* **Required Phase 1 Actions:**
  * Change unique constraint to `@@unique([year, branch, section, academicYear])`.
  * Make `academicYear` `String` (`NOT NULL` default `'2026-27'`).

---

### 2.4 `TimetableSlot`
Master recurring weekly class schedule entries.

| Column | Type | Nullable | Default | Constraints / Attributes |
|---|---|---|---|---|
| `id` | `Int` | No | `autoincrement()` | `@id` |
| `classId` | `Int` | No | None | FK to `ClassRoom.id` (`onDelete: Cascade`) |
| `day` | `Int` | No | None | 0 (Monday) to 5 (Saturday) |
| `startTime` | `String` | No | None | `@db.Char(5)` strict HH:MM |
| `endTime` | `String` | No | None | `@db.Char(5)` strict HH:MM |
| `periods` | `String?` | Yes | None | Comma-separated period indices (e.g. `'1,2'`) |
| `subjectId` | `Int?` | Yes | None | FK to `Subject.id` (`onDelete: Restrict`) |
| `facultyId` | `Int?` | Yes | None | FK to `Faculty.id` (`onDelete: Restrict`) (Batch A / primary) |
| `createdAt` | `DateTime` | No | `now()` | Standard audit |
| `updatedAt` | `DateTime` | No | `@updatedAt` | Standard audit |

* **Constraints & Indexes:**
  * `@@index([classId, day])`
  * `@@unique([classId, day, startTime, endTime])`
* **Relations:**
  * `class`: `ClassRoom` (Cascade)
  * `subject`: `Subject` (Restrict)
  * `faculty`: `Faculty` (Restrict)
* **Required Phase 1 Actions:**
  * Add `batchBFacultyId Int?` mapped to `Faculty` (`onDelete: Restrict`) for lab Batch B support.
  * Update unique constraint to `@@unique([classId, day, startTime])`.
  * Add PostgreSQL check constraints: `day BETWEEN 0 AND 5`, time format regex, `startTime < endTime`.
  * Shift cascade behavior on class deletion to safe restricted handling if required.

---

### 2.5 `TimetableOverride`
Daily CR/admin overrides for specific calendar dates.

| Column | Type | Nullable | Default | Constraints / Attributes |
|---|---|---|---|---|
| `id` | `Int` | No | `autoincrement()` | `@id` |
| `classId` | `Int` | No | None | FK to `ClassRoom.id` (`onDelete: Cascade`) |
| `date` | `DateTime`| No | None | `@db.Date` calendar date |
| `startTime` | `String` | No | None | `@db.Char(5)` strict HH:MM |
| `endTime` | `String` | No | None | `@db.Char(5)` strict HH:MM |
| `subjectId` | `Int?` | Yes | None | FK to `Subject.id` (`onDelete: Restrict`) |
| `facultyId` | `Int?` | Yes | None | FK to `Faculty.id` (`onDelete: Restrict`) |
| `createdAt` | `DateTime` | No | `now()` | Standard audit |
| `updatedAt` | `DateTime` | No | `@updatedAt` | Standard audit |

* **Constraints & Indexes:**
  * `@@index([classId, date])`
* **Required Phase 1 Actions:**
  * Add `batchBFacultyId Int?` mapped to `Faculty` (`onDelete: Restrict`).
  * Add check constraints for date range and strict `HH:MM` time formats.

---

### 2.6 `User`
User authentication and role-based access.

| Column | Type | Nullable | Default | Constraints / Attributes |
|---|---|---|---|---|
| `id` | `Int` | No | `autoincrement()` | `@id` |
| `username` | `String` | No | None | `@unique` |
| `passwordHash` | `String` | No | None | bcrypt hash |
| `role` | `UserRole`| No | None | Enum (`ADMIN`, `CR`) |
| `isActive` | `Boolean` | No | `true` | Account active flag |
| `classId` | `Int?` | Yes | None | FK to `ClassRoom.id` (`onDelete: SetNull`) |
| `createdAt` | `DateTime` | No | `now()` | Standard audit |
| `updatedAt` | `DateTime` | No | `@updatedAt` | Standard audit |

* **Constraints & Indexes:**
  * `@@index([role, classId])`

---

### 2.7 `FacultySyncRun`
Audit log of automated faculty directory scraping and sync runs.

| Column | Type | Nullable | Default | Constraints / Attributes |
|---|---|---|---|---|
| `id` | `Int` | No | `autoincrement()` | `@id` |
| `status` | `String` | No | None | `RUNNING`, `COMPLETED`, `FAILED` |
| `sourceUrl` | `String` | No | None | Target official URL |
| `created` | `Int` | No | `0` | Count of inserted faculty |
| `updated` | `Int` | No | `0` | Count of updated faculty |
| `unchanged` | `Int` | No | `0` | Count of identical faculty |
| `failed` | `Int` | No | `0` | Count of errors |
| `skipped` | `Int` | No | `0` | Count of skipped entries |
| `error` | `String?` | Yes | None | Error message string |
| `startedAt` | `DateTime` | No | `now()` | `@default(now())` |
| `finishedAt` | `DateTime?`| Yes | None | Timestamp |

* **Constraints & Indexes:**
  * `@@index([startedAt])`

---

### 2.8 `TimetableLog`
Audit log recording administrative changes.

| Column | Type | Nullable | Default | Constraints / Attributes |
|---|---|---|---|---|
| `id` | `Int` | No | `autoincrement()` | `@id` |
| `action` | `String` | No | None | `@db.VarChar(100)` |
| `performedBy`| `String` | No | None | `@db.VarChar(100)` |
| `year` | `Int?` | Yes | None | Audit context |
| `branch` | `String?` | Yes | None | `@db.VarChar(50)` |
| `section` | `String?` | Yes | None | `@db.VarChar(50)` |
| `day` | `String?` | Yes | None | `@db.VarChar(50)` |
| `date` | `String?` | Yes | None | `@db.VarChar(50)` |
| `details` | `String?` | Yes | None | `@db.Text` |
| `timestamp` | `DateTime` | No | `now()` | `@default(now())` |

* **Constraints & Indexes:**
  * `@@index([timestamp(sort: Desc)])`

---

## 3. New Models Required in Phase 1 & Phase 5

### 3.1 `Period` (New Phase 1 Model)
```prisma
model Period {
  id           Int      @id @default(autoincrement())
  periodNumber Int?     // 1..7 for periods, null/0 for lunch
  name         String   @db.VarChar(50) // "Period 1", "Lunch Break"
  startTime    String   @db.Char(5)     // HH:MM
  endTime      String   @db.Char(5)     // HH:MM
  isBreak      Boolean  @default(false)
  order        Int      @default(0)     // Sort order
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([order])
}
```

### 3.2 `TimetableDraft` & `TimetableDraftSlot` (New Phase 5 Models)
```prisma
enum DraftStatus {
  OPEN
  PUBLISHED
  DISCARDED
}

model TimetableDraft {
  id          Int                  @id @default(autoincrement())
  classId     Int
  name        String?              @db.VarChar(100)
  version     Int                  @default(1)
  status      DraftStatus          @default(OPEN)
  createdById Int?
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  class       ClassRoom            @relation(fields: [classId], references: [id], onDelete: Restrict)
  slots       TimetableDraftSlot[]

  @@index([classId, status])
}

model TimetableDraftSlot {
  id              Int            @id @default(autoincrement())
  draftId         Int
  day             Int
  startTime       String         @db.Char(5)
  endTime         String         @db.Char(5)
  subjectId       Int
  facultyId       Int?
  batchBFacultyId Int?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  draft           TimetableDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  subject         Subject        @relation(fields: [subjectId], references: [id], onDelete: Restrict)
  faculty         Faculty?       @relation("DraftFacultyA", fields: [facultyId], references: [id], onDelete: Restrict)
  batchBFaculty   Faculty?       @relation("DraftFacultyB", fields: [batchBFacultyId], references: [id], onDelete: Restrict)

  @@unique([draftId, day, startTime])
}
```
