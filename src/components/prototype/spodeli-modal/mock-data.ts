/**
 * PROTOTYPE mock — wipe with the branch.
 * Scenario: 3× water; mixed per-unit membership.
 */

export const ME_ID = 'me'
export const ME_LABEL = 'Ти'

export const MOCK_ITEM = {
  name: 'Вода',
  unitPriceCents: 150,
  quantity: 3,
} as const

export const MOCK_OTHERS = [
  { id: 'iva', label: 'Ива' },
  { id: 'petar', label: 'Петър' },
] as const

export type ParticipantId = typeof ME_ID | (typeof MOCK_OTHERS)[number]['id']

export const PARTICIPANT_LABELS: Record<ParticipantId, string> = {
  me: ME_LABEL,
  iva: 'Ива',
  petar: 'Петър',
}

/** unitIndex → participant ids currently on that unit */
export type UnitMembership = Record<number, ParticipantId[]>

export const INITIAL_MEMBERSHIP: UnitMembership = {
  0: ['iva'],
  1: [],
  2: ['me', 'petar'],
}
