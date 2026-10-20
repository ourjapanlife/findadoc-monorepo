import { describe, expect, it } from 'vitest'
import { OrderDirection } from '@findadoc/graphql'
import {
    columnOrder,
    loadPageInRange,
    nextListOrder,
    orderByInput,
    orderedPage,
    pageOffsetInRange,
    pageSelectionState,
    paginationIsCompact,
    paginationItems,
    reorderColumns,
    runBulkSubmissionAction
} from '~/utils/moderationTable'

describe('moderation table', () => {
    it('sorts the whole list before cutting the page', () => {
        const rows = [
            { name: 'C' },
            { name: 'A' },
            { name: 'B' }
        ]
        const page = orderedPage(
            rows,
            { field: 'name', direction: 'asc' },
            0,
            2,
            (row, field) => row[field as 'name']
        )
        expect(page.map(row => row.name)).toEqual(['A', 'B'])
    })

    it('leaves an unsorted list in server order', () => {
        const rows = [{ name: 'C' }, { name: 'A' }]
        const page = orderedPage(rows, null, 0, 1, row => row.name)
        expect(page.map(row => row.name)).toEqual(['C'])
    })

    it('flips the same column and starts a new column ascending', () => {
        expect(nextListOrder(null, 'createdDate')).toEqual({ field: 'createdDate', direction: 'asc' })
        expect(nextListOrder({ field: 'createdDate', direction: 'asc' }, 'createdDate')).toEqual({
            field: 'createdDate',
            direction: 'desc'
        })
        expect(nextListOrder({ field: 'createdDate', direction: 'desc' }, 'nameEn')).toEqual({
            field: 'nameEn',
            direction: 'asc'
        })
    })

    it('sends the sort to the server as orderBy', () => {
        expect(orderByInput(null)).toBeNull()
        expect(orderByInput({ field: 'nameEn', direction: 'desc' })).toEqual([{
            fieldToOrder: 'nameEn',
            orderDirection: OrderDirection.Desc
        }])
    })

    it('hides page numbers when the row is tight and keeps a window otherwise', () => {
        expect(paginationIsCompact(639)).toBe(true)
        expect(paginationIsCompact(640)).toBe(false)
        expect(paginationItems(3, 2)).toEqual([1, 2, 3])
        expect(paginationItems(10, 5)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10])
    })

    it('knows when every row on the page is selected', () => {
        expect(pageSelectionState(['a', 'b'], new Set(['a']))).toBe('some')
        expect(pageSelectionState(['a', 'b'], new Set(['a', 'b', 'c']))).toBe('all')
        expect(pageSelectionState([], new Set(['a']))).toBe('none')
    })

    it('reorders columns and keeps unknown saved ids out', () => {
        expect(reorderColumns(['name', 'status', 'created'], 'created', 'name')).toEqual([
            'created',
            'name',
            'status'
        ])
        expect(columnOrder(['created', 'missing', 'name'], ['name', 'status', 'created'])).toEqual([
            'created',
            'name',
            'status'
        ])
    })

    it('reports every row when one action fails', async () => {
        const results = await runBulkSubmissionAction(
            [
                { id: '1', label: 'A' },
                { id: '2', label: 'B' },
                { id: '3', label: 'C' }
            ],
            async id => {
                if (id === '2') {
                    throw new Error('no')
                }
                return id !== '3'
            }
        )
        expect(results).toEqual([
            { id: '1', label: 'A', succeeded: true },
            { id: '2', label: 'B', succeeded: false },
            { id: '3', label: 'C', succeeded: false }
        ])
    })

    it('keeps a stored page that still has rows', () => {
        expect(pageOffsetInRange(25, 25, 60)).toBe(25)
    })

    it('moves a stored page that is past the end back onto the last page', () => {
        expect(pageOffsetInRange(50, 25, 30)).toBe(25)
        expect(pageOffsetInRange(50, 25, 0)).toBe(0)
    })

    it('loads the last page when the stored page is gone', async () => {
        const requested: number[] = []
        const page = await loadPageInRange(50, 25, async offset => {
            requested.push(offset)
            return {
                rows: offset === 25 ? ['last'] : [],
                totalCount: 30
            }
        })
        expect(requested).toEqual([50, 25])
        expect(page).toEqual({ rows: ['last'], totalCount: 30, offset: 25 })
    })
})
