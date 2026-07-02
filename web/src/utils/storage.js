export function readStorage(key, fallback = null) {
  try {
    const storage = globalThis.localStorage
    const value = storage.getItem(key)
    return value ?? fallback
  } catch {
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    globalThis.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function readJsonStorage(key, fallback) {
  const value = readStorage(key, null)
  if (value === null) return fallback
  try {
    return JSON.parse(value) ?? fallback
  } catch {
    return fallback
  }
}

export function writeJsonStorage(key, value) {
  return writeStorage(key, JSON.stringify(value))
}

export function removeStorage(key) {
  try {
    globalThis.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function clearStorageByPrefix(prefix) {
  try {
    const storage = globalThis.localStorage
    const keys = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    keys.forEach(key => storage.removeItem(key))
    return keys.length
  } catch {
    return 0
  }
}
