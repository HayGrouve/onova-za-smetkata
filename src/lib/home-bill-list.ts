export const HOME_BILL_PAGE_SIZE = 20
export const HOME_BILL_SEARCH_DEBOUNCE_MS = 300

export function homeBillListEmptyMessage(args: { search: string }): string {
  if (args.search.trim()) return 'Няма намерени сметки.'
  return 'Все още нямате сметки.'
}
