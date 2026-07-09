import { z } from 'zod'
import {
  FRIEND_GROUP_MAX_GROUPS,
  FRIEND_GROUP_MAX_MEMBERS,
  GROUP_NAME_MAX,
  PERSON_NAME_MAX,
} from './validation/constants'
import { groupNameSchema, personNameSchema } from './validation/fields'

export {
  FRIEND_GROUP_MAX_GROUPS,
  FRIEND_GROUP_MAX_MEMBERS,
  GROUP_NAME_MAX as FRIEND_GROUP_NAME_MAX,
  PERSON_NAME_MAX as FRIEND_GROUP_MEMBER_NAME_MAX,
}

export const friendGroupFormSchema = z.object({
  name: groupNameSchema(),
  memberNames: z
    .array(personNameSchema)
    .max(
      FRIEND_GROUP_MAX_MEMBERS,
      `Групата може да има до ${FRIEND_GROUP_MAX_MEMBERS} участника`,
    )
    .superRefine((names, ctx) => {
      const seen = new Set<string>()
      for (const [index, name] of names.entries()) {
        const key = name.trim().toLowerCase()
        if (seen.has(key)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Името вече е в групата',
            path: [index],
          })
        }
        seen.add(key)
      }
    }),
})

export type FriendGroupFormInput = z.input<typeof friendGroupFormSchema>
export type FriendGroupSaveData = z.output<typeof friendGroupFormSchema>

export function parseFriendGroupInput(input: FriendGroupFormInput) {
  return friendGroupFormSchema.safeParse(input)
}

export function formatFriendGroupErrors(error: z.ZodError) {
  const fieldErrors: {
    name?: string
    memberNames?: string
    memberNameAt?: Record<number, string>
  } = {}

  for (const issue of error.issues) {
    const [field, index] = issue.path
    if (field === 'name' && !fieldErrors.name) {
      fieldErrors.name = issue.message
    } else if (field === 'memberNames' && typeof index === 'number') {
      fieldErrors.memberNameAt ??= {}
      if (!fieldErrors.memberNameAt[index]) {
        fieldErrors.memberNameAt[index] = issue.message
      }
    } else if (field === 'memberNames' && !fieldErrors.memberNames) {
      fieldErrors.memberNames = issue.message
    }
  }

  return fieldErrors
}

export function dedupeMemberNames(names: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of names) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

export interface AddMembersToBillResult {
  added: number
  skipped: number
}

export function summarizeAddMembersToBill(result: AddMembersToBillResult) {
  if (result.added === 0 && result.skipped > 0) {
    return 'Всички от групата вече са добавени'
  }
  if (result.skipped === 0) {
    return result.added === 1
      ? 'Добавен 1 участник'
      : `Добавени ${result.added} участника`
  }
  return `Добавени ${result.added} · ${result.skipped} вече на сметката`
}
