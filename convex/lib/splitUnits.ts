export function splitUnits(quantity: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(quantity / count)
  const remainder = quantity % count
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  )
}
