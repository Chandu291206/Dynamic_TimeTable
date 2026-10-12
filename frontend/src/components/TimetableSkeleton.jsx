export default function TimetableSkeleton({ rows = 5 }) {
  return (
    <div className="timetable-skeleton" aria-label="Loading timetable schedule..." role="status">
      <div className="timetable-grid-wrapper">
        <section className="timetable-grid">
          <div className="ruler-heading" aria-hidden="true">Time</div>
          <div className="slots-heading" aria-hidden="true">Scheduled sessions</div>
          {Array.from({ length: rows }).map((_, i) => (
            <div className="timetable-row timetable-skeleton-row" key={i}>
              <div className="time-ruler">
                <div className="skeleton-box skeleton-box--time" />
                <div className="skeleton-box skeleton-box--subtime" />
              </div>
              <div className="timetable-cell timetable-skeleton-cell">
                <div className="skeleton-box skeleton-box--title" />
                <div className="skeleton-box-group">
                  <div className="skeleton-box skeleton-box--avatar" />
                  <div className="skeleton-box skeleton-box--faculty" />
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
