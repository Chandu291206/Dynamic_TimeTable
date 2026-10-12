import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { getClasses } from '../api/public.js'

export default function HomePage() {
  const [classes, setClasses] = useState([])
  const [selected, setSelected] = useState('')
  const [status, setStatus] = useState('loading')
  const [retryKey, setRetryKey] = useState(0)
  const id = useId()

  const retry = useCallback(() => setRetryKey((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getClasses({ signal: controller.signal })
      .then((resData) => {
        const availableClasses = Array.isArray(resData) ? resData : (Array.isArray(resData?.data) ? resData.data : [])
        setClasses(availableClasses)
        setStatus(availableClasses.length ? 'ready' : 'empty')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })
    return () => controller.abort()
  }, [retryKey])

  const message = status === 'loading' ? 'Finding available classes…' : status === 'empty' ? 'No published classes yet. Please check back shortly.' : status === 'error' ? 'Classes could not be loaded. Check that the API is running and try again.' : 'Select your class to see today’s schedule.'
  return <section className="home" aria-labelledby="welcome-heading"><div className="home-inner"><p className="kicker">GRIET · Academic rhythm</p><h1 id="welcome-heading">Your day, <em>on time.</em></h1><p className="lede">A clear view of the timetable for the class you belong to—built for focused mornings, smoother transitions, and fewer missed periods.</p>
    <div className="selector-panel"><div><label className="field-label" htmlFor={id}>Choose your class</label><select className="class-select" id={id} value={selected} disabled={status !== 'ready'} onChange={(event) => setSelected(event.target.value)}><option value="">{status === 'loading' ? 'Loading classes…' : 'Select a class'}</option>{classes.map((classRoom) => <option key={classRoom.id} value={classRoom.id}>{classRoom.label}</option>)}</select></div><Link className="button" to={selected ? `/timetable/${selected}` : '#'} aria-disabled={!selected} onClick={(event) => { if (!selected) event.preventDefault() }}>View timetable <span aria-hidden="true">→</span></Link><div><p className={`field-note ${status === 'error' ? 'error' : ''}`} role={status === 'error' ? 'alert' : 'status'}>{message}</p>{status === 'error' && <button className="text-button" type="button" onClick={retry}>Try again</button>}</div></div>
    <div className="fact-strip" aria-label="Service highlights"><span><b>01</b> Live class list</span><span><b>02</b> Daily view</span><span><b>03</b> CR updates</span></div>
  </div></section>
}
