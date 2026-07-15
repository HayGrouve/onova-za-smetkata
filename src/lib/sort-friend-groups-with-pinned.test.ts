import { describe, expect, it } from 'vitest'
import { sortFriendGroupsWithPinned } from './sort-friend-groups-with-pinned'

const groups = [
  { _id: 'a', name: 'Alpha' },
  { _id: 'b', name: 'Beta' },
  { _id: 'c', name: 'Gamma' },
]

describe('sortFriendGroupsWithPinned', () => {
  it('returns original order when pinnedId is null', () => {
    expect(sortFriendGroupsWithPinned(groups, null)).toEqual({
      groups,
      pinnedId: null,
    })
  })

  it('moves pinned group to front', () => {
    expect(sortFriendGroupsWithPinned(groups, 'c')).toEqual({
      groups: [
        { _id: 'c', name: 'Gamma' },
        { _id: 'a', name: 'Alpha' },
        { _id: 'b', name: 'Beta' },
      ],
      pinnedId: 'c',
    })
  })

  it('ignores invalid pinned id', () => {
    expect(sortFriendGroupsWithPinned(groups, 'missing')).toEqual({
      groups,
      pinnedId: null,
    })
  })

  it('keeps order when pinned is already first', () => {
    expect(sortFriendGroupsWithPinned(groups, 'a')).toEqual({
      groups,
      pinnedId: 'a',
    })
  })
})
