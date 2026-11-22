export const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function timeToMinutes(value) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return (hours * 60) + minutes
}

export function timesOverlap(first, second) {
  const firstStart = timeToMinutes(first.startTime)
  const firstEnd = timeToMinutes(first.endTime)
  const secondStart = timeToMinutes(second.startTime)
  const secondEnd = timeToMinutes(second.endTime)
  if ([firstStart, firstEnd, secondStart, secondEnd].some((time) => time === null)) return false
  return firstStart < secondEnd && firstEnd > secondStart
}
