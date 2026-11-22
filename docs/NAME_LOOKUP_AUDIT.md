# Name-Based Lookup Audit (`docs/NAME_LOOKUP_AUDIT.md`)

> **Generated:** Phase 0 Discovery  
> **Scope:** `backend/src/`, `backend/scripts/`, `backend/prisma/`, `frontend/src/`  
> **Purpose:** Comprehensive inventory of every location in the codebase that resolves, compares, queries, or matches entities by name, label, or text string rather than internal `id` or unique natural keys (`staffId`, `code`).

---

## 1. Executive Summary

| Category | High-Risk Locations | Primary Risk | Phase 3 Resolution |
|---|---|---|---|
| **Scraper** | `faculty-web-scraper.service.js` (lines 485–498) | Merges or overwrites faculty sharing similar names | Match exclusively by normalized `staffId`; eliminate name-based fallback |
| **JSON/Excel Importer** | `timetable-json.service.js` (lines 125–147, 150–175) | Creates duplicate subjects/faculty; resolves via `findFirst({ where: { name } })` | Require `staffId` and subject `code` in import payload; resolve by unique natural keys |
| **Break Special-Casing** | Importer, `timetable.service.js`, `WeeklyTimetableGrid.jsx`, `TimetableCell.jsx` | Hardcoded comparisons against `'LUNCH'` string | Replace with `isBreak Boolean` on `Subject` and `Period` |
| **Admin CRUD** | `admin-subject.controller.js`, `SubjectManagement.jsx` | Subjects created and queried only by `name` | Make `code` mandatory in forms; API and UI select/update by `id` |
| **Display Labels** | `classLabel(classRoom)` in controllers and views | Display string used in logs or UI selection | Retain `classLabel` strictly for UI rendering; forms and APIs send `classId` |

---

## 2. Inventory by Subsystem

### 2.1 Faculty Scraper & Synchronization Engine

#### `backend/src/services/faculty-web-scraper.service.js`
* **Line 470–505 (`matchScrapedFaculty`)**:
  * **Code:**
    ```javascript
    // 2. Normalized name match
    if (!matched && dbNorm) {
      const sNorm = normalizeName(s.name);
      if (sNorm && sNorm === dbNorm) {
        matched = true;
      } else if (sNorm && dbNorm.length > 5 && (sNorm.includes(dbNorm) || dbNorm.includes(sNorm))) {
        matched = true;
      }
    }
    ```
  * **Violation:** Matches faculty by substring or normalized name if staff ID fails. Two faculty with the same name can be merged or have their photos/details overwritten.
  * **Fix:** Completely eliminate the name matching block. A scraped record matches a DB record if and only if `staffId === existing.staffId`. If staff ID is absent or unmatched, log as skipped.

---

### 2.2 Timetable JSON & Excel Importer

#### `backend/src/services/timetable-json.service.js`
* **Line 125–147 (`importTimetableJson` - Faculty Resolution)**:
  * **Code:**
    ```javascript
    if (!facultyRecord) {
      facultyRecord = await db.faculty.findFirst({
        where: { name: primaryFacultyName },
      });
    }
    ```
  * **Violation:** Resolves faculty by `findFirst` on name; if two teachers share a name, the first created row is always selected.
  * **Fix:** Require `staff_id` in course JSON; look up only via `findUnique({ where: { staffId } })`.

* **Line 150–175 (`importTimetableJson` - Subject Resolution)**:
  * **Code:**
    ```javascript
    const subjectRecord = await db.subject.upsert({
      where: { name: subjectName },
      update: { code: course.course_code, shortform: course.shortform },
      create: { name: subjectName, code: course.course_code, shortform: course.shortform },
    });
    ```
  * **Violation:** Upserts subject keyed on `name` instead of `code`.
  * **Fix:** Upsert subjects by unique `code: course.course_code.trim().toUpperCase()`.

* **Line 177–185 (`importTimetableJson` - LUNCH Break)**:
  * **Code:**
    ```javascript
    let lunchSubject = await db.subject.findUnique({ where: { name: 'LUNCH' } });
    if (!lunchSubject) {
      lunchSubject = await db.subject.create({
        data: { name: 'LUNCH', shortform: 'LUNCH' },
      });
    }
    ```
  * **Violation:** Matches break subject by name string `'LUNCH'`.
  * **Fix:** Use `findFirst({ where: { isBreak: true, code: 'LUNCH' } })` or seed standard break record.

* **Line 204–220 (`importTimetableJson` - Slot Subject Mapping)**:
  * **Code:** Uses `subjectMap.set(subjectName.toUpperCase(), ...)` and `db.subject.upsert({ where: { name: item.subject.trim() } })`.
  * **Fix:** Key `subjectMap` by subject `code` and use `id` for slot FK assignments.

* **Line 306 (`exportTimetableJson`)**:
  * **Code:** `if (!slot.subject || slot.subject.name.toUpperCase() === 'LUNCH') continue;`
  * **Fix:** `if (!slot.subject || slot.subject.isBreak) continue;`

#### `backend/src/utils/excelTimetableConverter.js`
* **Lines 181–183, 270–292**:
  * **Code:** Checks strings like `rawVal.toUpperCase().includes('LUNCH')` and sets `subject: 'LUNCH'`.
  * **Fix:** When converting Excel rows to timetable payload, map lunch/break periods using the canonical period structure (`isBreak: true`).

---

### 2.3 Seed Routine

#### `backend/prisma/seed.js`
* **Line 13**:
  * **Code:** `const { classRoom, importedSlotsCount } = await importTimetableJson(cse1Data, { db: prisma });`
  * **Status:** Because seed delegates to `importTimetableJson`, updating `importTimetableJson` to resolve by ID/staffId/code ensures `seed.js` becomes fully idempotent and ID-safe.

---

### 2.4 Backend Services & Controllers

#### `backend/src/controllers/admin-subject.controller.js`
* **Lines 8–47**:
  * **Code:** Normalizes `name` using `normalizeName(name)` and validates uniqueness against `name`.
  * **Fix:** Validate uniqueness on `code`. Allow duplicate `name` values if codes differ.

#### `backend/src/services/timetable.service.js`
* **Line 149 (`getWeeklyTimetable`)**:
  * **Code:** `if (!subj || !subj.name || subj.name.trim().toUpperCase() === 'LUNCH') return;`
  * **Fix:** `if (!subj || subj.isBreak) return;`
* **Lines 5–27 (`classLabel`)**:
  * **Code:** `classLabel(classRoom)` generates `Y3 - AIML - B`.
  * **Status:** Used only for display and audit log formatting. Verified that internal slot lookups use `classId`.

---

### 2.5 Frontend Components

#### `frontend/src/components/TimetableCell.jsx`
* **Line 4**:
  * **Code:** `const isLunch = slot.subject?.name?.trim().toUpperCase() === 'LUNCH'`
  * **Fix:** `const isLunch = slot.subject?.isBreak || slot.isBreak`

#### `frontend/src/components/WeeklyTimetableGrid.jsx`
* **Lines 68, 77, 86, 97, 161, 210**:
  * **Code:**
    * Hardcoded checks for `period === 'LUNCH'`.
    * Hardcoded period array `[{ startTime: '09:00', ... }, ...]`.
    * Subject filtering: `s.subject?.name?.trim().toUpperCase() !== 'LUNCH'`.
  * **Fix:**
    * Use dynamic periods fetched from `GET /api/periods`.
    * Check `period.isBreak` and `slot.subject?.isBreak`.

#### `frontend/src/admin/SubjectManagement.jsx`
* **Lines 7–65**:
  * **Code:** Form only contains a single `name` text input.
  * **Fix:** Add mandatory `code` field to the form (`CODE — Full name`), displaying both and submitting `code` and `name`.

#### `frontend/src/admin/SlotManagement.jsx`
* **Lines 35–42**:
  * **Code:** Form submits `subjectId` and `facultyId` (which is already ID-based).
  * **Status:** Verified that dropdown values bind to IDs. Disambiguate duplicate faculty names in the dropdown labels: `Name — Staff ID — Dept`.

---

## 3. Checklist for Phase 3 Implementation

- [ ] Remove name-based matching in `faculty-web-scraper.service.js`.
- [ ] Add strict ESLint / test rule: `findFirst` with `name` is banned in `backend/src/services/`.
- [ ] Update `timetable-json.service.js` to look up faculty by `staffId` and subjects by `code`.
- [ ] Update `SubjectManagement.jsx` to manage `code` alongside `name`.
- [ ] Replace all `'LUNCH'` string checks with `subject.isBreak` or `period.isBreak`.
- [ ] Update frontend `<select>` dropdowns to display `Name — Staff ID — Department` for faculty and `CODE — Name` for subjects.
