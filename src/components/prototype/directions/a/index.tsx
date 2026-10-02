/**
 * PROTOTYPE — Direction A, „Познато и бързо“. Bill as one screen with tabs
 * (Артикули · Хора · Плащания), banking-style host home, Sunday-style guest
 * checkout. Host and guest share one mock store.
 */
import { useGoogleFont } from '../mock/fonts.ts'
import type { DirectionProps } from '../types.ts'
import { GuestApp } from './guest/guest-app.tsx'
import { HostApp } from './host/host-app.tsx'
import { FONT_URL, PROTO_A_CSS } from './tokens.ts'

export function DirectionA({ view }: DirectionProps) {
  useGoogleFont(FONT_URL)
  return (
    <div className="proto-a min-h-[100dvh] bg-(--a-bg) text-[15px] leading-normal">
      <style>{PROTO_A_CSS}</style>
      {view === 'host' ? <HostApp /> : <GuestApp />}
    </div>
  )
}
