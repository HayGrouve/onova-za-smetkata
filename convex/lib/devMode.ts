export function isDevMode(): boolean {
  return process.env.DEV_MODE === 'true'
}

export const DEV_USER_EMAIL = 'dev@local.test'
export const DEV_USER_NAME = 'Dev User'
export const DEV_USER_PASSWORD = 'devpassword'
