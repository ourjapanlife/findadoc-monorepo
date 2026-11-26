<template>
    <PopoverRoot v-model:open="open">
        <PopoverTrigger as-child>
            <button
                type="button"
                class="inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium
                transition-colors"
                :class="isActive
                    ? 'border-primary bg-primary text-primary-text-inverted hover:bg-primary-hover'
                    : 'border-border-strong bg-primary-bg text-primary-text hover:bg-accent-bg/40'"
                :data-testid="testId"
                :data-active="isActive"
            >
                <span>{{ chipText }}</span>
                <SvgAccordionArrow
                    class="size-3 shrink-0 transition-transform"
                    :class="open ? 'rotate-180' : ''"
                    aria-hidden="true"
                />
            </button>
        </PopoverTrigger>
        <PopoverPortal>
            <PopoverContent
                align="start"
                :side-offset="6"
                class="z-70 flex min-w-64 flex-col rounded-lg border border-accent-bg bg-primary-bg py-2 shadow-overlay"
                :data-testid="`${testId}-menu`"
            >
                <fieldset class="m-0 flex flex-col border-0 p-0">
                    <legend class="sr-only">
                        {{ label }}
                    </legend>
                    <label
                        v-for="item in items"
                        :key="item.value"
                        class="flex min-h-10 cursor-pointer items-center gap-3 px-4 py-2 text-sm text-primary-text
                        hover:bg-accent-bg/40"
                    >
                        <input
                            :type="multiselect ? 'checkbox' : 'radio'"
                            :name="testId"
                            class="size-4 accent-primary"
                            :checked="isShownChecked(item.value)"
                            :disabled="isLastChecked(item.value)"
                            :data-testid="`${testId}-option-${item.value}`"
                            @change="toggle(item.value)"
                        >
                        <span class="flex-1">{{ item.label }}</span>
                        <span
                            v-if="item.count !== undefined"
                            class="min-w-6 rounded-full bg-accent-bg/60 px-1.5 py-0.5 text-center text-xs font-semibold
                            tabular-nums"
                        >{{ item.count }}</span>
                    </label>
                </fieldset>
                <div class="mt-1 border-t border-accent-bg px-2 pt-2">
                    <button
                        type="button"
                        class="btn btn-ghost btn-sm w-full"
                        :disabled="!isActive"
                        :data-testid="`${testId}-reset`"
                        @click="reset"
                    >
                        {{ t('filterChip.reset') }}
                    </button>
                </div>
            </PopoverContent>
        </PopoverPortal>
    </PopoverRoot>
</template>

<script setup lang="ts" generic="T extends string">
import { computed, ref } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useI18n } from '#imports'
import SvgAccordionArrow from '~/assets/icons/accordion-arrow.svg'
import { chipSelectionAfterToggle, isChipDefaultSelection } from '~/utils/filterChip'

/**
 * A filter chip with a dropdown (#313). The model is what is ticked. `defaultValue` is where the
 * chip starts and what Reset returns to; with none, the default is no filter. With
 * `multiselect`, a moderator ticks more options to add them. Without it, picking one option
 * filters to it. The chip is filled while the selection is not the default, so a filter left on
 * is never hard to spot.
 */
const props = withDefaults(defineProps<{
    items: { value: T, label: string, count?: number }[]
    label: string
    testId: string
    multiselect?: boolean
    defaultValue?: T[]
}>(), {
    multiselect: false,
    defaultValue: () => []
})

const selected = defineModel<T[]>({ required: true })

const { t } = useI18n()
const open = ref(false)

const isActive = computed(() => !isChipDefaultSelection(selected.value, props.defaultValue))

function isShownChecked(value: T): boolean {
    return selected.value.includes(value)
}

/** The last ticked box in a multiselect stays ticked: showing nothing is not a filter. */
function isLastChecked(value: T): boolean {
    return props.multiselect && selected.value.length === 1 && selected.value[0] === value
}

function toggle(value: T): void {
    selected.value = chipSelectionAfterToggle(
        selected.value,
        value,
        props.items.map(item => item.value),
        props.multiselect
    )
}

function reset(): void {
    selected.value = [...props.defaultValue]
    open.value = false
}

const chipText = computed(() => {
    if (selected.value.length === 0) {
        return props.label
    }
    const names = props.items.filter(item => selected.value.includes(item.value)).map(item => item.label)
    const shown = names.length <= 2 ? names.join(', ') : t('filterChip.selected', { count: names.length })
    return `${props.label}: ${shown}`
})
</script>
