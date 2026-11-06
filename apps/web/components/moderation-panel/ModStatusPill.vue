<template>
    <span
        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold
        text-primary-text"
        :class="tone.pill"
        :data-testid="`mod-status-pill-${pill}`"
    >
        <component
            :is="tone.icon"
            class="size-3 shrink-0"
            :class="tone.iconClass"
            aria-hidden="true"
        />
        {{ t(MODERATION_PILL_LABEL_KEYS[pill]) }}
    </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgChatBubbles from '~/assets/icons/chat-bubbles.svg'
import SvgCheckMark from '~/assets/icons/check-mark.svg'
import SvgClose from '~/assets/icons/x-close-symbol.svg'
import SvgTime from '~/assets/icons/time-icon.svg'
import SvgInbox from '~/assets/icons/inbox.svg'
import { MODERATION_PILL_LABEL_KEYS, type ModerationPill } from '~/utils/moderationSubmissionStatus'

/**
 * A submission's status in moderation (#22): an icon and a word, so the color is never the only
 * signal. Feedback marks a visitor correction.
 */
const props = defineProps<{
    pill: ModerationPill
}>()

const { t } = useI18n()

// nuxt-svgo makes each icon a component. Its module declaration types the import as string.
type PillTone = { pill: string, icon: string, iconClass: string }

const TONES: Readonly<Record<ModerationPill, PillTone>> = {
    NEW: { pill: 'border-info/40 bg-info/10', icon: SvgInbox, iconClass: 'text-info' },
    UNDER_REVIEW: { pill: 'border-warning/50 bg-warning/15', icon: SvgTime, iconClass: 'stroke-warning stroke-2' },
    APPROVED: { pill: 'border-success/40 bg-success/10', icon: SvgCheckMark, iconClass: 'text-success' },
    DECLINED: { pill: 'border-error/40 bg-error/10', icon: SvgClose, iconClass: 'text-error' },
    FEEDBACK: { pill: 'border-accent/50 bg-accent/15', icon: SvgChatBubbles, iconClass: 'stroke-accent stroke-2' }
}

const tone = computed(() => TONES[props.pill])
</script>
