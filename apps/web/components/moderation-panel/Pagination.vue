<template>
    <div
        ref="root"
        class="flex flex-wrap items-center justify-center gap-1 py-1 sm:gap-2"
    >
        <button
            :disabled="!hasPrev"
            class="flex size-9 items-center justify-center rounded-sm text-primary transition-colors
            hover:bg-accent-bg disabled:cursor-not-allowed disabled:opacity-30 sm:size-10"
            @click="goToFirstPage"
        >
            <SVGFirstPage class="size-4 text-primary" />
        </button>

        <button
            :disabled="!hasPrev"
            class="flex size-9 items-center justify-center rounded-sm text-primary transition-colors
            hover:bg-accent-bg disabled:cursor-not-allowed disabled:opacity-30 sm:size-10"
            @click="goToPrev"
        >
            <SVGLeftArrow class="size-4 text-primary" />
        </button>

        <template v-if="!compact">
            <template
                v-for="(item, index) in pages"
                :key="`${item}-${index}`"
            >
                <span
                    v-if="item === 'ellipsis'"
                    class="px-1 text-primary-text-muted"
                >…</span>
                <button
                    v-else
                    type="button"
                    class="h-9 min-w-9 rounded-sm px-2 text-sm"
                    :class="item === currentPage
                        ? 'bg-primary text-primary-inverted'
                        : 'text-primary hover:bg-accent-bg'"
                    :aria-label="t('moderationTable.page', { page: item })"
                    :aria-current="item === currentPage ? 'page' : undefined"
                    @click="goToPage(item)"
                >
                    {{ item }}
                </button>
            </template>
        </template>

        <span
            class="order-3 flex h-8 w-full items-center justify-center px-2 text-center
            text-xs text-primary-text-muted sm:order-0 sm:h-10 sm:w-auto sm:px-4 sm:text-sm"
        >
            {{ startIndex }}-{{ endIndex }} {{ $t('pagination.of') }} {{ totalItems }} {{ $t('pagination.results') }}
        </span>

        <button
            type="button"
            data-testid="mod-pagination-next"
            :disabled="!hasNext"
            class="flex size-9 items-center justify-center rounded-sm text-primary transition-colors
            hover:bg-accent-bg disabled:cursor-not-allowed disabled:opacity-30 sm:size-10"
            @click="goToNext"
        >
            <SVGRightArrow class="size-4 text-primary" />
        </button>

        <button
            :disabled="!hasNext"
            class="flex size-9 items-center justify-center rounded-sm text-primary transition-colors
            hover:bg-accent-bg disabled:cursor-not-allowed disabled:opacity-30 sm:size-10"
            @click="goToLastPage"
        >
            <SVGLastPage class="size-4 text-primary" />
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SVGLeftArrow from '~/assets/icons/left-arrow-pagination.svg'
import SVGRightArrow from '~/assets/icons/right-arrow-pagination.svg'
import SVGFirstPage from '~/assets/icons/first-page-pagination.svg'
import SVGLastPage from '~/assets/icons/last-page-pagination.svg'
import { paginationIsCompact, paginationItems } from '~/utils/moderationTable'

const props = defineProps<{
    currentOffset: number
    totalItems: number
    itemsPerPage: number
}>()

const emit = defineEmits<{
    (e: 'update:offset', value: number): void
}>()

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)
const compact = ref(false)
let widthObserver: ResizeObserver | undefined

const startIndex = computed(() => props.totalItems === 0 ? 0 : props.currentOffset + 1)
const endIndex = computed(() => Math.min(props.currentOffset + props.itemsPerPage, props.totalItems))
const pageCount = computed(() => Math.max(1, Math.ceil(props.totalItems / props.itemsPerPage)))
const currentPage = computed(() => Math.floor(props.currentOffset / props.itemsPerPage) + 1)
const pages = computed(() => paginationItems(pageCount.value, currentPage.value))

const hasPrev = computed(() => props.currentOffset > 0)
const hasNext = computed(() => props.currentOffset + props.itemsPerPage < props.totalItems)

onMounted(() => {
    if (root.value === null || typeof ResizeObserver === 'undefined') {
        return
    }
    widthObserver = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width ?? 0
        compact.value = paginationIsCompact(width)
    })
    widthObserver.observe(root.value)
})

onBeforeUnmount(() => {
    widthObserver?.disconnect()
})

function goToPage(page: number) {
    const nextOffset = (page - 1) * props.itemsPerPage
    if (nextOffset !== props.currentOffset) {
        emit('update:offset', nextOffset)
    }
}

function goToFirstPage() {
    if (hasPrev.value) {
        emit('update:offset', 0)
    }
}

function goToPrev() {
    if (hasPrev.value) {
        emit('update:offset', props.currentOffset - props.itemsPerPage)
    }
}

function goToNext() {
    if (hasNext.value) {
        emit('update:offset', props.currentOffset + props.itemsPerPage)
    }
}

function goToLastPage() {
    if (hasNext.value) {
        const lastPageOffset = Math.max(0, Math.floor((props.totalItems - 1) / props.itemsPerPage) * props.itemsPerPage)
        emit('update:offset', lastPageOffset)
    }
}
</script>
