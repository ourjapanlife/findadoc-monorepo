<template>
    <button
        type="button"
        class="group inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-full border
        border-accent-bg bg-primary-bg py-1 pr-1 pl-3 text-left transition-colors hover:border-primary/60
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :aria-label="t('modCopyId.copyLabel', { label, id })"
        :title="id"
        data-testid="mod-copy-id"
        @click="copyId"
    >
        <span class="shrink-0 text-xs font-semibold tracking-wide text-primary-text-muted uppercase">
            {{ label }}
        </span>
        <span
            class="min-w-0 truncate font-mono text-sm font-medium text-primary-text"
            data-testid="mod-copy-id-value"
        >
            {{ id }}
        </span>
        <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors"
            :class="copied
                ? 'bg-success/15 text-success'
                : 'bg-primary/10 text-primary group-hover:bg-primary/20'"
        >
            <SVGCheckMark
                v-if="copied"
                class="size-3.5"
                aria-hidden="true"
            />
            <SVGCopy
                v-else
                class="size-3.5"
                aria-hidden="true"
            />
            {{ copied ? t('modCopyId.copied') : t('modCopyId.copy') }}
        </span>
        <span
            class="sr-only"
            aria-live="polite"
        >{{ announcement }}</span>
    </button>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from '#imports'
import SVGCopy from '~/assets/icons/copy-icon.svg'
import SVGCheckMark from '~/assets/icons/check-mark.svg'
import { useAppToast } from '~/composables/useAppToast'

const props = defineProps<{
    id: string
    label: string
}>()

const COPIED_FOR_MS = 2000

const { t } = useI18n()
const toast = useAppToast()
const copied = ref(false)
// Separate from `copied`: a second copy must change the live region's text, or it is not announced again.
const announcement = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined
let announceFrame: number | undefined

function stopTimers() {
    clearTimeout(copiedTimer)
    if (announceFrame !== undefined) {
        cancelAnimationFrame(announceFrame)
        announceFrame = undefined
    }
}

/** Moderators search by id, so the record's id is one click away. */
async function copyId() {
    try {
        await navigator.clipboard.writeText(props.id)
    } catch {
        toast.error(t('modCopyId.copyFailed'))
        return
    }
    stopTimers()
    copied.value = true
    announcement.value = ''
    announceFrame = requestAnimationFrame(() => {
        announceFrame = undefined
        announcement.value = t('modCopyId.copied')
    })
    copiedTimer = setTimeout(() => {
        copied.value = false
        announcement.value = ''
    }, COPIED_FOR_MS)
}

// Another record on the same screen starts with the copy label again.
watch(() => props.id, () => {
    stopTimers()
    copied.value = false
    announcement.value = ''
})

onUnmounted(stopTimers)
</script>
