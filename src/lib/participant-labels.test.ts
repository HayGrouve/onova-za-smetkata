import { describe, expect, it } from 'vitest'
import { buildParticipantLabels } from './participant-labels'

describe('buildParticipantLabels', () => {
  it('uses plain names when there are no duplicates', () => {
    const labels = buildParticipantLabels([
      { _id: 'a', name: 'Иван', sortOrder: 0 },
      { _id: 'b', name: 'Мария', sortOrder: 1 },
    ])
    expect(labels).toEqual({ a: 'Иван', b: 'Мария' })
  })

  it('disambiguates duplicate names in sortOrder order', () => {
    const labels = buildParticipantLabels([
      { _id: 'b', name: 'Иван', sortOrder: 1 },
      { _id: 'a', name: 'Иван', sortOrder: 0 },
      { _id: 'c', name: 'Иван', sortOrder: 2 },
    ])
    expect(labels).toEqual({
      a: 'Иван',
      b: 'Иван (2)',
      c: 'Иван (3)',
    })
  })

  it('handles a mix of duplicate and unique names', () => {
    const labels = buildParticipantLabels([
      { _id: 'a', name: 'Георги', sortOrder: 0 },
      { _id: 'b', name: 'Иван', sortOrder: 1 },
      { _id: 'c', name: 'Иван', sortOrder: 2 },
    ])
    expect(labels).toEqual({
      a: 'Георги',
      b: 'Иван',
      c: 'Иван (2)',
    })
  })

  it('returns an empty object for no participants', () => {
    expect(buildParticipantLabels([])).toEqual({})
  })
})
