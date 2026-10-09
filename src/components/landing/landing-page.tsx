import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import {
  ArrowRightIcon,
  CameraIcon,
  LinkIcon,
  QrCodeIcon,
  SmartphoneIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { LiveReceiptDemo } from '#/components/landing/live-receipt-demo.tsx'
import { LeaderRow } from '#/components/receipt/paper.tsx'
import { SeatAvatar } from '#/components/receipt/seats.tsx'
import { Button } from '#/components/ui/button.tsx'
import { SUPPORT_EMAIL, mailtoHref } from '#/lib/contact.ts'
import { cn } from '#/lib/utils.ts'

const START_LABEL = 'Започнете'

/**
 * What the app does, in the order a table lives it. The details are the
 * product's value props; the visuals are tiny printed props, not screenshots.
 */
const STEPS = [
  {
    title: 'Снимате бележката',
    detail: 'Продуктите се въвеждат сами.',
    visual: <ScanProp />,
  },
  {
    title: 'Пращате линка в групата',
    detail: 'Линк и QR код за хората на масата.',
    visual: <LinkProp />,
  },
  {
    title: 'Всеки отбелязва своето',
    detail: 'И плаща с Revolut или по IBAN.',
    visual: <PayProp />,
  },
] as const

/** Content slides up a few pixels into place; it is never hidden before. */
function Rise({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ y: 18 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      {children}
    </motion.div>
  )
}

function StartButton({ className }: { className?: string }) {
  return (
    <Button asChild size="lg" className={className}>
      <Link to="/login" search={{ redirect: '/' }}>
        {START_LABEL}
        <ArrowRightIcon strokeWidth={2} aria-hidden />
      </Link>
    </Button>
  )
}

/**
 * The signed-out front door (`/`). Rendered on the server too, so crawlers
 * and slow phones get the words before any script runs.
 */
export function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:px-6">
      <section className="grid gap-12 pt-6 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center lg:gap-20 lg:pt-6 lg:pb-24">
        <div>
          <h1 className="font-display text-[34px] leading-[1.08] font-extrabold tracking-[-0.03em] sm:text-5xl lg:text-[56px]">
            Разделете сметката без{' '}
            <span className="underline decoration-stamp decoration-[4px] [text-decoration-skip-ink:none] underline-offset-[7px]">
              калкулатор
            </span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-[14px] leading-relaxed text-on-table-muted sm:text-[15px]">
            Снимате бележката, пращате линка в групата, всеки отбелязва своето и
            плаща с Revolut или по IBAN.
          </p>
          <StartButton className="mt-8 w-full sm:w-auto sm:min-w-56" />
        </div>
        <motion.div
          initial={{ y: 28 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 80, damping: 18 }}
          className="mx-auto w-full max-w-[400px] lg:rotate-[1.5deg]"
        >
          <LiveReceiptDemo />
        </motion.div>
      </section>

      <section
        aria-labelledby="landing-how"
        className="grid gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-16 lg:py-20"
      >
        <h2
          id="landing-how"
          className="font-display text-[26px] leading-tight font-bold sm:text-[32px] lg:sticky lg:top-24 lg:self-start"
        >
          Как работи
        </h2>
        <ol className="flex flex-col gap-5 lg:max-w-[640px]">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className={cn(
                index === 1 && 'lg:ml-14',
                index === 2 && 'lg:ml-28',
              )}
            >
              <Rise>
                <div className="paper-lift">
                  <div className="stub paper flex gap-4 p-5 sm:gap-5 sm:p-6">
                    <span
                      aria-hidden
                      className="font-display text-[44px] leading-none font-extrabold text-stamp"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-[16px] leading-snug font-bold">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                        {step.detail}
                      </p>
                      <div aria-hidden className="mt-4">
                        {step.visual}
                      </div>
                    </div>
                  </div>
                </div>
              </Rise>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 py-10 sm:py-14 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8 lg:py-20">
        <Rise>
          <div className="paper-lift h-full">
            <div className="stub paper flex h-full flex-col gap-5 p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-stamp-soft text-stamp">
                  <CameraIcon
                    className="size-5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </span>
                <h2 className="font-display text-[22px] leading-tight font-bold">
                  Бърза сметка
                </h2>
              </div>
              <p className="max-w-[44ch] text-[13px] leading-relaxed">
                Без линк и без чакане. Снимате бележката, подавате телефона по
                масата и всеки докосва своето.
              </p>
              <div
                aria-hidden
                className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 border-t-2 border-dashed border-rule pt-4"
              >
                <span className="text-[11px] font-semibold text-ink-muted">
                  Чий ред е?
                </span>
                <span className="flex items-center gap-2.5">
                  {[0, 1, 2, 3].map((hue) => (
                    <SeatAvatar
                      key={hue}
                      seat={{ initials: String(hue + 1), hue }}
                      size="sm"
                      ring={hue === 1 ? 'mine' : 'none'}
                    />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </Rise>
        <Rise>
          <div className="flex h-full flex-col gap-4 border-2 border-dashed border-table-3 p-5 sm:p-7">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-[1.5px] border-current">
              <SmartphoneIcon
                className="size-5"
                strokeWidth={1.75}
                aria-hidden
              />
            </span>
            <h2 className="font-display text-[22px] leading-tight font-bold">
              Гост сте?
            </h2>
            <p className="text-[13px] leading-relaxed text-on-table-muted">
              Отворете линка от домакина. Не ви трябва профил.
            </p>
          </div>
        </Rise>
      </section>

      <section className="py-10 sm:py-14 lg:py-20">
        <Rise>
          <div className="paper-lift mx-auto lg:mx-0">
            <div className="stub paper grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
              <div>
                <h2 className="font-display text-[24px] leading-tight font-bold sm:text-[30px]">
                  Разделете първата си сметка
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                  Безплатно за домакини и гости.
                </p>
              </div>
              <div className="border-t-2 border-dashed border-rule pt-6 lg:border-t-0 lg:border-l-2 lg:pt-0 lg:pl-12">
                <StartButton className="w-full lg:w-auto lg:min-w-56" />
              </div>
            </div>
          </div>
        </Rise>
      </section>

      <footer className="flex flex-col gap-1 border-t-2 border-dashed border-table-3 pt-4 text-[11px] text-on-table-muted sm:flex-row sm:items-center sm:justify-between">
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
      </footer>
    </div>
  )
}

const footerLinkClass =
  'inline-flex min-h-11 items-center !text-on-table underline decoration-dotted decoration-2 underline-offset-4'

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

/** Two printed lines, as if the scan had just read them. */
function ScanProp() {
  return (
    <div className="space-y-1 text-[11px] text-ink-muted">
      <LeaderRow label="Шопска салата" value="7,80 €" />
      <LeaderRow label="Бира 0,5 л" value="3,20 €" />
    </div>
  )
}

function LinkProp() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex min-w-0 items-center gap-2 rounded-full border-[1.5px] border-dashed border-ink-faint px-3 py-1.5 text-[11px]">
        <LinkIcon
          className="size-3.5 shrink-0"
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="truncate">onova-za-smetkata.com/…</span>
      </span>
      <QrCodeIcon
        className="size-7 text-ink-muted"
        strokeWidth={1.5}
        aria-hidden
      />
    </div>
  )
}

function PayProp() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1.5">
        {[0, 1, 2].map((hue) => (
          <SeatAvatar
            key={hue}
            seat={{ initials: ['Д', 'Н', 'М'][hue], hue }}
            size="xs"
          />
        ))}
      </span>
      {['Revolut', 'IBAN'].map((method) => (
        <span
          key={method}
          className="rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-semibold"
        >
          {method}
        </span>
      ))}
    </div>
  )
}
