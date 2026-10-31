<template>
    <TooltipProvider :delay-duration="200">
        <TooltipRoot
            :open="open"
            @update:open="onOpenChange"
        >
            <TooltipTrigger as-child>
                <NuxtLink
                    v-if="to"
                    ref="triggerEl"
                    :to="to"
                    :class="triggerClass"
                    v-bind="attrs"
                    @click="onTriggerClick"
                >
                    <span
                        ref="elementRef"
                        :class="labelClass"
                    >{{ label }}</span>
                </NuxtLink>
                <button
                    v-else
                    ref="triggerEl"
                    type="button"
                    :class="triggerClass"
                    v-bind="attrs"
                    @click="onTriggerClick"
                >
                    <span
                        ref="elementRef"
                        :class="labelClass"
                    >{{ label }}</span>
                </button>
            </TooltipTrigger>
            <TooltipPortal>
                <TooltipContent
                    side="top"
                    :side-offset="6"
                    class="z-70 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-accent-bg
                    bg-secondary-bg px-3 py-2 text-sm/snug text-primary-text shadow-overlay"
                >
                    {{ label }}
                    <TooltipArrow class="fill-secondary-bg" />
                </TooltipContent>
            </TooltipPortal>
        </TooltipRoot>
    </TooltipProvider>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, watch, type ComponentPublicInstance } from 'vue'
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { useOverflowing } from '~/composables/useOverflowing'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
    label: string
    to?: string
    chipClass?: string
    bare?: boolean
}>()

const attrs = useAttrs()
const open = ref(false)
const pinned = ref(false)
const triggerEl = ref<HTMLElement | ComponentPublicInstance | null>(null)
const { elementRef, isOverflowing, checkOverflow } = useOverflowing()
let resizeObserver: ResizeObserver | undefined

const triggerClass = computed(() => props.bare
    ? 'inline-flex h-full min-w-0 max-w-full shrink items-center border-0 bg-transparent p-0 text-left font-medium text-inherit'
    : [
        'chip max-w-full min-w-0 cursor-pointer text-left',
        'portrait:h-auto portrait:min-h-11 portrait:whitespace-normal',
        props.chipClass
    ])

const labelClass = 'block min-w-0 max-w-full truncate portrait:overflow-visible portrait:whitespace-normal'

function triggerNode(): HTMLElement | null {
    const current = triggerEl.value
    if (current instanceof HTMLElement) {
        return current
    }
    if (current && '$el' in current && current.$el instanceof HTMLElement) {
        return current.$el
    }
    return null
}

function onOpenChange(next: boolean) {
    if (next) {
        checkOverflow()
        if (!isOverflowing.value) {
            open.value = false
            return
        }
    }
    if (!next && pinned.value) {
        return
    }
    open.value = next
}

function onTriggerClick() {
    checkOverflow()
    if (props.to || !isOverflowing.value) {
        return
    }
    pinned.value = !open.value
    open.value = pinned.value
}

function onDocumentPointerDown(event: Event) {
    const target = event.target
    const node = triggerNode()
    if (!(target instanceof Node) || (node && node.contains(target))) {
        return
    }
    pinned.value = false
    open.value = false
}

watch(pinned, isPinned => {
    if (isPinned) {
        document.addEventListener('pointerdown', onDocumentPointerDown)
        return
    }
    document.removeEventListener('pointerdown', onDocumentPointerDown)
})

watch(isOverflowing, overflowing => {
    if (overflowing) {
        return
    }
    pinned.value = false
    open.value = false
})

watch(() => props.label, async () => {
    await nextTick()
    checkOverflow()
})

onMounted(() => {
    checkOverflow()
    if (elementRef.value === null || typeof ResizeObserver === 'undefined') {
        return
    }
    resizeObserver = new ResizeObserver(() => checkOverflow())
    resizeObserver.observe(elementRef.value)
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>
