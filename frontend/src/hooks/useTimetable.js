import { useCallback, useEffect, useState } from 'react'
import { getTimetable } from '../api/public.js'

export default function useTimetable(classId, date) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const [retryKey, setRetryKey] = useState(0)

  const retry = useCallback(() => setRetryKey((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setData(null)

    getTimetable(classId, date, { signal: controller.signal })
      .then((response) => {
        setData(response?.data?.slots ? response.data : response)
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
