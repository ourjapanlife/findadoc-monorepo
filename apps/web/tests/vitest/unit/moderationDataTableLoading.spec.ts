import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import ModerationDataTable from '~/components/moderation-panel/ModerationDataTable.vue'
import type { ModerationTableRow } from '~/utils/moderationTable'

const i18n = createI18n({
    legacy: false,
    locale: 'en-US',
    missingWarn: false,
    fallbackWarn: false,
    messages: { 'en-US': { common: { loading: 'Loading' } } }
})

const ROW: ModerationTableRow = {
    id: 'facility-1',
    href: '/my-page/edit-facility/facility-1',
    testId: 'mod-facility-list-item-1',
    linkColumn: 'name',
    badges: [],
    cells: { name: 'Fake Clinic' }
}

function mountTable(loading: boolean, rows: ModerationTableRow[]) {
    return mount(ModerationDataTable, {
        props: {
            columnStorageKey: 'test',
            columns: [{ id: 'name', label: 'Name' }],
            rows,
            emptyLabel: 'No results',
            loading,
            search: '',
            offset: 0,
            totalItems: rows.length,
            pageSize: 25,
            sort: null,
            selectable: false,
            selectedIds: [],
            selectedNames: [],
            pageSelection: 'none',
            pending: false,
            results: []
        },
        global: {
            plugins: [i18n],
            stubs: { ModListContainerItem: true, Pagination: true, SVGLookingGlass: true }
        }
    })
}

describe('ModerationDataTable loading', () => {
    it('shows Chiko instead of "no results" while the first page is in flight', () => {
        const wrapper = mountTable(true, [])

        expect(wrapper.find('[data-testid="mod-table-loading"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="mod-table-empty"]').exists()).toBe(false)
        expect(wrapper.text()).not.toContain('No results')
    })

    it('shows "no results" once the request finished with no rows', () => {
        const wrapper = mountTable(false, [])

        expect(wrapper.find('[data-testid="mod-table-loading"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="mod-table-empty"]').text()).toContain('No results')
    })

    it('keeps the current rows under Chiko while the next page loads', () => {
        const wrapper = mountTable(true, [ROW])

        expect(wrapper.find('[data-testid="mod-table-loading-overlay"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="mod-table-empty"]').exists()).toBe(false)
    })
})
