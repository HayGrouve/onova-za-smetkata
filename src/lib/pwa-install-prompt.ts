export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let captureInitialized = false
const listeners = new Set<() => void>()

function notifyListeners() {
  for (const listener of listeners) {
    listener()
  }
}

export function ensurePwaInstallPromptCapture() {
  if (captureInitialized || typeof window === 'undefined') return
  captureInitialized = true

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notifyListeners()
  })
}

export function getDeferredPrompt() {
  return deferredPrompt
}

export function clearDeferredPrompt() {
  deferredPrompt = null
  notifyListeners()
}

export function subscribeToDeferredPrompt(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function promptPwaInstall() {
  const prompt = deferredPrompt
  if (!prompt) return { outcome: 'unavailable' as const }

  await prompt.prompt()
  const choice = await prompt.userChoice
  if (choice.outcome === 'accepted') {
    clearDeferredPrompt()
  }
  return choice
}
