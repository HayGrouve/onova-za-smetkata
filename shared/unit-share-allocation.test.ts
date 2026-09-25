import { describe, expect, it } from 'vitest'
import {
  splitLineTotal,
  splitUnitShareAmongAssignees,
} from './unit-share-allocation'

describe('splitLineTotal', () => {
  it('assigns full amount to one person', () => {
    expect(splitLineTotal(1000, ['a'])).toEqual([{ id: 'a', cents: 1000 }])
  })

  it('splits evenly with remainder to first participants', () => {
    expect(splitLineTotal(100, ['a', 'b', 'c'])).toEqual([
      { id: 'a', cents: 34 },
      { id: 'b', cents: 33 },
      { id: 'c', cents: 33 },
    ])
  })
})

describe('splitUnitShareAmongAssignees', () => {
  it('orders assignees by participant sortOrder, not lexicographic id', () => {
    const participants = [
      { id: 'id_bbb', sortOrder: 0 },
      { id: 'id_aaa', sortOrder: 1 },
      { id: 'id_ccc', sortOrder: 2 },
    ]

    expect(
      splitUnitShareAmongAssignees(
        1000,
        ['id_aaa', 'id_bbb', 'id_ccc'],
        participants,
      ),
    ).toEqual([
      { id: 'id_bbb', cents: 334 },
      { id: 'id_aaa', cents: 333 },
      { id: 'id_ccc', cents: 333 },
    ])
  })
})
