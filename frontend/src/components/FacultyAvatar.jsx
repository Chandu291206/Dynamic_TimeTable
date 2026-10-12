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

  if (faculty?.imageUrl && !imgError) {
    return (
      <img
        className={`faculty-avatar faculty-avatar--${size}`}
        src={faculty.imageUrl}
        alt=""
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
