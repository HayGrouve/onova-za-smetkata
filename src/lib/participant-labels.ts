export interface ParticipantForLabel {
  _id: string
  name: string
  sortOrder: number
}

export function buildParticipantLabels(
  participants: ParticipantForLabel[],
): Record<string, string> {
  const sorted = [...participants].sort((a, b) => a.sortOrder - b.sortOrder)
  const nameCounts = new Map<string, number>()
  const labels: Record<string, string> = {}
  for (const p of sorted) {
    const count = (nameCounts.get(p.name) ?? 0) + 1
    nameCounts.set(p.name, count)
    labels[p._id] = count > 1 ? `${p.name} (${count})` : p.name
  }
  return labels
}

/** „Ани“, „Ани и Петър“, „Ани, Петър и Мария“. */
export function joinLabels(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} и ${names[1]}`
  return `${names.slice(0, -1).join(', ')} и ${names.at(-1)}`
}
