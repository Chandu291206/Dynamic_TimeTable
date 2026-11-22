# Implementation Plan v2 — ID-Based Identity, Clash-Free Timetable Designer, Database Cleanup

> **Audience:** Antigravity agent working inside the existing `Timetable/` repository.
> **Read first:** `README.md` and `Implementation_plan_updated_for_tt.md` (the original plan). Everything in them still applies unless this document explicitly changes it.
> **Stack constraints (unchanged):** React + Vite, Express, Prisma, PostgreSQL only. No Docker. Times stay strict 24-hour `HH:MM` strings. Follow the styling approach already used in the frontend.

---

## 0. Goals

| # | Goal | Summary |
|---|------|---------|
| G1 | Faculty identity in scraping | The scraper must identify faculty by **staff ID**, never by "first name match". Two faculty with the same name must stay two separate records. |
| G2 | ID-only references everywhere | Anything that has a unique id (faculty, subject, class, slot, CR user, period) is referenced **only by id** in the DB, API, importer, seed, and UI. Names are display-only. |
| G3 | Timetable Designer | A new admin page that clones the existing weekly grid layout and lets the admin assign subject + faculty to each cell by id, with **clash prevention**. |
| G4 | Database cleanup | Audit every table, remove unnecessary columns safely, and fix the schema so unique mapping is enforced by the database itself. |

---

## 1. Rules for the Agent (read before touching anything)

1. **I (the author) have not shown you the real `schema.prisma` or the scraper source in this brief. Do not assume column names from this document.** Phase 0 exists to discover the real state. Where this document names a field, verify it against the actual schema first.
2. **Work phase by phase.** After each phase: run the test suite, write a short report (what changed, what was found, what needs a decision), then continue. If a phase reveals a surprise (e.g. existing duplicate data), stop and report rather than improvising.
3. **Take a backup before any migration** (`npm run db:backup:sql`, and `npm run db:backup`). Rehearse every data migration on a **copy** of the database first.
4. **Destructive changes (dropping columns/tables) happen last (Phase 8)**, after all new features work, so nothing needed gets removed.
5. **Additive-then-destructive migrations:** add new columns/constraints → backfill → switch code → only then drop old ones. Never combine these in one migration.
6. **One source of truth per rule.** Clash logic lives in one service (`clash.service.js`) and is used by the designer, the existing slot CRUD, and the bulk importer. No endpoint may bypass it.
7. **Do not change public API response shapes** in a breaking way. Add fields; don't remove or rename them without updating every consumer in the same change.
8. Keep the existing conventions: Zod validators, controller → service → Prisma layering, centralized error handler, audit logging for admin actions.

---

## 2. Terminology (decisions already made)

- **`id`** = the internal primary key of each table. Keep the current type (integer autoincrement). Do **not** migrate to UUIDs.
- **`staffId`** = the official GRIET staff identifier from the staff-list source. This is the **natural key** used to match scraped rows to Faculty rows. Internally, everything still references `Faculty.id`.
- **"Clash"** = two assignments that cannot both be true. Defined precisely in §7.1.
- **Overlap** is always computed on minutes-from-midnight: `a.start < b.end && a.end > b.start`. Touching boundaries (09:50 end / 09:50 start) are **not** an overlap.

---

## 3. Phase 0 — Discovery and Safety Net (no code changes except scripts/reports)

**Tasks**

1. Create a git branch `feature/id-identity-designer`.
2. Take backups (SQL dump + JSON snapshot). Record row counts per table.
3. Read `backend/prisma/schema.prisma` fully and produce `docs/DB_AUDIT.md` containing, **for every model**: columns, types, nullability, defaults, unique constraints, indexes, FK relations with their `onDelete` behavior.
4. Produce `docs/NAME_LOOKUP_AUDIT.md`: grep the entire repo (`backend/src`, `backend/scripts`, `backend/prisma/seed.js`, `frontend/src`) for every place that **finds, matches, compares, or joins by name/label/text** instead of id. Search patterns to use at minimum: `findFirst` with `name`, `where: { name`, `.find(` with `.name`, `=== ...name`, `.includes(` on names, string-keyed maps, `label` comparisons, Excel/JSON importer lookups, scraper upserts, seed lookups, and any special-casing of the string `"LUNCH"` or other subject names.
5. Produce `docs/DUPLICATE_REPORT.md` by running read-only SQL against the DB:
   - Faculty with the same normalized name (lowercase, trimmed, collapsed whitespace, titles like Dr./Mr./Ms. stripped) — list their `id`, `staffId`, department, and how many slots/overrides reference each.
   - Faculty with `staffId IS NULL`.
   - Duplicate `staffId` values.
   - Subjects with the same normalized name (and same code if a code column exists).
   - Classes that would violate the uniqueness key chosen in Phase 1.
   - Slots with overlapping times within the same class/day.
   - **Faculty double-booked** across different classes at overlapping times (existing clashes in live data).
6. Produce `docs/COLUMN_USAGE_MATRIX.md` — the input for Phase 8 (see §9.1 for the method). Only gather evidence now; do not drop anything.

**Acceptance:** all four documents exist, are based on real schema/code (not guesses), and the existing test suite still passes unchanged.

---

## 4. Phase 1 — Schema: Identity and Uniqueness (additive only)

Goal: make the **database** reject ambiguous or duplicate mappings, not just the application.

### 4.1 Faculty

- `staffId` becomes **required and unique** (`@unique`, non-null) for all faculty.
  - Backfill for existing rows with `staffId IS NULL`: first try to match to the official source; if that is not possible, list them in `docs/DUPLICATE_REPORT.md` and **ask the admin (me) to supply values**. Do not fabricate IDs. A temporary migration state may allow null while backfilling; the final state must be NOT NULL.
  - Manually created faculty (admin UI) must supply a `staffId`; validate format and uniqueness in Zod and surface a clean 409 error on conflict.
- Store a **normalized staffId** (trim, uppercase, strip internal whitespace) so `"abc 123"` and `"ABC123"` cannot become two records. Normalize in one shared util used by scraper, admin form, importer, and seed.
- Add a non-unique index on `(name)` only if lookups still need it (search box). Names are never used to resolve identity.

### 4.2 Subject

- Add/confirm a **unique `code`** (e.g. `CN`, `DWDM LAB`) as the human-stable key, in addition to `id`. If a code column already exists (README mentions subject codes), make it unique and normalized (trim/uppercase).
  - **Backfill resolution:** For existing subjects with `code = null`, backfill with `code = coalesce(code, shortform, name)` normalized (trimmed and uppercased).
- `name` (full title) is display-only and may repeat across different codes.
- **LUNCH / breaks:** Add an explicit flag on the subject (`isBreak Boolean @default(false)`). Break subjects (e.g. `code = 'LUNCH'`) must have `facultyId = null` and are excluded from faculty-clash checks.

### 4.3 ClassRoom

- Enforce uniqueness on `(year, branch, section, academicYear)`. This allows keeping historical classes from past academic years and supports drafting upcoming academic year timetables cleanly.
- `academicYear` is required / non-null (current existing classes are all `'2026-27'`).
- Normalize `branch` and `section` (trim, uppercase) at write time.

### 4.4 TimetableSlot

- FKs `classId`, `subjectId`, `facultyId`, `batchBFacultyId` must be real foreign keys with `onDelete: Restrict` (deleting a referenced faculty/subject/class must fail with a friendly error; prefer deactivation for faculty/subjects via `isActive`).
- **Multi-Faculty Lab Sessions (2 Batches):** For lab slots, classes are split into Batch A and Batch B with two faculty assigned. Add `batchBFacultyId Int?` (mapped to `Faculty`) alongside `facultyId` (Batch A / primary faculty). Both are validated by the clash engine.
- Add a unique index `(classId, day, startTime)` as a cheap DB-level backstop.
- Add DB `CHECK` constraints through a raw-SQL migration: `day BETWEEN 0 AND 5`; `startTime ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'` (same for `endTime`); `startTime < endTime`.

### 4.5 TimetableOverride and CRUser

- Same FK/`Restrict` treatment. CR accounts reference `classId` only by id. Support `batchBFacultyId` on overrides when modifying lab slots.

### 4.6 Periods

- Move periods to a dedicated **`Period` database table**:
  - `id Int @id @default(autoincrement())`
  - `periodNumber Int?` (1..7 for academic periods, null/0 for breaks)
  - `name String` ('Period 1', 'Lunch Break', etc.)
  - `startTime String @db.Char(5)`
  - `endTime String @db.Char(5)`
  - `isBreak Boolean @default(false)`
  - `order Int @default(0)`
- Seed with the canonical 7-period + 1 lunch break structure (defaulting to the current 09:00–15:25 schedule).
- Remove hardcoded timestamp assumptions from `WeeklyTimetableGrid.jsx` and `timetable-json.service.js`.
- Provide `GET /api/periods` and admin management endpoints so non-technical admins can adjust period timings via UI without code changes.
- `TimetableDraftSlot` stores raw `startTime`/`endTime`; period mapping is dynamically calculated/validated against active DB `Period` rows upon publish.

### 4.7 Existing-data fixes (before adding constraints)

Write `backend/scripts/fix-duplicates.js` with a **`--dry-run` default** and an explicit `--apply` flag:

- For duplicate faculty/subjects: pick the survivor **by explicit rule** (e.g. the record with a valid `staffId`, then the most references, then the lowest id), repoint all FKs (slots, overrides), then delete the loser. Print a before/after report and write it to the audit log.
- Same-name faculty with **different** staffIds are **not duplicates**. Leave them alone.
- Never auto-merge on name alone. If two records share a name and one has no staffId, flag for manual resolution.

**Acceptance:** migrations apply cleanly on a copy of production data; constraint violations are reported by the script rather than crashing the migration; `prisma migrate deploy` works from scratch on an empty DB and the seed still runs.

---

## 5. Phase 2 — Scraper: Identify Faculty by Staff ID (G1)

### 5.1 Parsing

- Inspect the real official PDF/HTML source and document its columns in `docs/FACULTY_SOURCE_FORMAT.md`. Identify where the staff ID appears (table column, profile URL, image filename).
- The parser must output records shaped like `{ staffId, name, department, designation, qualification, email, phone, profileUrl, imageUrl }` where **`staffId` is mandatory**. A parsed row without a staffId is **not** upserted; it is added to the sync run's "skipped / needs review" list with the raw row and reason.

### 5.2 Matching (replaces any "first match wins" logic)

```text
1. Normalize staffId.
2. Look up Faculty WHERE staffId = normalized  (unique → at most one row)
   - found     → update changed fields only
   - not found → create new Faculty
3. NEVER look up faculty by name to decide identity.
4. If two source rows in the same run have the same staffId → keep neither silently;
   record a "duplicate staffId in source" conflict and skip both.
```

- Two different people with the same name and different staffIds produce **two** Faculty rows. This must have an automated test.
- Image and profile resolution must be keyed from the same source row (profile URL / image URL taken from that row), never by searching the site by name. If the profile page lookup returns a staffId that differs from the row's, discard the image and log a mismatch.
- `imageHash` keeps preventing unnecessary rewrites. A failed fetch never wipes an existing good image.

### 5.3 Sync report

- Extend the existing sync-run record (`FacultySyncRun`) so each run stores counts **plus** a structured list of issues: `missing_staff_id`, `duplicate_staff_id_in_source`, `image_mismatch`, `fetch_failed`. Show them in the Faculty Management admin screen.
- Sync remains manual/admin-triggered, rate-limited, restricted to official GRIET domains.

### 5.4 Other scripts

- Any standalone scraping/maintenance scripts under `backend/scripts/` (or elsewhere) must use the same shared parser/matcher service, not their own copy of the logic.

**Tests (fixtures, no live network):**
- Source with two "Dr. A. Kumar" rows, different staffIds → 2 records, each with its own image.
- Re-running the same sync → 0 created, 0 duplicated, N unchanged.
- Row with missing staffId → skipped and reported, nothing created.
- Same staffId twice in source → both skipped and reported.
- Failed image fetch → existing image preserved.

---

## 6. Phase 3 — ID-Only Contract Across Backend, Importer, Seed, Frontend (G2)

Use `docs/NAME_LOOKUP_AUDIT.md` as the checklist. Every item in it must be resolved or explicitly justified.

### 6.1 Backend

- All write endpoints accept **ids** for references: `classId`, `subjectId`, `facultyId`, `crId`. Zod schemas must **reject** unknown keys such as `subjectName`/`facultyName` (`.strict()`), so a client cannot send names by accident.
- All service-layer lookups for identity use `findUnique({ where: { id } })` or a unique natural key (`staffId`, subject `code`). `findFirst` by name for identity purposes is banned. Add an ESLint/grep check in CI-style test: fail if `findFirst` + `name` appears in `services/`.
- API responses always include `id` for every nested entity (`class`, `subject`, `faculty`) — already the pattern in the timetable response; make it uniform for admin endpoints.
- Search endpoints (typeahead) may match by name but must return ids, and the follow-up action uses the id.

### 6.2 Bulk Excel/JSON importer

- Rows reference subjects by **`code`** and faculty by **`staffId`** (or `id`), not by name. Update the template/sample file and the importer preview UI.
- The preview must show, per row, the resolved `subjectId`/`facultyId` and mark unresolved/ambiguous references as errors. Importing is all-or-nothing within a transaction and runs through the shared clash service (§7).
- Provide a one-time export of the current timetable in the new format so existing data can round-trip.

### 6.3 Seed

- `seed.js` must create/lookup records via the same natural keys (`staffId`, subject `code`, class tuple) and be idempotent (upsert by those keys, never by name).
- Seeded faculty need staffIds. Use clearly marked placeholder IDs (e.g. `SEED-001`) only for demo data and keep them out of production seeding.

### 6.4 Frontend

- Every `<select>`/combobox for subject, faculty, class stores and submits the **id** as its value; labels are only text.
- Faculty options must disambiguate duplicates: `"Name — StaffID — Department"`. Subject options: `"CODE — Full name"`.
- React `key` props, state, URL params, and comparisons use ids. No logic may compare display strings (e.g. `cell.subject === "LUNCH"` → use the break flag or `subjectId`).
- Class pickers use `classId`, not the `Y3 - AIML - B` label.

**Acceptance:** with two same-named faculty in the DB, assigning each to different slots via the existing admin UI, the importer, and the CR override form all work and the right person is saved and displayed every time.

---

## 7. Phase 4 — Clash Engine (shared service)

Create `backend/src/services/clash.service.js` plus pure helpers in `utils/time.js`. It must be a **pure, unit-testable core** (takes candidate slots + existing slots, returns clashes) wrapped by DB-loading functions.

### 7.1 Clash types (only what the current data supports)

| Type | Definition | Blocking? |
|------|------------|-----------|
| `CLASS_OVERLAP` | Two slots of the **same class**, same day, overlapping times | Yes |
| `FACULTY_DOUBLE_BOOKED` | The **same facultyId or batchBFacultyId** in any two slots (same or different class), same day, overlapping times | Yes |
| `INVALID_REFERENCE` | `classId`/`subjectId`/`facultyId`/`batchBFacultyId` does not exist, or is inactive | Yes |
| `BREAK_HAS_FACULTY` | A break subject (e.g. LUNCH) assigned a faculty | Yes |
| `OUTSIDE_PERIODS` | Cell times do not align to the configured period grid (when a slot is created from the designer) | Yes |

Out of scope for this iteration (no data for them): room clashes, student-group/elective clashes. Do not invent room tables.
T&P has no college faculty assigned (`facultyId = null`), so it does not cause faculty clashes.

Rules:
- Slots with `facultyId = null` (and `batchBFacultyId = null`) never cause faculty clashes.
- Overlap uses minutes-from-midnight; touching boundaries are allowed.
- A lab spanning several periods is a **single slot** whose `startTime` is the first period's start and `endTime` is the last period's end; it clashes with anything that overlaps any part of it.
- For lab slots with two batches, both `facultyId` (Batch A) and `batchBFacultyId` (Batch B) are checked against other published slots and drafts. Neither faculty member can be double-booked elsewhere.

### 7.2 API of the service

```text
findClashes({ candidateSlots, scope })  → Clash[]
  Clash = { type, day, startTime, endTime,
            candidate: { classId, subjectId, facultyId },
            conflictsWith: { slotId | draftSlotId, classId, classLabel, subjectId, facultyId, facultyName, startTime, endTime } }

assertNoClashes(...)  → throws a 409 AppError with the Clash[] payload

getFacultyBusyMap({ excludeClassId?, excludeDraftId? })
  → { [facultyId]: [{ day, startTime, endTime, classId, classLabel }] }
```

### 7.3 Enforcement points (no bypass allowed)

- Existing `POST/PUT /api/admin/slots` → call `assertNoClashes`.
- Bulk importer → call it for the whole batch plus against existing slots of other classes.
- Designer draft writes and publish (Phase 5).
- Run each write inside a transaction and take a **PostgreSQL advisory lock** (e.g. `pg_advisory_xact_lock` on a fixed key, or per-faculty) so two admins editing different classes cannot double-book the same faculty concurrently. The DB unique index from §4.4 stays as a backstop for the class-level case.

### 7.4 Existing live-data clashes

Phase 0 may find faculty already double-booked in live data. Do **not** auto-fix. Expose them in an admin "Conflicts report" (`GET /api/admin/conflicts`) listing each clash, so the admin can fix it using the designer. The designer must still allow saving a draft that *reduces* clashes; publishing is blocked only if the draft itself introduces or retains a clash.

**Tests (pure unit tests, no DB):**
- Same class overlap, different class same faculty overlap, adjacent slots (no clash), identical slots, multi-period lab vs single period, null faculty, break with faculty, off-grid times, 3-way overlap reporting all conflicts.
- Integration: two simultaneous publish requests for different classes booking the same faculty → exactly one succeeds, the other gets 409.

---

## 8. Phase 5 — Timetable Designer (G3)

### 8.1 Design decision: Draft → Publish

Editing the live timetable cell-by-cell would show half-finished timetables to students. So the designer works on a **draft** per class and the admin explicitly **publishes** it.

New tables (names indicative; follow the repo's naming style):

```text
TimetableDraft
  id, classId (FK, Restrict), name?, version Int (optimistic concurrency),
  status (OPEN | PUBLISHED | DISCARDED), createdById, createdAt, updatedAt
  → only ONE OPEN draft per class (partial unique index WHERE status = 'OPEN')

TimetableDraftSlot
  id, draftId (FK, Cascade), day, startTime, endTime, subjectId (FK), facultyId (FK, nullable), batchBFacultyId (FK, nullable)
  → unique (draftId, day, startTime)
```

Keep these tables lean — only the columns listed (this phase must not add to the cleanup work in Phase 8).

### 8.2 Clash scope while drafting

A draft slot is validated against:
1. The other slots **in the same draft** (class overlap).
2. **Published** slots of **all other classes** (faculty double-booking).
3. Published slots of the **same class are ignored** (the draft is replacing them).

Other classes' **open drafts** are *not* hard blockers; if a faculty is also used there, show a non-blocking warning ("also used in draft for Y3-AIML-A"). The final authority is the re-validation at publish time (§8.3).

### 8.3 API (admin-only, JWT role = ADMIN)

```http
POST   /api/admin/designer/drafts                 { classId, startFrom: "published" | "blank" }
GET    /api/admin/designer/drafts                 list open drafts
GET    /api/admin/designer/drafts/:draftId        draft + slots + period grid + validation summary
PUT    /api/admin/designer/drafts/:draftId/cells  { day, startTime, endTime, subjectId, facultyId|null, expectedVersion }
DELETE /api/admin/designer/drafts/:draftId/cells  { day, startTime }  (clear a cell)
GET    /api/admin/designer/drafts/:draftId/availability
                                                  → faculty busy map for the whole week (see §7.2)
POST   /api/admin/designer/drafts/:draftId/validate
POST   /api/admin/designer/drafts/:draftId/publish
DELETE /api/admin/designer/drafts/:draftId        discard
```

Behavior:
- Cell writes are rejected with **409 + clash payload** if they introduce a clash (so a saved draft is always clash-free at write time). A stale `expectedVersion` returns 409 `STALE_DRAFT`.
- All inputs are ids (`subjectId`, `facultyId`). Names are never accepted.
- **Publish** = one transaction: advisory lock → re-run the full clash check against current published data → replace that class's published slots with the draft's slots → mark draft `PUBLISHED`. Slots whose (day, start, end, subjectId, facultyId) are unchanged keep their existing row ids (diff-based update, not delete-all/insert-all).
- Publish response includes **impact warnings**: future-dated overrides for that class that no longer overlap any slot. Do not delete overrides automatically; list them.
- Write an audit-log entry for create, publish, and discard.

### 8.4 Frontend — new route `/admin/designer/:classId`

**Reuse, don't re-invent the layout.** Refactor the public `TimetableGrid`/`TimetableCell` into a presentational layout (rows/columns/period headers/responsive behavior) that supports a `mode` of `"view"` or `"edit"` (or compose a `DesignerGrid` from the same building blocks and CSS). The designer must look like the existing weekly grid: same day rows, same period columns, same cell styling — plus editing affordances.

Add to the admin dashboard navigation: **"Timetable Designer"** → pick class → open/create draft.

Designer behavior:

1. **Grid:** Monday–Saturday × configured periods (from the single period source). Each cell shows subject code, faculty name + avatar, and a status ring: normal / clash / warning.
2. **Cell editor** (click a cell → popover on desktop, bottom sheet on mobile, keyboard accessible, Esc closes, focus returns to the cell):
   - Subject select (value = `subjectId`, label = `CODE — name`).
   - Faculty select (value = `facultyId`, label = `Name — StaffID — Dept`), **searchable**.
   - Faculty busy at that time slot are shown **disabled with the reason** ("Busy: Y3-AIML-A, Tue 10:40–11:30"), using the availability map. Client-side disabling is a convenience only; the server is authoritative.
   - Break subjects hide/disable the faculty field.
   - **Span control:** "Occupies N periods" to create a multi-period slot (labs). Merged cells render as one block spanning columns.
   - Clear cell, and Apply/Cancel.
3. **Optimistic-looking but server-confirmed saves:** on a 409 clash, revert the cell, keep the editor open, and show the exact conflict ("Dr. X is already teaching Y3-AIML-A on Tuesday 10:40–11:30").
4. **Toolbar:** Validate, Publish (disabled while clashes exist; shows a confirmation with the diff and any override impact), Discard, "Reset from published", draft version indicator.
5. **Faculty load panel (small):** per-faculty periods/week in this draft, to help balance workload. Derived from draft data, no new storage.
6. Unsaved/stale handling: if another admin changed the draft (`STALE_DRAFT`), prompt to reload.
7. Same loading/error components as the rest of the app; fully responsive (horizontal scroll or day-tab layout on mobile as in the public view).

### 8.5 Optional extension (do last, only if time permits)

When a CR creates an override with a faculty, warn if that faculty is already teaching another class at that date/time (computed from the effective timetable incl. other overrides). Non-blocking unless I request otherwise.

**Tests:**
- API: create draft from published; edit cells; every clash type returns 409 with the right payload; stale version; non-admin forbidden; one-open-draft-per-class; publish happy path; publish after another class took the faculty → 409; publish impact warnings.
- Frontend: faculty options disabled when busy; span/merge rendering; 409 revert; keyboard flow.
- Manual QA script in `docs/DESIGNER_QA.md` covering the same-name-faculty scenario (two "Dr. A. Kumar" with different staffIds must be independently assignable and independently clash-checked).

---

## 9. Phase 8 — Database Column Cleanup (G4) — run **last**

### 9.1 Method (per column of every table)

For each column in `docs/DB_AUDIT.md`, collect evidence in `docs/COLUMN_USAGE_MATRIX.md`:

| Check | How |
|-------|-----|
| Read in backend code | grep Prisma `select`/`include`/property access across `backend/src`, `backend/scripts`, `seed.js` |
| Written in backend code | grep `create`/`update`/`upsert` payloads, importer, scraper |
| Exposed in API responses | check controllers/services and DTO shaping |
| Used by frontend | grep `frontend/src` for the property name |
| Used by Zod validators | grep `validators/` |
| Used by tests/backup scripts | grep `test/`, `scripts/` |
| Populated in real data | SQL: `% NULL`, `% empty`, `COUNT(DISTINCT)` per column |
| Required by this plan | cross-check against Phases 1–5 (e.g. `staffId`, `imageHash`, `version`) |

### 9.2 Decision rule

- **KEEP** if read by code/UI/API, or required by Phases 1–5, or needed for traceability the original plan demands (e.g. `profileSourceUrl`, `lastScrapedAt`, `imageHash`) and actually populated.
- **DROP** only if: never read, never exposed, not required by any phase, **and** (empty in data **or** the value is derivable from another column).
- **MERGE/RENAME** when two columns hold the same meaning (e.g. code vs short form).
- **ASK** if uncertain. Put it under "Needs decision" in the matrix instead of dropping it.

Also review (not just columns): **unused tables, unused indexes, and redundant relations**; list them in the same document with a recommendation, but dropping a *table* requires my explicit approval.

Likely places to scrutinize (verify against the real schema, don't assume): faculty source/metadata fields, class academic-year/semester/effective-date fields, subject short-form vs code duplication, timestamp columns on tables that never use them, leftover fields from earlier iterations.

### 9.3 Execution

1. Present the matrix; **wait for my approval of the DROP list.**
2. Stage A migration: stop writing/reading the columns in code (remove from Prisma selects, validators, UI, importer, scraper, seed, tests). Run all tests.
3. Stage B migration (separate): `ALTER TABLE ... DROP COLUMN` through a Prisma migration. Backup immediately before.
4. Update `README.md` data model/API sections, `docs/DB_AUDIT.md` (final schema), and the Prisma schema comments.
5. Provide a rollback note: restore from the pre-drop backup (`db:restore`), plus the reverse migration SQL for each dropped column when feasible.

### 9.4 Final integrity pass

- Run a script `backend/scripts/verify-integrity.js` that checks and prints: no null staffIds; no duplicate staffIds/subject codes/class tuples; no orphan FKs; no overlapping slots per class; **no double-booked faculty**; every override overlaps a slot; every CHECK constraint present. Wire it into `npm run prisma:verify`.

---

## 10. Phase Order and Dependencies

```text
Phase 0  Discovery, backups, audits
   ↓
Phase 1  Schema identity/uniqueness (additive) + duplicate cleanup
   ↓
Phase 2  Scraper by staffId          Phase 3  ID-only backend/importer/seed/frontend
   └──────────────┬───────────────────────────┘
                  ↓
Phase 4  Clash engine (shared) + wire into slot CRUD and importer
   ↓
Phase 5  Timetable Designer (draft/publish, UI)
   ↓
Phase 6  Regression, security, responsive QA, docs
   ↓
Phase 8  Column cleanup (approval gate → Stage A → Stage B) + final integrity pass
```

(Phase numbering skips 7 intentionally: reserved for any follow-ups discovered during Phases 0–6.)

### Phase 6 — Regression and Hardening

- Full backend unit/integration suites, frontend lint/build, manual pass of public view, CR override flow, admin CRUD, bulk import, faculty sync.
- Security: designer endpoints enforce ADMIN role server-side; CR tokens get 403; rate limiting unchanged; Zod strict schemas on all new routes.
- Update `README.md`: new feature section, new endpoints, new scripts (`fix-duplicates`, `verify-integrity`), updated importer template, updated data model.
- Update `Implementation_plan_updated_for_tt.md` Definition of Done with the checklist below.

---

## 11. Definition of Done

**Identity (G1, G2)**
- [x] Two faculty with identical names but different staffIds coexist and are never merged or swapped by sync, import, seed, or UI.
- [x] `staffId` is NOT NULL + unique in the DB; normalized by one shared util.
- [x] Scraper skips and reports rows with missing or duplicated staffId; never matches by name.
- [x] Subject `code` unique; class tuple unique; all FKs use `Restrict`.
- [x] No name-based identity lookups remain (verified by `NAME_LOOKUP_AUDIT.md` being fully resolved plus an automated check).
- [x] API write endpoints reject name fields; all dropdowns submit ids; duplicates are disambiguated in the UI.
- [x] Importer and seed use staffId / subject code and are idempotent.

**Clash engine**
- [x] One `clash.service.js` used by slot CRUD, importer, and designer.
- [x] Class overlap and faculty double-booking are impossible to save through any path.
- [x] Concurrent publishes cannot double-book a faculty (tested).
- [x] Existing live clashes are listed in an admin conflicts report.

**Designer**
- [x] `/admin/designer/:classId` mirrors the public grid layout and is responsive and accessible.
- [x] Cells are assigned by subjectId/facultyId; busy faculty are disabled with reasons.
- [x] Multi-period (lab) spans work.
- [x] Drafts are isolated from the live timetable until published.
- [x] Publish re-validates, is atomic, preserves unchanged slot ids, and reports affected overrides.
- [x] Audit log records create/publish/discard.

**Database cleanup (G4)**
- [x] `DB_AUDIT.md` and `COLUMN_USAGE_MATRIX.md` complete; DROP list approved before execution.
- [x] Dropped columns removed from schema, code, tests, importer, scraper, seed, and README.
- [x] `verify-integrity.js` passes on the final database.
- [x] Backups taken before each destructive step and restore verified.

---

## 12. Clarifications and Architecture Decisions (Confirmed)

1. **Staff ID source:** Does every row in the official GRIET staff list expose a staff ID? If not, what is the fallback for rows without one (manual admin entry is the default).
   - *Status:* Mandatory natural key. Parser skips rows missing staff ID and records them for admin review. Existing 54 faculty all possess valid non-null `staffId`.
2. **Joint sessions / T&P:**
   - *Decision:* T&P has no college faculty assigned (`facultyId = null`). Aside from unassigned sessions, strict clash blocking (`FACULTY_DOUBLE_BOOKED`) is enforced across all classes.
3. **Multiple faculty per slot (Labs):**
   - *Decision:* For lab sessions, classes are divided into two batches (Batch A and Batch B) with two faculty assigned. Both faculty are validated against double-booking (`FACULTY_DOUBLE_BOOKED`). Supported via `facultyId` (Batch A) and `batchBFacultyId` (Batch B, nullable) with FK Restrict constraints.
4. **Class uniqueness key:**
   - *Decision:* Key is extended to `(year, branch, section, academicYear)`. `academicYear` is required (non-null), preserving historical classes from prior academic years and enabling drafting future academic year timetables.
5. **Period Grid & Timings:**
   - *Decision:* Canonical structure is 7 periods + 1 lunch break. Stored in a new `Period` database model (seeded with the current 09:00–15:25 timings) so timings are dynamic and configurable via UI. Hardcoded timestamps removed from `WeeklyTimetableGrid.jsx` and `timetable-json.service.js`. `TimetableDraftSlot` stores raw `startTime`/`endTime`; period mapping is dynamically validated/calculated against active DB `Period` rows upon publish.
6. **Subject code & Breaks:**
   - *Decision:* Subject `code` is unique and required; existing nulls backfilled with `coalesce(code, shortform, name).trim().toUpperCase()`. Breaks/LUNCH use `code = 'LUNCH'` and `isBreak = true`.
7. **Faculty/subject deactivation vs deletion:**
   - *Decision:* Soft-delete (`isActive Boolean @default(true)`) and `onDelete: Restrict` on foreign keys. Delete is blocked if referenced.
