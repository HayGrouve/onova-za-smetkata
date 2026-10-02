/** PROTOTYPE - Direction B internal screen state (not URL routes). */
export type NewStep = 'scan' | 'review' | 'people' | 'share'

export type HostRoute =
  | { name: 'home' }
  | { name: 'new'; step: NewStep }
  | { name: 'live' }
  | { name: 'person'; id: string }

export type GoHost = (route: HostRoute, dir?: number) => void

export type GuestRoute = 'claim' | 'pay' | 'done'
