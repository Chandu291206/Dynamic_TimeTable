const DEFAULT_CLASS_KEY = 'tt_default_class_id'

export function getDefaultClassId() {
  try {
    return localStorage.getItem(DEFAULT_CLASS_KEY) || null
  } catch {
    return null
  }
}

export function setDefaultClassId(classId) {
  try {
    if (classId) {
      localStorage.setItem(DEFAULT_CLASS_KEY, String(classId))
    } else {
      localStorage.removeItem(DEFAULT_CLASS_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearDefaultClassId() {
  try {
    localStorage.removeItem(DEFAULT_CLASS_KEY)
  } catch {
    // Ignore storage errors
  }
}
