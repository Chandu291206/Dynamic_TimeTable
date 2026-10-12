import { useCallback, useEffect, useState } from 'react'
import { getWeeklyTimetable } from '../api/public.js'

export default function useWeeklyTimetable(classId, date) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const [retryKey, setRetryKey] = useState(0)

  const retry = useCallback(() => setRetryKey((value) => value + 1), [])

  useEffect(() => {
    if (!classId) return
    const controller = new AbortController()
    setStatus('loading')

    getWeeklyTimetable(classId, date, { signal: controller.signal })
      .then((response) => {
        const payload = response?.data || response
        setData(payload)
        setStatus('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        const isNotFound = error.status === 404 || error.code === 'CLASS_NOT_FOUND' || error?.message?.includes('(404)')
        setStatus(isNotFound ? 'notFound' : 'error')
      })

    return () => controller.abort()
  }, [classId, date, retryKey])

  return { data, status, retry }
}
