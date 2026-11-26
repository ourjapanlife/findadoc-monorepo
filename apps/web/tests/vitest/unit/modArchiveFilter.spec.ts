import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { ArchiveFilter } from '@findadoc/graphql'
import enUS from '~/i18n/locales/en.json'

vi.mock('~/utils/graphql', () => ({
    gqlClient: { request: vi.fn() },
    graphQLClientRequestWithRetry: vi.fn(() => Promise.resolve({ data: {} }))
}))

const { default: ModDashboardTopbar } = await import('~/components/moderation-panel/ModDashboardTopbar.vue')
const { useFacilitiesStore } = await import('~/stores/facilitiesStore')
const { useHealthcareProfessionalsStore } = await import('~/stores/healthcareProfessionalsStore')
const { SelectedModerationListView, useModerationSubmissionsStore } = await import('~/stores/moderationSubmissionsStore')

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS }, missingWarn: false })

/** Stands in for the chip: exposes what the topbar hands it, and lets a test pick. */
const FilterChipStub = defineComponent({
    name: 'FilterChip',
    props: {
        modelValue: { type: Array, required: true },
        items: { type: Array, required: true },
        label: { type: String, required: true },
        testId: { type: String, required: true },
        defaultValue: { type: Array, default: () => [] }
    },
    emits: ['update:modelValue'],
    template: '<div :data-testid="testId" />'
})

function mountTopbar(view: typeof SelectedModerationListView[keyof typeof SelectedModerationListView]) {
    useModerationSubmissionsStore().selectedModerationListViewChosen = view
    const wrapper = mount(ModDashboardTopbar, {
        global: { plugins: [i18n], stubs: { FilterChip: FilterChipStub, NuxtLink: true } }
    })
    return wrapper.findAllComponents(FilterChipStub).find(chip => chip.props('testId') === 'mod-archive-filter')
}

describe('moderation archive filter', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('offers active only, archived only, and both, and starts on active only', () => {
        const chip = mountTopbar(SelectedModerationListView.Facilities)

        expect((chip?.props('items') as { value: ArchiveFilter }[]).map(item => item.value))
            .toEqual([ArchiveFilter.Active, ArchiveFilter.Archived, ArchiveFilter.All])
        expect(chip?.props('modelValue')).toEqual([ArchiveFilter.Active])
        expect(chip?.props('defaultValue')).toEqual([ArchiveFilter.Active])
    })

    it('lists archived facilities, then goes back to active ones', async () => {
        const chip = mountTopbar(SelectedModerationListView.Facilities)
        const store = useFacilitiesStore()

        chip?.vm.$emit('update:modelValue', [ArchiveFilter.Archived])
        expect(store.archiveFilter).toBe(ArchiveFilter.Archived)

        chip?.vm.$emit('update:modelValue', [ArchiveFilter.Active])
        expect(store.archiveFilter).toBe(ArchiveFilter.Active)
    })

    it('lists archived professionals, and a cleared choice is active only', () => {
        const chip = mountTopbar(SelectedModerationListView.HealthcareProfessionals)
        const store = useHealthcareProfessionalsStore()

        chip?.vm.$emit('update:modelValue', [ArchiveFilter.Archived])
        expect(store.archiveFilter).toBe(ArchiveFilter.Archived)

        chip?.vm.$emit('update:modelValue', [])
        expect(store.archiveFilter).toBe(ArchiveFilter.Active)
    })
})
