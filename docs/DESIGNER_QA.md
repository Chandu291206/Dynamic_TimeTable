# Timetable Designer Manual QA & Verification Protocol

This manual QA guide validates the functionality, clash-prevention engine, and same-name faculty isolation of the **Timetable Designer** (`/admin/designer`).

---

## 1. Prerequisites
- Backend running on `http://localhost:5000` (or active test server).
- Frontend running on `http://localhost:5173`.
- Authenticated as an administrator at `/admin/login`.

---

## 2. Test Scenarios

### Test 1: Draft Creation & Lifecycle (Blank vs. Published)
1. Navigate to `/admin/dashboard` &rarr; click **Timetable Designer** tab (or direct URL `/admin/designer`).
2. Select any class from the dropdown (e.g. `Year 3 - CSE - A`).
3. If no draft exists, you will see two options:
   - **Start From Published Timetable**: Clones all active slots for this class into an isolated draft.
   - **Start With Blank Timetable**: Initializes an empty schedule with 0 assigned cells.
4. Select **Start From Published Timetable**.
5. **Expected result:**
   - Grid renders Monday–Saturday with the canonical 7 periods + 1 lunch break.
   - Status badge shows `Draft v1 • OPEN`.
   - The public timetable remains unchanged and unaffected until published.

---

### Test 2: Same-Name Faculty Disambiguation & Isolation
**Goal:** Verify that two faculty members with identical names are never confused or cross-assigned.

1. In `/admin/dashboard` &rarr; **Faculty Directory**, ensure two faculty members have identical names with distinct staff IDs:
   - Faculty A: `Dr. Ramesh Kumar` &mdash; Staff ID: `1001` (CSE)
   - Faculty B: `Dr. Ramesh Kumar` &mdash; Staff ID: `1002` (AIML)
2. Open **Timetable Designer** for Class A (`Year 3 - CSE - A`).
3. Click an empty period (e.g. `Monday Period 1 09:00–09:50`).
4. In the popover, look at the Faculty dropdown:
   - **Verify:** Both faculty are displayed with their distinct staff IDs:
     - `Dr. Ramesh Kumar — Staff ID: 1001 (CSE)`
     - `Dr. Ramesh Kumar — Staff ID: 1002 (AIML)`
5. Assign `Dr. Ramesh Kumar (Staff ID: 1001)` to `Monday 09:00–09:50`. Click **Apply & Save**.
6. Cell renders with avatar and `Dr. Ramesh Kumar`.
7. Now open a separate class draft (Class B: `Year 3 - CSE - B`).
8. Click `Monday Period 1 09:00–09:50`:
   - If Class A's timetable is published, Faculty A (`Staff ID: 1001`) will appear as **disabled** with reason: `[BUSY: Y3 - CSE - A]`.
   - Faculty B (`Staff ID: 1002`) remains **enabled and selectable**.
9. Assign Faculty B (`Staff ID: 1002`). Click **Apply & Save**.
10. **Verify:** Both classes successfully save without interference, each holding its respective distinct faculty ID.

---

### Test 3: Multi-Period Lab Spanning & Batch B Faculty
1. In the designer grid, click `Wednesday Period 6 (13:45–14:35)`.
2. In the Cell Editor:
   - Choose a Lab course (e.g. `ML LAB`).
   - In **Slot Duration / Period Span**, select `2 Periods [Lab] (13:45–15:25)`.
   - Notice the **Batch B Faculty** dropdown appears automatically for multi-period slots.
   - Select Faculty A for Batch A and Faculty B for Batch B.
3. Click **Apply & Save**.
4. **Expected result:**
   - Cell merges across Period 6 and Period 7 (`colSpan = 2`).
   - Displays `Lab (2P)` badge and `Batch B: [Name]` indicator.

---

### Test 4: Live Clash Detection & Blocking
1. With Faculty A (`Staff ID: 1001`) already booked in a published slot on `Tuesday 10:40–11:30`:
2. Open another class draft and attempt to assign Faculty A on `Tuesday 10:40–11:30`.
3. Notice:
   - The dropdown displays `[BUSY: Y3 - CSE - A]`.
   - If forced or submitted concurrently, the server immediately returns `409 Conflict`:
     `"Faculty Dr. Ramesh Kumar is already booked in Y3 - CSE - A from 10:40 to 11:30"`.
   - The cell reverts and the editor stays open displaying the exact conflict message.

---

### Test 5: Atomic Publish & Override Impact Warnings
1. When all desired cells are scheduled in the draft, click **Validate**.
   - If clean: `Draft is clean with zero clashes!`.
   - If conflicts exist: `Publish Timetable` button remains disabled.
2. Click **Publish Timetable**:
   - The server acquires a PostgreSQL advisory lock (`timetable_clash_lock`).
   - Runs final serialized verification.
   - Updates `TimetableSlot` rows using diff-based replacement (preserving unchanged slot IDs).
   - If any future-dated CR override no longer matches a valid slot in the new schedule, a summary dialog lists:
     `Override on 2026-11-25 (09:00–09:50): Subject no longer overlaps recurring slot`.
   - Marks draft as `PUBLISHED`.
3. Navigate to public timetables (`/timetables`):
   - The updated class timetable is immediately live and visible to students and faculty.
