<template>
    <div
        ref="rootRef"
        class="flex flex-col gap-6"
        data-testid="stepper"
    >
        <nav :aria-label="navLabel">
            <ol
                class="m-0 grid w-full list-none gap-2 p-0"
                :style="{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }"
            >
                <li
                    v-for="(step, index) in steps"
                    :key="step.key"
                    class="min-w-0"
                >
                    <button
                        type="button"
                        class="flex h-full w-full items-center justify-start gap-2 rounded-full border px-3 py-1
                            text-left text-sm transition-colors disabled:cursor-default"
                        :class="stepClass(index)"
                        :aria-current="index === currentIndex ? 'step' : undefined"
                        :disabled="!canOpen(index) || blocked"
                        :data-testid="`stepper-step-${step.key}`"
                        @click="onStepClick(index)"
                    >
                        <span
                            class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold"
                            :class="badgeClass(index)"
                        >
                            {{ index + 1 }}
                        </span>
                        <span class="min-w-0 truncate font-medium">{{ step.label }}</span>
                    </button>
                </li>
            </ol>
            <p class="mt-2 text-sm text-primary-text-muted">
                {{ progressLabel }}
            </p>
        </nav>

        <div>
            <slot
                :step="currentStep"
                :index="currentIndex"
            />
        </div>

        <div class="flex flex-col gap-3 landscape:flex-row landscape:items-center">
            <button
                v-if="!isFirst"
                type="button"
                class="btn btn-secondary"
                data-testid="stepper-previous"
                :disabled="blocked"
                @click="goTo(currentIndex - 1)"
            >
                {{ previousLabel }}
            </button>
            <div class="flex flex-col gap-3 landscape:ml-auto landscape:flex-row landscape:items-center">
                <slot name="tools" />
                <button
                    v-if="!isLast"
                    type="button"
                    class="btn btn-primary"
                    data-testid="stepper-next"
                    :disabled="blocked"
                    @click="goTo(currentIndex + 1)"
                >
                    {{ nextLabel }}
                </button>
                <slot
                    v-else
                    name="action"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { skipsUnreachedStep } from '~/utils/stepper'

export type Step = {
    key: string
    label: string
}

const props = defineProps<{
    modelValue: number
    steps: Step[]
    navLabel: string
    nextLabel: string
    previousLabel: string
    progressLabel: string
    /** When set, a forward move waits for this check on the step being left. */
    validateLeaving?: (stepKey: string) => boolean | Promise<boolean>
}>()

const emit = defineEmits<{
    'update:modelValue': [value: number]
}>()

const rootRef = ref<HTMLElement | null>(null)
const busy = ref(false)
const blocked = computed(() => busy.value)

const currentIndex = computed(() => {
    const last = Math.max(props.steps.length - 1, 0)
    return Math.min(Math.max(props.modelValue, 0), last)
})

const maxReached = ref(currentIndex.value)
watch(currentIndex, index => {
    if (index > maxReached.value) {
        maxReached.value = index
    }
})

const isFirst = computed(() => currentIndex.value === 0)
const isLast = computed(() => currentIndex.value === props.steps.length - 1)
const currentStep = computed(() => props.steps[currentIndex.value])

function canOpen(index: number): boolean {
    if (index === currentIndex.value) {
        return false
    }
    if (index < currentIndex.value) {
        return true
    }
    return !skipsUnreachedStep({
        from: currentIndex.value,
        to: index,
        maxReached: maxReached.value
    })
}

function stepClass(index: number): string {
    if (index === currentIndex.value) {
        return 'border-primary bg-primary/10 text-primary-text'
    }
    if (index <= maxReached.value) {
        return 'border-accent-bg bg-secondary-bg text-primary-text'
    }
    return 'border-accent-bg bg-primary-bg text-primary-text-muted'
}

function badgeClass(index: number): string {
    if (index === currentIndex.value) {
        return 'bg-primary text-white'
    }
    if (index <= maxReached.value) {
        return 'bg-primary/15 text-primary'
    }
    return 'bg-accent-bg text-primary-text-muted'
}

async function goTo(to: number): Promise<void> {
    if (blocked.value) {
        return
    }
    const from = currentIndex.value
    const last = Math.max(props.steps.length - 1, 0)
    const normalized = Math.min(Math.max(to, 0), last)
    if (normalized === from) {
        return
    }

    busy.value = true
    try {
        if (normalized > from) {
            if (skipsUnreachedStep({
                from,
                to: normalized,
                maxReached: maxReached.value
            })) {
                return
            }
            const step = props.steps[from]
            if (step === undefined) {
                return
            }
            if (props.validateLeaving !== undefined) {
                const allowed = await props.validateLeaving(step.key)
                if (!allowed) {
                    return
                }
            }
        }
        emit('update:modelValue', normalized)
    } finally {
        busy.value = false
    }
}

function onStepClick(index: number): void {
    void goTo(index)
}

watch(currentIndex, () => {
    rootRef.value?.scrollIntoView({ block: 'start' })
})
</script>
