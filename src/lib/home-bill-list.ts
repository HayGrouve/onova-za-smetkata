export const HOME_BILL_PAGE_SIZE = 20
export const HOME_BILL_SEARCH_DEBOUNCE_MS = 300

export type HomeBillStatusFilter = 'draft' | 'final'

export function parseHomeBillStatusSearch(
  value: unknown,
): HomeBillStatusFilter | undefined {
  if (value === 'draft' || value === 'final') return value
  return undefined
}

/** Always includes `status` so TanStack Router search types stay satisfied; `undefined` omits the query param. */
export function homeBillStatusSearchParam(
  status: HomeBillStatusFilter | undefined,
): { status: HomeBillStatusFilter | undefined } {
  return { status }
}

export function homeBillListEmptyMessage(args: {
  status: HomeBillStatusFilter | undefined
  search: string
}): string {
  if (args.search.trim()) return 'Няма намерени сметки.'
  if (args.status === 'draft') return 'Няма чернови.'
  if (args.status === 'final') return 'Няма приключени.'
  return 'Все още нямате сметки. Създайте първата си сметка!'
}
