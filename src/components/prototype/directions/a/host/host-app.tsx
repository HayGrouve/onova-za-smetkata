/**
 * PROTOTYPE — Direction A host shell. Phone: Home ⇄ bill workspace.
 * ≥768: master/detail (bill list left, workspace right). ≥1280: Плащания
 * becomes a right rail beside the workspace.
 */
import { useEffect, useState } from 'react'
import { useLiveTable } from '../../mock/live.ts'
import { useProto } from '../../mock/store.tsx'
import { useMediaQuery } from '../ui.tsx'
import { Home } from './home.tsx'
import { StaticBill } from './static-bill.tsx'
import { Workspace } from './workspace.tsx'
import type { BillTab } from './workspace.tsx'
import { PaymentsPanel } from './payments.tsx'

type Selection = { kind: 'live' } | { kind: 'static'; id: string }

export function HostApp() {
  const md = useMediaQuery('(min-width: 768px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  const { dispatch } = useProto()
  const [screen, setScreen] = useState<'home' | 'bill'>('home')
  const [sel, setSel] = useState<Selection>({ kind: 'live' })
  const [tab, setTab] = useState<BillTab>('items')
  const [demoEmpty, setDemoEmpty] = useState(false)
  const [booting, setBooting] = useState(true)

  // A short first-load skeleton, so the loading state can be evaluated.
  useEffect(() => {
    const t = window.setTimeout(() => setBooting(false), 650)
    return () => window.clearTimeout(t)
  }, [])

  const showingLive =
    sel.kind === 'live' && !demoEmpty && (md || screen === 'bill')
  useLiveTable(showingLive)

  // A new screen starts at the top.
  useEffect(() => window.scrollTo(0, 0), [screen, sel])

  // Плащания lives in the rail at ≥1280.
  const effectiveTab: BillTab = xl && tab === 'payments' ? 'items' : tab

  function openLive(t?: BillTab) {
    setSel({ kind: 'live' })
    if (t) setTab(t)
    setScreen('bill')
  }
  function openStatic(id: string) {
    setSel({ kind: 'static', id })
    setScreen('bill')
  }
  function newBill() {
    dispatch({ type: 'newBill' })
    setDemoEmpty(false)
    setSel({ kind: 'live' })
    setTab('items')
    setScreen('bill')
  }

  const home = (
    <Home
      pane={md}
      booting={booting}
      empty={demoEmpty}
      onToggleEmpty={() => setDemoEmpty((e) => !e)}
      selected={md ? (sel.kind === 'live' ? 'live' : sel.id) : null}
      onOpenLive={openLive}
      onOpenStatic={openStatic}
      onNew={newBill}
    />
  )

  const detail = demoEmpty ? null : sel.kind === 'static' ? (
    <StaticBill
      id={sel.id}
      pane={md}
      onBack={() => setScreen('home')}
      onOpenLive={() => openLive()}
    />
  ) : (
    <Workspace
      pane={md}
      booting={booting}
      tab={effectiveTab}
      setTab={setTab}
      showPaymentsTab={!xl}
      onBack={() => setScreen('home')}
    />
  )

  if (!md) return screen === 'home' || !detail ? home : detail

  return (
    <div className="grid h-[100dvh] grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_380px]">
      <aside className="min-h-0 overflow-y-auto border-r border-(--a-hairline) bg-(--a-bg)">
        {home}
      </aside>
      <main className="min-h-0 overflow-y-auto bg-(--a-bg)">
        {detail ?? (
          <div className="flex h-full items-center justify-center p-10 text-center text-(--a-muted)">
            Изберете сметка или създайте нова.
          </div>
        )}
      </main>
      {xl && (
        <aside className="min-h-0 overflow-y-auto border-l border-(--a-hairline) bg-(--a-surface)">
          {sel.kind === 'live' && !demoEmpty ? (
            <PaymentsPanel rail onGoItems={() => setTab('items')} />
          ) : (
            <div className="p-6 text-[13px] text-(--a-muted)">
              Плащанията на избраната сметка се виждат тук.
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
