// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionPage } from './subscription-page.tsx'

const navigate = vi.fn()
const auth = { isAuthenticated: true, isLoading: false }
let hostPro: { enabled: boolean } | null | undefined

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('#/hooks/use-require-host-auth.ts', () => ({
  useRequireHostAuth: () => auth,
}))
vi.mock('#/hooks/use-host-pro.ts', () => ({
  useHostProStatus: () => hostPro,
}))
vi.mock('#/components/subscription/host-pro-subscription-panel.tsx', () => ({
  HostProSubscriptionPanel: () => <p>panel</p>,
}))

beforeEach(() => {
  navigate.mockReset()
  auth.isAuthenticated = true
  auth.isLoading = false
})
afterEach(cleanup)

describe('Абонамент page', () => {
  it('shows the panel while billing is on', () => {
    hostPro = { enabled: true }
    render(<SubscriptionPage />)
    expect(screen.queryByText('panel')).not.toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('sends a signed in Host Home while billing is off', () => {
    hostPro = { enabled: false }
    render(<SubscriptionPage />)
    expect(screen.queryByText('panel')).toBeNull()
    expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
  })

  it('waits for the billing switch before deciding', () => {
    hostPro = undefined
    render(<SubscriptionPage />)
    expect(screen.queryByText('panel')).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('leaves a signed out visitor to the login redirect', () => {
    auth.isAuthenticated = false
    hostPro = undefined
    render(<SubscriptionPage />)
    expect(screen.queryByText('panel')).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })
})
