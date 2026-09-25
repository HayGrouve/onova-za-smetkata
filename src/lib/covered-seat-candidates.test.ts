import { describe, expect, it } from 'vitest'
import { buildCoveredSeatCandidates } from './covered-seat-candidates'

describe('buildCoveredSeatCandidates', () => {
  it('lists other guests and marks seats held by other phones', () => {
    expect(
      buildCoveredSeatCandidates({
        participants: [
          { _id: 'host', sortOrder: 0 },
          { _id: 'me', sortOrder: 1 },
          { _id: 'ani', sortOrder: 3 },
          { _id: 'petar', sortOrder: 2 },
          { _id: 'maria', sortOrder: 4 },
        ],
        hostParticipantId: 'host',
        ownParticipantId: 'me',
        takenSeats: new Map([
          ['ani', null],
          ['maria', 'ani'],
        ]),
        labels: { ani: 'Ани', petar: 'Петър', maria: 'Мария' },
      }),
    ).toEqual([
      { id: 'petar', label: 'Петър' },
      { id: 'ani', label: 'Ани', unavailableLabel: 'Заето' },
      { id: 'maria', label: 'Мария', unavailableLabel: 'с Ани' },
    ])
  })
})
