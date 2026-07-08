export const SITE_NAME = 'Онова за сметката'

export const SITE_DESCRIPTION =
  'Мобилно приложение за разделяне на ресторантски сметки — добавяй участници, разпределяй артикули и следи плащанията.'

export const JOIN_OG_TITLE = 'Присъедини се към сметката'

export const JOIN_OG_DESCRIPTION =
  'Отвори линка, избери името си и отбележи какво си консумирал.'

export const DEFAULT_SITE_ORIGIN = 'https://onova-za-smetkata.com'

export const OG_IMAGE_PATH = '/og-image.png'
export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630

export type SiteMetaTag = {
  charSet?: string
  title?: string
  name?: string
  property?: string
  content?: string
}

export function resolveSiteOrigin(fallbackOrigin = ''): string {
  const fromEnv = import.meta.env.VITE_APP_ORIGIN?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, '')
  return DEFAULT_SITE_ORIGIN
}

export function absoluteSiteUrl(path: string, origin?: string): string {
  const base = (origin ?? resolveSiteOrigin()).replace(/\/$/, '')
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function robotsNoIndexMeta(): SiteMetaTag {
  return { name: 'robots', content: 'noindex, nofollow' }
}

export function buildOpenGraphMeta(options: {
  title: string
  description: string
  path?: string
  imagePath?: string
  origin?: string
}): SiteMetaTag[] {
  const origin = options.origin ?? resolveSiteOrigin()
  const pageUrl = absoluteSiteUrl(options.path ?? '/', origin)
  const imageUrl = absoluteSiteUrl(options.imagePath ?? OG_IMAGE_PATH, origin)

  return [
    { name: 'description', content: options.description },
    { property: 'og:title', content: options.title },
    { property: 'og:description', content: options.description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: pageUrl },
    { property: 'og:image', content: imageUrl },
    { property: 'og:image:width', content: String(OG_IMAGE_WIDTH) },
    { property: 'og:image:height', content: String(OG_IMAGE_HEIGHT) },
    { property: 'og:locale', content: 'bg_BG' },
    { property: 'og:site_name', content: SITE_NAME },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: options.title },
    { name: 'twitter:description', content: options.description },
    { name: 'twitter:image', content: imageUrl },
  ]
}

export function buildPageTitle(pageTitle: string): string {
  return `${pageTitle} · ${SITE_NAME}`
}

export function buildHomeHead(origin?: string) {
  const resolvedOrigin = origin ?? resolveSiteOrigin()
  return {
    title: SITE_NAME,
    meta: buildOpenGraphMeta({
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      path: '/',
      origin: resolvedOrigin,
    }),
    links: [{ rel: 'canonical', href: absoluteSiteUrl('/', resolvedOrigin) }],
  }
}

export function buildJoinShareHead(billId: string, origin?: string) {
  const resolvedOrigin = origin ?? resolveSiteOrigin()
  return {
    title: buildPageTitle(JOIN_OG_TITLE),
    meta: [
      robotsNoIndexMeta(),
      ...buildOpenGraphMeta({
        title: JOIN_OG_TITLE,
        description: JOIN_OG_DESCRIPTION,
        path: `/bills/${billId}/join`,
        origin: resolvedOrigin,
      }),
    ],
  }
}

export function buildNoIndexHead(pageTitle: string) {
  return {
    title: buildPageTitle(pageTitle),
    meta: [robotsNoIndexMeta()],
  }
}
