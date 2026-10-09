import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SUPPORT_EMAIL, mailtoHref } from '#/lib/contact.ts'

const footerLinkClass =
  'inline-flex min-h-11 items-center !text-on-table underline decoration-dotted decoration-2 underline-offset-4'

/**
 * The landing page's footer. The app shell renders it after `<main>`, so it is
 * the page's contentinfo landmark rather than a footer inside the content.
 */
export function LandingFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1180px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:px-6">
      <div className="flex flex-col gap-1 border-t-2 border-dashed border-table-3 pt-4 text-[11px] text-on-table-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Чисти сметки, добри приятели.</p>
        <nav aria-label="Информация" className="flex flex-wrap gap-x-5">
          <FooterLink to="/privacy">Поверителност</FooterLink>
          <FooterLink to="/terms">Условия</FooterLink>
          <a
            href={mailtoHref(SUPPORT_EMAIL, 'Онова за сметката')}
            className={footerLinkClass}
          >
            Пишете ни
          </a>
        </nav>
      </div>
    </footer>
  )
}

function FooterLink({
  to,
  children,
}: {
  to: '/privacy' | '/terms'
  children: ReactNode
}) {
  return (
    <Link to={to} className={footerLinkClass}>
      {children}
    </Link>
  )
}
