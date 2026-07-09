import { z } from 'zod'

export function formatZodFieldErrors<T extends string>(
  error: z.ZodError,
  fields: readonly T[],
): Partial<Record<T, string>> {
  const fieldSet = new Set<string>(fields)
  const result: Partial<Record<T, string>> = {}

  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string' || !fieldSet.has(field)) continue
    const key = field as T
    if (!result[key]) {
      result[key] = issue.message
    }
  }

  return result
}

export function firstZodIssueMessage(
  error: z.ZodError,
  fallback: string,
): string {
  return error.issues[0]?.message ?? fallback
}
