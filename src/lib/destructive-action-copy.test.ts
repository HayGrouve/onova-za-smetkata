import { describe, expect, it } from 'vitest'
import {
  getBillDeleteCopy,
  getClaimUnassignCopy,
  getFriendGroupDeleteCopy,
  getFriendGroupMemberRemoveCopy,
  getItemDeleteCopy,
  getParticipantRemoveCopy,
  getClearAllGuestsCopy,
  getPaymentUndoCopy,
  getSignOutCopy,
} from './destructive-action-copy'

describe('destructive-action-copy', () => {
  it('bill delete has irreversible warning', () => {
    const copy = getBillDeleteCopy()
    expect(copy.title).toBe('Изтриване на сметка?')
    expect(copy.description).toContain('необратимо')
    expect(copy.confirmLabel).toBe('Изтрий сметката')
  })

  it('interpolates item name', () => {
    expect(getItemDeleteCopy('Салата').description).toContain('Салата')
  })

  it('interpolates participant name', () => {
    expect(getParticipantRemoveCopy('Иван').description).toContain('Иван')
  })

  it('clear all guests copy mentions guest count', () => {
    const copy = getClearAllGuestsCopy(3)
    expect(copy.title).toBe('Изчистване на всички гости?')
    expect(copy.description).toContain('3 госта')
    expect(copy.confirmLabel).toBe('Изчисти всички')
  })

  it('interpolates friend group name', () => {
    expect(getFriendGroupDeleteCopy('Колеги').description).toContain('Колеги')
  })

  it('interpolates friend group member name', () => {
    expect(getFriendGroupMemberRemoveCopy('Мария').description).toContain(
      'Мария',
    )
  })

  it('interpolates claim line name', () => {
    expect(getClaimUnassignCopy('Бира').description).toContain('Бира')
  })

  it('payment undo copy is non-empty', () => {
    const copy = getPaymentUndoCopy()
    expect(copy.title.length).toBeGreaterThan(0)
    expect(copy.confirmLabel).toBe('Отмени плащането')
  })

  it('sign out copy is non-empty', () => {
    const copy = getSignOutCopy()
    expect(copy.title).toBe('Изход от профила?')
    expect(copy.confirmLabel).toBe('Изход')
  })
})
