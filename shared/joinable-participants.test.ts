import { describe, expect, it } from 'vitest'
import { joinableParticipants } from './joinable-participants'

describe('joinableParticipants', () => {
  const participants = [
    { _id: 'host', sortOrder: 0, name: 'Цветомир' },
    { _id: 'guest-a', sortOrder: 1, name: 'Ани' },
    { _id: 'guest-b', sortOrder: 2, name: 'Борис' },
  ]

  it('omits the host participant when hostParticipantId is set', () => {
    expect(joinableParticipants(participants, 'host')).toEqual([
      { _id: 'guest-a', sortOrder: 1, name: 'Ани' },
      { _id: 'guest-b', sortOrder: 2, name: 'Борис' },
    ])
  })

  it('returns all participants when hostParticipantId is unset', () => {
    expect(joinableParticipants(participants, undefined)).toEqual(participants)
  })
})
