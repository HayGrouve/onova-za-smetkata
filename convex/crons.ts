import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'purge stale sessions, rate limits, and receipt scans',
  { hours: 6 },
  internal.cleanup.run,
  {},
)

crons.interval(
  'delete uploaded photos nothing kept',
  { hours: 24 },
  internal.cleanup.sweepOrphanUploads,
  {},
)

// Queries never read the clock, so this sweep is what frees a seat whose phone
// went quiet (and pushes the change to everyone watching the bill).
crons.interval(
  'end quiet guest sessions',
  { minutes: 1 },
  internal.guestSessions.endQuiet,
  {},
)

export default crons
