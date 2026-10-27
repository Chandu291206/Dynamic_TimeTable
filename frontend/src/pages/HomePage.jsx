import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getClasses } from '../api/public.js'

export default function HomePage() {
  const [classCount, setClassCount] = useState(0)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()
    getClasses({ signal: controller.signal })
      .then((resData) => {
        const availableClasses = Array.isArray(resData) ? resData : (Array.isArray(resData?.data) ? resData.data : [])
        setClassCount(availableClasses.length)
        setStatus('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('ready')
      })
    return () => controller.abort()
  }, [])

  return (
    <section className="home" aria-labelledby="welcome-heading">
      <div className="home-inner">
        <p className="kicker">GRIET · Academic rhythm</p>
        <h1 id="welcome-heading">
          Your day, <em>on time.</em>
        </h1>
        <p className="lede">
          A clear view of the timetable for the class you belong to—built for focused mornings, smoother transitions, and fewer missed periods.
        </p>

        <div className="selector-panel selector-panel--cta">
          <div className="home-cta-info">
            <span className="field-label">Institutional Timetable Directory</span>
            <p className="field-desc">
              Browse schedules across all academic years, branches, and sections in the timetable matrix.
            </p>
            {status === 'ready' && classCount > 0 && (
              <span className="home-active-pill">
                ● {classCount} published {classCount === 1 ? 'class' : 'classes'} available
              </span>
            )}
          </div>
          <Link className="button button--cta" to="/timetables">
            View all timetables <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="fact-strip" aria-label="Service highlights">
          <span><b>01</b> Live class list</span>
          <span><b>02</b> Daily & weekly view</span>
          <span><b>03</b> Verified faculty profiles</span>
        </div>
      </div>
    </section>
  )
}
