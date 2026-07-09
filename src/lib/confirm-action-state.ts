import type { ConfirmOptions } from '#/lib/destructive-action-copy.ts'

export type ConfirmRequest = Required<ConfirmOptions>

type Pending = {
  request: ConfirmRequest
  resolve: (confirmed: boolean) => void
}

export function createConfirmActionState() {
  let pending: Pending | null = null

  function requestConfirm(request: ConfirmRequest): Promise<boolean> {
    if (pending) {
      pending.resolve(false)
    }
    return new Promise<boolean>((resolve) => {
      pending = { request, resolve }
    })
  }

  function resolveConfirm(confirmed: boolean) {
    if (!pending) return
    pending.resolve(confirmed)
    pending = null
  }

  function cancelConfirm() {
    resolveConfirm(false)
  }

  function getPendingRequest(): ConfirmRequest | null {
    return pending?.request ?? null
  }

  return {
    requestConfirm,
    resolveConfirm,
    cancelConfirm,
    getPendingRequest,
  }
}
