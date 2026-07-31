import { clerkSetup } from '@clerk/testing/playwright'

export default async function globalSetup() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.warn(
      'CLERK_SECRET_KEY is not set — E2E host auth via Clerk Testing Tokens may fail.',
    )
  }

  await clerkSetup()
}
