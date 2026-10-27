/**
 * Room utilities for academic timetable.
 *
 * Requirements:
 * 1. Default theory room number is generally only one (the primary/majority room).
 * 2. Keep multiple room numbers unchanged ONLY if they are explicitly listed as theory rooms (e.g. "1302 / 1303" string).
 * 3. Daily room variations and lab allocations are parsed for display below academic schedule.
 */

export function parseTheoryRoomInfo(theory, fallback = 'TBA') {
  if (!theory) {
    return {
      defaultRoom: fallback,
      rawRoom: fallback,
      dayVariations: [],
      isExplicitMultiRoom: false,
    }
  }

  // If theory is an explicit string
  if (typeof theory === 'string') {
    const trimmed = theory.trim()
    if (!trimmed) {
      return {
        defaultRoom: fallback,
        rawRoom: fallback,
        dayVariations: [],
        isExplicitMultiRoom: false,
      }
    }

    // If explicitly listed with slash/comma as theory rooms (e.g., "1302 / 1303"),
    // keep them unchanged as they are explicitly listed as theory rooms.
    const isExplicitMultiRoom = trimmed.includes('/') || trimmed.includes(',')

    const formatted = trimmed.startsWith('Room') ? trimmed : `Room ${trimmed}`
    return {
      defaultRoom: formatted,
      rawRoom: trimmed,
      dayVariations: [],
      isExplicitMultiRoom,
    }
  }

  // If theory is a day-by-day mapping object:
  // e.g. { Monday: "2409", Tuesday: "2203", Wednesday: "2203", Thursday: "2203", Friday: "2203", Saturday: "2203" }
  if (typeof theory === 'object') {
    const entries = Object.entries(theory)
    const counts = {}

    for (const [_, rm] of entries) {
      if (!rm) continue
      const cleaned = String(rm).trim()
      if (cleaned) {
        counts[cleaned] = (counts[cleaned] || 0) + 1
      }
    }

    const sortedRooms = Object.entries(counts).sort((a, b) => b[1] - a[1])
    if (sortedRooms.length === 0) {
      return {
        defaultRoom: fallback,
        rawRoom: fallback,
        dayVariations: [],
        isExplicitMultiRoom: false,
      }
    }

    // Default theory room is the primary/most frequent theory room (e.g., 2203 used on 5 days)
    const primaryRoom = sortedRooms[0][0]
    const formattedDefault = primaryRoom.startsWith('Room') ? primaryRoom : `Room ${primaryRoom}`

    // Day variations: days where the room differs from the primary theory room
    const dayVariations = entries
      .filter(([_, rm]) => String(rm).trim() !== primaryRoom && Boolean(rm))
      .map(([day, rm]) => {
        const val = String(rm).trim()
        return {
          day,
          room: val.startsWith('Room') ? val : `Room ${val}`,
          rawRoom: val,
        }
      })

    return {
      defaultRoom: formattedDefault,
      rawRoom: primaryRoom,
      dayVariations,
      isExplicitMultiRoom: false,
    }
  }

  const str = String(theory).trim()
  return {
    defaultRoom: str.startsWith('Room') ? str : `Room ${str}`,
    rawRoom: str,
    dayVariations: [],
    isExplicitMultiRoom: false,
  }
}

/**
 * Returns single default theory room for cards and brief labels.
 * E.g. "Room 2203" instead of "Room 2203 / 2409 / 2401"
 */
export function formatDefaultTheoryRoom(theory, fallback = '') {
  const info = parseTheoryRoomInfo(theory, fallback)
  return info.defaultRoom || fallback
}
