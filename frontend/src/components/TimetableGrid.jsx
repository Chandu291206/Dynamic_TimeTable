import { useEffect, useState } from 'react'
import TimetableCell from './TimetableCell.jsx'

function timeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return -1
  const [h, m] = timeStr.split(':').map((n) => parseInt(n, 10))
  return h * 60 + m
}

export default function TimetableGrid({ slots, onOpen, isToday = false }) {
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })

  // Update current time every minute so the "NOW" badge is dynamic
  useEffect(() => {
    if (!isToday) return
    const interval = setInterval(() => {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }, 60000)
    return () => clearInterval(interval)
  }, [isToday])

  return (
    <div className="timetable-grid-wrapper">
      <section className="timetable-grid" aria-label="Class schedule">
        <div className="ruler-heading" aria-hidden="true">Time</div>
        <div className="slots-heading" aria-hidden="true">Scheduled sessions</div>
        {slots.map((slot, index) => {
          const startMin = timeToMinutes(slot.startTime)
          const endMin = timeToMinutes(slot.endTime)
          const isCurrent = isToday && startMin !== -1 && endMin !== -1 && currentMinutes >= startMin && currentMinutes < endMin

          return (
            <div
              className={`timetable-row ${isCurrent ? 'timetable-row--current' : ''}`}
              key={`${slot.id}-${slot.startTime}-${index}`}
            >
              <div className="time-ruler">
                <b>{slot.startTime}</b>
                <span>{slot.endTime}</span>
                {isCurrent && <span className="ruler-live-dot" title="Active session" aria-hidden="true" />}
              </div>
              <TimetableCell slot={slot} onOpen={onOpen} isCurrent={isCurrent} />
            </div>
          )
        })}
      </section>
    </div>
  )
}
