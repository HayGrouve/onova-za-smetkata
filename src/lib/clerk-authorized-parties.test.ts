import { describe, expect, it } from 'vitest'
import { parseAuthorizedParties } from './clerk-authorized-parties.ts'

describe('parseAuthorizedParties', () => {
  it('is undefined when the env is unset or blank, so SSR skips the check', () => {
    expect(parseAuthorizedParties(undefined)).toBeUndefined()
    expect(parseAuthorizedParties('')).toBeUndefined()
    expect(parseAuthorizedParties(' , ')).toBeUndefined()
  })

  it('splits a comma separated list and trims each origin', () => {
    expect(
      parseAuthorizedParties(
        ' https://smetkata.onovaza.com/ , http://localhost:3000',
      ),
    ).toEqual(['https://smetkata.onovaza.com', 'http://localhost:3000'])
  })
})
