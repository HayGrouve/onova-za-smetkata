# iOS Revolut Launch Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open Revolut synchronously from a guest tap so iOS Safari preserves user activation while retaining pending-transfer recording and accurate feedback.

**Architecture:** Add a small browser-side orchestration helper that opens the URL before clipboard or network work and reports a typed outcome. Use it from the guest footer after synchronously deriving the amount and URL.

**Tech Stack:** TypeScript, React 19, Convex, Vitest

## Global Constraints

- The Revolut URL format remains unchanged.
- No platform or user-agent branches.
- A blocked open must not record a pending transfer or show success.
- Once Revolut opens, a recording failure must not undo or delay the launch.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Synchronous Revolut launch orchestration

**Files:**

- Create: `src/lib/revolut-launch.ts`
- Create: `src/lib/revolut-launch.test.ts`
- Modify: `src/components/bills/guest-claim-footer.tsx:206-275`

**Interfaces:**

- Produces: `launchRevolut(options: LaunchRevolutOptions): Promise<LaunchRevolutResult>`
- Produces: `LaunchRevolutResult = 'blocked' | 'opened' | 'recording-failed'`
- Consumes callbacks for opening the URL, copying the amount, and recording the transfer.

- [x] **Step 1: Write the failing ordering and blocked-open tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { launchRevolut } from './revolut-launch.ts'

describe('launchRevolut', () => {
  it('opens Revolut before waiting for transfer recording', async () => {
    const events: string[] = []
    let finishRecording: ((recorded: boolean) => void) | undefined
    const recording = new Promise<boolean>((resolve) => {
      finishRecording = resolve
    })

    const result = launchRevolut({
      url: 'https://revolut.me/example?amount=500&currency=EUR',
      openWindow: (url) => {
        events.push(`open:${url}`)
        return {} as Window
      },
      copyAmount: () => events.push('copy'),
      recordTransfer: () => {
        events.push('record')
        return recording
      },
    })

    expect(events).toEqual([
      'open:https://revolut.me/example?amount=500&currency=EUR',
      'copy',
      'record',
    ])

    finishRecording?.(true)
    await expect(result).resolves.toBe('opened')
  })

  it('does not copy or record when the browser blocks the open', async () => {
    const copyAmount = vi.fn()
    const recordTransfer = vi.fn()

    await expect(
      launchRevolut({
        url: 'https://revolut.me/example?amount=500&currency=EUR',
        openWindow: () => null,
        copyAmount,
        recordTransfer,
      }),
    ).resolves.toBe('blocked')
    expect(copyAmount).not.toHaveBeenCalled()
    expect(recordTransfer).not.toHaveBeenCalled()
  })
})
```

- [x] **Step 2: Run the test and verify RED**

Run: `pnpm exec vitest run src/lib/revolut-launch.test.ts`

Expected: FAIL because `src/lib/revolut-launch.ts` does not exist.

- [x] **Step 3: Add the minimal helper**

```ts
export type LaunchRevolutResult = 'blocked' | 'opened' | 'recording-failed'

export interface LaunchRevolutOptions {
  url: string
  openWindow: (url: string) => Window | null
  copyAmount: () => void
  recordTransfer: () => Promise<boolean>
}

export async function launchRevolut({
  url,
  openWindow,
  copyAmount,
  recordTransfer,
}: LaunchRevolutOptions): Promise<LaunchRevolutResult> {
  const openedWindow = openWindow(url)
  if (!openedWindow) return 'blocked'

  copyAmount()
  const recorded = await recordTransfer()
  return recorded ? 'opened' : 'recording-failed'
}
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec vitest run src/lib/revolut-launch.test.ts`

Expected: 2 tests pass.

- [x] **Step 5: Integrate the helper into the guest footer**

Make `resolvePayCents` synchronous, then construct the note and URL before
calling `launchRevolut`. Pass `window.open` as the first side effect, defer
clipboard copying and `recordTransferInitiated` through callbacks, and handle
the result:

```ts
function handleRevolut() {
  if (!revolutUsername || (remainingCents <= 0 && !isCombined && !pending)) {
    return
  }
  const payCents = resolvePayCents()
  if (payCents === null) return

  const payingForOthers = Boolean(pendingCoveredIds.length > 0 || isCombined)
  const participantNames = payingForOthers
    ? [
        label,
        ...selectedCoveredIds.map(
          (id) =>
            participantLabels?.[id] ??
            participantBalances.find((b) => b.participantId === id)?.name,
        ),
      ].filter((name): name is string => Boolean(name?.trim()))
    : [label]
  const note = buildRevolutPaymentNote(restaurantName, participantNames)
  const url = buildRevolutUrl(revolutUsername, payCents, note)

  void launchRevolut({
    url,
    openWindow: (targetUrl) => window.open(targetUrl),
    copyAmount: () => {
      void copyToClipboard(formatCopyAmount(payCents))
    },
    recordTransfer: recordTransferInitiated,
  }).then((result) => {
    if (result === 'blocked') {
      toast.error('Revolut не можа да се отвори')
    } else if (result === 'opened') {
      toast.success('Отворен Revolut')
    }
  })
}
```

Update `handleCopyIban` to call the now-synchronous `resolvePayCents` without
`await`.

- [x] **Step 6: Verify the focused behavior and project**

Run:

```bash
pnpm exec vitest run src/lib/revolut-launch.test.ts src/lib/payment-settings.test.ts
pnpm exec eslint src/lib/revolut-launch.ts src/lib/revolut-launch.test.ts src/components/bills/guest-claim-footer.tsx
pnpm run build
```

Expected: all tests pass, ESLint exits 0, and the production build exits 0.

- [ ] **Step 7: Perform native-device smoke test**

On iPhone Safari: open a shared bill, select a participant with an outstanding
share, tap **Revolut**, and verify the Revolut app or `revolut.me` opens and the
host receives the pending-transfer state. Repeat on Android Chrome to confirm
no regression.
