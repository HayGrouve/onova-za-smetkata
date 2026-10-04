import { describe, expect, it } from 'vitest'
import {
  HOST_PARTICIPANT_SORT_ORDER,
  isHostParticipant,
  planHostParticipantOnBillCreate,
  shouldClearHostParticipantId,
} from './host-bill-participant'

describe('planHostParticipantOnBillCreate', () => {
  it('snapshots Auth name onto the Host seat', () => {
    expect(
      planHostParticipantOnBillCreate({
        authName: '  Google Name  ',
      }),
    ).toEqual({ name: 'Google Name', sortOrder: HOST_PARTICIPANT_SORT_ORDER })
  })

  it('falls back to домакин when Auth name is unset', () => {
    expect(planHostParticipantOnBillCreate({})).toEqual({
      name: 'домакин',
      sortOrder: HOST_PARTICIPANT_SORT_ORDER,
    })
  })
})

describe('shouldClearHostParticipantId', () => {
  it('clears when removing the linked host participant', () => {
    expect(
      shouldClearHostParticipantId('participant_host', 'participant_host'),
    ).toBe(true)
  })

  it('does not clear when removing a different participant', () => {
    expect(
      shouldClearHostParticipantId('participant_guest', 'participant_host'),
    ).toBe(false)
  })

  it('does not clear when the bill has no host link', () => {
    expect(shouldClearHostParticipantId('participant_guest', undefined)).toBe(
      false,
    )
  })
})

describe('isHostParticipant', () => {
  it('returns true when participant matches hostParticipantId', () => {
    expect(isHostParticipant('host', 'host')).toBe(true)
  })

  it('returns false for guests or when host link is unset', () => {
    expect(isHostParticipant('guest', 'host')).toBe(false)
    expect(isHostParticipant('host', undefined)).toBe(false)
  })
})
