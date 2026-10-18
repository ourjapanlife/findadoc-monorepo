<template>
    <tr
        class="border-b border-accent-bg cursor-pointer"
        :class="selected ? 'bg-primary/10' : 'hover:bg-accent-bg/30'"
        @click="openRow"
    >
        <td
            v-if="selectable"
            class="w-10 px-3 py-2"
            @click.stop
        >
            <input
                type="checkbox"
                :checked="selected"
                :aria-label="t('moderationTable.selectRow', { name: row.cells[row.linkColumn] ?? '' })"
                :data-testid="`mod-table-select-${row.id}`"
                @change="emit('toggle')"
            >
        </td>
        <td class="px-3 py-2 text-primary-text-muted tabular-nums">
            {{ rowNumber }}
        </td>
        <td
            v-for="column in columns"
            :key="column.id"
            class="px-3 py-2 text-primary-text align-top"
        >
            <NuxtLink
                v-if="column.id === row.linkColumn"
                :to="row.href"
                :data-testid="row.testId"
                class="font-semibold text-primary-text hover:underline"
                @click="emit('open')"
            >
                {{ row.cells[column.id] }}
            </NuxtLink>
            <div
                v-else-if="column.id === 'status'"
                class="flex flex-wrap gap-1"
            >
                <span
                    v-for="badge in row.badges"
                    :key="badge.label"
                    class="text-xs px-2 py-0.5 rounded-full text-primary-inverted"
                    :class="badge.className"
                >
                    {{ badge.label }}
                </span>
            </div>
            <span v-else>{{ row.cells[column.id] }}</span>
        </td>
    </tr>
</template>

<script setup lang="ts">
import type { ModerationTableColumn, ModerationTableRow } from '~/utils/moderationTable'

const props = defineProps<{
    row: ModerationTableRow
    columns: ModerationTableColumn[]
    rowNumber: number
    selectable: boolean
    selected: boolean
}>()

const emit = defineEmits<{
    toggle: []
    open: []
}>()

const { t } = useI18n()
const router = useRouter()

function openRow(event: MouseEvent) {
    const target = event.target
    if (target instanceof Element && target.closest('a, button, input, label')) {
        return
    }
    emit('open')
    router.push(props.row.href)
}
</script>
