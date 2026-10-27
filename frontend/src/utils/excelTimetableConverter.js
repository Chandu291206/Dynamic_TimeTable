import * as XLSX from 'xlsx'

export function cleanStr(val) {
  if (val === null || val === undefined) return ''
  return String(val).replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseTime24(timeStr) {
  if (!timeStr) return ''
  const cleaned = cleanStr(timeStr).replace(/\s+/g, '')
  const [startRaw, endRaw] = cleaned.split('-')
  if (!startRaw || !endRaw) return cleaned

  function to24(t) {
    let [h, m] = t.split(':').map(Number)
    if (isNaN(h)) return t
    if (isNaN(m)) m = 0
    // 1:00 to 5:59 is PM in college timetable
    if (h >= 1 && h <= 5) {
      h += 12
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  return `${to24(startRaw)}-${to24(endRaw)}`
}

export function formatExcelDate(val) {
  if (typeof val === 'number') {
    const d = (XLSX.SSF || XLSX.default?.SSF)?.parse_date_code(val)
    if (d) {
      return `${String(d.d).padStart(2, '0')}-${String(d.m).padStart(2, '0')}-${d.y}`
    }
  }
  const str = cleanStr(val)
  const m = str.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    const day = m[1].padStart(2, '0')
    const month = m[2].padStart(2, '0')
    let yr = m[3]
    if (yr.length === 2) yr = '20' + yr
    return `${day}-${month}-${yr}`
  }
  return str
}

export function parseFaculty(facultyStr) {
  if (!facultyStr) return null
  const parts = String(facultyStr)
    .split(/\s*[\/\n\r]+\s*/)
    .map((p) => cleanStr(p))
    .filter(Boolean)

  if (parts.length === 0) return null

  const parsedList = parts.map((part) => {
    const match = part.match(/^(.*?)(?:\s*\(([^)]+)\))?$/)
    if (match) {
      const name = cleanStr(match[1])
      const staff_id = match[2] ? cleanStr(match[2]) : null
      return staff_id ? { name, staff_id } : { name }
    }
    return { name: part }
  })

  if (parsedList.length === 1) {
    return {
      faculty: parsedList[0].name,
      ...(parsedList[0].staff_id ? { staff_id: parsedList[0].staff_id } : {}),
    }
  }

  return { faculty: parsedList }
}

export function parseTimetableSheet(sheet, sheetName) {
  const xlsxLib = XLSX.utils ? XLSX : (XLSX.default || XLSX)
  const rows = xlsxLib.utils.sheet_to_json(sheet, { header: 1 })
  if (!rows || rows.length < 10) return null

  // 1. Identify sheet metadata from SheetName and top header rows
  let academic_year = '2026-27'
  let semester = 'II Year I Semester'
  let branch = ''
  let effective_from = ''

  // Extract from sheetName first as fallback
  const sheetYearMatch = sheetName.match(/^(I{1,3}|IV)/i)
  if (sheetYearMatch) {
    const y = sheetYearMatch[1].toUpperCase()
    if (y === 'IV') semester = 'IV Year I Semester'
    else if (y === 'III') semester = 'III Year I Semester'
    else if (y === 'II') semester = 'II Year I Semester'
    else if (y === 'I') semester = 'I Year I Semester'
  }

  // Scan top 15 rows for metadata
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const text = (rows[r] || []).map(cleanStr).join(' ')
    if (!text) continue

    const ayMatch = text.match(/A\.?Y\.?\s*[:\-]?\s*([0-9]{4}\s*[-/]\s*[0-9]{2,4})/i)
    if (ayMatch) academic_year = ayMatch[1].replace(/\s+/g, '')

    const wefMatch = text.match(/w\.?e\.?f\s*[:\-]?\s*([0-9]{1,2}[-/.]\s*[0-9]{1,2}[-/.]\s*[0-9]{2,4})/i)
    if (wefMatch) effective_from = formatExcelDate(wefMatch[1])

    const secMatch = text.match(/Section\s*[:\-]?\s*([A-Za-z0-9]+)/i)

    if (text.match(/IV\s+Year/i)) semester = 'IV Year I Semester'
    else if (text.match(/III\s+Year/i)) semester = 'III Year I Semester'
    else if (text.match(/II\s+Year/i)) semester = 'II Year I Semester'
    else if (text.match(/I\s+Year/i)) semester = 'I Year I Semester'

    if (text.match(/II\s+Sem/i)) semester = semester.replace('I Semester', 'II Semester')

    if (text.includes('B.Tech DS') || text.includes('DATA SCIENCE') || (text.includes('DS') && text.includes('Semester'))) {
      if (secMatch) branch = `DS Section ${secMatch[1]}`
      else if (!branch) branch = 'DS'
    } else if (text.includes('CSBS') || sheetName.includes('CSBS')) {
      if (secMatch) branch = `CSBS Section ${secMatch[1]}`
      else if (!branch) branch = 'CSBS'
    }
  }

  if (!branch) {
    if (sheetName.includes('CSBS')) branch = 'CSBS'
    else {
      const dsMatch = sheetName.match(/DS-?([A-Za-z0-9]+)/i)
      if (dsMatch) branch = `DS Section ${dsMatch[1]}`
      else branch = sheetName
    }
  }

  // 2. Find DAY header row and Time / Period rows
  let dayHeaderRowIdx = -1
  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const row = rows[r] || []
    if (row.some((c) => cleanStr(c).match(/^DAY\b|^DAY\s*[\/\-]/i))) {
      dayHeaderRowIdx = r
      break
    }
  }

  // If not found by DAY header, find by first MONDAY cell in col 0 or col 1
  if (dayHeaderRowIdx === -1) {
    for (let r = 0; r < Math.min(25, rows.length); r++) {
      const row = rows[r] || []
      if (cleanStr(row[0]).match(/^MONDAY/i) || cleanStr(row[1]).match(/^MONDAY/i)) {
        dayHeaderRowIdx = r - 1
        break
      }
    }
  }

  if (dayHeaderRowIdx === -1) return null

  // Determine timeRow and periodRow
  let timeRow = rows[dayHeaderRowIdx] || []
  let periodNumRow = rows[dayHeaderRowIdx - 1] || []

  // Check if dayHeaderRowIdx actually has period numbers and next row has times
  if (timeRow.some((c) => typeof c === 'number' && c >= 1 && c <= 8)) {
    periodNumRow = timeRow
    timeRow = rows[dayHeaderRowIdx + 1] || []
    dayHeaderRowIdx = dayHeaderRowIdx + 1
  }

  // Detect time columns dynamically
  const timeSlots = []
  let lunchSlot = null
  let pCounter = 1

  for (let c = 1; c < timeRow.length; c++) {
    const rawVal = cleanStr(timeRow[c])
    const numVal = periodNumRow[c]

    if (rawVal.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)) {
      const parsedTime = parseTime24(rawVal)
      const isLunchTime =
        cleanStr(numVal).toUpperCase().includes('LUNCH') ||
        rawVal.toUpperCase().includes('LUNCH') ||
        ((numVal === null || numVal === undefined || numVal === '') &&
          (rawVal.includes('11:30') || rawVal.includes('12:20') || rawVal.includes('12:45') || rawVal.includes('1:00')))

      if (isLunchTime && !lunchSlot) {
        lunchSlot = { col: c, time: parsedTime }
      } else {
        const periodNum = typeof numVal === 'number' ? numVal : pCounter++
        timeSlots.push({ period: periodNum, col: c, time: parsedTime })
      }
    }
  }

  if (timeSlots.length === 0) return null

  const working_hours = {
    periods: timeSlots.map((p) => ({ period: p.period, time: p.time })),
    lunch: lunchSlot ? lunchSlot.time : '11:30-12:10',
  }

  // 3. Find Room Columns (Theory / Lab / Coordinators)
  let theoryCol = -1
  let labCol = -1

  for (let c = 0; c < timeRow.length; c++) {
    const h1 = cleanStr(timeRow[c]).toUpperCase()
    const h2 = cleanStr(periodNumRow[c]).toUpperCase()
    if (h1.includes('THEORY') || h2.includes('THEORY')) theoryCol = c
    if (h1.includes('LAB') || h2.includes('LAB') || h1.includes('ROOM NO')) {
      if (h1.includes('THEORY')) theoryCol = c
      else if (labCol === -1) labCol = c
    }
  }

  const maxTimeCol = Math.max(...timeSlots.map((s) => s.col), lunchSlot ? lunchSlot.col : 0)
  if (theoryCol === -1) theoryCol = maxTimeCol + 1
  if (labCol === -1) labCol = maxTimeCol + 2

  // 4. Parse Days Timetable
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const timetable = {}
  const theoryRooms = {}
  const labRooms = {}
  let class_coordinator = ''
  let year_coordinator = ''

  for (let r = dayHeaderRowIdx + 1; r < Math.min(dayHeaderRowIdx + 12, rows.length); r++) {
    const row = rows[r] || []
    const col0 = cleanStr(row[0]).toUpperCase()
    const col1 = cleanStr(row[1]).toUpperCase()

    let matchedDay = daysOfWeek.find((d) => col0.startsWith(d.toUpperCase()) || col0 === d.slice(0, 3).toUpperCase())
    let dayColOffset = 0
    if (!matchedDay) {
      matchedDay = daysOfWeek.find((d) => col1.startsWith(d.toUpperCase()) || col1 === d.slice(0, 3).toUpperCase())
      if (matchedDay) dayColOffset = 1
    }
    if (!matchedDay) continue

    if (row[theoryCol] !== undefined && row[theoryCol] !== null && String(row[theoryCol]).trim() !== '') {
      theoryRooms[matchedDay] = cleanStr(row[theoryCol])
    }

    for (let c = labCol; c < row.length; c++) {
      if (row[c] !== undefined && row[c] !== null) {
        const cellText = String(row[c])
        const ccMatch = cellText.match(/Class Coordinator\s*[:\-]?\s*[\r\n]*\s*(.+)/i)
        if (ccMatch && !class_coordinator) class_coordinator = cleanStr(ccMatch[1])

        const ycMatch = cellText.match(/Year Coordinator\s*[:\-]?\s*[\r\n]*\s*(.+)/i)
        if (ycMatch && !year_coordinator) year_coordinator = cleanStr(ycMatch[1])

        const lines = cellText.split(/[\r\n]+/)
        for (const line of lines) {
          const cleaned = cleanStr(line)
          if (!cleaned.match(/Coordinator/i) && cleaned.includes(':')) {
            const [labName, labRoom] = cleaned.split(':').map(cleanStr)
            if (labName && labRoom) {
              labRooms[labName] = labRoom
            }
          }
        }
      }
    }

    const sessions = []
    const orderedSlots = [...timeSlots]
    if (lunchSlot) {
      orderedSlots.push({ period: 'LUNCH', col: lunchSlot.col, time: lunchSlot.time })
    }
    orderedSlots.sort((a, b) => a.col - b.col)

    let idx = 0
    while (idx < orderedSlots.length) {
      const slot = orderedSlots[idx]
      if (slot.period === 'LUNCH') {
        sessions.push({
          time: slot.time,
          subject: 'LUNCH',
        })
        idx++
        continue
      }

      const cellVal = cleanStr(row[slot.col + dayColOffset])
      if (cellVal) {
        let span = 1
        while (
          idx + span < orderedSlots.length &&
          orderedSlots[idx + span].period !== 'LUNCH' &&
          (!cleanStr(row[orderedSlots[idx + span].col + dayColOffset]) ||
            cleanStr(row[orderedSlots[idx + span].col + dayColOffset]) === cellVal)
        ) {
          span++
        }

        const startSlot = orderedSlots[idx]
        const endSlot = orderedSlots[idx + span - 1]
        const startTime = startSlot.time.split('-')[0]
        const endTime = endSlot.time.split('-')[1]

        const periods = []
        for (let k = 0; k < span; k++) {
          periods.push(orderedSlots[idx + k].period)
        }

        sessions.push({
          time: `${startTime}-${endTime}`,
          periods,
          subject: cellVal,
        })

        idx += span
      } else {
        idx++
      }
    }

    timetable[matchedDay] = sessions
  }

  // 5. Courses Table & Almanac Table
  let courseHeaderRowIdx = -1
  for (let r = dayHeaderRowIdx + 5; r < rows.length; r++) {
    const row = rows[r] || []
    if (row.some((c) => cleanStr(c).match(/Course Code/i))) {
      courseHeaderRowIdx = r
      break
    }
  }

  const courses = []
  const academic_calendar = []

  if (courseHeaderRowIdx !== -1) {
    const courseHeaderRow = rows[courseHeaderRowIdx] || []
    let facultyCol = -1
    let almanacCol = -1

    for (let c = 0; c < courseHeaderRow.length; c++) {
      const h = cleanStr(courseHeaderRow[c]).toUpperCase()
      if (h.includes('FACULTY')) facultyCol = c
      if (h.includes('ALMANAC') || h.includes('ACADEMIC')) almanacCol = c
    }

    if (facultyCol === -1) facultyCol = 4
    if (almanacCol === -1) almanacCol = 6

    for (let r = courseHeaderRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] || []
      const code = cleanStr(row[0])
      const shortform = cleanStr(row[1])
      const courseName = cleanStr(row[2])
      const facultyVal = row[facultyCol]

      if (code && shortform && !code.match(/TIME TABLE|HOD|DAA/i)) {
        const parsedFac = parseFaculty(facultyVal)
        courses.push({
          course_code: code,
          shortform,
          course_name: courseName,
          ...(parsedFac || {}),
        })
      }

      const eventName = cleanStr(row[almanacCol])
      let dateVal = null
      for (let c = almanacCol + 1; c < row.length; c++) {
        if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') {
          dateVal = row[c]
          break
        }
      }

      if (eventName && !eventName.match(/TIME TABLE|HOD|DAA|COORDINATOR/i)) {
        const formattedDate = formatExcelDate(dateVal)
        if (formattedDate) {
          const rangeMatch = formattedDate.match(/^(\d{2}-\d{2}-\d{4})\s+to\s+(\d{2}-\d{2}-\d{4})(?:\s*\((.*?)\))?/i)
          if (rangeMatch) {
            academic_calendar.push({
              event: eventName,
              start_date: rangeMatch[1],
              end_date: rangeMatch[2],
              ...(rangeMatch[3] ? { duration: rangeMatch[3].trim() } : {}),
            })
          } else if (eventName.match(/Submission.*before/i) || eventName.match(/deadline/i)) {
            academic_calendar.push({
              event: eventName,
              deadline: formattedDate,
            })
          } else {
            academic_calendar.push({
              event: eventName,
              date: formattedDate,
            })
          }
        }
      }
    }
  }

  return {
    academic_year,
    semester,
    branch,
    effective_from: effective_from || '06-08-2026',
    classroom: {
      theory: theoryRooms,
      labs: labRooms,
      class_coordinator: class_coordinator || null,
      year_coordinator: year_coordinator || null,
    },
    working_hours,
    timetable,
    courses,
    academic_calendar,
  }
}

export function convertTimetableWorkbook(workbook) {
  const result = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const classData = parseTimetableSheet(sheet, sheetName)
    if (classData && Object.keys(classData.timetable).length > 0) {
      result.push(classData)
    }
  }
  return result
}
