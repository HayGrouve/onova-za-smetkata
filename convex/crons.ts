import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'purge stale sessions, rate limits, and receipt scans',
  { hours: 6 },
  internal.cleanup.run,
)

export default crons
