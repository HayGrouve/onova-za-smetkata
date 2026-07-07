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
