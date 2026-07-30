import { Link } from '@tanstack/react-router'
import {
  buildPageTitle,
  buildOpenGraphMeta,
  resolveSiteOrigin,
  absoluteSiteUrl,
} from '#/lib/site-meta.ts'

export function buildLegalPageHead(pageTitle: string, path: string) {
  const origin = resolveSiteOrigin()
  return {
    title: buildPageTitle(pageTitle),
    meta: buildOpenGraphMeta({
      title: pageTitle,
      description: `${pageTitle} — Онова за сметката`,
      path,
      origin,
    }),
    links: [{ rel: 'canonical', href: absoluteSiteUrl(path, origin) }],
  }
}

export function LegalPageLayout({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="page-container max-w-prose py-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        <Link
          to="/"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Към началото
        </Link>
      </p>
    </div>
  )
}
