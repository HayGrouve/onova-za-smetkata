/** True in the Vite dev server; pairs with Convex `DEV_MODE=true`. */
export function isClientDevMode(): boolean {
  return import.meta.env.DEV
}
