import { ConvexError } from 'convex/values'

export function assertNonNegativeIntCents(
  value: number,
  label = 'Сумата',
): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new ConvexError(`${label} трябва да е цяло число ≥ 0.`)
  }
  return value
}

export function assertPositiveIntCents(
  value: number,
  label = 'Сумата',
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ConvexError(`${label} трябва да е положително цяло число.`)
  }
  return value
}

export function assertPositiveQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new ConvexError('Количеството трябва да е поне 1.')
  }
  return value
}
