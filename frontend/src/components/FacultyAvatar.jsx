import { useState, useEffect } from 'react'
import { apiUrl } from '../api/client.js'

function initials(name) {
  return (name || 'TBA')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function FacultyAvatar({ faculty, size = 'small' }) {
  const [imgError, setImgError] = useState(false)

  // Route through HTTPS backend proxy to bypass browser mixed-content & unverified TLS certificate blocks
  let imageSrc = null
  if (faculty?.id) {
    imageSrc = apiUrl(`/api/faculty/${faculty.id}/image`)
  } else if (faculty?.imageSourceUrl || faculty?.imageUrl) {
    const rawUrl = faculty.imageSourceUrl || faculty.imageUrl
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      imageSrc = apiUrl(`/api/faculty-image-proxy?url=${encodeURIComponent(rawUrl)}`)
    } else {
      imageSrc = apiUrl(rawUrl)
    }
  }

  useEffect(() => {
    setImgError(false)
  }, [imageSrc])

  if (imageSrc && !imgError) {
    return (
      <img
        className={`faculty-avatar faculty-avatar--${size}`}
        src={imageSrc}
        alt={faculty?.name ? `${faculty.name} avatar` : ''}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        loading="lazy"
      />
    )
  }

  return (
    <span
      className={`faculty-avatar faculty-avatar--${size} faculty-avatar--initials`}
      aria-hidden="true"
      title={faculty?.name || 'Faculty profile'}
    >
      {initials(faculty?.name)}
    </span>
  )
}
