/**
 * Per-user localStorage so SMS / pending pays don't leak across accounts on one phone.
 */

export function currentUserId() {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const u = JSON.parse(raw)
    return u?.id != null ? String(u.id) : null
  } catch {
    return null
  }
}

export function isLoggedIn() {
  return !!(localStorage.getItem('token') && currentUserId())
}

/** Storage key scoped to the logged-in user. */
export function userStorageKey(baseKey) {
  const id = currentUserId()
  if (!id) return `${baseKey}__anon`
  return `${baseKey}__u${id}`
}

/**
 * Read user-scoped value. One-time migrate from legacy unscoped key → current user.
 */
export function userGetItem(baseKey) {
  const key = userStorageKey(baseKey)
  let v = localStorage.getItem(key)
  if (v != null) return v

  const id = currentUserId()
  if (!id) return null

  // Migrate old shared key once into this user's bucket (then remove shared)
  const legacy = localStorage.getItem(baseKey)
  if (legacy != null) {
    try {
      localStorage.setItem(key, legacy)
      localStorage.removeItem(baseKey)
    } catch { /* ignore */ }
    return legacy
  }
  return null
}

export function userSetItem(baseKey, value) {
  localStorage.setItem(userStorageKey(baseKey), value)
}

export function userRemoveItem(baseKey) {
  localStorage.removeItem(userStorageKey(baseKey))
  // Also clear legacy unscoped if present
  try { localStorage.removeItem(baseKey) } catch { /* ignore */ }
}

export function userSessionGetItem(baseKey) {
  const key = userStorageKey(baseKey)
  try {
    let v = sessionStorage.getItem(key)
    if (v != null) return v
    const legacy = sessionStorage.getItem(baseKey)
    if (legacy != null && currentUserId()) {
      sessionStorage.setItem(key, legacy)
      sessionStorage.removeItem(baseKey)
      return legacy
    }
  } catch { /* ignore */ }
  return null
}

export function userSessionSetItem(baseKey, value) {
  try {
    sessionStorage.setItem(userStorageKey(baseKey), value)
  } catch { /* ignore */ }
}
