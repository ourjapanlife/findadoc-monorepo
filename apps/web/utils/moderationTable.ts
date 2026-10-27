import { OrderDirection, type OrderBy } from '@findadoc/graphql'

export interface ListOrder {
    field: string
    direction: 'asc' | 'desc'
}

export interface ModerationTableBadge {
    label: string
    className: string
}

export interface ModerationTableColumn {
    id: string
    label: string
    sortField?: string
}

export interface ModerationTableRow {
    id: string
    href: string
    testId: string
    linkColumn: string
    cells: Record<string, string>
    badges: ModerationTableBadge[]
}

export interface BulkSubmissionTarget {
    id: string
    label: string
}

export interface BulkSubmissionResult {
    id: string
    label: string
    succeeded: boolean
}

export type PageSelection = 'none' | 'some' | 'all'

export type PaginationItem = number | 'ellipsis'

export const PAGINATION_COMPACT_BELOW = 640

export const MODERATION_PAGE_SIZES = [10, 25, 50] as const

export const DEFAULT_MODERATION_PAGE_SIZE = 25

/** The stored page, aligned to the page size, or the first page when that page is gone. */
export function pageOffsetInRange(offset: number, pageSize: number, totalCount: number): number {
    if (!Number.isFinite(pageSize) || pageSize < 1) {
        return 0
    }
    if (!Number.isFinite(totalCount) || totalCount <= 0) {
        return 0
    }
    const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0
    const aligned = Math.floor(safeOffset / pageSize) * pageSize
    const lastPage = Math.floor((totalCount - 1) / pageSize) * pageSize
    return Math.min(aligned, lastPage)
}

/**
 * Loads the requested page. When that page is past the end, loads the last page that still has rows.
 */
export async function loadPageInRange<T>(
    offset: number,
    pageSize: number,
    load: (offset: number) => Promise<{ rows: T[], totalCount: number }>
): Promise<{ rows: T[], totalCount: number, offset: number }> {
    let pageOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0
    let page = await load(pageOffset)
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const clamped = pageOffsetInRange(pageOffset, pageSize, page.totalCount)
        if (clamped === pageOffset) {
            return { rows: page.rows, totalCount: page.totalCount, offset: pageOffset }
        }
        pageOffset = clamped
        page = await load(pageOffset)
    }
    return {
        rows: page.rows,
        totalCount: page.totalCount,
        offset: pageOffsetInRange(pageOffset, pageSize, page.totalCount)
    }
}

const COLUMN_ORDER_PREFIX = 'moderation-table-columns:'

type ColumnStorage = Pick<Storage, 'getItem' | 'setItem'>

function columnStorage(storage: ColumnStorage | undefined): ColumnStorage | undefined {
    return storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
}

export function moderationTableColumnKey(view: string): string {
    return `${COLUMN_ORDER_PREFIX}${view}`
}

/** First click sorts ascending. The next click on the same column flips direction. */
export function nextListOrder(current: ListOrder | null, field: string): ListOrder {
    if (current !== null && current.field === field && current.direction === 'asc') {
        return { field, direction: 'desc' }
    }
    return { field, direction: 'asc' }
}

export function orderByInput(order: ListOrder | null): OrderBy[] | null {
    if (order === null) {
        return null
    }
    return [{
        fieldToOrder: order.field,
        orderDirection: order.direction === 'asc' ? OrderDirection.Asc : OrderDirection.Desc
    }]
}

/**
 * Sort the full loaded set, then cut the page.
 * A header click must not rearrange only the rows already on screen.
 */
export function orderedPage<T>(
    rows: readonly T[],
    order: ListOrder | null,
    offset: number,
    limit: number,
    valueAt: (row: T, field: string) => string
): T[] {
    const sorted = order === null
        ? rows
        : [...rows].sort((left, right) => {
            const compared = valueAt(left, order.field).localeCompare(valueAt(right, order.field))
            return order.direction === 'asc' ? compared : -compared
        })
    return sorted.slice(offset, offset + limit)
}

export function paginationIsCompact(width: number): boolean {
    return width < PAGINATION_COMPACT_BELOW
}

export function paginationItems(pageCount: number, currentPage: number): PaginationItem[] {
    if (pageCount <= 7) {
        return Array.from({ length: pageCount }, (_, index) => index + 1)
    }

    const items: PaginationItem[] = [1]
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(pageCount - 1, currentPage + 1)
    if (start > 2) {
        items.push('ellipsis')
    }
    for (let page = start; page <= end; page += 1) {
        items.push(page)
    }
    if (end < pageCount - 1) {
        items.push('ellipsis')
    }
    items.push(pageCount)
    return items
}

export function pageSelectionState(pageIds: readonly string[], selectedIds: ReadonlySet<string>): PageSelection {
    if (pageIds.length === 0) {
        return 'none'
    }
    let selectedOnPage = 0
    for (const id of pageIds) {
        if (selectedIds.has(id)) {
            selectedOnPage += 1
        }
    }
    if (selectedOnPage === 0) {
        return 'none'
    }
    if (selectedOnPage === pageIds.length) {
        return 'all'
    }
    return 'some'
}

export function reorderColumns(columnIds: readonly string[], fromId: string, toId: string): string[] {
    if (fromId === toId) {
        return [...columnIds]
    }
    const fromIndex = columnIds.indexOf(fromId)
    const toIndex = columnIds.indexOf(toId)
    if (fromIndex === -1 || toIndex === -1) {
        return [...columnIds]
    }
    const next = [...columnIds]
    next.splice(fromIndex, 1)
    next.splice(toIndex, 0, fromId)
    return next
}

export function columnOrder(saved: readonly string[], defaults: readonly string[]): string[] {
    const known = saved.filter(id => defaults.includes(id))
    const missing = defaults.filter(id => !known.includes(id))
    return [...known, ...missing]
}

export function readColumnOrder(
    view: string,
    defaults: readonly string[],
    storage?: ColumnStorage
): string[] {
    try {
        const raw = columnStorage(storage)?.getItem(moderationTableColumnKey(view))
        if (raw === null || raw === undefined || raw === '') {
            return [...defaults]
        }
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
            return [...defaults]
        }
        const saved = parsed.filter((id): id is string => typeof id === 'string')
        return columnOrder(saved, defaults)
    } catch {
        return [...defaults]
    }
}

export function writeColumnOrder(view: string, columnIds: readonly string[], storage?: ColumnStorage): void {
    try {
        columnStorage(storage)?.setItem(moderationTableColumnKey(view), JSON.stringify(columnIds))
    } catch {
        // Private mode can reject storage. The columns stay in the new order for this visit.
    }
}

/** One failed row does not stop the rest, and every row is reported. */
export async function runBulkSubmissionAction(
    targets: readonly BulkSubmissionTarget[],
    act: (id: string) => Promise<boolean>
): Promise<BulkSubmissionResult[]> {
    const results: BulkSubmissionResult[] = []
    for (const target of targets) {
        let succeeded = false
        try {
            succeeded = await act(target.id)
        } catch {
            // A thrown update is a failed row. The other rows still run.
        }
        results.push({
            id: target.id,
            label: target.label,
            succeeded
        })
    }
    return results
}
