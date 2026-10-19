<template>
    <div class="relative flex flex-col h-full w-full min-h-0">
        <div class="shrink-0 px-3 pt-3 pb-2">
            <div class="relative w-full sm:max-w-sm">
                <input
                    :value="search"
                    type="text"
                    :placeholder="t('modDashboardTopbar.placeholderText')"
                    class="pl-10 pr-3 py-2.5 w-full rounded-lg border border-accent-bg
                    bg-secondary-bg text-primary-text text-sm font-normal font-sans
                    placeholder-primary-text-muted"
                    data-testid="mod-submission-search-input"
                    @input="onSearchInput"
                >
                <SVGLookingGlass
                    role="img"
                    title="searching icon"
                    class="absolute left-3 top-3 w-4 h-4 text-primary-text-muted"
                />
            </div>
        </div>

        <div class="relative z-10 flex-1 min-h-0 overflow-auto">
            <table class="w-full text-sm border-collapse">
                <thead class="sticky top-0 z-10 bg-secondary-bg">
                    <tr class="border-b border-accent-bg text-left">
                        <th
                            v-if="selectable"
                            class="w-10 px-3 py-2"
                        >
                            <input
                                ref="pageCheckbox"
                                type="checkbox"
                                :checked="pageSelection === 'all'"
                                :aria-label="t('moderationTable.selectPage')"
                                data-testid="mod-table-select-page"
                                @change="emit('toggle-page')"
                            >
                        </th>
                        <th class="w-12 px-3 py-2 font-medium text-primary-text-muted">
                            #
                        </th>
                        <th
                            v-for="column in visibleColumns"
                            :key="column.id"
                            draggable="true"
                            class="px-3 py-2 font-medium text-primary-text"
                            @dragstart="onDragStart(column.id, $event)"
                            @dragover.prevent
                            @drop="onDrop(column.id)"
                        >
                            <span class="inline-flex items-center gap-2">
                                <span
                                    class="cursor-grab text-primary-text-muted"
                                    aria-hidden="true"
                                    :title="t('moderationTable.dragColumn', { column: column.label })"
                                >⋮⋮</span>
                                <button
                                    v-if="column.sortField"
                                    type="button"
                                    class="inline-flex items-center gap-1 hover:text-primary"
                                    :aria-label="t('moderationTable.sortBy', { column: column.label })"
                                    @click="emit('sort', column.sortField)"
                                >
                                    {{ column.label }}
                                    <span v-if="sort?.field === column.sortField">
                                        {{ sort.direction === 'asc' ? '↑' : '↓' }}
                                    </span>
                                </button>
                                <span v-else>{{ column.label }}</span>
                            </span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="rows.length === 0">
                        <td
                            :colspan="columnSpan"
                            class="px-4 py-16 text-center text-primary-text-muted"
                        >
                            <img
                                :src="emptyStateIllustration"
                                alt=""
                                width="1536"
                                height="1024"
                                loading="lazy"
                                decoding="async"
                                class="mx-auto mb-4 h-32 w-auto object-contain"
                            >
                            <p>{{ emptyLabel }}</p>
                        </td>
                    </tr>
                    <template v-else>
                        <ModListContainerItem
                            v-for="(row, index) in rows"
                            :key="row.id"
                            :row="row"
                            :columns="visibleColumns"
                            :row-number="offset + index + 1"
                            :selectable="selectable"
                            :selected="selectedIds.includes(row.id)"
                            @toggle="emit('toggle-row', row)"
                            @open="emit('open', row)"
                        />
                    </template>
                </tbody>
            </table>
        </div>

        <div class="relative z-10 shrink-0 border-t border-accent-bg bg-secondary-bg">
            <div
                v-if="selectable && (selectedNames.length > 0 || results.length > 0)"
                class="px-3 py-2 flex flex-col gap-2 border-b border-accent-bg"
                data-testid="mod-table-bulk-footer"
            >
                <p
                    v-if="selectedNames.length > 0"
                    class="text-sm text-primary-text"
                >
                    {{ t('moderationTable.selectedRows', { count: selectedNames.length, names: selectedNames.join(', ') }) }}
                </p>
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="rounded-lg border border-accent-bg bg-secondary-bg px-3 py-1.5 text-sm font-semibold
                        text-primary-text hover:bg-accent-bg/20 disabled:opacity-40"
                        data-testid="mod-bulk-approve"
                        :disabled="pending || selectedNames.length === 0"
                        @click="emit('approve')"
                    >
                        {{ t('moderationTable.approveSelected') }}
                    </button>
                    <button
                        type="button"
                        class="rounded-lg border border-accent-bg bg-secondary-bg px-3 py-1.5 text-sm font-semibold
                        text-primary-text hover:bg-accent-bg/20 disabled:opacity-40"
                        data-testid="mod-bulk-reject"
                        :disabled="pending || selectedNames.length === 0"
                        @click="emit('reject')"
                    >
                        {{ t('moderationTable.rejectSelected') }}
                    </button>
                </div>
                <p
                    v-if="pending"
                    class="text-sm text-primary-text-muted"
                >
                    {{ t('moderationTable.working') }}
                </p>
                <ul
                    v-if="results.length > 0"
                    class="text-sm text-primary-text"
                >
                    <li
                        v-for="result in results"
                        :key="result.id"
                    >
                        {{ result.text }}
                    </li>
                </ul>
            </div>
            <div class="px-3 py-2 flex flex-col md:flex-row md:items-center gap-2">
                <div class="w-full md:flex-1 flex justify-center">
                    <Pagination
                        :current-offset="offset"
                        :total-items="totalItems"
                        :items-per-page="pageSize"
                        @update:offset="emit('update:offset', $event)"
                    />
                </div>
                <div class="w-full md:w-auto flex items-center justify-center md:justify-end gap-2">
                    <label
                        for="items-per-page-select"
                        class="text-xs sm:text-sm text-primary-text-muted"
                    >{{ t('modListContainer.resultsPerPage') }}</label>
                    <select
                        id="items-per-page-select"
                        :value="pageSize"
                        class="border border-accent-bg rounded px-2 py-1 text-sm bg-secondary-bg
                        text-primary-text focus:ring-primary focus:border-primary"
                        @change="onPageSizeChange"
                    >
                        <option value="10">
                            10
                        </option>
                        <option value="25">
                            25
                        </option>
                        <option value="50">
                            50
                        </option>
                    </select>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import SVGLookingGlass from '~/assets/icons/looking-glass.svg'
import type { ListOrder, ModerationTableColumn, ModerationTableRow, PageSelection } from '~/utils/moderationTable'
import { readColumnOrder, reorderColumns, writeColumnOrder } from '~/utils/moderationTable'

const emptyStateIllustration = '/illustrations/characters-together-welcomescreen.svg'

const props = defineProps<{
    columnStorageKey: string
    columns: ModerationTableColumn[]
    rows: ModerationTableRow[]
    emptyLabel: string
    search: string
    offset: number
    totalItems: number
    pageSize: number
    sort: ListOrder | null
    selectable: boolean
    selectedIds: string[]
    selectedNames: string[]
    pageSelection: PageSelection
    pending: boolean
    results: { id: string, text: string }[]
}>()

const emit = defineEmits<{
    'update:search': [value: string]
    'update:offset': [value: number]
    'update:pageSize': [value: number]
    sort: [field: string]
    'toggle-row': [row: ModerationTableRow]
    'toggle-page': []
    open: [row: ModerationTableRow]
    approve: []
    reject: []
}>()

const { t } = useI18n()
const orderedIds = ref<string[]>([])
const pageCheckbox = ref<HTMLInputElement | null>(null)
let draggedColumnId = ''

const visibleColumns = computed(() => orderedIds.value.flatMap(id => {
    const column = props.columns.find(candidate => candidate.id === id)
    return column === undefined ? [] : [column]
}))

const columnSpan = computed(() => visibleColumns.value.length + 1 + (props.selectable ? 1 : 0))

watch(() => `${props.columnStorageKey}:${props.columns.map(column => column.id).join('|')}`, () => {
    orderedIds.value = readColumnOrder(props.columnStorageKey, props.columns.map(column => column.id))
}, { immediate: true })

watchEffect(() => {
    if (pageCheckbox.value) {
        pageCheckbox.value.indeterminate = props.pageSelection === 'some'
    }
})

function onSearchInput(event: Event) {
    emit('update:search', (event.target as HTMLInputElement).value)
}

function onPageSizeChange(event: Event) {
    emit('update:pageSize', Number((event.target as HTMLSelectElement).value))
}

function onDragStart(columnId: string, event: DragEvent) {
    draggedColumnId = columnId
    event.dataTransfer?.setData('text/plain', columnId)
}

function onDrop(targetId: string) {
    if (draggedColumnId === '') {
        return
    }
    orderedIds.value = reorderColumns(orderedIds.value, draggedColumnId, targetId)
    writeColumnOrder(props.columnStorageKey, orderedIds.value)
    draggedColumnId = ''
}
</script>
