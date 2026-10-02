import { describe, expect, it } from 'vitest'
import { diffActivity } from './bill-activity.ts'
import type { ActivitySnapshot } from './bill-activity.ts'

const names: Record<string, string> = { a: 'Деси', b: 'Явор', c: 'Мила' }
const labelOf = (id: string) => names[id] ?? id

function snapshot(overrides: Partial<ActivitySnapshot> = {}): ActivitySnapshot {
  return {
    unitMembers: new Map(),
    itemNames: new Map([
      ['i1', 'Шопска салата'],
      ['i2', 'Бира'],
    ]),
    activeSeatIds: new Set(),
    paidCents: new Map(),
    ...overrides,
  }
}

describe('diffActivity', () => {
  it('reports a seat taking a Unit', () => {
    const events = diffActivity(
      snapshot(),
      snapshot({ unitMembers: new Map([['i1:0', ['a']]]) }),
      labelOf,
      1,
    )
    expect(events.map((e) => e.text)).toEqual(['Деси взе Шопска салата'])
  })

  it('reports a Shared Unit once, naming everyone on it', () => {
    const events = diffActivity(
      snapshot({ unitMembers: new Map([['i2:1', ['a']]]) }),
      snapshot({ unitMembers: new Map([['i2:1', ['a', 'b']]]) }),
      labelOf,
      1,
    )
    expect(events.map((e) => e.text)).toEqual(['Деси и Явор делят Бира'])
    expect(events[0].kind).toBe('shared')
  })

  it('reports a returned Unit but not one deleted with its line', () => {
    const prev = snapshot({
      unitMembers: new Map([
        ['i1:0', ['a']],
        ['i2:0', ['b']],
      ]),
    })
    const next = snapshot({
      itemNames: new Map([['i1', 'Шопска салата']]),
      unitMembers: new Map(),
    })
    expect(diffActivity(prev, next, labelOf, 1).map((e) => e.text)).toEqual([
      'Деси върна Шопска салата',
    ])
  })

  it('reports joins and payments', () => {
    const events = diffActivity(
      snapshot({ paidCents: new Map([['b', 0]]) }),
      snapshot({
        activeSeatIds: new Set(['c']),
        paidCents: new Map([['b', 1240]]),
      }),
      labelOf,
      1,
    )
    expect(events.map((e) => e.kind)).toEqual(['joined', 'paid'])
    expect(events.map((e) => e.text)).toEqual([
      'Мила седна на масата',
      'Явор: платено',
    ])
  })

  it('is quiet when nothing changed', () => {
    const same = snapshot({ unitMembers: new Map([['i1:0', ['a']]]) })
    expect(diffActivity(same, same, labelOf, 1)).toEqual([])
  })
})
