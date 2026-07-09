import { describe, expect, it } from 'vitest'
import {
  dedupeMemberNames,
  formatFriendGroupErrors,
  parseFriendGroupInput,
  summarizeAddMembersToBill,
} from './friend-group-schema'

describe('parseFriendGroupInput', () => {
  it('accepts a valid group', () => {
    const result = parseFriendGroupInput({
      name: 'Работа обяд',
      memberNames: ['Иван', 'Мария'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.memberNames).toEqual(['Иван', 'Мария'])
    }
  })

  it('rejects empty group name', () => {
    const result = parseFriendGroupInput({ name: '  ', memberNames: ['Иван'] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(formatFriendGroupErrors(result.error).name).toBeTruthy()
    }
  })

  it('rejects duplicate member names', () => {
    const result = parseFriendGroupInput({
      name: 'Група',
      memberNames: ['Иван', 'иван'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(formatFriendGroupErrors(result.error).memberNameAt?.[1]).toBeTruthy()
    }
  })
})

describe('dedupeMemberNames', () => {
  it('trims and removes case-insensitive duplicates', () => {
    expect(dedupeMemberNames([' Иван ', 'иван', 'Мария'])).toEqual([
      'Иван',
      'Мария',
    ])
  })
})

describe('summarizeAddMembersToBill', () => {
  it('reports all skipped', () => {
    expect(summarizeAddMembersToBill({ added: 0, skipped: 3 })).toBe(
      'Всички от групата вече са добавени',
    )
  })

  it('reports mixed result', () => {
    expect(summarizeAddMembersToBill({ added: 2, skipped: 1 })).toBe(
      'Добавени 2 · 1 вече на сметката',
    )
  })
})
