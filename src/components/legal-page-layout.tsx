import { Link } from '@tanstack/react-router'
import { Receipt, Rule } from '#/components/receipt/paper.tsx'
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
    <div className="mx-auto w-full max-w-[680px] px-3 pt-4 pb-24 sm:pt-10">
      <Receipt innerClassName="sm:px-10">
        <h2 className="font-display text-[22px] leading-tight font-bold uppercase">
          {title}
        </h2>
        <Rule />
        <div className="space-y-4 text-[12px] leading-relaxed [&_a]:text-ink [&_h2]:pt-2 [&_h2]:font-display [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-ink [&_strong]:text-ink">
          {children}
        </div>
        <Rule />
        <Link
          to="/"
          className="text-[12px] text-ink underline decoration-dotted decoration-2 underline-offset-4"
        >
          Към началото
        </Link>
      </Receipt>
    </div>
  )
}
