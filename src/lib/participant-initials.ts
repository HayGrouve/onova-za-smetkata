/**
 * Avatar initials for Participant labels that stay unique within one bill —
 * „test“ / „test2“ become TT / T2 instead of two identical „T“ circles.
 */
export function buildParticipantInitials(
  labels: Record<string, string>,
): Record<string, string> {
  const entries = Object.entries(labels).map(([id, label]) => ({
    id,
    chars: significantChars(label),
    words: label
      .split(/\s+/)
      .map(significantChars)
      .filter((word) => word.length > 0),
  }))

  const result: Record<string, string> = {}
  for (const entry of entries) {
    const first = entry.words[0]?.[0]
    const last =
      entry.words.length > 1 ? entry.words[entry.words.length - 1][0] : ''
    result[entry.id] = first ? (first + last).toUpperCase() : '?'
  }

  for (const ids of groupByValue(result)) {
    if (ids.length < 2) continue
    const group = new Set(ids)
    const taken = new Set(
      Object.entries(result)
        .filter(([id]) => !group.has(id))
        .map(([, value]) => value),
    )
    ids.forEach((id, index) => {
      const chars = entries.find((entry) => entry.id === id)?.chars ?? []
      const first = (chars[0] ?? '?').toUpperCase()
      const lastChar = chars.length > 1 ? chars[chars.length - 1] : ''
      let candidate = (first + lastChar).toUpperCase()
      for (let n = index + 1; taken.has(candidate); n++) {
        candidate = `${first}${n}`
      }
      taken.add(candidate)
      result[id] = candidate
    })
  }

  return result
}

function significantChars(value: string): string[] {
  return [...value.normalize('NFC')].filter((char) =>
    /[\p{L}\p{N}]/u.test(char),
  )
}

function groupByValue(record: Record<string, string>): string[][] {
  const byValue = new Map<string, string[]>()
  for (const [id, value] of Object.entries(record)) {
    const list = byValue.get(value) ?? []
    list.push(id)
    byValue.set(value, list)
  }
  return [...byValue.values()]
}
