# GRIET Faculty Source Format & Identity Resolution Specification

This document defines the official data sources, parsing structures, column layouts, and identity resolution rules for faculty records within the GRIET Timetable Management System.

---

## 1. Overview & Data Sources

Faculty data originates from two institutional sources at Gokaraju Rangaraju Institute of Engineering and Technology (GRIET):

1. **Official Staff List PDF** (Canonical Institutional Staff Directory)
   - **URL:** `https://www.griet.ac.in/images/Staff%20List%20for%20Website.pdf`
   - **Protocol:** Strict HTTPS, verified domain `griet.ac.in`.
   - **Role:** Authoritative primary source for institutional identity, official Staff IDs, designations, and qualifications.
2. **Online Department Web Directories** (HTML / Department Subdomains)
   - **Central Staff Directory:** `https://www.griet.ac.in/staff.php`
   - **Department Sites:**
     - CSE: `http://www.cse.griet.ac.in/facultydirectory.html`
     - AIML: `http://www.aiml.griet.ac.in/facultydirectory.html`
     - EEE: `http://www.eeedept.griet.ac.in/department_faculty.html`
     - H&BS: `http://hs.griet.ac.in/facultydata.html`
     - ME: `http://www.me.griet.ac.in/faculty.html`
     - IT: `http://www.it.griet.ac.in/faculty.html`
     - ECE: `http://www.ece.griet.ac.in/department_faculty.html`
     - CE: `http://www.ce.griet.ac.in/department_facultydirectory.html`
   - **Role:** Enrichment source for profile URLs, official avatar/photograph URLs, email addresses, and departmental affiliations.

---

## 2. Official Staff List PDF Format

The official PDF document is a structured tabular roster generated from institutional records.

### 2.1 Column Layout

| Column Position | Field Name | Data Type | Example Values | Description |
|---|---|---|---|---|
| **1** | Serial Number (`S.No`) | Integer | `1`, `2`, `145` | Sequential row index in document |
| **2** | Full Name (`name`) | String | `Dr. J. Praveen`, `Mr. K. Sunil Kumar Reddy` | Official institutional name including academic prefix |
| **3** | Staff ID (`staffId`) | String (numeric/alphanumeric) | `1079`, `1818`, `270`, `1175` | **Mandatory primary natural identity key** |
| **4** | Highest Qualification (`qualification`) | String | `Ph.D`, `M.Tech`, `M.Sc` | Academic qualifications |
| **5** | Designation (`designation`) | String | `Professor & Principal`, `Associate Professor`, `Asst. Professor` | Faculty academic rank |

### 2.2 Text Extraction Pattern

When parsed via text extractors (`pdf-parse`), lines follow this standardized pattern:
```regex
^\s*(\d+)\s+([A-Za-z.\s'-]+?)\s+(\d{2,})\s+([A-Za-z0-9,.\s&()/-]+?)\s+(Professor|Associate\s+Prof(?:essor)?|Asst\.?\s*Professor|Lecturer|Dean|Director|HOD)(?:\s+.*)?$
```

### 2.3 Required Output Record Schema

Any parser extracting from this source must return records adhering to:
```typescript
interface ParsedFacultyRecord {
  staffId: string;         // Mandatory: normalized staff ID
  name: string;            // Mandatory: faculty full name
  department: string | null;
  designation: string | null;
  qualification: string | null;
  email: string | null;
  phone: string | null;
  profileUrl: string | null;
  imageUrl: string | null;
}
```

---

## 3. Web Directory Source Formats

### 3.1 Central Staff Directory (`staff.php`)
- **Table Structure:**
  - `<td>[0]`: Serial Number
  - `<td>[1]`: JNTUH Registration Number / Staff ID (e.g., `85150330-182657` or `1079`)
  - `<td>[2]`: Faculty Name
  - `<td>[3]`: Designation
  - `<td>[4]`: Highest Qualification
  - `<td>[5]`: Department (`CSE`, `AIML`, `EEE`, `DS`, `CSBS`, etc.)
  - `<td>[6]`: Faculty Photograph (`<img src="fac/Dr. J.Praveen.jpg">`)

### 3.2 CSE & AIML Department Directories
- **Table Structure:**
  - `<td>[0]`: Serial Number
  - `<td>[1]`: Faculty Name
  - `<td>[2]`: Designation
  - `<td>[3]`: Staff ID (e.g., `1818`, `922`)
  - `<td>[4]`: Date of Joining
  - `<td>[5]`: Email Address (e.g., `hod_aimle@griet.ac.in`)
  - `<td>[6]`: JNTUH Portal ID
  - `<td>[7]`: Photograph & Profile Link (`<img src="images/...">`, `<a href="...html">`)

### 3.3 EEE & H&BS Department Directories
- **Table Structure:**
  - `<td>[0]`: Serial Number
  - `<td>[1]`: Faculty Name
  - `<td>[2]`: Staff ID (e.g., `1079`)
  - `<td>[3]`: Qualification
  - `<td>[4]`: Specialization
  - `<td>[5]`: Designation
  - Profile Links: `<a href="document/Dr. J.Praveen.pdf">` or web profiles

---

## 4. Identity Resolution Invariants (Goal G1)

In strict adherence to architectural requirement **G1**:

1. **Staff ID is the Sole Determinant of Identity:**
   - Identity is determined strictly by `normalizeStaffId(staffId)`.
   - Normalization removes all whitespace and converts to uppercase:
     `normalizeStaffId(staffId) = staffId.trim().toUpperCase().replace(/\s+/g, '')`.
2. **Zero Name Matching for Identity:**
   - Name matching (exact or substring/fuzzy) is strictly **forbidden** for establishing identity, linking slots, or updating records.
   - Two faculty members sharing the exact same name (e.g., two people named "Dr. A. Kumar") with different Staff IDs (`1401` and `1520`) produce **two distinct, independent `Faculty` records**.
3. **Strict Validation & Skip Rule:**
   - Any parsed row without a valid, non-empty `staffId` is **never upserted**.
   - It is categorized as `missing_staff_id` and logged in the sync run's `issues` array.
4. **Duplicate Staff ID Conflict Rule:**
   - If two rows in the source data share the same `staffId`, neither row is saved silently.
   - Both rows are dropped, counted as `skipped`, and logged under `duplicate_staff_id_in_source`.
5. **Profile and Image Verification:**
   - Photographs and profile links must be extracted only from records matching the official `staffId`.
   - If a linked HTML profile page explicitly provides a Staff ID that contradicts the source record's `staffId`, the image is discarded, and an `image_mismatch` issue is logged.
   - Failed image fetches or broken image links never overwrite or delete an existing valid avatar (`imageHash` / `imageSourceUrl`).

---

## 5. Sync Run Issue Taxonomy

Each synchronization run records its status in `FacultySyncRun` with a structured `issues` JSON payload containing:

| Issue Code | Description | Payload Fields |
|---|---|---|
| `missing_staff_id` | Source row lacked a valid or parseable Staff ID | `rawRow`, `name`, `reason` |
| `duplicate_staff_id_in_source` | Multiple rows in the source feed claimed the same Staff ID | `staffId`, `name`, `reason`, `rawRow` |
| `image_mismatch` | Linked profile page Staff ID conflicted with source row | `staffId`, `name`, `expectedStaffId`, `foundStaffId`, `url` |
| `fetch_failed` | Network failure or invalid response when retrieving profile or image | `staffId`, `name`, `url`, `error` |

These issues are stored in `FacultySyncRun.issues` and surfaced in the admin Faculty Management UI.
