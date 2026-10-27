import { useState } from 'react'

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
  const imageSrc = faculty?.imageSourceUrl || faculty?.imageUrl

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
