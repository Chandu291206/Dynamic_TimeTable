# Database Integrity & Duplicate Audit Report (`docs/DUPLICATE_REPORT.md`)

> **Generated:** Phase 0 Discovery  
> **Target Database:** Live PostgreSQL database (`timetable_db`)  
> **Audit Date:** 2026-11-22  
> **Status:** Read-only verification of existing data prior to Phase 1 constraints.

---

## 1. Summary of Database Checks

| # | Integrity Check | Status | Records Flagged | Severity | Action Required |
|---|---|---|---|---|---|
| 1 | Faculty with `staffId IS NULL` | **CLEAN** | 0 | None | Ready for `NOT NULL` constraint |
| 2 | Duplicate `staffId` values | **CLEAN** | 0 | None | Ready for `@unique` constraint |
| 3 | Faculty with duplicate normalized names | **CLEAN** | 0 | None | No ambiguous faculty identity |
| 4 | Classes violating `(year, branch, section, academicYear)` | **CLEAN** | 0 | None | Ready for 4-tuple `@unique` key |
| 5 | Slots overlapping within the same class & day | **CLEAN** | 0 | None | Ready for DB CHECK constraints |
| 6 | Subjects with `code IS NULL` | **ACTION REQUIRED** | 23 | Moderate | Backfill `code = coalesce(code, shortform, name)` |
| 7 | Subjects with duplicate normalized names | **ACTION REQUIRED** | 6 clusters (13 rows) | Moderate | Merge/normalize redundant subject rows |
| 8 | Subjects sharing duplicate `code` values | **ACTION REQUIRED** | 7 clusters (15 rows) | Moderate | De-duplicate before adding unique index on `code` |
| 9 | **Faculty double-booked in live data** | **ACTION REQUIRED** | 8 clashes (16 slots) | High | Expose in conflicts report (`/api/admin/conflicts`) |

---

## 2. Detailed Findings & Data Breakdowns

### 2.1 Faculty Identity Checks
* **Total Faculty Records:** 54
* **Faculty with `staffId IS NULL`:** **0**
* **Duplicate `staffId` values:** **0**
* **Duplicate Normalized Names:** **0**
  * *Result:* All 54 faculty currently have distinct names and valid GRIET staff IDs. Transitioning `staffId` to `NOT NULL` and `@unique` in Phase 1 can proceed without data fabrication or loss.

---

### 2.2 Subject Catalogue Integrity & Code Analysis
* **Total Subject Records:** 80
* **Subjects with `code IS NULL`:** **23**
* **Duplicate Subject Code Clusters:** **7**
* **Duplicate Normalized Name Clusters:** **6**

#### A. Subjects with Null Codes (23 Records)
These records were created prior to code tracking or imported without explicit subject codes:
1. `RP LAB` (ID: 2)
2. `T&P` (ID: 4)
3. `AI LAB` (ID: 5)
4. `FLAT` (ID: 6)
5. `IIOT` (ID: 7)
6. `LUNCH` (ID: 8)
7. `OE` (ID: 33)
8. `JP (T&P)` (ID: 57)
9. `JP TRAINING` (ID: 58)
10. `JP (T&P) LAB` (ID: 105)
11. `PW-I- (A)` (ID: 323)
12. `PW-I (A)` (ID: 324)
13. `PW-I- (B)` (ID: 333)
14. `PW-I- (C)` (ID: 342)
15. `PW-I` (ID: 352)
16. `JP (T & P) LAB` (ID: 399)
*(and 7 others)*

*Remediation:* In Phase 1, backfill `code = coalesce(code, shortform, name).trim().toUpperCase()`. Breaks will receive `code = 'LUNCH'` and `isBreak = true`.

#### B. Duplicate Subject Codes (7 Clusters)
The following subject rows share identical subject codes:

| Code | Duplicate Subjects | IDs | Total Slots Referencing |
|---|---|---|---|
| `GR24A3130` | `AI`, `AI (PE-I)`, `AI(PE-I)` | 1, 109, 264 | 14 slots |
| `GR24A3094` | `CN LAB`, `CNS LAB` | 30, 112 | 6 slots |
| `GR24A3109` | `MLRP`, `MLR` | 150, 304 | 10 slots |
| `GR24A3110` | `BCVS-III`, `BCVS - III` | 151, 305 | 0 slots |
| `GR24A3112` | `CC (PE-I)`, `CC(PE-I)` | 152, 306 | 0 slots |
| `GR24A3116` | `MLRP LAB`, `MLR LAB` | 155, 309 | 6 slots |
| `GR22A4082` | `PW- I`, `PW - I` | 319, 350 | 0 slots |

*Remediation:* Write `backend/scripts/fix-duplicates.js` to merge each cluster into the survivor with the most slot references, repoint existing slots/overrides, and prune the orphan duplicate rows prior to creating the unique constraint on `Subject.code`.

---

### 2.3 Class Uniqueness Check
* **Total Class Records:** 15
* **Key Tested:** `(year, branch, section, academicYear)`
* **Violations Found:** **0**
* *Result:* Every existing class has `academicYear = '2026-27'`. The 4-column uniqueness constraint can be added safely in Phase 1.

---

### 2.4 Timetable Slot Overlaps Within the Same Class
* **Total Slots:** 382
* **Violations Found (`start < other.end && end > other.start` for same `classId` and `day`):** **0**
* *Result:* No internal intra-class scheduling conflicts exist in the current recurring timetable.

---

### 2.5 Live Faculty Double-Booking Clashes (Existing Data)
The audit identified **8 live scheduling clashes** (involving 16 slots across 6 distinct faculty members) where the same faculty member is assigned to teach two different classes at overlapping times:

| # | Faculty Name | Staff ID | Day | Conflicting Slot 1 | Conflicting Slot 2 | Overlap Details |
|---|---|---|---|---|---|---|
| 1 | **Dr. D. Indira** | 270 | Tuesday (1) | **Y2-DS-A** (Slot 1249)<br>`13:50–15:30` (EAE) | **Y4-DS-A** (Slot 842)<br>`13:25–14:15` (EAE) | 25 min overlap (`13:50–14:15`) |
| 2 | **Dr. D. Indira** | 270 | Thursday (3) | **Y2-DS-A** (Slot 1256)<br>`10:40–11:30` (EAE) | **Y4-DS-A** (Slot 849)<br>`10:00–11:50` (EAE) | 50 min overlap (`10:40–11:30`) |
| 3 | **Ms. D. Priyanka** | 1848 | Friday (4) | **Y2-DS-A** (Slot 1263)<br>`12:10–13:50` (DM) | **Y3-CSBS-A** (Slot 828)<br>`09:50–12:20` (CC LAB) | 10 min overlap (`12:10–12:20`) |
| 4 | **Ms. P. Samyuktha** | 1756 | Wednesday (2) | **Y2-DS-D** (Slot 1341)<br>`10:40–11:30` (EAE) | **Y4-CSBS-A** (Slot 923)<br>`10:00–11:50` (HRM) | 50 min overlap (`10:40–11:30`) |
| 5 | **Mr. V. Y. Bharadwaj** | 1718 | Thursday (3) | **Y2-CSBS-A** (Slot 1380)<br>`13:50–14:40` (DBMS) | **Y3-CSBS-A** (Slot 826)<br>`14:35–15:25` (CMA) | 5 min overlap (`14:35–14:40`) |
| 6 | **Mr. V. Y. Bharadwaj** | 1718 | Saturday (5) | **Y2-CSBS-A** (Slot 1388)<br>`12:10–13:50` (DBMS) | **Y3-CSBS-A** (Slot 834)<br>`13:45–15:25` (CMA) | 5 min overlap (`13:45–13:50`) |
| 7 | **Dr. A. Aruna Kumari** | 1826 | Saturday (5) | **Y3-DS-B** (Slot 772)<br>`09:50–12:20` (CN) | **Y3-DS-C** (Slot 792)<br>`11:30–12:20` (CN) | 50 min overlap (`11:30–12:20`) |
| 8 | **Ms. S. H. Swaroopa** | 1878 | Friday (4) | **Y3-DS-C** (Slot 788)<br>`09:50–12:20` (DV) | **Y3-DS-D** (Slot 809)<br>`11:30–12:20` (DV) | 50 min overlap (`11:30–12:20`) |

### Resolution Policy for Live Clashes:
As mandated by §7.4 of the Implementation Plan:
1. **Do not auto-delete or auto-reassign these live slots.**
2. Expose all 8 clashes in an administrative Conflicts Report endpoint: `GET /api/admin/conflicts`.
3. Allow administrators to resolve these double-bookings using the new **Timetable Designer** drafts.
4. Enforce that new publishes are blocked if they introduce new clashes or preserve existing ones.
