import { describe, expect, it } from 'vitest'
import {
  absoluteSiteUrl,
  buildJoinShareHead,
  buildOpenGraphMeta,
  DEFAULT_SITE_ORIGIN,
  JOIN_OG_DESCRIPTION,
  JOIN_OG_TITLE,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  resolveSiteOrigin,
  SITE_NAME,
} from './site-meta'

describe('resolveSiteOrigin', () => {
  it('uses fallback origin when env is unset', () => {
    expect(resolveSiteOrigin('https://preview.vercel.app')).toBe(
      'https://preview.vercel.app',
    )
  })

  it('falls back to default production origin', () => {
    expect(resolveSiteOrigin()).toBe(DEFAULT_SITE_ORIGIN)
  })
})

describe('buildOpenGraphMeta', () => {
  it('builds absolute og:image and og:url', () => {
    const tags = buildOpenGraphMeta({
      title: SITE_NAME,
      description: 'Test',
      path: '/',
      origin: 'https://example.com',
    })

    expect(tags).toEqual(
      expect.arrayContaining([
        { property: 'og:url', content: 'https://example.com/' },
        {
          property: 'og:image',
          content: `https://example.com${OG_IMAGE_PATH}`,
        },
        { property: 'og:image:width', content: String(OG_IMAGE_WIDTH) },
        { property: 'og:image:height', content: String(OG_IMAGE_HEIGHT) },
        { name: 'twitter:card', content: 'summary_large_image' },
      ]),
    )
  })
})

describe('buildJoinShareHead', () => {
  it('includes noindex and join-specific og:url', () => {
    const head = buildJoinShareHead('bill123', 'https://example.com')
    const meta = head.meta

    expect(head.title).toContain(JOIN_OG_TITLE)
    expect(meta).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow',
    })
    expect(meta).toContainEqual({
      property: 'og:url',
      content: 'https://example.com/bills/bill123/join',
    })
    expect(meta).toContainEqual({
      property: 'og:description',
      content: JOIN_OG_DESCRIPTION,
    })
  })
})

describe('absoluteSiteUrl', () => {
  it('joins origin and path', () => {
    expect(absoluteSiteUrl('/og-image.png', 'https://example.com')).toBe(
      'https://example.com/og-image.png',
    )
  })
})
