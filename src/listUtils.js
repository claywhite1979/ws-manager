// Sort a list with a function that returns the value to sort by.
// Empty values always sort to the bottom, in either direction.
export function sortList(list, getValue, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1
  return [...list].sort((x, y) => {
    const a = getValue(x)
    const b = getValue(y)
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    if (typeof a === 'string' && typeof b === 'string') return sign * a.localeCompare(b)
    return sign * (a < b ? -1 : a > b ? 1 : 0)
  })
}

// Case-insensitive "contains" check for search boxes.
export function matchesSearch(text, query) {
  if (!query || !query.trim()) return true
  return (text || '').toLowerCase().includes(query.trim().toLowerCase())
}

// Whole nights between two YYYY-MM-DD dates.
export function nightsBetween(start, end) {
  if (!start || !end) return null
  const [y1, m1, d1] = start.split('-').map(Number)
  const [y2, m2, d2] = end.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}