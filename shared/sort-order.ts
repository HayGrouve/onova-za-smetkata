/**
 * Sort order for a row appended after `existing`: one past the highest, so a
 * row added after a deletion never ties with a survivor. Ties matter — Unit
 * share allocation hands cent remainders out in participant sort order.
 */
export function nextSortOrder(
  existing: ReadonlyArray<{ sortOrder: number }>,
): number {
  let highest = -1
  for (const row of existing) {
    if (row.sortOrder > highest) highest = row.sortOrder
  }
  return highest + 1
}
